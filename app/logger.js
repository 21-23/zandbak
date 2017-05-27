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
        console.log(`[${Date.now()}] [zandbak]`, ...args);
    }
}

function perfLog(level, levels, buffer, ...args) {
    if (levels[level]) {
        args.unshift(Date.now());
        buffer.push(args);
    }
}

function flush(buffer) {
    if (!buffer.length) {
        return;
    }

    while (buffer.length) {
        console.log('[zandbak][perf]', ...buffer.shift());
    }
}

module.exports = function logger(options) {
    const levels = parseOptions(options);
    const perfBuffer = [];

    return {
        perf: perfLog.bind(null, 'perf', levels, perfBuffer),
        flush: flush.bind(null, perfBuffer),
        error: conditionalLog.bind(null, 'error', levels),
    };
};
