const contract = require('../contract');

const TYPE = 'electron';

module.exports = function electron(options, logger) {
    const instance = contract.instance(TYPE);

    return instance;
};
