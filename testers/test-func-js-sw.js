const assert = require('assert');

const zandbak = require('../app/zandbak');

const sandbox = zandbak({
    logLevel: '+error,+info,+perf',
    validators: [
        { name: 'acorn' },
    ],
    workers: {
        count: 2,
        options: {
            subworkersCount: 5,
        },
    },
}, {
    type: 'electron',
    options: {
        sand: 'js/subworkers', // css | lodash | lodash/subworkers | js | js/subworkers
        showDevTools: false,
        browserWindow: { width: 400, height: 400, show: false },
        urlOptions: { userAgent: '_qd-ua' },
        logLevel: '+error,+perf',
    },
});

const rounds = [
    {
        content: {
            input: `[
                { "name": "Johnie", "surname": "Walker", "age": 14 },
                { "name": "Johnie", "surname": "Walker", "age": 20 },
                { "name": "Adam", "surname": "Smith", "age": 99 }
            ]`,
            expected: `[
                "Johnie",
                "Johnie",
                "Adam"
            ]`,
            hidden: [
                { input: '[{ "name": "hidden name" }]', expected: '["hidden name"]' }
            ]
        },
        options: {
            sandbox: {
                reloadWorkers: false,
                refillWorkers: false,
                taskTimeoutMs: 50,
                inputCopies: 200,
            },
            filler: { },
        },
    },
    {
        content: {
            input: `{
                "state": "DC",
                "list": ["W", "A", "S", "D"]
            }`,
            expected: '"DC"'
        },
        options: {
            sandbox: {
                reloadWorkers: false,
                refillWorkers: false,
                taskTimeoutMs: 50,
                inputCopies: 20,
            },
            filler: { },
        },
    }
];

function onTaskSolved({ task, error, result, correct }) {
    console.log('[test-lodash]', 'Task solved', task, '; error', error, '; result:', result, '; correct:', correct);

    switch (task.id) {
        case 'task-0':
            return assert.deepEqual(JSON.parse(result), ['Johnie', 'Johnie', 'Adam']);
        case 'task-1':
            assert.ok(error);
            assert.ifError(result);
            return;
        case 'task-2':
            return assert.deepEqual(JSON.parse(result), ['Johnie', 'Johnie', 'Adam']);
        case 'task-3':
            assert.ok(error);
            assert.ifError(result);
            return;
        case 'task-4':
            return assert.equal(JSON.parse(result), 'DC');
        case 'task-5':
            assert.ok(error);
            assert.ifError(result);
            return;
        default:
            return assert.ok(false, 'unknown task id');
    }
}

// sandbox.resetWith may increase task time up to 200-300ms
// try to call it in advance

sandbox.on('solved', onTaskSolved);
sandbox.resetWith(rounds[0]);


setTimeout(() => {
    sandbox
        .exec({ id: 'task-0', input: 'return arg.map(a => a.name)' }) // OK
        .exec({ id: 'task-1', input: 'return arg.map(a a.name)' }) // internal error
        .exec({ id: 'task-2', input: 'return ["Johnie", "Johnie", "Adam"]' }); // partial
}, 1000);
setTimeout(() => {
    sandbox
        .exec({ id: 'task-3', input: 'while(1) {}' }) // interrupted error
        .resetWith(rounds[1]);
}, 3000);
setTimeout(() => {
    sandbox
        .exec({ id: 'task-4', input: 'return arg.state;' }) // OK
        .exec({ id: 'task-5', input: 'const x = [].map({ } })' }); // internal error
}, 5000);
setTimeout(() => {
    sandbox.resetWith(null);
}, 7000);

setTimeout(sandbox.destroy, 10000);
