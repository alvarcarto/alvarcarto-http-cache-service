const BPromise = require('bluebird');
const crypto = require('crypto');
const requestPromise = require('request-promise');
const _ = require('lodash');
const path = require('path');
const fs = require('fs');

BPromise.promisifyAll(fs);

function createMiddleware(_opts = {}) {
  const opts = _.merge({
    // Express docs:
    //   GET /search?q=something
    //   req.originalUrl
    //   => "/search?q=something"
    encodeKey: req => crypto.createHash('sha256').update(req.originalUrl).digest('hex'),
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

    const key = opts.encodeKey(req);
    const filePath = path.join(opts.cacheDir, key);

    return fs.readFileAsync(filePath, { encoding: null })
      .then((bytes) => {
        console.log(`Serving ${key} from cache ..`);
        res.send(bytes);
      })
      .catch((err) => {
        if (err.code === 'ENOENT') {
          console.log('Fetching from origin ..');

          return BPromise.resolve(requestPromise({
            url: opts.originBaseUrl + req.originalUrl,
            resolveWithFullResponse: true,
            simple: false,
            encoding: null,
          }))
            .tap((response) => {
              if (response.body) {
                return fs.writeFileAsync(filePath, response.body, { encoding: null });
              }

              return BPromise.resolve();
            })
            .then((response) => {
              res.status(response.statusCode);
              if (!response.body) {
                res.end();
              } else {
                res.send(response.body);
              }

              return response;
            });
        }

        throw err;
      });
  };
}

module.exports = createMiddleware;
