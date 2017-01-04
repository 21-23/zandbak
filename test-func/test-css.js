/*
 * Html page (round placeholder) should look like:

<!DOCTYPE html>
<html>
<body>
<!-- markup goes here -->
<script>
    var ipcRenderer = require('electron').ipcRenderer;

    function send(result) {
        return ipcRenderer.send('worker::solved', result);
    }

    function exec(task, done) {
        try {
            var result = document.querySelectorAll(task.payload.selector);
            done({ result: result});
        } catch (e) {
            done({ error: e });
        }
    }

    ipcRenderer.on('e-app::exec', function(message) {
        if (!message) {
            console.log('worker::onMessage', 'empty message, do nothing');
            return send({ message: message, error: 'empty message' });
        }

        if (message.type !== 'worker::exec') {
            console.log('worker::onMessage', 'unknown message type', message.type);
            return send({ message: message, error: 'unknown message type' });
        }

        exec(message.payload, send);
    });
</script>
</body>
</html>

 */

const zandbak = require('../app/zandbak');

const sandbox = zandbak({
    zandbakOptions: { workersCount: 5, maxWorkersCount: 10, taskTimeoutMs: 500, reloadWorkers: false },
    eAppOptions: { showDevTools: true, browserWindow: { width: 400, height: 400, show: true } }
});

const rounds = [
    {
        url: `data:text/html,<!DOCTYPE html><html><body>
                <div class='parent'><span>child 0</span><h1>child 1</h1></div>
            <script>
                var ipcRenderer = require('electron').ipcRenderer;

                function send(result) {
                    return ipcRenderer.send('worker::solved', result);
                }

                function exec(task, done) {
                    try {
                        var result = document.querySelectorAll(task.payload.selector);
                        done({ result: result});
                    } catch (e) {
                        done({ error: e });
                    }
                }

                ipcRenderer.on('e-app::exec', function(source, message) {
                    if (!message) {
                        console.log('worker::onMessage', 'empty message, do nothing');
                        return send({ message: message, error: 'empty message' });
                    }

                    if (message.type !== 'worker::exec') {
                        console.log('worker::onMessage', 'unknown message type', message.type);
                        return send({ message: message, error: 'unknown message type' });
                    }

                    exec(message.payload, send);
                });
            </script>
            </body>
            </html>`,
        urlOptions: { userAgent: 'cssqd-ua' }
    },
    {
        url: 'http://www.brainjar.com/java/host/test.html',
        urlOptions: { userAgent: 'cssqd-ua' }
    }
];

function onTaskSolved(task, result) {
    console.log('Task solved', task, '; result:', result);
}

sandbox.on('solved', onTaskSolved);


sandbox.resetWith(rounds[0]);
let taskIterator = 50;
while (--taskIterator > 0) {
    sandbox.exec({ taskId: taskIterator, payload: { selector: `h${taskIterator}` } });
}
// force to create additional workers
setTimeout(() => {
    let taskIterator = 50;
    while (--taskIterator > 0) {
        sandbox.exec({ taskId: taskIterator, payload: { selector: `span${taskIterator}` } });
    }
}, 1000);


setTimeout(() => {
    sandbox.off('solved', onTaskSolved);
    sandbox.destroy();
}, 10000);
