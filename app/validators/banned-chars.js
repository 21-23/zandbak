const symbol = Symbol('banned-chars-regex');

function getRegex(fillerOptions) {
    let regex = fillerOptions[symbol];

    if (regex) {
        return regex;
    }

    const chars = fillerOptions.bannedCharacters.join('|');

    regex = new RegExp(`(${chars})`, 'i');
    fillerOptions[symbol] = regex;

    return regex;
}

exports.validate = function bannedCharsValidate(input, filler) {
    const fillerOptions = filler.options.filler;

    if (!fillerOptions.bannedCharacters || !fillerOptions.bannedCharacters.length) {
        return null;
    }

    if (getRegex(fillerOptions).test(input)) {
        return 'Banned characters are not allowed';
    }

    return null;
};

exports.destroy = function bannedCharsDestroy() { };
