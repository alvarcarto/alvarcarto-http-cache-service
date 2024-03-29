const BPromise = require('bluebird');
const { startWatchLoop, stopWatchLoop } = require('./cache-cleaner');
const config = require('./config');

BPromise.config({
  warnings: config.NODE_ENV !== 'production',
  longStackTraces: true,
});

const createApp = require('./app');
const enableDestroy = require('server-destroy');

const app = createApp();
const server = app.listen(config.PORT, () => {
  console.log(
    'Express server listening on http://localhost:%d/ in %s mode',
    config.PORT,
    app.get('env'),
  );
});
enableDestroy(server);

startWatchLoop({
  cacheDir: config.CACHE_DIR,
  maxCacheDirSize: config.MAX_CACHE_DIR_SIZE,
});

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
