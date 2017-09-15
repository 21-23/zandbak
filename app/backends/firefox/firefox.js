const contract = require('../contract');

const TYPE = 'firefox';

module.exports = function firefox(options, logger) {
    const instance = contract.instance(TYPE);

    return instance;
};
