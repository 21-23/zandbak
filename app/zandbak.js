const path = require('path');
const proc = require('child_process');
const EventEmitter = require('events');

const _uniqueid = require('lodash.uniqueid');
const electron = require('electron');

const { JOB_STATE, JOB_RESOLUTION, createJob } = require('./helpers');

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

function getReadyWorker(workers) {

}

function initWorker() {

}

function onWorkerStateChange({ workerId, state }) {

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

function execJob(job, worker, eApp) {
    job.workerId = worker.workerId;
    job.state = JOB_STATE.inProgress;

    eApp.send({
        type: 'e-app::loadWorker',
        payload: { workerId: job.workerId, task: job.task }
    });
}

function tryExecJob(jobs, workers, eApp) {
    const job = getReadyJob(jobs);

    if (!job) {
        console.log('no ready jobs');
        return null;
    }

    const worker = getReadyWorker(workers);

    if (!worker) {
        console.log('no ready workers');
        return null;
    }

    execJob(job, worker, eApp);
}

function onSolved({ workerId, result }, jobs, emitter, sand, eApp) {
    const job = getJobByWorkerId(jobs, workerId);

    if (!job) {
        return console.warn('task solved for unknown job', result);
    }

    emitter.emit('solved', job.task, result);

    removeJob(jobs, job);
    initWorker(workerId, sand, eApp);
}


module.exports = function zandbak({ zandbakOptions, eAppOptions }) {
    const emitter = new EventEmitter();
    let eApp = createEAppProc(eAppOptions);

    let sand = null;
    const jobs = [];
    const workers = [];

    eApp.on('message', ({ type, payload }) => {
        console.log('zandbak::onEAppMessage type:', type, '; payload:', payload);

        switch (type) {
            case 'e-app::ready':
                return;
            case 'e-app::workerStateChange':
                return onWorkerStateChange(payload);
            case 'e-app::taskSolved':
                return onSolved(payload, jobs, emitter, sand, eApp);
            default:
                return console.log('Unknown message from e-app');
        }
    });

    process.on('uncaughtException', (e) => {
        console.log('uncaughtException:', e);
        instance.destroy();
    });

    const instance = {
        resetWith: (newSand, callback) => {
            sand = newSand || emptySand;

            callback(instance);
        },
        exec: (task) => {
            const job = createJob(_uniqueid('jobId'), task, JOB_STATE.ready);

            jobs.push(job);

            tryExecJob(jobs, workers, eApp);
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
