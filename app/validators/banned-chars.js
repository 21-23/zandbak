function getRegex(filler) {
    let regex = filler.options[Symbol.for('banned-chars-regex')];

    if (regex) {
        return regex;
    }

    const chars = filler.options.banned.join('|');

    regex = new RegExp(`(${chars})`, 'i');
    filler.options[Symbol.for('banned-chars-regex')] = regex;

    return regex;
}

exports.validate = function bannedCharsValidate(input, filler) {
    if (!filler.options.banned) {
        return null;
    }

    if (getRegex(filler).test(input)) {
        return 'Banned characters are not allowed';
    }

    return null;
};

exports.destroy = function bannedCharsDestroy() { };
