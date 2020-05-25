const BPromise = require('bluebird');
const crypto = require('crypto');
const genericPool = require('generic-pool');
const moment = require('moment');
const requestPromise = require('request-promise');
const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const HEADERS_TO_NOT_PROXY = [
  'connection',
  'content-length',
  'content-md5',
  'host',
  'transfer-encoding',
  'accept-encoding',
];

// Use generic-pool to limit the max concurrent requests into origin, we are using the
// lib with resource that isn't exactly similar to e.g. database connection which is constantly
// open but the usage is still valid.
const poolFactory = {
  // This way each function get's a new identity so that generic-pool doesn't
  // mix up the "resources"
  create: () => (...args) => requestPromise.apply(requestPromise, args),
  destroy: () => null,
};
const requestPool = genericPool.createPool(poolFactory, {
  min: 1,
  max: config.MAX_CONCURRENT_REQUESTS_TO_ORIGIN,
  acquireTimeoutMillis: 1000 * 60 * 2,
  Promise: BPromise,
});

BPromise.promisifyAll(fs);

function withPoolResource(func) {
  let resource;
  return requestPool.acquire()
    .then((_resource) => {
      resource = _resource;
      return func(resource);
    })
    .finally(() => {
      if (resource) {
        requestPool.release(resource);
      }
    });
}

function createMiddleware(_opts = {}) {
  const opts = _.merge({
    // Express docs:
    //   GET /search?q=something
    //   req.originalUrl
    //   => "/search?q=something"
    getPath: req => req.originalUrl,

    // Cache everything
    selector: () => true,

    // `urlPath`  will contain to what opts.getPath returns
    encodeKey: urlPath => crypto.createHash('sha256').update(urlPath).digest('hex'),
    cacheDir: path.join(__dirname, '../cache'),
  }, _opts);

  if (!opts.originBaseUrl) {
    throw new Error('Missing required option: opts.originUrl');
  }

  return function cacheProxy(req, res, next) {
    if (req.method !== 'GET') {
      const err = new Error('Only GET requests are supported');
      err.status = 403;
      return next(err);
    }

    const urlPath = opts.getPath(req);
    const key = opts.encodeKey(urlPath);
    const filePath = path.join(opts.cacheDir, key);

    return BPromise.props({
      fileData: fs.readFileAsync(filePath, { encoding: null }),
      fileMeta: fs.readFileAsync(filePathToMetaPath(filePath), { encoding: 'utf8' })
        .then(content => JSON.parse(content)),
    })
      .then(({ fileData, fileMeta }) => {
        if (req.query.noCache === 'true') {
          const err = new Error('Skipping cache ..');
          err.code = 'ENOENT';
          throw err;
        }

        console.log(`Serving ${urlPath} (${key}) from cache`);
        _.forEach(fileMeta.headers, (headerVal, headerKey) => {
          res.set(headerKey, headerVal);
        });

        res.send(fileData);
      })
      .catch(async (err) => {
        if (err.code !== 'ENOENT') {
          throw err;
        }

        console.log('Fetching from origin ..');
        const response = await withPoolResource(requestPromiseInstance =>
          BPromise.resolve(requestPromiseInstance({
            url: opts.originBaseUrl + req.originalUrl,
            headers: _.omit(req.headers, HEADERS_TO_NOT_PROXY),
            resolveWithFullResponse: true,
            simple: false,
            encoding: null,
          }))
        );

        if (response.statusCode === 200 && response.body && opts.selector(req, response)) {
          const meta = {
            meta: {
              originalUrl: req.originalUrl,
              createdAt: moment().toISOString(),
            },
            headers: {
              'content-type': response.headers['content-type'],
            },
          };

          await fs.writeFileAsync(filePath, response.body, { encoding: null });
          await fs.writeFileAsync(filePathToMetaPath(filePath), JSON.stringify(meta, null, 2), {
            encoding: 'utf8',
          });
        }

        res.set('content-type', response.headers['content-type']);
        res.status(response.statusCode);

        if (!response.body) {
          res.end();
        } else {
          res.send(response.body);
        }

        return response;
      })
      .catch(err => next(err));
  };
}

function filePathToMetaPath(filePath) {
  return `${filePath}-meta.json`;
}

module.exports = createMiddleware;
