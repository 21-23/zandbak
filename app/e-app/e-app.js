/*
 * Task lifecycle:
 *
 * createWorker                                                            fillWorker                                      loadWorker                                 reloadWorker
 *     |           loadSand              did-finish-load                       |                worker::filled                 |               worker::solved              |                did-finish-load
 *     | empty ---------|----> loading --------|---------> readyForFiller------| -----> filling -------|--------> ready -------|------> busy --------|--------> dirty -----|-----> loading --------|----------> readyForFiller --- - - -
 */

const path = require('path');
const url = require('url');

const { app, BrowserWindow, ipcMain } = require('electron');

const { log, warn } = require('./e-app-logger');

const INTERNAL_WORKER_STATE = {
    empty: 'empty',
    loading: 'loading',
    readyForFiller: 'readyForFiller',
    filling: 'filling',
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

function buildSandUrl(sand) {
    return url.format({
        protocol: 'file',
        slashes: true,
        pathname: path.join(__dirname, 'sand', `${sand}.html`)
    });
}

function loadSand(webContents) {
    return webContents.loadURL(buildSandUrl(args.sand), args.urlOptions);
}

function sendWorkerStateChange(workerId, state, meta) {
    process.send({
        type: 'e-app::workerStateChange',
        payload: { workerId, state, meta }
    });
}

function createWorker() {
    const win = new BrowserWindow(args.browserWindow);
    const webContents = win.webContents;
    const workerId = win.id;

    if (args.showDevTools && args.browserWindow.show) {
        webContents.openDevTools();
    }

    win.on('unresponsive', () => {
        sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.unresponsive);
    });
    webContents.on('did-finish-load', () => {
        sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.readyForFiller);
    });

    loadSand(webContents);
    sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.loading);

    return win;
}

function reloadWorker({ workerId }) {
    const win = BrowserWindow.fromId(workerId);
    const webContents = win.webContents;

    loadSand(webContents);
    sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.loading);
}

function fillWorker({ workerId, filler, fillerId }) {
    const win = BrowserWindow.fromId(workerId);
    const webContents = win.webContents;

    sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.filling);

    webContents.send('e-app::fill', { type: 'worker::fill', payload: { filler, fillerId } });
}

function loadWorker(payload) {
    const win = BrowserWindow.fromId(payload.workerId);
    const webContents = win.webContents;

    sendWorkerStateChange(payload.workerId, INTERNAL_WORKER_STATE.busy);

    webContents.send('e-app::exec', { type: 'worker::exec', payload });
}

process.on('message', ({ type, payload }) => {
    log('[e-app]', 'onHostMessage type:', type);

    switch (type) {
        case 'e-app::createWorker':
            return createWorker();
        case 'e-app::fillWorker':
            return fillWorker(payload);
        case 'e-app::loadWorker':
            return loadWorker(payload);
        case 'e-app::reloadWorker':
            return reloadWorker(payload);
        case 'e-app::destroy':
            return destroy();
        default:
            warn('[e-app]', 'unknown message');
    }
});

ipcMain.on('e-app::exec', (event, message) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const workerId = win.id;

    if (!message || message.error) {
        warn('[e-app]', 'on job exec error', message);
    }

    if (message.type !== 'worker::solved') {
        warn('[e-app]', 'on job exec error, unknown message type', message);
    }

    process.send({
        type: 'e-app::taskSolved',
        payload: message.payload,
        error: message.error,
    });
    // now worker is INTERNAL_WORKER_STATE.dirty
    // that should be handled by e-app::taskSolved handler
});

ipcMain.on('e-app::fill', (event, message) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const workerId = win.id;

    if (!message || message.error) {
        warn('[e-app]', 'on worker fill error', message);
        return sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.dirty);
    }

    if (message.type !== 'worker::filled') {
        warn('[e-app]', 'on worker fill error, unknown message type', message);
        return sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.dirty);
    }

    sendWorkerStateChange(workerId, INTERNAL_WORKER_STATE.ready, message.payload);
});

app.on('ready', () => {
    process.send({ type: 'e-app::ready', payload: {} });
});
