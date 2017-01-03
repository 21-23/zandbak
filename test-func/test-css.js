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

	function exec(message, done) {
		try {
			var result = document.querySelectorAll(message.payload.selector);
			done({ message: message, result: result });
		} catch (e) {
			done({ message: message, error: e });
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

		exec(message, send);
	});
</script>
</body>
</html>

 */

const zandbak = require('../app/zandbak');

const sandbox = zandbak({
	zandbakOptions: { workersCount: 2, maxWorkersCount: 5, taskTimeoutMs: 500 },
	eAppOptions: { showDevTools: true, browserWindow: { width: 400, height: 400, show: true }}
});

const rounds = [
	{
		url: `data:text/html,<!DOCTYPE html><html><body>
			<div class='parent'><span>child 0</span><h1>child 1</h1></div>
			<script>var ipcRenderer = require('electron').ipcRenderer;function send(result) {return ipcRenderer.send('worker::solved', result);}function exec(message, done) {try {var result = document.querySelectorAll(message.payload.selector);done({ message: message, result: result });} catch (e) {done({ message: message, error: e });}}ipcRenderer.on('e-app::exec', function(message) {if (!message) {console.log('worker::onMessage', 'empty message, do nothing');return send({ message: message, error: 'empty message' });}if (message.type !== 'worker::exec') {console.log('worker::onMessage', 'unknown message type', message.type);return send({ message: message, error: 'unknown message type' });}exec(message, send);});</script></body></html>`,
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


sandbox.resetWith(rounds[0], (sandbox) => {
	sandbox.exec({ taskId: 0, payload: 'h1' });
	sandbox.exec({ taskId: 1, payload: '.span' });
});

setTimeout(() => {
	sandbox.resetWith(null, () => { //STOP button
		sandbox.resetWith(rounds[1], () => { // start next round init to be ready
			sandbox.exec({});
			sandbox.exec({});
		});
	});
}, 5000);

setTimeout(() => {
	sandbox.off('solved', onTaskSolved);
	sandbox.destroy();
}, 10000);
