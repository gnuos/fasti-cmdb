/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */

const fs = require('fs');
const fp = require('fastify-plugin');

// database 是从 ax1/a1-database 项目仓库里复制来的代码，作者实现了一个简单的基于JSON管理的数据库
const database = require('./database');

// 包装jsondb连接，用fastify的装饰器封装到server上下文，提供给路由使用
async function fastifyJsondb(fastify, options, next) {
  const _options = { ...options };

  const _name = _options.name;
  const path = _options.url;

  if (!path) {
    next(new Error('`path` parameter is mandatory'));
    return;
  }

  if (!fs.existsSync(path)) {
    next(new Error('database `path` file is not exists'));
    return;
  }

  const conn = await database.connect(path);

  const cfg = { session: conn };

  // 可以用name参数传给register函数，注册多个db连接
  if (_name) {
    if (!fastify.db) {
      fastify.decorate('db', cfg);
    }

    if (fastify.db[_name]) {
      next(new Error(`Connection name already registered: ${_name}`));
      return;
    }

    fastify.db[_name] = cfg;
  }

  if (fastify.db) {
    next(new Error('fastify-jsondb has already registered'));
  }

  if (!fastify.db) {
    fastify.decorate('db', cfg);
  }

  next();
}

module.exports = fp(fastifyJsondb, {
  fastify: '>=1.0.0',
  name: 'fastify-jsondb',
});
