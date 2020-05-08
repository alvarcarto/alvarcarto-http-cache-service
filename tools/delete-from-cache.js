const fs = require('fs');
const path = require('path');
const BPromise = require('bluebird');
const _ = require('lodash');
const Confirm = require('prompt-confirm');
const find = require('find');
const config = require('../src/config');

BPromise.promisifyAll(fs);
BPromise.promisifyAll(find);

function removeFromStringEnd(str, removeStr) {
  return str.substring(0, str.length - removeStr.length);
}

async function deleteFilesMatching(cacheDir, pattern) {
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

  const regexPattern = new RegExp(pattern);
  const metadatasToDelete = _.filter(metadatas, (metadata) => {
    return regexPattern.test(metadata.meta.originalUrl);
  });

  _.forEach(metadatasToDelete, (metadata) => {
    console.log('Deleting cache for', metadata.meta.originalUrl);
  });
  console.log('');
  const shouldDelete = await new Confirm('Delete the above paths?').run();

  if (!shouldDelete) {
    console.log('Will not delete. Exiting..');
    return;
  }

  for (let i = 0; i < metadatasToDelete.length; i += 1) {
    const metadata = metadatasToDelete[i];

    const nonMetaFilePath = removeFromStringEnd(metadata.filePath, '-meta.json');
    await fs.unlinkAsync(metadata.filePath);
    await fs.unlinkAsync(nonMetaFilePath);
  }

  console.log(`Deleted ${metadatasToDelete.length} paths from cache`);
}

async function main() {
  const pattern = process.argv[2];
  if (!pattern) {
    console.error(`Usage: ${process.argv[1]} <pattern>`);
    process.exit(2);
  }

  await deleteFilesMatching(config.CACHE_DIR, pattern);
}

main();
