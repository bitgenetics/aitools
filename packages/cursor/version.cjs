const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

module.exports = { CURSOR_CLI_VERSION: pkg.version };
