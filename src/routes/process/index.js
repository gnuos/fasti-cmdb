/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable func-names */
const { exec } = require('child_process');

async function shell(cmd) {
  exec(`${cmd}`, (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
  });
}

module.exports = async function (fastify, options) {
  fastify.post('/gobetween', async (request, reply) => {
    const data = request.body;
    let msg = {};

    if (!data.action || !(data.action instanceof String)) {
      msg = {
        code: 400,
        status: 'failed',
        msg: 'ERROR: need a action',
      };
      reply.send(msg);
    }

    switch (data.action) {
      case 'restart':
        shell('/usr/bin/supervisorctl restart portmap');
        break;
      case 'start':
        shell('/usr/bin/supervisorctl start portmap');
        break;
      default:
        msg = {
          code: 400,
          status: 'failed',
          msg: `ERROR: undefined ${data.action} action`,
        };
        reply.send(msg);
    }
  });
};
