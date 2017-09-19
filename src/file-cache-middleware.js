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

    return BPromise.props({
      fileData: fs.readFileAsync(filePath, { encoding: null }),
      fileMeta: fs.readFileAsync(filePathToMetaPath(filePath), { encoding: 'utf8' })
        .then(content => JSON.parse(content)),
    })
      .then(({ fileData, fileMeta }) => {
        console.log(`Serving ${key} from cache ..`);
        _.forEach(fileMeta.headers, (headerVal, headerKey) => {
          res.set(headerKey, headerVal);
        });

        res.send(fileData);
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
              if (response.statusCode === 200 && response.body) {
                const meta = {
                  meta: {
                    originalUrl: req.originalUrl,
                  },
                  headers: {
                    'content-type': response.headers['content-type'],
                  },
                };

                return fs.writeFileAsync(filePath, response.body, { encoding: null })
                  .then(() => fs.writeFileAsync(filePathToMetaPath(filePath), JSON.stringify(meta, null, 2), { encoding: 'utf8' }));
              }

              return BPromise.resolve();
            })
            .then((response) => {
              res.set('content-type', response.headers['content-type']);
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
      })
      .catch(err => next(err));
  };
}

function filePathToMetaPath(filePath) {
  return `${filePath}-meta.json`;
}

module.exports = createMiddleware;
