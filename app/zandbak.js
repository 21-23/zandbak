const path = require('path');
const proc = require('child_process');
const EventEmitter = require('events');

const _uniqueid = require('lodash.uniqueid');
const electron = require('electron');

const createLogger = require('./logger');

const { JOB_STATE, WORKER_STATE, JOB_INT_ERROR, JOB_TIMEOUT_ERROR, createJob, createWorkerInstance, createFiller, serializePath, hrtimeToMs } = require('./helpers');

const eAppPath = path.join(__dirname, 'e-app', 'e-app.js');
const emptyFiller = createFiller('filler-empty', null, { reloadWorkers: true });


function createEAppProc(options) {
    const child = proc.spawn(
        electron,
        [eAppPath].concat(JSON.stringify(options || {})),
        {
            stdio: [null, process.stdout, process.stderr, 'ipc']
        }
    );

    return child;
}

function destroyEAppProc(eApp) {
    eApp.removeAllListeners('message');

    // potentially, we can rely on 'e-app::destroy' but who knows...
    eApp.kill('SIGINT');
}

function createValidators(options) {
    const validators = [];

    if (!options) {
        return validators;
    }

    options.forEach((validatorOptions) => {
        validators.push(require(`./validators/${validatorOptions.name}`));
    });

    return validators;
}

function destroyValidators(validators) {
    validators.forEach((validator) => {
        validator.destroy();
    });
}

function validate(input, validators) {
    let error = null;
    let counter = 0;
    const validatorsCount = validators.length;

    while (counter < validatorsCount) {
        error = validators[counter].validate(input);

        if (error) {
            // if there's an error from validator - break the loop and return the error
            break;
        }

        counter++;
    }

    return error;
}

// ====================== Jobs =========================

function executeJob(job, worker, jobs, filler, emitter, eApp, logger) {
    job.workerPath = worker.path;
    job.state = JOB_STATE.inProgress;

    if (filler.options.taskTimeoutMs) {
        job.timerId = setTimeout(() => {
            onJobTimeout(job, worker, jobs, emitter, eApp);
        }, filler.options.taskTimeoutMs);
    }

    logger.perf('Task waiting time:', hrtimeToMs(process.hrtime(job.hrtime)), 'ms');

    worker.state = WORKER_STATE.busy;
    eApp.send({
        type: 'e-app:>exec',
        payload: {
            path: worker.path,
            jobId: job.jobId,
            fillerId: filler.fillerId,
            task: job.task,
            // error: undefined     <-- ninja property filled by sand
            // result: {}           <-- ninja property filled by sand
        }
    });
}

function tryExecuteJob(jobs, workers, preferredWorker, filler, emitter, eApp, logger) {
    if (jobs.size === 0) {
        return;
    }

    let pendingJob = null;

    for (const [, job] of jobs) {
        if (job.state === JOB_STATE.pending) {
            pendingJob = job;
            break;
        }
    }

    if (!pendingJob) {
        return;
    }

    let readyWorker = preferredWorker;

    if (!readyWorker) {
        if (workers.size === 0) {
            return;
        }
        for (const [, worker] of workers) {
            if (worker.state === WORKER_STATE.ready) {
                readyWorker = worker;
                break;
            }
        }
    }

    if (!readyWorker) {
        return;
    }

    executeJob(pendingJob, readyWorker, jobs, filler, emitter, eApp, logger);
}

// ====================== Workers ======================

function createWorkers(options, amount, eApp) {
    let counter = 0;

    while (++counter <= amount) {
        eApp.send({
            type: 'e-app:>create-worker',
            payload: options,
        });
    }
}

function getWorker(workers, path) {
    return workers.get(serializePath(path));
}

function setWorker(workers, worker) {
    workers.set(serializePath(worker.path), worker);
}

function onWorkerEmpty(path, workers, filler, eApp) {
    let worker = getWorker(workers, path);

    if (!worker) {
        worker = createWorkerInstance(path, WORKER_STATE.empty);
        setWorker(workers, worker);
    }

    worker.state = WORKER_STATE.filling;
    eApp.send({
        type: 'e-app:>fill-worker',
        payload: {
            path,
            content: filler.content,
            fillerId: filler.fillerId,
        }
    });
}

function onWorkerReady(path, workerFillerId, workers, jobs, filler, emitter, eApp, logger) {
    const worker = getWorker(workers, path);

    if (workerFillerId !== filler.fillerId) {
        worker.state = WORKER_STATE.filling;
        return eApp.send({
            type: 'e-app:>fill-worker',
            payload: {
                path,
                content: filler.content,
                fillerId: filler.fillerId,
            }
        });
    }

    worker.state = WORKER_STATE.ready;
    tryExecuteJob(jobs, workers, worker, filler, emitter, eApp, logger);
}

function onWorkerStateChange(payload, workers, jobs, filler, emitter, eApp, logger) {
    switch (payload.state) {
        case WORKER_STATE.empty:
            return onWorkerEmpty(payload.path, workers, filler, eApp);
        case WORKER_STATE.ready:
            return onWorkerReady(payload.path, payload.fillerId, workers, jobs, filler, emitter, eApp, logger);
        default:
            return logger.error('Invalid worker state', payload.state);
    }
}

// ====================== Job handling ======================

function onJobDone(payload, workers, jobs, filler, emitter, eApp, logger) {
    emitter.emit('solved', payload.task, payload.error, payload.result);

    const job = jobs.get(payload.jobId);
    const worker = getWorker(workers, payload.path);
    const invalidFiller = payload.fillerId !== filler.fillerId;

    clearTimeout(job.timerId);
    jobs.delete(job.jobId);

    logger.perf('Task full time:', hrtimeToMs(process.hrtime(job.hrtime)), 'ms');

    if (filler.options.reloadWorkers) {
        worker.state = WORKER_STATE.creating;
        return eApp.send({
            type: 'e-app:>reload-worker',
            payload: {
                path: worker.path,
            }
        });
    }

    if (invalidFiller || filler.options.refillWorkers) {
        worker.state = WORKER_STATE.filling;
        return eApp.send({
            type: 'e-app:>fill-worker',
            payload: {
                path: worker.path,
                content: filler.content,
                fillerId: filler.fillerId,
            }
        });
    }

    // if there is no need to clean up worker (neither reload nor refill)
    // use it immediately
    worker.state = WORKER_STATE.ready;
    tryExecuteJob(jobs, workers, worker, filler, emitter, eApp, logger);
}

function onJobTimeout(job, worker, jobs, emitter, eApp) {
    emitter.emit('solved', job.task, JOB_TIMEOUT_ERROR, null);

    clearTimeout(job.timerId);
    jobs.delete(job.jobId);

    worker.state = WORKER_STATE.creating;
    eApp.send({
        type: 'e-app:>reload-worker',
        payload: {
            path: worker.path,
        }
    });
}

// ====================== Zandbak state handling ======================

function resetWith(jobs, workers, emitter, eApp) {
    jobs.forEach((job) => {
        emitter.emit('solved', job.task, JOB_INT_ERROR, null);

        clearTimeout(job.timerId);
    });
    jobs.clear();

    workers.forEach((worker) => {
        worker.state = WORKER_STATE.creating;
        eApp.send({
            type: 'e-app:>reload-worker',
            payload: {
                path: worker.path,
            }
        });
    });
}

module.exports = function zandbak({ zandbakOptions, eAppOptions }) {
    const emitter = new EventEmitter();
    const logger = createLogger(zandbakOptions.logs);
    const jobs = new Map();
    const workers = new Map();
    let filler = emptyFiller;

    let eApp = createEAppProc(eAppOptions);
    let validators = createValidators(zandbakOptions.validators);

    const instance = {
        resetWith: (newFiller) => {
            logger.flush();

            if (newFiller) {
                filler = createFiller(_uniqueid('filler-'), newFiller.content, newFiller.options);
            } else {
                filler = emptyFiller;
            }

            resetWith(jobs, workers, emitter, eApp);

            return instance;
        },
        exec: (task) => {
            const validationError = validate(task.input, validators);

            if (validationError) {
                emitter.emit('solved', task, validationError, null);
                logger.perf('Task validation error');

                return instance;
            }

            const job = createJob(_uniqueid('job-'), filler.fillerId, task, JOB_STATE.pending);

            jobs.set(job.jobId, job);

            tryExecuteJob(jobs, workers, null, filler, emitter, eApp, logger);

            return instance;
        },
        destroy: () => {
            logger.flush();

            if (eApp) {
                destroyEAppProc(eApp);
                eApp = null;
            }
            if (validators) {
                destroyValidators(validators);
                validators = null;
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
        switch (message.type) {
            case 'e-app::ready':
                return createWorkers(zandbakOptions.workerOptions, zandbakOptions.workersCount, eApp);
            case 'e-app::wrk-state':
                return onWorkerStateChange(message.payload, workers, jobs, filler, emitter, eApp, logger);
            case 'e-app::done':
                return onJobDone(message.payload, workers, jobs, filler, emitter, eApp, logger);
            default:
                logger.error('Unknown message from e-app', message);
        }
    });

    eApp.on('error', (error) => {
        logger.error('Error in electron app', error);
        emitter.emit('error', error);
    });

    process.on('uncaughtException', (error) => {
        logger.error('uncaughtException:', error);
        instance.destroy();
    });

    return instance;
};
