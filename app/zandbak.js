const path = require('path');
const proc = require('child_process');
const EventEmitter = require('events');

const _uniqueid = require('lodash.uniqueid');
const electron = require('electron');

const { JOB_STATE, JOB_RESOLUTION, createJob, createJobResult } = require('./helpers');

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


// ------------------ jobs management ---------------------

module.exports = function zandbak({ zandbakOptions, eAppOptions }) {
	const emitter = new EventEmitter();
	let eApp = createEAppProc(eAppOptions);

	let sand = null;

	eApp.on('message', ({ type, payload }) => {
		console.log('zandbak::onEAppMessage type:', type, '; payload:', payload);

		switch (type) {
			case 'e-app::ready':
				return;
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
		},
		destroy: () => {
			instance.off();
			eApp && destroyEAppProc(eApp);
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
