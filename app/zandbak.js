const path = require('path');
const proc = require('child_process');
const EventEmitter = require('events');

const electron = require('electron');

const eAppPath = path.join(__dirname, 'e-app', 'e-app.js');

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

module.exports = function zandbak({ zandbakOptions, eAppOptions }) {
	const emitter = new EventEmitter();
	let eApp = createEAppProc(eAppOptions);

	eApp.on('message', (message) => {
		console.log('zandbak::onEAppMessage', message);
	});

	const instance = {
		resetWith: (sand, callback) => {
			callback(instance);
		},
		exec: (task) => {},
		destroy: () => {
			instance.off();
			destroyEAppProc(eApp)
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
