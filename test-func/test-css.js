const zandbak = require('../app/zandbak');

const sandbox = zandbak({
    zandbakOptions: { workersCount: 2, maxWorkersCount: 5 },
    eAppOptions: {
        showDevTools: true,
        browserWindow: { width: 400, height: 400, show: true },
        urlOptions: { userAgent: 'cssqd-ua' },
        sand: 'css', // sand = 'lodash' | 'css'
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


const timing = {};
let avgTimingNanoSec = 0;

function onTaskSolved(task, result) {
    const diff = process.hrtime(timing[task.taskId]);

    console.log('[test-css]', 'Task solved', task, '; result:', result, 'time:', diff);

    avgTimingNanoSec += ((diff[0] * 1000000000) + diff[1]);
}

sandbox.on('solved', onTaskSolved);


// sandbox.resetWith(rounds[0]);

// const tasksCount = 100;
// let taskIterator = tasksCount;
// while (--taskIterator >= 0) {
//     const timeout = Math.floor(Math.random() * 50);
//     // eslint-disable-next-line
//     setTimeout(((taskId) => (() => {
//         timing[taskId] = process.hrtime();
//         sandbox.exec({ taskId, payload: { selector: `h${taskIterator}` } });
//     }))(taskIterator), (timeout * 1000));
// }


// setTimeout(() => {
//     console.log('[test-css]', 'Sum task time: ', avgTimingNanoSec / 1000000000, 'sec');
//     console.log('[test-css]', 'Avg task time: ', ((avgTimingNanoSec / tasksCount) / 1000000000), 'sec');

//     sandbox.off('solved', onTaskSolved);
//     sandbox.destroy();
// }, 20000);
