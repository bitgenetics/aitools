'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { REPO_ROOT } = require('./constants.cjs');

/** Run git in the repo root; returns trimmed stdout, throws with stderr on failure. */
function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return (result.stdout ?? '').trim();
}

/** Run npm in the repo root with inherited stdio. Windows needs a shell: npm is npm.cmd. */
function runNpm(args) {
  const result = spawnSync('npm', args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} failed`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = { runGit, runNpm, readJson };
