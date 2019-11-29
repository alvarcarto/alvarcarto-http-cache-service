const fs = require('fs');
const path = require('path');
const BPromise = require('bluebird');
const bytes = require('bytes');
const _ = require('lodash');
const chalk = require('chalk');
const find = require('find');
const getFolderSize = require('get-folder-size');

// This watcher doesn't guarantee that we won't write over the give folder size,
// but it's a lot more performant than doing this check before each cache write.

BPromise.promisifyAll(fs);
BPromise.promisifyAll(find);
const getFolderSizeAsync = BPromise.promisify(getFolderSize);

let timeout;

function startWatchLoop(_opts = {}) {
  const opts = _.merge({
    maxCacheDirBytes: bytes.parse('100GB'),

    // Once every few minutes
    interval: 1000 * 60 * 2
  }, _opts, {
    maxCacheDirBytes: bytes.parse(_opts.maxCacheDirSize),
  });

  if (!opts.cacheDir) {
    throw new Error('opts.cacheDir is required for cache cleaner');
  }

  iteration(opts);
}

async function iteration(opts) {
  try {
    await cleanCacheDir(opts);
  } catch (err) {
    console.error(chalk.red(`Error when cleaning cache dir: ${err}`));
    if (err.stack) {
      console.error(chalk.red(err.stack));
    }

    throw err;
  }

  timeout = setTimeout(() => iteration(opts), opts.interval);
}

function stopWatchLoop() {
  clearTimeout(timeout);
}

function removeFromStringEnd(str, removeStr) {
  return str.substring(0, str.length - removeStr.length);
}

async function deleteOldFiles(cacheDir, bytesToDelete) {
  const files = _.map(await fs.readdirAsync(cacheDir), name => path.join(cacheDir, name));

  const metaFiles = _.filter(files, name => _.endsWith(name, '-meta.json'));
  const metadatas = await BPromise.map(metaFiles, async (filePath) => {
    const content = await fs.readFileAsync(filePath, { encoding: 'utf8' });
    const data = JSON.parse(content);
    return _.extend({}, data, {
      filePath,
      createdAt: _.get(data, 'meta.createdAt'),
    });
  });

  const sorted = _.sortBy(metadatas, 'createdAt');
  let bytesDeleted;
  let filesDeleted = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const metadata = sorted[i];
    const stats = await fs.statAsync(metadata.filePath);
    const nonMetaFilePath = removeFromStringEnd(metadata.filePath, '-meta.json');
    await fs.unlinkAsync(metadata.filePath);
    await fs.unlinkAsync(nonMetaFilePath);

    bytesDeleted += stats.size;
    filesDeleted += 2;
    if (bytesDeleted > bytesToDelete) {
      break;
    }
  }

  console.log(`Deleted ${filesDeleted} files to clean cache directory`);
}

async function cleanCacheDir(opts) {
  const dirSizeBytes = await getFolderSizeAsync(opts.cacheDir);

  console.log('Cache directory size:', bytes(dirSizeBytes));
  if (dirSizeBytes > opts.maxCacheDirBytes) {
    const bytesToClean = (dirSizeBytes - opts.maxCacheDirBytes) * 2;
    console.log('Cleaning', bytes(bytesToClean), 'from cache dir');
    await deleteOldFiles(opts.cacheDir, bytesToClean);
  } else {
    console.log('No cleaning needed.');
  }
}


module.exports = {
  startWatchLoop,
  stopWatchLoop,
};
