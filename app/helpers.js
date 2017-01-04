exports.JOB_STATE = {
    ready: 'ready',
    inProgress: 'inProgress',
    solved: 'solved', // potential state, should never happen
};

exports.JOB_RESOLUTION = {
    success: 'success',
    fail: 'fail',
    timeout: 'timeout',
};

exports.createJob = function (jobId, task, state) {
    return {
        jobId,
        workerId: null,
        task,
        state,
    };
};

exports.WORKER_STATE = {
    preparing: 'preparing',
    ready: 'ready',
    inProgress: 'inProgress',
};

exports.createWorkerInstance = function (workerId, state) {
    return {
        workerId,
        state,
    };
};

exports.UNRESPONSIVE_WORKER_ERROR = {
    error: 'unresponsive worker'
};

exports.JOB_INT_ERROR = {
    error: 'job was interrupted'
};
