const contract = require('../contract');

const TYPE = 'electrino';

module.exports = function electrino(options, logger) {
    const instance = contract.instance(TYPE);

    return instance;
};
