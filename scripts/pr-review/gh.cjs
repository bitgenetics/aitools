/**
 * Thin `gh` runner. Every GitHub read and write in the review pipeline goes through
 * `runGh`, so tests inject a recorder instead of a real CLI.
 */
'use strict';

const { spawnSync } = require('node:child_process');

/** @returns {string} stdout; throws with stderr on a non-zero exit */
function runGh(args, { input } = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8', input, shell: process.platform === 'win32' });
  if (result.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(' ')} failed: ${(result.stderr || '').trim()}`);
  return result.stdout;
}

module.exports = { runGh };
