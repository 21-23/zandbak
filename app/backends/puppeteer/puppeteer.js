const EventEmitter = require('events');

const contract = require('../contract');

const TYPE = 'puppeteer';
const LOG_PRFIX = `[${TYPE}]`;

module.exports = function puppeteer(options, logger) {
    const emitter = new EventEmitter();
    const instance = contract.instance(TYPE, emitter);

    logger.info(`${LOG_PRFIX} backend instance is created`);

    return instance;
};
