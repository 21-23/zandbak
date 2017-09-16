const proc = require('child_process');
const path = require('path');

const electron = require('electron');

const contract = require('../contract');

const TYPE = 'electron';
const electronAppPath = path.join(__dirname, 'e-app', 'e-app.js');

function createElectronApp(options, logger) {
    const child = proc.spawn(
        electron,
        [electronAppPath].concat(JSON.stringify(options || {})),
        {
            stdio: [null, process.stdout, process.stderr, 'ipc'] // TODO: pass to logger as stream
        }
    );

    return child;
}

module.exports = function electron(options, logger) {
    const electronApp = createElectronApp(options, logger);
    const instance = contract.instance(TYPE, electronApp);

    instance.send = electronApp.send.bind(electronApp);
    instance.destroy = () => {
        electronApp.kill('SIGINT');
    };
    instance.on = electronApp.on.bind(electronApp);

    logger.info(`${TYPE} backend instance is created`);

    return instance;
};
