"use strict";

const fs = require("fs");
const fp = require("fastify-plugin");

// database 是从 ax1/a1-database 项目仓库里复制来的代码，作者实现了一个简单的基于JSON管理的数据库
const database = require("./database");

// 包装jsondb连接，用fastify的装饰器封装到server上下文，提供给路由使用
async function fastifyJsondb(fastify, options, next) {
  var options = Object.assign(options);

  const name = options.name;
  delete options.name;

  const path = options.url;
  delete options.url;

  if (!path) {
    next(new Error("`path` parameter is mandatory"));
    return;
  }

  if (!fs.existsSync(path)) {
    next(new Error("database `path` file is not exists"));
    return;
  }

  const conn = await database.connect(path);
  fastify.addHook("onClose", () => conn.disconnect(path));

  const cfg = {
    path: path,
    session: conn,
  };

  // 可以用name参数传给register函数，注册多个db连接
  if (name) {
    if (!fastify.db) {
      fastify.decorate("db", cfg);
    }
    if (fastify.db[name]) {
      next(new Error("Connection name already registered: " + name));
      return;
    }

    fastify.db[name] = cfg;
  } else {
    if (fastify.db) {
      next(new Error("fastify-jsondb has already registered"));
      return;
    }
  }

  if (!fastify.db) {
    fastify.decorate("db", cfg);
  }

  next();
}

module.exports = fp(fastifyJsondb, {
  fastify: ">=1.0.0",
  name: "fastify-jsondb",
});
