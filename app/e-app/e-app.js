const { app, BrowserWindow } = require('electron');

const { WORKER_STATE } = require('../helpers');

const args = JSON.parse(process.argv[2]);

function exit() {
	const windows = BrowserWindow.getAllWindows();

	windows.forEach((win) => {
		win.destroy();
	});

	process.exit(0);
}

function createWorker() {
	const win = new BrowserWindow(args.browserWindow);
	const webContents = win.webContents;

	if (args.showDevTools && args.browserWindow.show) {
		webContents.openDevTools();
	}

	webContents.on('did-finish-load', () => {
		process.send({
			type: 'e-app::workerStateChange',
			payload: { workerId: win.id, state: WORKER_STATE.ready }
		});
	});

	process.send({
		type: 'e-app::workerCreated',
		payload: { workerId: win.id, state: WORKER_STATE.empty }
	});

	return win;
}

function initWorker({ workerId, sand }) {
	const win = BrowserWindow.fromId(workerId);
	const webContents = win.webContents;

	process.send({
		type: 'e-app::workerStateChange',
		payload: { workerId, state: WORKER_STATE.empty }
	});

	webContents.loadURL(sand.url, sand.urlOptions);
}

process.on('message', ({ type, payload }) => {
	console.log('e-app::onHostMessage type:', type, '; payload', payload);

	switch (type) {
		case 'e-app::createWorker':
			return createWorker();
		case 'e-app::initWorker':
			return initWorker(payload);
	}
});

app.on('ready', () => {
	process.send({ type: 'e-app::ready', payload: {} });
});
