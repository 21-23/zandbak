const EventEmitter = require('events');
const url = require('url');
const path = require('path');

const puppeteer = require('puppeteer');
const _uniqueid = require('lodash.uniqueid');

const contract = require('../contract');

const TYPE = 'puppeteer';
const LOG_PRFIX = `[${TYPE}]`;
const REMOTE_FUNCTION = {
    init: function (options) { return window.init(options); }, // eslint-disable-line
    fill: function (options) { return window.fill(options); }, // eslint-disable-line
    reload: function (options) { return window.reloadWorker(options); }, // eslint-disable-line
    exec: function (payload) { return window.exec(payload); }, // eslint-disable-line
};

function buildSandUrl(sand) {
    return url.format({
        protocol: 'file',
        slashes: true,
        pathname: path.join(__dirname, 'sand', `${sand}.html`),
    });
}

function createBrowser(options) {
    return puppeteer.launch(options);
}

function createWorker(state, options) {
    return state.browser.newPage()
        .then((page) => {
            const workerId = _uniqueid('puppeteer-worker-');

            state.workers.set(workerId, page);

            page.on('console', state.logger.info.bind(state.logger, LOG_PRFIX));
            page.on('load', () => {
                // this callback should be always attached
                // in case of reload - worker should pass through the whole process
                return page.evaluate(REMOTE_FUNCTION.init, options)
                    .then((responses) => {
                        responses.forEach((response) => {
                            state.emitter.emit('message', {
                                type: contract.messages.WORKER_STATE,
                                payload: {
                                    state: 'empty',
                                    path: [workerId].concat(response.path),
                                }
                            });
                        });
                    })
                    .catch((err) => {
                        state.logger.error(LOG_PRFIX, 'Error in initializing new worker', err);
                        state.workers.set(workerId);
                    });
            });

            return page.goto(buildSandUrl(state.options.sand));
        })
        .catch((err) => {
            state.logger.error(LOG_PRFIX, 'Error in creating new worker', err);
        });
}

function fillWorker(state, options) {
    options.path = options.path.slice();
    const workerId = options.path.shift();
    const page = state.workers.get(workerId);

    return page.evaluate(REMOTE_FUNCTION.fill, options)
        .then((response) => {
            state.emitter.emit('message', {
                type: contract.messages.WORKER_STATE,
                payload: {
                    state: 'ready',
                    path: [workerId].concat(response.path),
                    fillerId: response.fillerId,
                }
            });
        })
        .catch((err) => {
            state.logger.error(LOG_PRFIX, 'Error in filling worker', err);
        });
}

function reloadWorker(state, options) {
    options.path = options.path.slice();
    const workerId = options.path.shift();
    const page = state.workers.get(workerId);

    if (options.path.length !== 0) {
        return page.evaluate(REMOTE_FUNCTION.reload, options);
    }

    return page.reload();
}

function exec(state, payload) {
    // performance critical function; make it FTL;
    payload.path = payload.path.slice();
    const workerId = payload.path.shift();
    const page = state.workers.get(workerId);

    page.evaluate(REMOTE_FUNCTION.exec, payload)
        .then((response) => {
            if (typeof response !== 'object') {
                // sometimes if job has been interrupted
                // response may be a string "Object"
                return;
            }

            response.path = [workerId].concat(response.path);
            state.emitter.emit('message', {
                type: contract.messages.DONE,
                payload: response
            });
        })
        .catch((err) => {
            state.logger.perf(LOG_PRFIX, 'Error in exec, most probably caused by resetWith call', err);
        });
}

function destroy(state) {
    if (state.browser) {
        state.browser.close();
        state.browser = null;
    }

    state.workers.clear();
}

function send(state, { type, payload }) {
    switch (type) {
        case contract.commands.CREATE_WORKER:
            return createWorker(state, payload);
        case contract.commands.FILL_WORKER:
            return fillWorker(state, payload);
        case contract.commands.RELOAD_WORKER:
            return reloadWorker(state, payload);
        case contract.commands.EXEC:
            return exec(state, payload);
        case contract.commands.FLUSH:
            return true; // nothing to do here
        case contract.commands.DESTROY:
            return destroy(state);
        default:
            return state.logger.error(LOG_PRFIX, 'unknown message:', type);
    }
}

module.exports = function puppeteer(options, logger) {
    const emitter = new EventEmitter();
    const instance = contract.instance(TYPE, emitter);
    const state = {
        options,
        logger,
        emitter,
        instance,
        browser: null,
        workers: new Map(), // TODO: WeakMap?
    };

    instance.send = send.bind(null, state);
    instance.destroy = destroy.bind(null, state);

    createBrowser(options.launch)
        .then((launchedBrowser) => {
            state.browser = launchedBrowser;
            state.emitter.emit('message', { type: contract.messages.READY, payload: {} });
        });

    logger.info(`${LOG_PRFIX} backend instance is created`);

    return instance;
};
