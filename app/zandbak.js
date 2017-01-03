const path = require('path');
const proc = require('child_process');
const EventEmitter = require('events');

const electron = require('electron');

const eAppPath = path.join(__dirname, 'e-app', 'e-app.js');

function createEAppProc() {
	const child = proc.spawn(
		electron,
		[eAppPath].concat(JSON.stringify({
			// options here
		})),
		{
			stdio: [null, process.stdout, process.stderrm, 'ipc']
		}
	);

	return child;
}

module.exports = function zandbak() {
	const emitter = new EventEmitter();
	let eApp = createEAppProc();

	eApp.on('message', (message) => {
		console.log('zandbak::onEAppMessage', message);
	});

	const instance = {
		resetWith: (sand, callback) => {
			callback(instance);
		},
		exec: (task) => {},
		destroy: () => {
			eApp.removeAllListeners('message');
			eApp.kill('SIGINT');
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
