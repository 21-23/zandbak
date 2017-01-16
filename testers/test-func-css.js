const zandbak = require('../app/zandbak');

const sandbox = zandbak({
    zandbakOptions: {
        workersCount: 2,
        maxWorkersCount: 5,
        logs: '+error,-warn,-log,+perf',
    },
    eAppOptions: {
        showDevTools: false,
        browserWindow: { width: 400, height: 400, show: false },
        urlOptions: { userAgent: '_qd-ua' },
        sand: 'css', // sand = 'lodash' | 'css'
        logs: '+error,-warn,-log',
    }
});

const rounds = [
    {
        content: `<div class='parent'>
                    <span>child 0</span>
                    <h1>child 1</h1>
                </div>`,
        options: {
            reloadWorkers: false,
            refillWorkers: false,
            taskTimeoutMs: 500,
        }
    },
    {
        content: `<div class='parent-1'>
                    <div>child 0</div>
                    <p>child 1</p>
                </div>`,
        options: {
            reloadWorkers: false,
            refillWorkers: false,
            taskTimeoutMs: 500,
        }
    }
];


function onTaskSolved(task, error, result) {
    console.log('[test-css]', 'Task solved', task, '; error', error, '; result:', result);
}

sandbox.on('solved', onTaskSolved);
sandbox.resetWith(rounds[0]);

setTimeout(() => {
    sandbox
        .exec({ id: 'task-0', input: '.parent' })
        .exec({ id: 'task-1', input: 'span' })
        .exec({ id: 'task-2', input: 'span' });
}, 1000);
setTimeout(() => {
    sandbox
        .exec({ id: 'task-3', input: 'h' })
        .resetWith(rounds[1]);
}, 3000);
setTimeout(() => {
    sandbox
        .exec({ id: 'task-4', input: 'di' })
        .exec({ id: 'task-5', input: 'div' });
}, 5000);
setTimeout(() => {
    sandbox.resetWith(null);
}, 7000);

setTimeout(sandbox.destroy, 10000);
