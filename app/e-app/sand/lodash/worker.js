importScripts('./lodash.js');

var stub = {};
var stubFun = function() {};
var content = [];
var _lodash = Object.freeze(_);

function initWorker(options) {
    postMessage({
        type: 'wrk::created',
        payload: { path: [] }
    });
}

function fillWorker(payload) {
    content = [];

    content = typeof payload.content === 'string' ? JSON.parse(payload.content) : payload.content;
    payload.content = undefined; // no need to transfer back the filler

    postMessage({
        type: 'wrk::filled',
        payload: payload
    });
}

function evaluate(task, puzzleContent) {
    try {
        var result = eval('(function(_, content, global, setTimeout, setInterval, self, location, navigator, onmessage, close, postMessage, importScripts) {"use strict"; return _.chain(content).' + task.input + '.value()}).call(stub, _lodash, puzzleContent, stub, stubFun, stubFun, stub, stub, stub, stubFun, stubFun, stubFun, stubFun)');

        result = JSON.stringify(result);

        if (typeof result === 'undefined') {
            // undefined, function, Symbol are stringify-ed to undefined
            result = JSON.stringify('');
        }

        return [result];
    } catch (e) {
        return [null, e];
    }
}

function exec(payload) {
    var puzzleContent = _.cloneDeep(content);
    var result = evaluate(payload.task, puzzleContent);

    if (result.length === 1) {
        payload.result = result[0];
    } else {
        var e = result[1];
        payload.error = (e && e.payload || (e + ''));
    }

    postMessage({
        type: 'wrk::done',
        payload: payload
    });
}

self.addEventListener('message', function (event) {
    var data = event.data;

    switch (data.type) {
        case 'wrk:>init':
            return initWorker(data.payload);
        case 'wrk:>fill':
            return fillWorker(data.payload);
        case 'wrk:>exec':
            return exec(data.payload);

    }
});
