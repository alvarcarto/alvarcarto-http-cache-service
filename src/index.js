const createApp = require('./app');
const enableDestroy = require('server-destroy');
const BPromise = require('bluebird');
const config = require('./config');

BPromise.config({
  warnings: config.NODE_ENV !== 'production',
  longStackTraces: true,
});

const app = createApp();
const server = app.listen(config.PORT, () => {
  console.log(
    'Express server listening on http://localhost:%d/ in %s mode',
    config.PORT,
    app.get('env'),
  );
});
enableDestroy(server);

function closeServer(signal) {
  console.log(`${signal} received`);
  console.log('Closing http.Server ..');
  server.destroy();
}

// Handle signals gracefully. Heroku will send SIGTERM before idle.
process.on('SIGTERM', closeServer.bind(this, 'SIGTERM'));
process.on('SIGINT', closeServer.bind(this, 'SIGINT(Ctrl-C)'));

server.on('close', () => {
  console.log('Server closed');
  process.emit('cleanup');

  console.log('Giving 100ms time to cleanup..');
  // Give a small time frame to clean up
  setTimeout(process.exit, 100);
});
