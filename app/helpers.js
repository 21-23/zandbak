exports.JOB_STATE = {
    pending: 'pending',
    inProgress: 'inProgress',
    solved: 'solved', // potential state, should never happen
};

exports.WORKER_STATE = {
    creating: 'creating',
    empty: 'empty',
    filling: 'filling',
    ready: 'ready',
    busy: 'busy',
    dirty: 'dirty',
};

exports.createJob = function (jobId, fillerId, task, state, hrtime = process.hrtime()) {
    return {
        jobId,
        workerPath: null,
        fillerId,
        task,
        state,
        timerId: null,
        hrtime
    };
};

exports.createWorkerInstance = function (path, state) {
    return {
        path,
        state,
        hrtime: null
    };
};

exports.createFiller = function (fillerId, content, options) {
    return {
        fillerId,
        content,
        options,
    };
};

exports.serializePath = function (path) {
    return path.join('->');
};

exports.hrtimeToMs = function (hrtime) {
    return ((hrtime[0] * 1e9) + hrtime[1]) / 1e6;
};

exports.JOB_INT_ERROR = 'Interrupted';

exports.JOB_TIMEOUT_ERROR = 'Time out';
