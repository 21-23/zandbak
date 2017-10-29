const zandbak = require('../app/zandbak');

const sandbox = zandbak({
    logLevel: '+error,+info,+perf',
    validators: [
        { name: 'esprima' },
    ],
    workers: {
        count: 10,
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
            input: [
                { name: 'Johnie', surname: 'Walker', age: 14 },
                { name: 'Johnie', surname: 'Walker', age: 20 },
                { name: 'Adam', surname: 'Smith', age: 99 },
                { name: 'Jack', surname: 'Daniels', age: 18 },
                { name: 'Unknown', surname: 'Jameson', age: 18 },
                { name: 'Adam', surname: 'Smith1', age: 4 },
            ],
            expected: ['Johnie'],
            hidden: [
                { input: '[{ "name": "hidden name" }]', expected: '["hidden name"]' }
            ]
        },
        options: {
            sandbox: {
                reloadWorkers: false,
                refillWorkers: false,
                taskTimeoutMs: 500,
                inputCopies: 600,
            },
            filler: { },
        },
    },
    {
        content: {
            state: 'DC',
            list: ['W', 'A', 'S', 'D']
        },
        options: {
            sandbox: {
                reloadWorkers: false,
                refillWorkers: false,
                taskTimeoutMs: 500,
                inputCopies: 600,
            },
            filler: { },
        },
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

