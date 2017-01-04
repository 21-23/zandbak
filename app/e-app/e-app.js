/*
 * Task lifecycle:
 *
 * createWorker     initWorker                                  loadWorker                                 initWorker
 *     |                |                did-finish-load            |               worker::solved              |                did-finish-load
 *     | epmty ---------|------> empty --------|---------> ready ---|------> busy --------|--------> dirty -----|------> empty --------|----------> ready --- - - -
 */

const { app, BrowserWindow } = require('electron');

const INTERNAL_WORKER_STATE = {
    empty: 'empty',
    ready: 'ready',
    busy: 'busy',
    dirty: 'dirty',
    unresponsive: 'unresponsive'
};

const args = JSON.parse(process.argv[2]);

function destroy() {
    app.exit(0);

    process.exit(0);
}

function sendWorkerStateChange(workerId, state) {
    process.send({
        type: 'e-app::workerStateChange',
        payload: { workerId, state }
    });
}

function createWorker() {
    const win = new BrowserWindow(args.browserWindow);
    const webContents = win.webContents;
    const workerId = win.id;

    if (args.showDevTools && args.browserWindow.show) {
        webContents.openDevTools();
    }

    sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.empty);

    win.on('unresponsive', () => {
        sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.unresponsive);
    });
    webContents.on('did-finish-load', () => {
        sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.ready);
    });
    webContents.on('worker::solved', (result) => {
        sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.dirty);
        process.send({
            type: 'e-app::taskSolved',
            payload: { workerId, result }
        });
    });

    return win;
}

function initWorker({ workerId, sand }) {
    const win = BrowserWindow.fromId(workerId);
    const webContents = win.webContents;

    sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.empty);

    webContents.loadURL(sand.url, sand.urlOptions);
}

function loadWorker({ workerId, task }) {
    const win = BrowserWindow.fromId(workerId);
    const webContents = win.webContents;

    sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.busy);

    webContents.send('e-app::exec', { type: 'worker::exec', payload: task });
}

process.on('message', ({ type, payload }) => {
    console.log('e-app::onHostMessage type:', type, '; payload', payload);

    switch (type) {
        case 'e-app::createWorker':
            return createWorker();
        case 'e-app::initWorker':
            return initWorker(payload);
        case 'e-app::loadWorker':
            return loadWorker(payload);
        case 'e-app::destroy':
            return destroy();
        default:
            console.log('unknown message');
    }
});

app.on('ready', () => {
    process.send({ type: 'e-app::ready', payload: {} });
});
