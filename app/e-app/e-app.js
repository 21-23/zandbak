const { app, BrowserWindow } = require('electron');

function exit() {
    const windows = BrowserWindow.getAllWindows();

    windows.forEach((win) => {
        win.destroy();
    });

    process.exit(0);
}

process.on('message', (message) => {
    console.log('e-app::onHostMessage', message);
});

app.on('ready', () => {
    process.send({ type: 'e-app::ready', payload: {} });
});
