/* eslint-disable import/no-unresolved */
/* eslint-disable no-console */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-param-reassign */

// 在 ax1/a1-database 库的基础上修复了一些bug
// extend库是jQuery的extend()方法移植到NodeJS上的实现，支持对象的递归深度拷贝
const extend = require('extend');

const fs = require('fs/promises');
const path = require('path');

const dbs = [];

async function clone(el) {
  return JSON.parse(JSON.stringify(el));
}

async function sleep(millis) {
  return new Promise((resolve) => setTimeout(resolve, millis));
}

/**
 * Format row. Note: to allow also parsing raw JSON lines (historical data files,logs,etc),
 * the 'save' action is removed
 */
function toText(action, json) {
  const prefix = action === 'delete' ? `${action}|` : '';
  const text = json.charAt ? json : JSON.stringify(json);
  return `${prefix}${text}\n`;
}

class Db {
  constructor(filePath) {
    this._rows = []; // the array[objects] representing the database in the RAM
    this._map = new Map();
    this._filePath = filePath;
    this._file = null;
    this._counter = 0;
    this._lock = false;
  }

  async _destroy() {
    await this._compactDB();
    await this._file.close();
  }

  async load() {
    await this._loadFile();
    await this._compactDB();
  }

  async find(filter) {
    const search = this._rows.filter(filter);
    const result = await clone(search);
    return result;
  }

  /**
   * Insert an item o array of items.
   * If items have `id` property, and the id is already in database,
   * this method will throw an error.
   * Use `save()` method if you want to use insert/update (upsert)
   * @param {Array|Object} arr the object or the array of objects to be stored
   * @returns {number} the net number of items added
   */
  async insert(arr) {
    if (!Array.isArray(arr)) arr = [arr];

    arr.forEach((el) => {
      if (el.id != null && this._rows.find((row) => el.id === row.id)) {
        throw Error(`Duplicated id: ${el.id}`);
      }
    });

    const result = await this._save(arr);
    return result;
  }

  /**
   * Insert an item. if item has id, and existing in database, the item is updated
   * @param {Array|Object} arr the object or the array of objects to be stored
   * @returns {number} the net number of items added
   */
  async upsert(arr) {
    if (!Array.isArray(arr)) arr = [arr];

    const ids = arr.filter((el) => el.id != null).map((el) => el.id);
    const filter = ids.length > 0 ? (el) => ids.includes(el.id) : undefined;

    const result = await this._save(arr, filter);
    return result;
  }

  /**
   * Update an item. if item has id, and does not exists in database, an error is thrown
   * @param {Array|Object} arr the object or the array of objects to be stored
   * @returns {number} the net number of items added
   */
  async update(arr, filter) {
    if (!Array.isArray(arr)) arr = [arr];

    if (!filter) {
      const ids = arr.filter((el) => el.id != null).map((el) => el.id);
      ids.forEach((id) => {
        if (this._rows.find((row) => id === row.id) === undefined) {
          throw Error(`id: ${id} is not in database. Use insert, or upsert instead.`);
        }
      });
      filter = (el) => ids.includes(el.id);
    }

    const result = await this._save(arr, filter);

    return result;
  }

  /**
   * Save an item or an array of items into the database.
   * Filter is optional .This is similar to a SQL UPSERT operation
   * @param {Array|Object} arr the object or the array of objects to be stored
   * @param {Function} filter? Elements to be deleted
   * @returns {number} the net number of items added - items deleted
   */
  async save(arr, filter) {
    // if own filter, use it
    const result = filter ? await this._save(arr, filter) : await this.upsert(arr);
    return result;
  }

  /**
   * Internal save function. No inferred filter is created.
   * @param {*} arr
   * @param {*} filter
   */
  async _save(arr, filter) {
    this._counter += 1;
    // clone because arr could change when this async function is waiting for persist event
    let _arr = clone(arr);
    if (!Array.isArray(arr)) _arr = [arr];

    if (this._mustCompact()) await this._compactDB();

    // excute sync operations (next entries to this method will have the latest _rows)
    let countDeleted = 0;
    let oldRows = [];
    let selected = [];
    const newRows = [];

    if (filter) {
      oldRows = this._rows.filter(filter);
      countDeleted = oldRows.length;
      oldRows.forEach((el) => {
        const index = this._rows.indexOf(el);
        this._rows.splice(index, 1);
      });
      selected = _arr.filter(filter);
    }

    extend(true, newRows, oldRows);
    extend(true, newRows, selected);

    newRows.forEach((el) => this._rows.push(el));

    // execute async operations
    let p1 = [];
    let p2 = [];
    let p3 = [];
    if (countDeleted > 0 && selected.length > 0) {
      p1 = oldRows.map((el) => this._persist('delete', el));
    }

    if (countDeleted === 0 || newRows.length === oldRows.length) {
      p2 = newRows.map((el) => this._persist('save', el));
    }

    if (selected.length > 0 && _arr.length > selected.length) {
      selected.forEach((el) => {
        const index = _arr.indexOf(el);
        _arr.splice(index, 1);
      });

      _arr.forEach((el) => {
        newRows.push(el);
        this._rows.push(el);
      });

      p2 = newRows.filter(filter).map((el) => this._persist('save', el));

      p3 = _arr.map((el) => this._persist('save', el));
    }

    await Promise.all([...p1, ...p2, ...p3]);
    return _arr.length - countDeleted;
  }

  async delete(filter) {
    this._counter += 1;
    if (this._mustCompact()) await this._compactDB();

    const arr = this._rows.filter(filter);
    arr.forEach((el) => {
      const index = this._rows.indexOf(el);
      if (index >= 0) this._rows.splice(index, 1);
    });
    await Promise.all([arr.map((el) => this._persist('delete', el))]);
    return arr.length;
  }

  async _persist(action, json) {
    // stop the world while the database is still writing or compacting,
    // but set a timeout to warn when the persist time is too long

    /* DISABLE TO SEE if corruption problems are in this phase
    (ie: two persist at the same time or similar)
    let t1 = null //note: do not init time here to speedup the function
    while (this._lock) {
      if (!t1) t1 = Date.now()
      await sleep(100)
      if (Date.now() - t1 > 10000) {
        throw Error('a1-database: CRITICAL developer error or the file database is too big.
        The db was locked (compacting) for more than 10 seconds
        while a persist operation was requested')
      }
    }
    */
    while (this._lock) {
      sleep(1000);
    }
    await this._file.write(toText(action, json));
  }

  async _loadFile() {
    if (this._file) await this._file.close();

    let content = '';

    // access file
    try {
      content = await fs.readFile(this._filePath, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        try {
          await fs.mkdir(path.dirname(this._filePath));
        } catch (e) {
          console.log('folder already exists');
        }
        await fs.writeFile(this._filePath, content);
      } else throw err;
    }

    // load content into memory
    const DEL = 'delete|';
    const arr = content.split('\n').filter((el) => el !== '');
    const set = new Set(); // first into a set to remove duplicated
    arr.forEach((el) => (el.startsWith(DEL) ? set.delete(el.substring(DEL.length)) : set.add(el)));
    set.delete('');
    set.forEach((el) => {
      const isArray = el.startsWith('[') && el.endsWith(']');
      const isObject = el.startsWith('{') && el.endsWith('}');
      const obj = isArray || isObject ? JSON.parse(el) : el;
      this._rows.push(obj);
    });

    // set the file as open
    this._file = await fs.open(this._filePath, 'a+');
  }

  /**
   * Compact the database.
   */
  async _compactDB() {
    // clean rows (remove duplicated) in the in_memory database (RAM)
    let elements = this._rows.map((el) => (el.charAt ? el : JSON.stringify(el)));
    const set = new Set(elements);
    elements = [...set];
    const content = elements.reduce((acc, el) => `${acc}${el}\n`, '');

    // create a backup file before compacting
    await fs.writeFile(`${this._filePath}.bak.db`, content);

    // replace the database with clean content
    try {
      this._lock = true;
      if (this._file) await this._file.close();

      await fs.writeFile(this._filePath, content);
      this._file = await fs.open(this._filePath, 'a+');
      this._counter = 0;
      // everythingok, remove bak file
      fs.unlink(`${this._filePath}.bak.db`);
    } finally {
      this._lock = false;
    }
  }

  _mustCompact() {
    if (this._lock) return false;

    return this.counter === 0 || this._counter > 10000;
  }
}

/**
 * Connect to a database
 * @param {String} filePath absolute or relative path to db. If not exists, create file
 * @returns {Db}
 */
async function connect(filePath) {
  let db = dbs[filePath];
  if (!db) {
    const realPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    db = new Db(realPath);
    await db.load();
  } else if (db.isOpen) {
    throw new Error(`database ${filePath} is already open`);
  }
  return db;
}

async function disconnect(db) {
  const pos = dbs.indexOf(db._filePath);
  dbs.splice(pos, 1);
  await db._destroy();
  db = null;
}

module.exports = {
  connect,
  disconnect,
};
