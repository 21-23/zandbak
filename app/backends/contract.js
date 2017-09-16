// every backend MUST send messages below
exports.messages = {
    READY: 'e-app::ready',
    WORKER_STATE: 'e-app::wrk-state',
    DONE: 'e-app::done',
};

// every backend MUST react on next commands
exports.commands = {
    CREATE_WORKER: 'e-app:>create-worker',
    FILL_WORKER: 'e-app:>fill-worker',
    RELOAD_WORKER: 'e-app:>reload-worker',
    EXEC: 'e-app:>exec',
    FLUSH: 'e-app:>flush',
    DESTROY: 'e-app:>destroy',
};

exports.instance = function (type, emitter) {
    const instance = {
        type,
        send: () => { throw new Error('Method "send" is not implemented'); },
        destroy: () => { throw new Error('Method "destroy" is not implemented'); },
        on: (eventName, listener) => {
            emitter.addListener(eventName, listener);

            return instance;
        },
        off: (eventName, listener) => {
            if (listener) {
                emitter.removeListener(eventName, listener);
            } else {
                emitter.removeAllListeners(eventName);
            }

            return instance;
        },
    };

    return instance;
};
