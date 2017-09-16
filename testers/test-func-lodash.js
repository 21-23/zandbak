const assert = require('assert');

const zandbak = require('../app/zandbak');

const sandbox = zandbak({
    logLevel: '+error,+info,+perf',
    validators: [
        { name: 'esprima' },
    ],
    workers: {
        count: 2,
        options: {
            subworkersCount: 0,
        },
    },
}, {
    type: 'electron',
    options: {
        sand: 'lodash', // css | lodash | lodash/subworkers
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
            reloadWorkers: false,
            refillWorkers: false,
            taskTimeoutMs: 50,
        }
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
            reloadWorkers: false,
            refillWorkers: false,
            taskTimeoutMs: 50,
        }
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
        .exec({ id: 'task-0', input: 'map("name")' }) // OK
        .exec({ id: 'task-1', input: 'map(name")' }) // internal error
        .exec({ id: 'task-2', input: 'reduce((a) => a, ["Johnie", "Johnie", "Adam"])' }); // partial
}, 1000);
setTimeout(() => {
    sandbox
        .exec({ id: 'task-3', input: 'map((a) => { while(1) {} })' }) // interrupted error
        .resetWith(rounds[1]);
}, 3000);
setTimeout(() => {
    sandbox
        .exec({ id: 'task-4', input: 'get("state")' }) // OK
        .exec({ id: 'task-5', input: 'map(() => {  } })' }); // internal error
}, 5000);
setTimeout(() => {
    sandbox.resetWith(null);
}, 7000);

setTimeout(sandbox.destroy, 10000);
