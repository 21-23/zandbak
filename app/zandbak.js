const EventEmitter = require('events');

const _uniqueid = require('lodash.uniqueid');

const createLogger = require('./logger');
const { JOB_STATE, WORKER_STATE, JOB_INT_ERROR, JOB_TIMEOUT_ERROR, createJob, createWorkerInstance, createFiller, serializePath, hrtimeToMs } = require('./helpers');
const contract = require('./backends/contract');

const emptyFiller = createFiller('filler-empty', null, { sandbox: { reloadWorkers: true }, filler: {} });


function createBackend({ type, options }, logger) {
    // require backend lazily to avoid redundand memory usage
    const backendPath = `./backends/${type}/${type}`;
    const backend = require(backendPath);

    return backend(options, logger);
}

function destroyBackend(eApp) {
    eApp
        .off('message')
        .off('error');

    eApp.destroy();
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

function validate(input, filler, validators) {
    let error = null;
    let counter = 0;
    const validatorsCount = validators.length;

    while (counter < validatorsCount) {
        error = validators[counter].validate(input, filler);

        if (error) {
            // if there's an error from validator - break the loop and return the error
            break;
        }

        counter++;
    }

    return error;
}

// ====================== Jobs =========================

function executeJob(job, worker, state) {
    const { backend, filler, logger } = state;

    job.workerPath = worker.path;
    job.state = JOB_STATE.inProgress;

    if (filler.options.sandbox.taskTimeoutMs) {
        job.timerId = setTimeout(() => {
            onJobTimeout(job, worker, state);
        }, filler.options.sandbox.taskTimeoutMs);
    }

    logger.perf('Task waiting time:', hrtimeToMs(process.hrtime(job.hrtime)), 'ms');

    worker.state = WORKER_STATE.busy;
    backend.send({
        type: contract.commands.EXEC,
        payload: {
            path: worker.path,
            jobId: job.jobId,
            fillerId: filler.fillerId,
            task: job.task,
            // error: undefined     <-- ninja property filled by sand
            // result: {}           <-- ninja property filled by sand
            // correct: ''          <-- ninja property filled by sand
        }
    });
}

function tryExecuteJob(state, preferredWorker) {
    const { jobs, workers } = state;

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

    executeJob(pendingJob, readyWorker, state);
}

// ====================== Workers ======================

function createWorkers(amount, options, { backend }) {
    let counter = 0;

    while (++counter <= amount) {
        backend.send({
            type: contract.commands.CREATE_WORKER,
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

function onWorkerEmpty(path, { backend, filler, workers }) {
    let worker = getWorker(workers, path);

    if (!worker) {
        worker = createWorkerInstance(path, WORKER_STATE.empty);
        setWorker(workers, worker);
    }

    worker.state = WORKER_STATE.filling;
    backend.send({
        type: contract.commands.FILL_WORKER,
        payload: {
            path,
            content: filler.content,
            fillerId: filler.fillerId,
            options: filler.options.sandbox,
        }
    });
}

function onWorkerReady(path, workerFillerId, state) {
    const { backend, filler, workers } = state;
    const worker = getWorker(workers, path);

    if (workerFillerId !== filler.fillerId) {
        worker.state = WORKER_STATE.filling;
        return backend.send({
            type: contract.commands.FILL_WORKER,
            payload: {
                path,
                content: filler.content,
                fillerId: filler.fillerId,
                options: filler.options.sandbox,
            }
        });
    }

    worker.state = WORKER_STATE.ready;
    tryExecuteJob(state, worker);
}

function onWorkerStateChange(payload, state) {
    switch (payload.state) {
        case WORKER_STATE.empty:
            return onWorkerEmpty(payload.path, state);
        case WORKER_STATE.ready:
            return onWorkerReady(payload.path, payload.fillerId, state);
        default:
            return state.logger.error('Invalid worker state', payload.state);
    }
}

// ====================== Job handling ======================

function onJobDone(payload, state) {
    const { backend, emitter, filler, jobs, logger, workers } = state;
    const invalidFiller = payload.fillerId !== filler.fillerId;

    // if filter is invalid - we are no longer interested in the solution
    if (!invalidFiller) {
        emitter.emit('solved', {
            task: payload.task,
            error: payload.error,
            result: payload.result,
            correct: payload.correct
        });
    }

    const job = jobs.get(payload.jobId);
    const worker = getWorker(workers, payload.path);


    if (job) {
        // job may not exist if it was interrupted (e.g. by time out or resetWith) in the middle of execution
        clearTimeout(job.timerId);
        jobs.delete(job.jobId);
        logger.perf('Task full time:', hrtimeToMs(process.hrtime(job.hrtime)), 'ms');
    }

    if (filler.options.sandbox.reloadWorkers) {
        worker.state = WORKER_STATE.creating;
        return backend.send({
            type: contract.commands.RELOAD_WORKER,
            payload: {
                path: worker.path,
            }
        });
    }

    if (invalidFiller || filler.options.sandbox.refillWorkers) {
        worker.state = WORKER_STATE.filling;
        return backend.send({
            type: contract.commands.FILL_WORKER,
            payload: {
                path: worker.path,
                content: filler.content,
                fillerId: filler.fillerId,
                options: filler.options.sandbox,
            }
        });
    }

    // if there is no need to clean up worker (neither reload nor refill)
    // use it immediately
    worker.state = WORKER_STATE.ready;
    tryExecuteJob(state, worker);
}

function onJobTimeout(job, worker, { backend, emitter, jobs, logger }) {
    emitter.emit('solved', { task: job.task, error: JOB_TIMEOUT_ERROR });

    clearTimeout(job.timerId);
    jobs.delete(job.jobId);

    logger.perf('Task full time:', hrtimeToMs(process.hrtime(job.hrtime)), 'ms');

    worker.state = WORKER_STATE.creating;
    backend.send({
        type: contract.commands.RELOAD_WORKER,
        payload: {
            path: worker.path,
        }
    });
}

// ====================== Zandbak state handling ======================

function resetWith({ backend, emitter, jobs, logger, workers }) {
    jobs.forEach((job) => {
        emitter.emit('solved', { task: job.task, error: JOB_INT_ERROR });

        logger.perf('Task full time:', hrtimeToMs(process.hrtime(job.hrtime)), 'ms');

        clearTimeout(job.timerId);
    });
    jobs.clear();

    workers.forEach((worker) => {
        worker.state = WORKER_STATE.creating;
        backend.send({
            type: contract.commands.RELOAD_WORKER,
            payload: {
                path: worker.path,
            }
        });
    });
}

module.exports = function zandbak(options, backendOptions) {
    const logger = createLogger(options.logLevel, 'zandbak');
    const state = {
        backend: createBackend(backendOptions, logger),
        emitter: new EventEmitter(),
        filler: emptyFiller,
        jobs: new Map(),
        logger,
        workers: new Map(),
    };
    const { emitter } = state;

    let validators = createValidators(options.validators);

    const instance = {
        resetWith: (newFiller) => {
            if (newFiller) {
                state.filler = createFiller(_uniqueid('filler-'), newFiller.content, newFiller.options);
            } else {
                state.filler = emptyFiller;
            }

            resetWith(state);

            logger.flush();

            state.backend.send({
                type: contract.commands.FLUSH,
                payload: {}
            });

            return instance;
        },
        exec: (task) => {
            // TODO: if filler is "emptyFiller" - shall we immediately emit "solved"?
            const validationError = validate(task.input, state.filler, validators);

            if (validationError) {
                emitter.emit('solved', { task, error: validationError });
                logger.perf('Task validation error');

                return instance;
            }

            const job = createJob(_uniqueid('job-'), state.filler.fillerId, task, JOB_STATE.pending);

            state.jobs.set(job.jobId, job);

            tryExecuteJob(state, null);

            return instance;
        },
        destroy: () => {
            logger.flush();

            if (state.backend) {
                destroyBackend(state.backend);
                state.backend = null;
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

    state.backend
        .on('message', (message) => {
            switch (message.type) {
                case contract.messages.READY:
                    return createWorkers(options.workers.count, options.workers.options, state);
                case contract.messages.WORKER_STATE:
                    return onWorkerStateChange(message.payload, state);
                case contract.messages.DONE:
                    return onJobDone(message.payload, state);
                default:
                    logger.error('Unknown message from e-app', message);
            }
        }).on('error', (error) => {
            logger.error('Error in backend app', error);
            emitter.emit('error', error);
        });

    process.on('uncaughtException', (error) => {
        // TODO: emit error and force ZS to re-create zandbak
        logger.error('uncaughtException:', error);
        instance.destroy();
    });

    logger.info('zandbak instance is created');

    return instance;
};
