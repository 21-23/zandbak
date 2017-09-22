# zandbak

**zandbak** is a sandbox for your pages. Zandbak should be filled with so called `sand` with a predefined API.

### Usage example
```javascript
const zandbak = require('zandbak');

const sandbox = zandbak({ ... });

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
        taskTimeoutMs: 1500, // should be reasonably big (seconds) as time out forces worker reload (too expensive)
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

### Parametrization
**zandbak** supports several backends (backend - is an application that makes actual execution).

#### Electron example
```javascript
const sandbox = zandbak({
    logLevel: '+error,+info,+perf',
    validators: [],
    workers: {
        count: 2,
        options: {},
    }
}, {
    type: 'electron',
    options: {
        sand: 'lodash',
        logLevel: '+error,+perf',
        showDevTools: false,
        browserWindow: { width: 400, height: 400, show: false },
        urlOptions: { userAgent: '_qd-ua' },
    }
});
```

#### Electron example (with sub-workers)
```javascript
const sandbox = zandbak({
    logLevel: '+error,+info,+perf',
    validators: [],
    workers: {
        count: 2,
        options: {
            subworkersCount: 10,
        },
    }
}, {
    type: 'electron',
    options: {
        sand: 'lodash/subworkers',
        logLevel: '+error,+perf',
        showDevTools: false,
        browserWindow: { width: 400, height: 400, show: false },
        urlOptions: { userAgent: '_qd-ua' },
    }
});
```

#### Puppeteer example (with sub-workers)
```javascript
const sandbox = zandbak({
    logLevel: '+error,+info,+perf',
    validators: [],
    workers: {
        count: 2,
        options: {},
    },
}, {
    type: 'puppeteer',
    options: {
        sand: 'css',
        logLevel: '+error,+perf',
        launch: { headless: true, dumpio: true }
    }
});
```
