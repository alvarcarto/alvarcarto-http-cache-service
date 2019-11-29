/* eslint-disable no-process-env */

const path = require('path');

const config = {
  PORT: process.env.PORT || 7000,
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  CACHE_INCLUDE_MIME_TYPES: process.env.CACHE_INCLUDE_MIME_TYPES,
  CACHE_EXCLUDE_MIME_TYPES: process.env.CACHE_EXCLUDE_MIME_TYPES,
  CACHE_DIR: process.env.CACHE_DIR || path.join(__dirname, '../cache'),
  ORIGIN_BASE_URL: process.env.ORIGIN_BASE_URL || 'http://54.36.173.210',
  MAX_CONCURRENT_REQUESTS_TO_ORIGIN: 3,
};

if (process.env.MAX_CONCURRENT_REQUESTS_TO_ORIGIN) {
  config.MAX_CONCURRENT_REQUESTS_TO_ORIGIN = Number(process.env.MAX_CONCURRENT_REQUESTS_TO_ORIGIN);
}

if (process.env.CACHE_INCLUDE_MIME_TYPES) {
  config.CACHE_INCLUDE_MIME_TYPES = process.env.CACHE_INCLUDE_MIME_TYPES.split(' ');
} else {
  config.CACHE_INCLUDE_MIME_TYPES = ['*'];
}

if (process.env.CACHE_EXCLUDE_MIME_TYPES) {
  config.CACHE_EXCLUDE_MIME_TYPES = process.env.CACHE_EXCLUDE_MIME_TYPES.split(' ');
} else {
  config.CACHE_EXCLUDE_MIME_TYPES = [];
}

module.exports = config;
