function parseOptions(options) {
    const levels = options.split(',');

    return levels.reduce((logOptions, levelStr) => {
        if (levelStr.startsWith('+')) {
            logOptions[levelStr.substring(1)] = true;
        } else if (levelStr.startsWith('-')) {
            logOptions[levelStr.substring(1)] = false;
        } else {
            // unknown option
        }

        return logOptions;
    }, {});
}

function conditionalLog(level, levels, ...args) {
    if (levels[level]) {
        console.log(`[${Date.now()}] [e-app]`, ...args);
    }
}

module.exports = function eAppLogger(options) {
    const levels = parseOptions(options);

    return {
        log: conditionalLog.bind(null, 'log', levels),
        warn: conditionalLog.bind(null, 'warn', levels),
        error: conditionalLog.bind(null, 'error', levels),
    };
};
