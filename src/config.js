/* eslint-disable no-process-env */

const path = require('path');

module.exports = {
  PORT: process.env.PORT || 7000,
  NODE_ENV: process.env.NODE_ENV,
  CACHE_DIR: process.env.CACHE_DIR || path.join(__dirname, '../cache'),
  ORIGIN_BASE_URL: process.env.ORIGIN_BASE_URL || 'http://51.255.81.67:12001',
};
