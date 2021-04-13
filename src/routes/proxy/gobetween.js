const net = require("net");

module.exports = async function (fastify, options) {
  fastify.get("/gobetween", async (request, reply) => {
    const config = await fastify.db.session.find((el) => el.id === "gobetween");
    return config[0].conf;
  });

  fastify.put("/gobetween", async (request, reply) => {
    const config = await fastify.db.session.find(
      (el) => el.id === "gobetween" && el.conf.servers instanceof Object
    );

    try {
      const data = JSON.parse(JSON.stringify(request.body));
      const server = data.serv_name;
      const bind = data.bind;
      const backends = data.static_list;

      const serv_list = config[0].conf.servers;

      if (Object.keys(serv_list).indexOf(server) < 0) {
        return {
          code: 200,
          status: "faild",
          msg: "ERROR: 反向代理服务名不存在",
        };
      }

      let new_cfg = {};
      new_cfg[server] = {};

      if (bind) {
        const [addr, port] = bind.split(":");

        if (!net.isIPv4(addr)) {
          return {
            code: 200,
            status: "faild",
            msg: "ERROR: 监听地址格式不正确",
          };
        }

        if (port.length > 5 || !port.match(/[0-9]+/)) {
          return {
            code: 200,
            status: "faild",
            msg: "ERROR: 监听端口格式不正确",
          };
        }

        new_cfg[server].bind = bind;
      }

      if (backends && backends.length > 0) {
        // 检查反向代理的后端地址格式
        for (let server of backends) {
          const [b_addr, b_port] = backends.split(":");
          if (!net.isIPv4(addr)) {
            return {
              code: 200,
              status: "faild",
              msg: "ERROR: 后端地址格式不正确",
            };
          }

          if (port.length > 5 || !port.match(/[0-9]+/)) {
            return {
              code: 200,
              status: "faild",
              msg: "ERROR: 后端端口格式不正确",
            };
          }
        }

        new_cfg[server].discovery = { static_list: backends };
      }

      fastify.db.session.save({
        id: "gobetween",
        conf: { servers: new_cfg },
      });
    } catch (err) {
      console.log(err);
      return { code: 200, status: "faild", msg: err };
    }

    return { code: 200, status: "success", msg: "更新配置成功" };
  });
};
