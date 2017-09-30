const assert = require('assert');

const zandbak = require('../app/zandbak');

const sandbox = zandbak({
    logLevel: '+error,+info,+perf',
    validators: [
        { name: 'esprima' },
    ],
    workers: {
        count: 1,
        options: {
            subworkersCount: 10,
        },
    },
}, {
    type: 'electron',
    options: {
        sand: 'lodash/subworkers', // css | lodash | lodash/subworkers
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
            inputCopies: 500,
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
            inputCopies: 500,
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
