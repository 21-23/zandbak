const EventEmitter = require('events');

exports.instance = function (type) {
    const emitter = new EventEmitter();

    const instance = {
        type,
        emitter,
        send: () => {},
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
