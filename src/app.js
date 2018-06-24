const express = require('express');
const morgan = require('morgan');
const compression = require('compression');
const cors = require('cors');
const fileCache = require('./file-cache-middleware');
const config = require('./config');

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(morgan('dev'));

  const corsOpts = {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
  };
  console.log('Using CORS options:', corsOpts);
  app.use(cors(corsOpts));
  app.use(compression({
    // Compress everything over 10 bytes
    threshold: 10,
  }));

  app.use(fileCache({
    getPath: (req) => {
      const roundFloats = s => s.replace(/[+-]?\d+\.\d+/g, match => Number(match).toFixed(2));
      const fullPath = roundFloats(req.originalUrl);

      if (fullPath !== req.originalUrl) {
        console.log(`Rounded url parameters: ${fullPath}`);
      }

      return fullPath;
    },
    cacheDir: config.CACHE_DIR,
    originBaseUrl: config.ORIGIN_BASE_URL,
  }));

  return app;
}

module.exports = createApp;
