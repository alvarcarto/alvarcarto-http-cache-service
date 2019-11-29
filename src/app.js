const express = require('express');
const morgan = require('morgan');
const _ = require('lodash');
const minimatch = require('minimatch');
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
      // 3th decimal: 110 m accuracy
      // 4th decimal: 11m accuracy
      // 5th decimal: 1.1m accuracy
      const roundFloats = s => s.replace(/[+-]?\d+\.\d+/g, match => Number(match).toFixed(5));
      const fullPath = roundFloats(req.originalUrl);

      if (fullPath !== req.originalUrl) {
        console.log(`Rounded url parameters: ${fullPath}`);
      }

      return fullPath;
    },
    selector: (incomingReq, originRes) => {
      const contentType = originRes.headers['content-type'];

      const shouldInclude = _.some(
        config.CACHE_INCLUDE_MIME_TYPES,
        pattern => minimatch(contentType, pattern)
      );
      const shouldExclude = _.some(
        config.CACHE_EXCLUDE_MIME_TYPES,
        pattern => minimatch(contentType, pattern)
      );

      return shouldInclude && !shouldExclude;
    },
    cacheDir: config.CACHE_DIR,
    originBaseUrl: config.ORIGIN_BASE_URL,
  }));

  return app;
}

module.exports = createApp;
