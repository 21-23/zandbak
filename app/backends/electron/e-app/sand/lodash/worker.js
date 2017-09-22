/* eslint-env worker */
/* global _, isEqual */
/* eslint no-var: "warn", vars-on-top: "warn", object-shorthand: "warn", no-eval: "off", prefer-arrow-callback: "warn" */

importScripts('../../../../_common/lodash.js');

var stub = {};
var stubFun = function () {};
var resultBackup = JSON.stringify('');
var content = {
    input: [],
    inputs: [],
    expected: undefined,
    hidden: [] // array of objects { input: {JSON}, expected: {JSON} }
};
var inputCopies = 200;
var _lodash = Object.freeze(_);

var zandbakWorker = true; // required for improted below scripts
importScripts('../../../../_common/isEqual.js');

function initWorker(options) {
    postMessage({
        type: 'wrk::created',
        payload: { path: [] }
    });
}

function fillWorker(payload) {
    var counter = -1;
    content = {
        input: [],
        inputs: [],
        expected: undefined,
        hidden: []
    };

    if (payload.content) {
        content.input = typeof payload.content.input === 'string' ? JSON.parse(payload.content.input) : payload.content.input;
        content.expected = typeof payload.content.expected === 'string' ? JSON.parse(payload.content.expected) : payload.content.expected;

        counter = -1;
        while (++counter < inputCopies) {
            content.inputs.push(_.cloneDeep(content.input));
        }

        if (payload.content.hidden) {
            var hidden = payload.content.hidden;
            var index = -1;
            var hiddenCount = hidden.length;

            while (++index < hiddenCount) {
                var hiddenPuzzle = hidden[index];
                var hiddenContent = {
                    input: typeof hiddenPuzzle.input === 'string' ? JSON.parse(hiddenPuzzle.input) : hiddenPuzzle.input,
                    inputs: [],
                    expected: typeof hiddenPuzzle.expected === 'string' ? JSON.parse(hiddenPuzzle.expected) : hiddenPuzzle.expected,
                };

                counter = -1;
                while (++counter < inputCopies) {
                    hiddenContent.inputs.push(_.cloneDeep(hiddenContent.input));
                }

                content.hidden.push(hiddenContent);
            }
        }
    }

    payload.content = undefined; // no need to transfer back the filler

    postMessage({
        type: 'wrk::filled',
        payload: payload
    });
}

function evaluate(task, puzzleContent) {
    try {
        var result = eval('(function(_, content, global, setTimeout, setInterval, self, location, navigator, onmessage, close, postMessage, importScripts) {"use strict"; return _.chain(content).' + task.input + '.value()}).call(stub, _lodash, puzzleContent, stub, stubFun, stubFun, stub, stub, stub, stubFun, stubFun, stubFun, stubFun)');

        return [null, result];
    } catch (e) {
        return [e, null];
    }
}

function evaluateHidden(task, hidden) {
    var index = -1;
    var hiddenCount = hidden.length;

    while (++index < hiddenCount) {
        var hiddenPuzzle = hidden[index];
        var puzzleContent = hiddenPuzzle.inputs.pop() || _.cloneDeep(hiddenPuzzle.input);
        var evalResult = evaluate(task, puzzleContent);

        if (evalResult[0]) {
            return false;
        }

        if (!isEqual(hiddenPuzzle.expected, evalResult[1])) {
            return false;
        }
    }

    return true;
}

function exec(payload) {
    var puzzleContent = content.inputs.pop() || _.cloneDeep(content.input);
    var evalResult = evaluate(payload.task, puzzleContent);

    if (evalResult[0]) {
        // error branch
        var e = evalResult[0];
        payload.error = ((e && e.payload) || (e + ''));
    } else {
        var result = evalResult[1];
        var resultStr = JSON.stringify(result);

        if (typeof resultStr === 'undefined') {
            resultStr = resultBackup; // undefined, function, Symbol are stringify-ed to undefined
        }
        payload.result = resultStr;

        if (isEqual(content.expected, result)) {
            if (evaluateHidden(payload.task, content.hidden)) {
                payload.correct = 'correct';
            } else {
                payload.correct = 'partial';
            }
        } else {
            payload.correct = 'incorrect';
        }
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
        default:
            return undefined;
    }
});
