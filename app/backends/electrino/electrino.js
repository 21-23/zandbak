const EventEmitter = require('events');

const contract = require('../contract');

const TYPE = 'electrino';

module.exports = function electrino(options, logger) {
    const emitter = new EventEmitter();
    const instance = contract.instance(TYPE, emitter);

    return instance;
};
