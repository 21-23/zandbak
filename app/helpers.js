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

exports.createJob = function (jobId, fillerId, task, state) {
    return {
        jobId,
        workerId: null,
        fillerId,
        task,
        state,
        timerId: null
    };
};

exports.createWorkerInstance = function (workerId, state) {
    return {
        workerId,
        state,
    };
};

exports.createFiller = function (fillerId, content, options) {
    return {
        fillerId,
        content,
        options,
    };
};

exports.UNRESPONSIVE_WORKER_ERROR = {
    error: 'unresponsive worker'
};

exports.JOB_INT_ERROR = {
    error: 'job was interrupted'
};

exports.JOB_TIMEOUT_ERROR = {
    error: 'job was timeouted'
};

exports.JOB_INTERNAL_ERROR = {
    error: 'job internal error'
};
