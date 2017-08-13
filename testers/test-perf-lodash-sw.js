const assert = require('assert');

const zandbak = require('../app/zandbak');

const sandbox = zandbak({
    zandbakOptions: {
        workersCount: 1,
        workerOptions: {
            subworkersCount: 10,
        },
        logs: '+error,+perf',
        validators: [
            { name: 'esprima' }
        ],
    },
    eAppOptions: {
        showDevTools: false,
        browserWindow: { width: 400, height: 400, show: false },
        urlOptions: { userAgent: '_qd-ua' },
        sand: 'lodash/subworkers', // sand = 'lodash' | 'css' | 'lodash/subworkers'
        logs: '+error,+perf',
    }
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

const tasksCount = 1000;
let remainingTasks = tasksCount;

function onTaskSolved({ task, error, result, correct }) {
    console.log('[test-perf-lodash]', 'Task solved', task, '; error', error, '; result:', result, '; correct:', correct);
    console.log('[test-perf-lodash]', 'Remaining tasks', --remainingTasks);
}

sandbox.on('solved', onTaskSolved);
sandbox.resetWith(rounds[0]);

setTimeout(() => {
    const timeSpan = 10000;
    let counter = tasksCount;

    while (--counter >= 0) {
        const timeout = 1000 + Math.round(Math.random() * timeSpan);

        setTimeout(((num, timeout) => {
            sandbox.exec({ id: `task-${num}`, input: `take(${num}).map((item) => { return item.name + item.age + '${timeout}'; })` });
        }).bind(null, counter, timeout), timeout);
    }
}, 2000);

setTimeout(() => {
    sandbox.resetWith(null);
    setTimeout(sandbox.destroy, 3000);
}, 15000);
