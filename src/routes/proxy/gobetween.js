/* eslint-disable no-console */
/* eslint-disable func-names */
/* eslint-disable no-unused-vars */
/* eslint-disable no-restricted-syntax */

const net = require('net');

module.exports = async function (fastify, options) {
  const db = fastify.db.session;

  fastify.get('/gobetween', async (request, reply) => {
    db.load();

    const config = await db.find((el) => el.id === 'gobetween');
    return config[0].conf;
  });

  fastify.put('/gobetween', async (request, reply) => {
    const config = await db.find((el) => el.id === 'gobetween' && el.conf.servers instanceof Object);

    try {
      const data = JSON.parse(JSON.stringify(request.body));
      const server = data.serv_name;
      const { bind } = data;
      const backends = data.static_list;

      const servList = config[0].conf.servers;

      if (Object.keys(servList).indexOf(server) < 0) {
        return {
          code: 200,
          status: 'faild',
          msg: 'ERROR: 反向代理服务名不存在',
        };
      }

      const newConf = {};
      newConf[server] = {};

      if (bind) {
        const [addr, port] = bind.split(':');

        if (!net.isIPv4(addr)) {
          return {
            code: 200,
            status: 'faild',
            msg: 'ERROR: 监听地址格式不正确',
          };
        }

        if (port.length > 5 || !port.match(/[0-9]+/)) {
          return {
            code: 200,
            status: 'faild',
            msg: 'ERROR: 监听端口格式不正确',
          };
        }

        newConf[server].bind = bind;
      }

      if (backends && backends instanceof Array && backends.length > 0) {
        // 检查反向代理的后端地址格式
        for (const addr of backends) {
          const [serverAddr, serverPort] = addr.split(':');
          if (!net.isIPv4(serverAddr)) {
            return {
              code: 200,
              status: 'faild',
              msg: 'ERROR: 后端地址格式不正确',
            };
          }

          if (serverPort.length > 5 || !serverPort.match(/[0-9]+/)) {
            return {
              code: 200,
              status: 'faild',
              msg: 'ERROR: 后端端口格式不正确',
            };
          }
        }

        newConf[server].discovery = { static_list: backends };
      }

      db.save({ id: 'gobetween', conf: { servers: newConf } });
    } catch (err) {
      return { code: 200, status: 'faild', msg: err };
    }

    return { code: 200, status: 'success', msg: '更新配置成功' };
  });
};
