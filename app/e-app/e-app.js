/*
 * Task lifecycle:
 *
 * createWorker     initWorker                                  loadWorker                                 initWorker
 *     |                |                did-finish-load            |               worker::solved              |                did-finish-load
 *     | empty ---------|----> loading --------|---------> ready ---|------> busy --------|--------> dirty -----|-----> loading --------|----------> ready --- - - -
 */

const { app, BrowserWindow, ipcMain } = require('electron');

const { log, warn } = require('./e-app-logger');

const INTERNAL_WORKER_STATE = {
    empty: 'empty',
    loading: 'loading',
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

    return win;
}

function initWorker({ workerId, sand }) {
    const win = BrowserWindow.fromId(workerId);
    const webContents = win.webContents;

    sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.loading);

    webContents.loadURL(sand.url, sand.urlOptions);
}

function loadWorker({ workerId, task }) {
    const win = BrowserWindow.fromId(workerId);
    const webContents = win.webContents;

    sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.busy);

    webContents.send('e-app::exec', { type: 'worker::exec', payload: task });
}

process.on('message', ({ type, payload }) => {
    log('[e-app]', 'onHostMessage type:', type);

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
            warn('[e-app]', 'unknown message');
    }
});

ipcMain.on('worker::solved', (event, result) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const workerId = win.id;

    sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.dirty);
    process.send({
        type: 'e-app::taskSolved',
        payload: { workerId, result }
    });
});

app.on('ready', () => {
    process.send({ type: 'e-app::ready', payload: {} });
});
