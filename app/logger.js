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

function actualLog(level, args) {
    console[level](...args);
}

function conditionalLog(level, levels, prefix, ...args) {
    if (levels[level]) {
        args.unshift(`[${Date.now()}]`, prefix);
        actualLog(level, args);
    }
}

module.exports = function logger(prefix, options) {
    const levels = parseOptions(options);
    const perfLogsStore = [];

    return {
        log: conditionalLog.bind(null, 'log', levels, prefix),
        warn: conditionalLog.bind(null, 'warn', levels, prefix),
        error: conditionalLog.bind(null, 'error', levels, prefix),
        perf: (...args) => {
            if (levels['perf']) {
                args.unshift(`[${Date.now()}]`, prefix);
                perfLogsStore.push(args);
            }
        },
        flush: () => {
            perfLogsStore.forEach(actualLog.bind(null, 'log'));
            perfLogsStore.length = 0;
        }
    };
};
