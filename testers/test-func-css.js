const assert = require('assert');

const zandbak = require('../app/zandbak');

const sandbox = zandbak({
    logLevel: '+error,+info,+perf',
    validators: [
        { name: 'banned-chars' },
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
        sand: 'css', // css | lodash | lodash/subworkers
        logLevel: '+error,+perf',
        showDevTools: false,
        browserWindow: { width: 400, height: 400, show: false },
        urlOptions: { userAgent: '_qd-ua' },
    },
});

const rounds = [
    {
        content: {
            input: `<div data-qdid="0" class="parent">
                        <span data-qdid="1">child 0</span>
                        <h1 data-qdid="2">child 1</h1>
                    </div>
                    <div data-qdid="3">
                        <div data-qdid="4">another root</div>
                    </div>`,
            expected: ['0'] // no need to parse qdid
        },
        options: {
            sandbox: {
                reloadWorkers: false,
                refillWorkers: false,
                taskTimeoutMs: 500,
            },
            filler: {
                bannedCharacters: ['s', ':'],
            },
        },
    },
    {
        content: {
            input: `<div data-qdid="0" class='parent-1'>
                        <div data-qdid="1">child 0</div>
                        <p data-qdid="2">child 1</p>
                    </div>`,
            expected: '["2"]'
        },
        options: {
            sandbox: {
                reloadWorkers: false,
                refillWorkers: false,
                taskTimeoutMs: 500,
            },
            filler: {
                bannedCharacters: [],
            },
        },
    },
    {
        content: {
            input: `<b data-qdid="0">
                        <b data-qdid="1">
                            <b data-qdid="2">
                                <b data-qdid="3">
                                </b>
                            </b>
                        </b>
                    </b>`,
            expected: '["2", "1", "0", "3"]'
        },
        options: {
            sandbox: {
                reloadWorkers: false,
                refillWorkers: false,
                taskTimeoutMs: 500,
            },
            filler: {
                bannedCharacters: ['i'],
            },
        },
    },
    {
        content: {
            input: `<div data-qdid="0">
                        <div class="firstborn" data-qdid="1"></div>
                        <div id="second-son" data-qdid="2"></div>
                        <span data-qdid="3"></span>
                        <div data-qdid="4"></div>
                        <span data-qdid="5"></span>
                    </div>`,
            expected: '["2", "3", "4", "5"]',
        },
        options: {
            sandbox: {
                reloadWorkers: false,
                refillWorkers: false,
                taskTimeoutMs: 500,
            },
            filler: {
                bannedCharacters: [','],
            },
        },
    }
];


function onTaskSolved({ task, error, result, correct }) {
    console.log('[test-css]', 'Task solved', task, '; error', error, '; result:', result, '; correct:', correct);

    switch (task.id) {
        case 'task-0':
            return assert.equal(correct, 'correct');
        case 'task-1':
            return assert.equal(correct, 'incorrect');
        case 'task-2':
            assert.ok(error);
            assert.ifError(result);
            return;
        case 'task-3':
            assert.ok(error);
            assert.ifError(result);
            return;
        case 'task-4':
            return assert.equal(correct, 'incorrect');
        case 'task-5':
            return assert.equal(correct, 'correct');
        case 'task-6':
            return assert.equal(correct, 'incorrect');
        case 'task-7':
            return assert.equal(correct, 'correct');
        case 'task-8':
            assert.ok(error);
            assert.ifError(result);
            return;
        case 'task-9':
            return assert.equal(correct, 'incorrect');
        case 'task-10':
            assert.ok(error);
            assert.ifError(result);
            return;
        case 'task-11':
            return assert.equal(correct, 'incorrect');
        case 'task-12':
            assert.ok(error);
            assert.ifError(result);
            return;
        case 'task-13':
            return assert.equal(correct, 'correct');
        default:
            return assert.ok(false, 'unknown task id');
    }
}

sandbox.on('solved', onTaskSolved);
sandbox.resetWith(rounds[0]);

setTimeout(() => {
    sandbox
        .exec({ id: 'task-0', input: '.parent' })
        .exec({ id: 'task-1', input: '[data-qdid="0"]' })
        .exec({ id: 'task-2', input: 'span' });
}, 1000);
setTimeout(() => {
    sandbox
        .exec({ id: 'task-3', input: 'div' }) // interrupted error
        .resetWith(rounds[1]);
}, 3000);
setTimeout(() => {
    sandbox
        .exec({ id: 'task-4', input: 'di' })
        .exec({ id: 'task-5', input: 'p' })
        .exec({ id: 'task-6', input: 'div' });
}, 5000);
setTimeout(() => {
    sandbox
        .resetWith(rounds[2]);
}, 6000);
setTimeout(() => {
    sandbox
        .exec({ id: 'task-7', input: 'b' })
        .exec({ id: 'task-8', input: 'b i' })
        .exec({ id: 'task-9', input: 'b b b b' })
        .exec({ id: 'task-10', input: 'nth-child(' });
}, 7000);
setTimeout(() => {
    sandbox
        .resetWith(rounds[3]);
}, 8000);
setTimeout(() => {
    sandbox
        .exec({ id: 'task-11', input: 'div > div' })
        .exec({ id: 'task-12', input: '#second-son, span' })
        .exec({ id: 'task-13', input: 'div > *:not(.firstborn)' });
}, 9000);
setTimeout(() => {
    sandbox.resetWith(null);
}, 11000);

setTimeout(sandbox.destroy, 15000);
