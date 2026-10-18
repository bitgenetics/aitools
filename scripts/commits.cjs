#!/usr/bin/env node
/**
 * Conventional Commits → release level. The commits since the last release tag decide
 * whether the next version is major, minor or patch; CHANGELOG.md only supplies the notes.
 *
 *   feat                      → minor
 *   fix, perf, revert         → patch
 *   "!" after the type/scope, or a "BREAKING CHANGE:" / "BREAKING-CHANGE:" footer → major
 *   anything else (build, chore, ci, docs, refactor, style, test) → none
 * Merge commits are ignored.
 *
 * CLI (used by the PR gate):
 *   node scripts/commits.cjs check <range>          → exit 1 listing non-conventional subjects
 *   node scripts/commits.cjs check-subject <text>   → exit 1 when <text> is not conventional
 */
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
/** Ordered weakest to strongest; `none` means "nothing to release". */
const LEVELS = ['none', 'patch', 'minor', 'major'];
const SUBJECT = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<bang>!)?: (?<description>.+)$/;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: /m;
const MINOR_TYPES = new Set(['feat']);
const PATCH_TYPES = new Set(['fix', 'perf', 'revert']);
const KNOWN_TYPES = new Set([...MINOR_TYPES, ...PATCH_TYPES, 'build', 'chore', 'ci', 'docs', 'refactor', 'style', 'test']);

/**
 * @returns {{type: string, scope: string|null, breaking: boolean, description: string} | null}
 *   null when the subject is not conventional or uses an unknown type
 */
function parseCommit(subject, body = '') {
  const match = SUBJECT.exec(subject.trim());
  if (!match) return null;
  const { type, scope, bang, description } = match.groups;
  if (!KNOWN_TYPES.has(type)) return null;
  return { type, scope: scope ?? null, breaking: Boolean(bang) || BREAKING_FOOTER.test(body), description };
}

function levelOf(commit) {
  if (commit.breaking) return 'major';
  if (MINOR_TYPES.has(commit.type)) return 'minor';
  if (PATCH_TYPES.has(commit.type)) return 'patch';
  return 'none';
}

function strongerLevel(a, b) {
  return LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b;
}

/**
 * Highest level among the commits. Non-conventional subjects are listed in `invalid`
 * and contribute nothing; the PR gate rejects them before they can reach main.
 * @param {{subject: string, body?: string}[]} commits
 */
function levelFromCommits(commits) {
  let level = 'none';
  const invalid = [];
  for (const { subject, body } of commits) {
    const parsed = parseCommit(subject, body);
    if (!parsed) {
      invalid.push(subject);
      continue;
    }
    level = strongerLevel(level, levelOf(parsed));
  }
  return { level, invalid };
}

/** Non-merge commits in `range` (e.g. "v3.6.5..HEAD"), newest first. */
function commitsInRange(range) {
  const result = spawnSync('git', ['log', '--no-merges', '--format=%s%x00%b%x1e', range], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`git log ${range} failed: ${(result.stderr || '').trim()}`);
  return result.stdout
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.trim() !== '')
    .map((record) => {
      const [subject, body = ''] = record.split('\x00');
      return { subject: subject.trim(), body };
    });
}

function formatInvalid(subjects) {
  return [
    `${subjects.length} commit subject(s) do not follow Conventional Commits (<type>(<scope>)!: <description>; types: ${[...KNOWN_TYPES].join(', ')}):`,
    ...subjects.map((s) => `  - ${s}`),
  ].join('\n');
}

function cli(argv) {
  const [verb, arg] = argv;
  switch (verb) {
    case 'check': {
      if (!arg) throw new Error('Usage: commits.cjs check <range>');
      const commits = commitsInRange(arg);
      const { level, invalid } = levelFromCommits(commits);
      if (invalid.length > 0) throw new Error(formatInvalid(invalid));
      return `${commits.length} commit(s) in ${arg} are conventional; level=${level}\n`;
    }
    case 'check-subject': {
      if (!arg) throw new Error('Usage: commits.cjs check-subject <subject>');
      const parsed = parseCommit(arg);
      if (!parsed) throw new Error(formatInvalid([arg]));
      return `level=${levelOf(parsed)}\n`;
    }
    default:
      throw new Error('Usage: node scripts/commits.cjs <check <range> | check-subject <subject>>');
  }
}

if (require.main === module) {
  try {
    process.stdout.write(cli(process.argv.slice(2)));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

module.exports = { LEVELS, KNOWN_TYPES, parseCommit, levelOf, strongerLevel, levelFromCommits, commitsInRange };
