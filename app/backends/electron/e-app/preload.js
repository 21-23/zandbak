const { contextBridge, ipcRenderer } = require('electron');

// inspired by https://stackoverflow.com/a/59888788/1404942
contextBridge.exposeInMainWorld('qd', {
    onWorkerCreated(payload) {
        ipcRenderer.send('wrk::created', payload);
    },
    onWorkerFilled(payload) {
        ipcRenderer.send('wrk::filled', payload);
    },
    onWorkerDone(payload) {
        ipcRenderer.send('wrk::done', payload);
    },

    onMessage(callback) {
        ipcRenderer.on('message', (event, ...args) => {
            callback(...args);
        });
    },
});
