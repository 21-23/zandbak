const assert = require('assert');

const zandbak = require('../app/zandbak');

const sandbox = zandbak({
    zandbakOptions: {
        workersCount: 2,
        workerOptions: {},
        logs: '+error,+perf',
        validators: [
            { name: 'esprima' }
        ],
    },
    eAppOptions: {
        showDevTools: false,
        browserWindow: { width: 400, height: 400, show: false },
        urlOptions: { userAgent: '_qd-ua' },
        sand: 'lodash', // sand = 'lodash' | 'css' | 'lodash/subworkers'
        logs: '+error,+perf',
    }
});

const rounds = [
    {
        content: [
            { name: 'Johnie', surname: 'Walker', age: 14 },
            { name: 'Johnie', surname: 'Walker', age: 20 },
            { name: 'Adam', surname: 'Smith', age: 99 },
        ],
        options: {
            reloadWorkers: false,
            refillWorkers: false,
            taskTimeoutMs: 1500,
        }
    },
    {
        content: {
            state: 'DC',
            list: ['W', 'A', 'S', 'D']
        },
        options: {
            reloadWorkers: false,
            refillWorkers: false,
            taskTimeoutMs: 1500,
        }
    }
];

function onTaskSolved(task, error, result) {
    console.log('[test-lodash]', 'Task solved', task, '; error', error, '; result:', result);

    switch (task.id) {
        case 'task-0':
            return assert.deepEqual(JSON.parse(result), ['Johnie', 'Johnie', 'Adam']);
        case 'task-1':
            assert.ok(error);
            assert.ifError(result);
            return;
        case 'task-2':
            return assert.deepEqual(JSON.parse(result), [14, 20, 99]);
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
        .exec({ id: 'task-2', input: 'map((a) => a.age)' }); // OK
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
