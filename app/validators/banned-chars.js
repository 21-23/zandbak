const symbol = Symbol('banned-chars-regex');
const escapeSymbolsRegex = /[.*+?^${}()|[\]\\]/g; // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions

function getRegex(fillerOptions) {
    let regex = fillerOptions[symbol];

    if (regex) {
        return regex;
    }

    const chars = fillerOptions.bannedCharacters
        .map((char) => {
            return char.replace(escapeSymbolsRegex, '\\$&');
        })
        .join('|');

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
