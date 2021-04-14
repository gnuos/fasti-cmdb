/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const db = require('./database');

async function saveMetadata() {
  let config = {};

  fs.readFile(path.resolve('./gobetween.json'), 'utf-8', (err, data) => {
    if (err) {
      throw err;
    }

    const conf = JSON.parse(data);
    // 以id作为数据库的索引加载配置
    config = { id: 'gobetween', conf };
  });

  const dbPath = path.resolve('./cmdb.jdb');

  if (!fs.existsSync(dbPath)) {
    await fs.writeFile(dbPath, '', (err) => {
      if (err) throw err;
    });
  }

  const session = await db.connect(dbPath);
  await session.save(config);

  const conf = await session.find((item) => item.id === config.id);

  console.log(conf);

  await db.disconnect(session);
}

saveMetadata();
