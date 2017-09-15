const contract = require('../contract');

const TYPE = 'puppeteer';

module.exports = function puppeteer(options, logger) {
    const instance = contract.instance(TYPE);

    return instance;
};
