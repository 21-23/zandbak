const zandbak = require('../app/zandbak');

const sandbox = zandbak({
    zandbakOptions: {
        workersCount: 5,
        maxWorkersCount: 10,
        logs: '-error,-warn,-log,+perf',
        validators: [
            { name: 'esprima' }
        ],
    },
    eAppOptions: {
        showDevTools: false,
        browserWindow: { width: 400, height: 400, show: false },
        urlOptions: { userAgent: '_qd-ua' },
        sand: 'lodash', // sand = 'lodash' | 'css'
        logs: '-error,-warn,-log',
    }
});

const rounds = [
    {
        content: [
            { name: 'Johnie', surname: 'Walker', age: 14 },
            { name: 'Johnie', surname: 'Walker', age: 20 },
            { name: 'Adam', surname: 'Smith', age: 99 },
            { name: 'Jack', surname: 'Daniels', age: 18 },
            { name: 'Unknown', surname: 'Jameson', age: 18 },
            { name: 'Adam', surname: 'Smith1', age: 4 },
        ],
        options: {
            reloadWorkers: false,
            refillWorkers: false,
            taskTimeoutMs: 500,
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
            taskTimeoutMs: 500,
        }
    }
];

const tasksCount = 1000;
let remainingTasks = tasksCount;

function onTaskSolved(task, error, result) {
    console.log('[test-perf-lodash]', 'Task solved', task, '; error', error, '; result:', result);
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

