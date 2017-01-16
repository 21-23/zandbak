const path = require('path');
const proc = require('child_process');
const EventEmitter = require('events');

const _uniqueid = require('lodash.uniqueid');
const electron = require('electron');

const logger = require('./logger');

const { JOB_STATE, WORKER_STATE, UNRESPONSIVE_WORKER_ERROR, JOB_INT_ERROR, JOB_INTERNAL_ERROR, JOB_TIMEOUT_ERROR, createJob, createWorkerInstance, createFiller, hrtimeToMs } = require('./helpers');

const eAppPath = path.join(__dirname, 'e-app', 'e-app.js');
const emptyFiller = createFiller('filler-empty', null, { reloadWorkers: true });


function _createEAppProc(options) {
    const child = proc.spawn(
        electron,
        [eAppPath].concat(JSON.stringify(options || {})),
        {
            stdio: [null, process.stdout, process.stderr, 'ipc']
        }
    );

    return child;
}

function _destroyEAppProc(eApp) {
    eApp.removeAllListeners('message');

    // potentially, we can rely on 'e-app::destroy' but who knows...
    eApp.kill('SIGINT');
}


function createWorkers(workers, amount, eApp) {
    let counter = 0;

    while (++counter <= amount) {
        eApp.send({
            type: 'e-app::createWorker',
        });
    }
}

function getWorkerById(workers, workerId) {
    return workers.get(workerId);
}

function createWorker(workers, workerId, state) {
    const worker = createWorkerInstance(workerId, state);

    workers.set(workerId, worker);

    return worker;
}

function setWorkerState(workers, workerId, state) {
    let worker = getWorkerById(workers, workerId);

    if (!worker) {
        worker = createWorker(workers, workerId, state);
    } else {
        worker.state = state;
    }
}

function findReadyWorker(workers, log) {
    let result = null;

    if (workers.size === 0) {
        log.warn('no workers at all');
        return result;
    }

    for (const [, worker] of workers) {
        if (worker.state === WORKER_STATE.ready) {
            result = worker;
            break;
        }
    }

    return result;
}

function fillWorker(workerId, filler, eApp) {
    eApp.send({
        type: 'e-app::fillWorker',
        payload: {
            workerId,
            fillerId: filler.fillerId,
            filler: filler.content,
        }
    });
}

function reloadWorker(workerId, eApp) {
    eApp.send({
        type: 'e-app::reloadWorker',
        payload: { workerId }
    });
}

function resetWorkers(workers, eApp) {
    workers.forEach((worker) => {
        worker.state = WORKER_STATE.preparing;
        reloadWorker(worker.workerId, eApp);
    });
}

function onWorkerReady(jobs, workers, workerId, workerMeta, filler, zandbakOptions, emitter, eApp, log) {
    if (workerMeta.fillerId !== filler.fillerId) {
        log.warn('worker', workerId, 'ready with invalid filler', workerMeta.fillerId);
        return fillWorker(workerId, filler, eApp);
    }

    setWorkerState(workers, workerId, WORKER_STATE.ready);

    tryExecuteJob(jobs, workers, filler, zandbakOptions, emitter, eApp, log);
}

function onWorkerDirty(workers, workerId, jobs, fillerId, withError, filler, zandbakOptions, emitter, eApp, log) {
    const invalidFiller = fillerId !== filler.fillerId;

    if (filler.options.reloadWorkers || invalidFiller) {
        if (invalidFiller) {
            log.warn('worker', workerId, 'dirty with invalid filler', fillerId, 'currrent:', filler.fillerId);
        }

        return reloadWorker(workerId, eApp);
    } else if (filler.options.refillWorkers || withError) {
        return fillWorker(workerId, filler, eApp);
    }

    // it is possible that we do not want to do anything with a dirty worker
    // it is ready to take another task
    setWorkerState(workers, workerId, WORKER_STATE.ready);
    tryExecuteJob(jobs, workers, filler, zandbakOptions, emitter, eApp, log);
}

function onWorkerUnresponsive(workerId, jobs, emitter, eApp, log) {
    let job = findJobByWorkerId(jobs, workerId);

    if (job) {
        job = cleanupJob(jobs, job.jobId);

        if (job) {
            notifyTaskSolve(job.task, UNRESPONSIVE_WORKER_ERROR, null, emitter, job.hrtime, log);
        } else {
            log.warn('invalid job is unresponsive', job.jobId);
        }
    } else {
        log.warn('worker', workerId, 'is unresponsive w/o any assigned job');
    }

    reloadWorker(workerId, eApp);
}

function createInitialWorkers(workers, zandbakOptions, eApp) {
    return createWorkers(workers, zandbakOptions.workersCount, eApp);
}

function handleWorkerStateChange(payload, workers, jobs, filler, zandbakOptions, emitter, eApp, log) {
    const { workerId, state, meta } = payload;

    log.log('worker', workerId, 'is', state);

    switch (state) {
        case 'empty':
            return;
        case 'loading':
            return setWorkerState(workers, workerId, WORKER_STATE.preparing);
        case 'readyForFiller':
            return fillWorker(workerId, filler, eApp);
        case 'filling':
            return;
        case 'ready':
            return onWorkerReady(jobs, workers, workerId, meta, filler, zandbakOptions, emitter, eApp, log);
        case 'busy':
            return;
        case 'dirty':
            return;
        case 'unresponsive':
            return onWorkerUnresponsive(workerId, jobs, emitter, eApp, log);
        default:
            return log.warn('unknown worker state', workerId, state);
    }
}

function notifyTaskSolve(task, error, result, emitter, jobHrtime, log) {
    if (jobHrtime) {
        log.perf('task', task, 'resolved in', hrtimeToMs(process.hrtime(jobHrtime)), 'ms');
    }
    emitter.emit('solved', task, error, result);
}

function interruptJobs(jobs, emitter, log) {
    jobs.forEach((job) => {
        clearTimeout(job.timerId);
        notifyTaskSolve(job.task, JOB_INT_ERROR, null, emitter, job.hrtime, log);
    });
    jobs.clear();
}

function findPendingJob(jobs) {
    let result = null;

    if (jobs.size === 0) {
        return result;
    }

    for (const [, job] of jobs) {
        if (job.state === JOB_STATE.pending) {
            result = job;
            break;
        }
    }

    return result;
}

function findJobByWorkerId(jobs, workerId) {
    let result = null;

    if (jobs.size === 0) {
        return result;
    }

    for (const [, job] of jobs) {
        if (job.workerId && job.workerId === workerId) {
            result = job;
            break;
        }
    }

    return result;
}

function cleanupJob(jobs, jobId) {
    const job = jobs.get(jobId);

    if (!job) {
        return false;
    }

    clearTimeout(job.timerId);
    jobs.delete(jobId);

    return job;
}

function handleSolvedTask(error, payload, jobs, workers, filler, zandbakOptions, emitter, eApp, log) {
    const { task, jobId, workerId, fillerId } = payload;

    const job = cleanupJob(jobs, jobId);

    if (job) {
        if (error) {
            notifyTaskSolve(task, JOB_INTERNAL_ERROR, null, emitter, job.hrtime, log);
        } else {
            const result = payload.result;
            notifyTaskSolve(task, null, result, emitter, job.hrtime, log);
        }
    } else {
        log.warn('invalid job solved', jobId);
    }

    onWorkerDirty(workers, workerId, jobs, fillerId, !!error, filler, zandbakOptions, emitter, eApp, log);
}

function handleTimeoutedTask(task, jobId, workerId, jobs, emitter, eApp, log) {
    const job = cleanupJob(jobs, jobId);

    if (job) {
        notifyTaskSolve(task, JOB_TIMEOUT_ERROR, null, emitter, job.hrtime, log);
    } else {
        log.warn('invalid job timeouted', jobId);
    }

    // TODO: kill worker here as simple reload may not help (e.g. while(true) { alert(1); })
    reloadWorker(workerId, eApp);
}

function _resetWith(filler, jobs, workers, emitter, eApp, log) {
    interruptJobs(jobs, emitter, log);

    resetWorkers(workers, eApp);
}

function _exec(task, jobs, workers, filler, zandbakOptions, emitter, eApp, log) {
    const job = createJob(_uniqueid('job-'), filler.fillerId, task, JOB_STATE.pending);

    jobs.set(job.jobId, job);

    tryExecuteJob(jobs, workers, filler, zandbakOptions, emitter, eApp, log);
}

function executeJob(job, worker, jobs, filler, emitter, eApp, log) {
    job.workerId = worker.workerId;
    job.state = JOB_STATE.inProgress;

    if (filler.options.taskTimeoutMs) {
        job.timerId = setTimeout(() => {
            handleTimeoutedTask(job.task, job.jobId, job.workerId, jobs, emitter, eApp, log);
        }, filler.options.taskTimeoutMs);
    }

    worker.state = WORKER_STATE.inProgress;

    eApp.send({
        type: 'e-app::loadWorker',
        payload: {
            workerId: worker.workerId,
            jobId: job.jobId,
            fillerId: filler.fillerId,
            task: job.task,
        }
    });
}

function tryExecuteJob(jobs, workers, filler, zandbakOptions, emitter, eApp, log) {
    const job = findPendingJob(jobs);

    if (!job) {
        return log.log('No pending jobs');
    }

    const worker = findReadyWorker(workers, log);

    if (!worker) {
        log.log('No ready workers');

        if (workers.size > 0 && workers.size < zandbakOptions.maxWorkersCount) {
            // at least 1 worker was created => e-app is ready to create more
            log.log('Create additional worker');
            return createWorkers(workers, 1, eApp);
        }

        return log.log('No additional workers');
    }

    executeJob(job, worker, jobs, filler, emitter, eApp, log);
}

function _handleEAppMessage(message, jobs, workers, filler, zandbakOptions, emitter, eApp, log) {
    const { type, payload, error } = message;

    switch (type) {
        case 'e-app::ready':
            return createInitialWorkers(workers, zandbakOptions, eApp);
        case 'e-app::workerStateChange':
            return handleWorkerStateChange(payload, workers, jobs, filler, zandbakOptions, emitter, eApp, log);
        case 'e-app::taskSolved':
            return handleSolvedTask(error, payload, jobs, workers, filler, zandbakOptions, emitter, eApp, log);
        default:
            return log.warn('Unknown message from e-app');
    }
}

module.exports = function zandbak({ zandbakOptions, eAppOptions }) {
    const emitter = new EventEmitter();
    const log = logger('[zandbak]', zandbakOptions.logs);
    const jobs = new Map();
    const workers = new Map();
    let filler = emptyFiller;

    let eApp = _createEAppProc(eAppOptions);

    const instance = {
        resetWith: (newFiller) => {
            log.flush();

            if (newFiller) {
                filler = createFiller(_uniqueid('filler-'), newFiller.content, newFiller.options);
            } else {
                filler = emptyFiller;
            }

            _resetWith(filler, jobs, workers, emitter, eApp, log);

            return instance;
        },
        exec: (task) => {
            _exec(task, jobs, workers, filler, zandbakOptions, emitter, eApp, log);

            return instance;
        },
        destroy: () => {
            if (eApp) {
                _destroyEAppProc(eApp);
                eApp = null;
            }
        },
        // sugar? yes, please
        on: (eventName, listener) => {
            emitter.addListener(eventName, listener);

            return instance;
        },
        off: (eventName, listener) => {
            if (listener) {
                emitter.removeListener(eventName, listener);
            } else {
                emitter.removeAllListeners(eventName);
            }

            return instance;
        }
    };

    eApp.on('message', (message) => {
        log.log('eAppMessage message:', message);
        _handleEAppMessage(message, jobs, workers, filler, zandbakOptions, emitter, eApp, log);
    });

    process.on('uncaughtException', (e) => {
        log.error('uncaughtException:', e);
        instance.destroy();
    });

    return instance;
};
