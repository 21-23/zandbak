const path = require('path');
const proc = require('child_process');
const EventEmitter = require('events');

const _uniqueid = require('lodash.uniqueid');
const electron = require('electron');

const { JOB_STATE, WORKER_STATE, UNRESPONSIVE_WORKER_ERROR, JOB_INT_ERROR, createJob, createWorkerInstance } = require('./helpers');

const eAppPath = path.join(__dirname, 'e-app', 'e-app.js');
const emptySand = {
    url: 'about:blank',
    urlOptions: {}
};

// ------------------ e-app management --------------------

function createEAppProc(options) {
    const child = proc.spawn(
        electron,
        [eAppPath].concat(JSON.stringify(options || {})),
        {
            stdio: [null, process.stdout, process.stderrm, 'ipc']
        }
    );

    return child;
}

function destroyEAppProc(eApp) {
    eApp.removeAllListeners('message');

    // potentially, we can rely on 'e-app::destroy' but who knows...
    eApp.kill('SIGINT');
}

// ------------------ workers management ------------------

function getWorkersCount(workers) {
    return workers.length;
}

function getReadyWorker(workers) {
    return workers.find((worker) => {
        return worker.state === WORKER_STATE.ready;
    });
}

function getWorkerById(workers, workerId) {
    return workers.find((worker) => {
        return worker.workerId === workerId;
    });
}

function getWorkerPlaceholder(workers) {
    return workers.find((worker) => {
        return !worker.workerId;
    });
}

function createWorkers(workers, eApp, amount = 1) {
    let counter = 0;

    while (++counter <= amount) {
        workers.push(createWorkerInstance(null, WORKER_STATE.preparing));

        eApp.send({
            type: 'e-app::createWorker',
        });
    }
}

function initWorker(workers, workerId, sand, eApp) {
    const worker = getWorkerById(workers, workerId);

    if (!worker) {
        console.log('can not find worker to init', workerId);
    }

    worker.state = WORKER_STATE.preparing;

    eApp.send({
        type: 'e-app::initWorker',
        payload: { workerId, sand }
    });
}

function onWorkerEmpty(workers, workerId, sand, eApp) {
    const worker = getWorkerPlaceholder(workers);

    if (!worker) {
        return console.warn('can not find worker placeholders');
    }

    worker.workerId = workerId;

    initWorker(workers, workerId, sand, eApp);
}

function onWorkerReady(workers, workerId, jobs, zandbakOptions, eApp) {
    // TODO: if this ready is from another sand?
    const worker = getWorkerById(workers, workerId);

    if (!worker) {
        return console.log('unknown worker is ready;');
    }

    worker.state = WORKER_STATE.ready;

    tryExecJob(jobs, workers, zandbakOptions, eApp);
}

function onWorkerDirty(workers, workerId, jobs, zandbakOptions, sand, eApp) {
    if (zandbakOptions.reloadWorkers) {
        return initWorker(workers, workerId, sand, eApp);
    }

    onWorkerReady(workers, workerId, jobs, zandbakOptions, eApp);
}

function onWorkerUnresponsive(workers, workerId, jobs, emitter, sand, eApp) {
    // force task solving with error
    onSolved({ workerId, UNRESPONSIVE_WORKER_ERROR }, jobs, emitter);

    // force worker reload
    initWorker(workers, workerId, sand, eApp);
}

function reinitWorkers(workers, sand, eApp) {
    workers.forEach((worker) => {
        if (worker.workerId) {
            initWorker(workers, worker.workerId, sand, eApp);
        }
    });
}

function onWorkerStateChange({ workerId, state }, workers, jobs, sand, zandbakOptions, emitter, eApp) {
    console.log('WorkerStateChange; workerId:', workerId, '; state:', state);

    switch (state) {
        case 'empty':
            return onWorkerEmpty(workers, workerId, sand, eApp);
        case 'loading':
            return console.log('worker', workerId, 'is loading');
        case 'ready':
            return onWorkerReady(workers, workerId, jobs, zandbakOptions, eApp);
        case 'busy':
            return console.log('worker', workerId, 'is busy');
        case 'dirty':
            return onWorkerDirty(workers, workerId, jobs, zandbakOptions, sand, eApp);
        case 'unresponsive':
            return onWorkerUnresponsive(workers, workerId, jobs, emitter, sand, eApp);
        default:
            return console.log('unknown worker state; workerId', workerId, '; state', state);
    }
}

// ------------------ jobs management ---------------------

function getReadyJob(jobs) {
    let jobsIterator = jobs.length;

    // start loop from the end of array cause most probably 'ready' task is in the end
    while (--jobsIterator >= 0) {
        if (jobs[jobsIterator].state === JOB_STATE.ready) {
            return jobs[jobsIterator];
        }
    }

    return null;
}

function getJobByWorkerId(jobs, workerId) {
    return jobs.find((job) => {
        return job.workerId === workerId;
    });
}

function removeJob(jobs, job) {
    const jobIndex = jobs.findIndex((iJob) => {
        return iJob === job;
    });

    if (jobIndex < 0) {
        return console.warn('trying to remove unknown job', job);
    }

    jobs.splice(jobIndex, 1);
}

function addJob(jobs, job) {
    jobs.push(job);
}

function execJob(job, worker, eApp) {
    job.workerId = worker.workerId;
    job.state = JOB_STATE.inProgress;
    worker.state = WORKER_STATE.inProgress;

    eApp.send({
        type: 'e-app::loadWorker',
        payload: { workerId: job.workerId, task: job.task }
    });
}

function tryExecJob(jobs, workers, zandbakOptions, eApp) {
    const job = getReadyJob(jobs);

    if (!job) {
        console.log('no ready jobs');
        return null;
    }

    const worker = getReadyWorker(workers, zandbakOptions.maxWorkersCount, eApp);

    if (!worker) {
        console.log('no ready workers');

        if (getWorkersCount(workers) < zandbakOptions.maxWorkersCount) {
            console.log('create additional worker');
            createWorkers(workers, eApp);
        }
        return null;
    }

    execJob(job, worker, eApp);
}

function onSolved({ workerId, result }, jobs, emitter) {
    const job = getJobByWorkerId(jobs, workerId);

    if (!job) {
        return console.warn('task solved for unknown job', result);
    }

    emitter.emit('solved', job.task, result);
    removeJob(jobs, job);
}

function interruptJobs(jobs, emitter) {
    while (jobs.length > 0) {
        const job = jobs[0];

        emitter.emit('solved', job.task, JOB_INT_ERROR);
        removeJob(jobs, job);
    }
}


module.exports = function zandbak({ zandbakOptions, eAppOptions }) {
    const emitter = new EventEmitter();
    let eApp = createEAppProc(eAppOptions);
    let isEAppReady = false; // TODO: workaround?

    let sand = emptySand;
    const jobs = [];
    const workers = [];

    eApp.on('message', ({ type, payload }) => {
        console.log('zandbak::onEAppMessage type:', type, '; payload:', payload);

        switch (type) {
            case 'e-app::ready':
                isEAppReady = true;
                return createWorkers(workers, eApp, zandbakOptions.workersCount);
            case 'e-app::workerStateChange':
                return onWorkerStateChange(payload, workers, jobs, sand, zandbakOptions, emitter, eApp);
            case 'e-app::taskSolved':
                return onSolved(payload, jobs, emitter);
            default:
                return console.log('Unknown message from e-app');
        }
    });

    process.on('uncaughtException', (e) => {
        console.log('uncaughtException:', e);
        instance.destroy();
    });

    const instance = {
        resetWith: (newSand) => {
            sand = newSand || emptySand;

            interruptJobs(jobs, emitter);
            reinitWorkers(workers, sand, eApp);
        },
        exec: (task) => {
            const job = createJob(_uniqueid('jobId'), task, JOB_STATE.ready);

            addJob(jobs, job);

            if (isEAppReady) {
                tryExecJob(jobs, workers, zandbakOptions, eApp);
            }
        },
        destroy: () => {
            instance.off();
            if (eApp) {
                destroyEAppProc(eApp);
                eApp = null;
            }
        },
        on: (eventName, listener) => {
            return emitter.addListener(eventName, listener);
        },
        off: (eventName, listener) => {
            if (listener) {
                return emitter.removeListener(eventName, listener);
            }

            return emitter.removeAllListeners(eventName);
        }
    };

    return instance;
};
