# fasti-cmdb

fasti-cmdb 是一个用 Fastify 框架和 JSON 对象数据库实现的一个配置管理服务。这个项目的目标是解决动态获取配置文件的问题，例如很多 Golang 项目都支持动态配置负载均衡，可以从一个 URL 地址获取配置内容。InfluxDB v2 的 Telegraf 已经支持了，Gobetween 也已经支持了，还需要让这个程序支持管理目标程序存活状态，实现类似 webhook 的效果。

## 安装

首先克隆本仓库或者下载本仓库的 archive ZIP 包，确保你的电脑上面已经安装了 NodeJS 环境和 Yarn 工具，然后执行下面的命令安装相关的依赖库

```bash
cd ./fasti-cmdb
yarn install

```

## 运行

```bash
yarn start  # 启动 fastify server 运行项目，监听端口是 3000
```

## 增加功能

可以在src/server.js文件中通过注册路由函数的方式增加一些功能，比如这个项目中的 src/routes/proxy/gobetween.js 就是挂在 /proxy 路径后面的子路径的路由，通过fastify.register 函数注册路由，就可以把定义的新功能加进去了
