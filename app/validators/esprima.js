const { parse } = require('esprima');

exports.validate = function esprimaValidate(input) {
    try {
        parse(input);
        return null;
    } catch (e) {
        return e.description || e.message || (e + '');
    }
};

exports.destroy = function esprimaDestroy() { };
