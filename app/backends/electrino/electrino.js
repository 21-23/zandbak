const EventEmitter = require('events');

const contract = require('../contract');

const TYPE = 'electrino';
const LOG_PRFIX = `[${TYPE}]`;

module.exports = function electrino(options, logger) {
    const emitter = new EventEmitter();
    const instance = contract.instance(TYPE, emitter);

    logger.info(`${LOG_PRFIX} backend instance is created`);

    return instance;
};
