function parseLevel(level) {
    const levels = level.split(',');

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

function conditionalLog(level, levels, prefix, ...args) {
    if (levels[level]) {
        console.log(`[${Date.now()}] [${prefix}]`, ...args);
    }
}

function perfLog(level, levels, buffer, ...args) {
    if (levels[level]) {
        args.unshift(Date.now());
        buffer.push(args);
    }
}

function flush(prefix, buffer) {
    if (!buffer.length) {
        return;
    }

    const fullPrefix = `[${prefix}][perf]`;

    while (buffer.length) {
        console.log(fullPrefix, ...buffer.shift());
    }
}

module.exports = function logger(level, prefix = '') {
    const levels = parseLevel(level);
    const perfBuffer = [];

    return {
        perf: perfLog.bind(null, 'perf', levels, perfBuffer),
        flush: flush.bind(null, prefix, perfBuffer),
        error: conditionalLog.bind(null, 'error', levels, prefix),
    };
};
