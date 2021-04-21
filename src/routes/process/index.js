/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable func-names */
const { spawnSync } = require('child_process');

module.exports = async function (fastify, options) {
  fastify.post('/gobetween', async (request, reply) => {
    const data = request.body;
    const cmd = '/usr/bin/supervisorctl';

    let msg = {};

    const shell = (args) => {
      const result = spawnSync(`${cmd}`, args);

      if (result.error) {
        console.log(result.error);

        msg = { code: 500, status: 'failed', msg: result.error };
        return;
      }

      if (result.stderr.constructor === String || result.stderr[0]) {
        console.log(`stderr: ${result.stderr}`);
        msg = { code: 200, status: 'failed', msg: result.stderr };
        return;
      }

      if (result.status !== undefined && result.status !== null && result.status === 0) {
        console.log(`stdout: ${result.stdout}`);
      } else {
        console.log(`status: ${result.status}`);
        console.log(`stdout: ${result.stdout}`);
        msg = { code: 200, status: 'failed', msg: `${data.action} process gobetween failed` };
      }
    };

    if (data.action === undefined || data.action === null || !(data.action.constructor === String)) {
      msg = {
        code: 400,
        status: 'failed',
        msg: 'ERROR: need a action',
      };
    } else {
      msg = { code: 200, status: 'success', msg: `${data.action} process gobetween finished` };

      switch (data.action) {
        case 'restart':
          shell(['restart', 'portmap']);
          break;
        case 'start':
          shell(['start', 'portmap']);
          break;
        default:
          msg = {
            code: 400,
            status: 'failed',
            msg: `ERROR: undefined ${data.action} action`,
          };
      }
    }

    return msg;
  });
};
