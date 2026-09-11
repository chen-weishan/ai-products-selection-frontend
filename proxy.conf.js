const fs = require('node:fs');
const path = require('node:path');

const backendDirectory = process.env.SSDS_BACKEND_DIR
  ? path.resolve(process.env.SSDS_BACKEND_DIR)
  : path.resolve(__dirname, '../ai-products-selection-backend/chen-weishan');
const backendEnvPath = path.join(backendDirectory, '.env');

function readEnvValue(name) {
  if (process.env[name]) {
    return process.env[name];
  }

  if (!fs.existsSync(backendEnvPath)) {
    return undefined;
  }

  const line = fs.readFileSync(backendEnvPath, 'utf8')
    .split(/\r?\n/)
    .find(candidate => candidate.trimStart().startsWith(`${name}=`));

  if (!line) {
    return undefined;
  }

  const value = line.slice(line.indexOf('=') + 1).trim();
  return value.replace(/^(['"])(.*)\1$/, '$2');
}

const username = readEnvValue('DEV_BASIC_AUTH_USERNAME') || 'ssds-dev';
const password = readEnvValue('DEV_BASIC_AUTH_PASSWORD');

if (!password) {
  throw new Error(
    `Missing DEV_BASIC_AUTH_PASSWORD. Set it in ${backendEnvPath} or in the shell environment.`
  );
}

module.exports = {
  '/api': {
    target: 'http://localhost:8080',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    }
  }
};
