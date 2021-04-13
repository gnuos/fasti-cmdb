const path = require("path");
const fastify = require("fastify")({
  logger: {
    prettyPrint: true,
  },
});

fastify.register(require("fastify-routes"));

// 给自己定义的插件传递object参数，可以传给包装的函数
fastify.register(require("./fastify-jsondb"), {
  url: path.resolve("./cmdb.jdb"),
});

fastify.register(require("./routes/index"));
fastify.register(require("./routes/proxy/gobetween"), { prefix: "/proxy" });

fastify.listen(3000, "0.0.0.0", (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // fastify-routes 插件是一个用于调试查看路由定义列表的一个实用工具
  console.log(fastify.routes);
});
