exports.JOB_STATE = {
    pending: 'pending',
    inProgress: 'inProgress',
    solved: 'solved', // potential state, should never happen
};

exports.JOB_RESOLUTION = {
    success: 'success',
    fail: 'fail',
};

exports.WORKER_STATE = {
    preparing: 'preparing',
    ready: 'ready',
    inProgress: 'inProgress',
};

exports.createJob = function (jobId, fillerId, task, state, hrtime = process.hrtime()) {
    return {
        jobId,
        workerId: null,
        fillerId,
        task,
        state,
        timerId: null,
        hrtime
    };
};

exports.createWorkerInstance = function (workerId, state) {
    return {
        workerId,
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

exports.hrtimeToMs = function (hrtime) {
    return ((hrtime[0] * 1e9) + hrtime[1]) / 1e6;
};

exports.UNRESPONSIVE_WORKER_ERROR = 'unresponsive';

exports.JOB_INT_ERROR = 'interrupted';

exports.JOB_TIMEOUT_ERROR = 'time out';
