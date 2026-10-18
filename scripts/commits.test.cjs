'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseCommit, levelOf, strongerLevel, levelFromCommits, commitsInRange } = require('./commits.cjs');

test('parseCommit reads type, scope, bang and description', () => {
  assert.deepEqual(parseCommit('feat(cli)!: new flag'), { type: 'feat', scope: 'cli', breaking: true, description: 'new flag' });
});

test('parseCommit returns null for a subject without a conventional prefix', () => {
  assert.equal(parseCommit('Fixed the thing'), null);
});

test('parseCommit returns null for an unknown type', () => {
  assert.equal(parseCommit('wip: half done'), null);
});

test('parseCommit marks a commit breaking from a BREAKING CHANGE footer', () => {
  const parsed = parseCommit('fix(core): drop old lock field', 'Details.\n\nBREAKING CHANGE: lock.context is gone.');
  assert.equal(parsed.breaking, true);
});

test('levelOf maps feat to minor, fix to patch, chore to none, breaking to major', () => {
  assert.equal(levelOf(parseCommit('feat: x')), 'minor');
  assert.equal(levelOf(parseCommit('fix: x')), 'patch');
  assert.equal(levelOf(parseCommit('chore: x')), 'none');
  assert.equal(levelOf(parseCommit('chore!: x')), 'major');
});

test('strongerLevel keeps the higher of two levels', () => {
  assert.equal(strongerLevel('patch', 'minor'), 'minor');
  assert.equal(strongerLevel('major', 'none'), 'major');
});

test('levelFromCommits takes the strongest level across commits', () => {
  const { level } = levelFromCommits([{ subject: 'docs: readme' }, { subject: 'fix: a' }, { subject: 'feat: b' }]);
  assert.equal(level, 'minor');
});

test('levelFromCommits is none for an empty range', () => {
  assert.deepEqual(levelFromCommits([]), { level: 'none', invalid: [] });
});

test('levelFromCommits reports non-conventional subjects without counting them', () => {
  const { level, invalid } = levelFromCommits([{ subject: 'Big rewrite' }, { subject: 'fix: a' }]);
  assert.equal(level, 'patch');
  assert.deepEqual(invalid, ['Big rewrite']);
});

/** A throwaway repo with two commits, so the test does not depend on the checkout's history depth. */
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'commits-test-'));
  const git = (...args) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
  };
  git('init', '-q');
  git('commit', '-q', '--allow-empty', '-m', 'chore: first');
  git('commit', '-q', '--allow-empty', '-m', 'fix(core): drop field\n\nBREAKING CHANGE: field is gone.');
  return dir;
}

test('commitsInRange reads subject and body from git log', () => {
  const commits = commitsInRange('HEAD~1..HEAD', makeRepo());
  assert.deepEqual(commits, [{ subject: 'fix(core): drop field', body: 'BREAKING CHANGE: field is gone.\n' }]);
});

test('commitsInRange is empty when the range has no commits', () => {
  assert.deepEqual(commitsInRange('HEAD..HEAD', makeRepo()), []);
});
