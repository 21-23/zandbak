const path = require('path');
const proc = require('child_process');

const electron = require('electron');

const eAppPath = path.join(__dirname, 'e-app', 'e-app.js');

function createEAppProc() {
    const child = proc.spawn(
        electron,
        [eAppPath].concat(JSON.stringify({
            // options here
        })),
        {
            stdio: [null, process.stdout, process.stderrm, 'ipc']
        }
    );

    return child;
}
