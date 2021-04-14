/* eslint-disable func-names */
/* eslint-disable no-unused-vars */

module.exports = async function (fastify, options) {
  fastify.get('/', async (request, reply) => 'It Works!');
};
