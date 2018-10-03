const { parse } = require('acorn');

const parseOptions = {
    allowReturnOutsideFunction: true,
};

exports.validate = function acornValidate(input) {
    try {
        parse(input, parseOptions);
        return null;
    } catch (e) {
        return e.description || e.message || (e + '');
    }
};

exports.destroy = function acornDestroy() { };
