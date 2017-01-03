const path = require('path');
const proc = require('child_process');
const EventEmitter = require('events');

const electron = require('electron');

const { JOB_STATE, JOB_RESOLUTION, createJob, createJobResult } = require('./helpers');

const eAppPath = path.join(__dirname, 'e-app', 'e-app.js');
const emptySand = {
	url: 'about:blank',
	urlOptions: {}
};
let jobIdGenerator = 0;

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
	eApp.kill('SIGINT');
}

// ------------------ workers management ------------------

function createInitialWorkers(eApp, workersCount) {
	while(--workersCount >= 0) {
		eApp.send({
			type: 'e-app::createWorker'
		});
	}
}

function workerCreated(worker, workers) {
	workers.set(worker.workerId, worker);
}

function initWorker({ workerId }, sand, eApp) {
	eApp.send({
		type: 'e-app::initWorker',
		payload: { workerId, sand }
	});
}

function workerStateChange({ workerId, state }, workers) {
	workers.get(workerId).state = state;
}

function resetWorkers(workers, sand, eApp) {
	workers.forEach((worker) => {
		initWorker(worker, sand, eApp);
		// TODO: clear worker state from here???
	});
}

// ------------------ jobs management ---------------------

function jobCreated(job, jobs) {
	jobs.set(job.jobId, job);
}

function resetJobs(jobs, emitter) {
	for (const jobId of jobs.keys()) {
		const { task } = jobs.get(jobId);
		const jobResult = createJobResult(task, null, JOB_RESOLUTION.timeout);

		emitter.emit('solved', jobResult);
		jobs.delete(jobId);
	}
}

module.exports = function zandbak({ zandbakOptions, eAppOptions }) {
	const emitter = new EventEmitter();
	let eApp = createEAppProc(eAppOptions);

	const workers = new Map();
	const jobs = new Map();
	let sand = null;

	eApp.on('message', ({ type, payload }) => {
		console.log('zandbak::onEAppMessage type:', type, '; payload:', payload);

		switch (type) {
			case 'e-app::ready':
				return createInitialWorkers(eApp, zandbakOptions.workersCount);
			case 'e-app::workerCreated':
				return workerCreated(payload, workers, eApp, sand);
			case 'e-app::workerStateChange':
				return workerStateChange(payload, workers);
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

			resetJobs(jobs, emitter);
			resetWorkers(workers, sand, eApp);

			// TODO: how to wait for the callback
			callback(instance);
		},
		exec: (task) => {
			const job = createJob(++jobIdGenerator, task, JOB_STATE.ready);

			jobCreated(job, jobs)
		},
		destroy: () => {
			instance.off();
			destroyEAppProc(eApp);
			eApp = null;
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
