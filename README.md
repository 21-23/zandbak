# zandbak

**zandbak** is a sandbox for your pages. Zandbak should be filled with so called [sand] with a predefined API.

### Usage example
```javascript
const zandbak = require('zandbak');

const sandbox = zandbak({
    zandbakOptions: {
        workersCount: 2,
        maxWorkersCount: 5,
        logs: '+error,-warn,-log,+perf',
    },
    eAppOptions: {
        showDevTools: false,
        browserWindow: { show: false },
        sand: 'lodash',
        logs: '+error,-warn,-log',
    }
});

sandbox.on('solved', (task, error, result) => {
    // handle solved task here
});

const filler = {
        content: [
            { name: 'Johnie', surname: 'Walker', age: 14 },
            { name: 'Johnie', surname: 'Walker', age: 20 },
        ],
        options: {
            reloadWorkers: false,
            refillWorkers: false,
            taskTimeoutMs: 500,
        }
    };
const task = { id: 'task-0', input: 'map(() => { return null; })' }

sandbox.resetWith(filler);
sandbox.exec(task);
sandbox.exec(...);

...
sandbox.resetWith(filler);
sandbox.exec(...);
sandbox.exec(...);
...
sandbox.destroy();
```

   [sand]: <https://github.com/games4nerds/zandbak/tree/master/app/e-app/sand>
