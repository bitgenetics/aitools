'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { planRelease, formatPlan } = require('./plan.cjs');

const CHANGELOG = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '### Fixed',
  '- A fix.',
  '',
  '## [1.2.3] - 2026-01-02',
  '',
  '### Fixed',
  '- Something old.',
  '',
  '[Unreleased]: https://github.com/bitgenetics/aitools/compare/v1.2.3...HEAD',
  '[1.2.3]: https://github.com/bitgenetics/aitools/compare/v1.2.2...v1.2.3',
  '',
].join('\n');

test('planRelease derives the next version from the commits, not the changelog', () => {
  const p = planRelease({ changelogText: CHANGELOG, packageVersion: '1.2.3', history: [{ subject: 'feat: x' }] });
  assert.deepEqual(p, { level: 'minor', previous: '1.2.3', next: '1.3.0', commits: 1, invalid: [] });
});

test('planRelease is none when only non-releasing commits exist, even with changelog bullets', () => {
  const p = planRelease({ changelogText: CHANGELOG, packageVersion: '1.2.3', history: [{ subject: 'docs: y' }] });
  assert.equal(p.level, 'none');
  assert.equal(p.next, null);
});

test('planRelease throws when the changelog top release does not match the package version', () => {
  assert.throws(
    () => planRelease({ changelogText: CHANGELOG, packageVersion: '1.2.4', history: [] }),
    /top release is 1\.2\.3 but packages are at 1\.2\.4/,
  );
});

test('formatPlan prints one key=value per line for GITHUB_OUTPUT', () => {
  const p = planRelease({ changelogText: CHANGELOG, packageVersion: '1.2.3', history: [{ subject: 'fix!: z' }, { subject: 'nope' }] });
  assert.equal(formatPlan(p), 'level=major\nprevious=1.2.3\nnext=2.0.0\ncommits=2\ninvalid=1\n');
});
