const proc = require('child_process');
const path = require('path');

const electron = require('electron');

const contract = require('../contract');

const TYPE = 'electron';
const LOG_PRFIX = `[${TYPE}]`;
const electronAppPath = path.join(__dirname, 'e-app', 'e-app.js');

function createElectronApp(options) {
    const child = proc.spawn(
        electron,
        [electronAppPath].concat(JSON.stringify(options || {})),
        {
            stdio: [null, 'pipe', 'pipe', 'ipc'],
        }
    );

    return child;
}

module.exports = function electron(options, logger) {
    const electronApp = createElectronApp(options);
    const instance = contract.instance(TYPE, electronApp);

    // TODO: split "data" to lines
    function logPerf(data) {
        // treat all logs from electron app as perf
        logger.perf(LOG_PRFIX, data.toString());
    }
    function logError(data) {
        logger.error(LOG_PRFIX, data.toString());
    }

    instance.send = electronApp.send.bind(electronApp);
    instance.on = electronApp.on.bind(electronApp);
    instance.destroy = () => {
        electronApp.kill('SIGINT');
        electronApp.stdout.removeListener('data', logPerf);
        electronApp.stderr.removeListener('data', logError);
    };

    electronApp.stdout.on('data', logPerf);
    electronApp.stderr.on('data', logError);


    logger.info(`${LOG_PRFIX} backend instance is created`);

    return instance;
};
