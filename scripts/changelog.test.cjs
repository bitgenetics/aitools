'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  CHANGELOG_PATH,
  parseChangelog,
  deriveLevel,
  nextVersion,
  plan,
  promote,
  notes,
  unreleased,
  readPackageVersion,
} = require('./changelog.cjs');

const FIXTURE = [
  '# Changelog',
  '',
  'Intro paragraph.',
  '',
  '## [Unreleased]',
  '',
  '### Added',
  '- New `thing` command.',
  '',
  '### Fixed',
  '- Crash on empty input.',
  '',
  '## [1.2.3] - 2026-01-02',
  '',
  '### Fixed',
  '- Something old.',
  '',
  '## [1.2.2] - 2026-01-01',
  '',
  '### Changed',
  '- First change.',
  '',
  '[Unreleased]: https://github.com/bitgenetics/aitools/compare/v1.2.3...HEAD',
  '[1.2.3]: https://github.com/bitgenetics/aitools/compare/v1.2.2...v1.2.3',
  '[1.2.2]: https://github.com/bitgenetics/aitools/compare/v1.2.1...v1.2.2',
  '',
].join('\n');

function withUnreleased(body) {
  return FIXTURE.replace(/## \[Unreleased\][\s\S]*?(?=## \[1\.2\.3\])/, `## [Unreleased]\n${body}\n`);
}

test('parseChangelog splits head, sections and link definitions', () => {
  const parsed = parseChangelog(FIXTURE);
  assert.equal(parsed.eol, '\n');
  assert.deepEqual(parsed.head.slice(0, 3), ['# Changelog', '', 'Intro paragraph.']);
  assert.deepEqual(
    parsed.sections.map((s) => [s.label, s.date]),
    [['Unreleased', null], ['1.2.3', '2026-01-02'], ['1.2.2', '2026-01-01']],
  );
  assert.deepEqual(parsed.links.map((l) => l.label), ['Unreleased', '1.2.3', '1.2.2']);
});

test('parseChangelog rejects a subsection outside the Keep a Changelog set', () => {
  assert.throws(() => parseChangelog(withUnreleased('\n### Breaking\n- x\n')), /Unknown subsection "### Breaking"/);
});

test('deriveLevel is none when [Unreleased] has no bullets', () => {
  assert.equal(deriveLevel(parseChangelog(withUnreleased('\n### Added\n')).sections[0].lines), 'none');
});

test('deriveLevel is patch for bullets outside Added', () => {
  assert.equal(deriveLevel(parseChangelog(withUnreleased('\n### Fixed\n- a\n')).sections[0].lines), 'patch');
});

test('deriveLevel is minor when Added has a bullet', () => {
  assert.equal(deriveLevel(parseChangelog(FIXTURE).sections[0].lines), 'minor');
});

test('deriveLevel is major for a **Breaking:** bullet under any subsection', () => {
  const lines = parseChangelog(withUnreleased('\n### Changed\n- **Breaking:** renamed flag.\n')).sections[0].lines;
  assert.equal(deriveLevel(lines), 'major');
});

test('nextVersion bumps the requested component and resets the lower ones', () => {
  assert.equal(nextVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(nextVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(nextVersion('1.2.3', 'major'), '2.0.0');
});

test('plan reports level, previous and next', () => {
  assert.deepEqual(plan(FIXTURE, '1.2.3'), { level: 'minor', previous: '1.2.3', next: '1.3.0' });
});

test('plan throws when the top release does not match the package version', () => {
  assert.throws(() => plan(FIXTURE, '1.2.4'), /top release is 1\.2\.3 but packages are at 1\.2\.4/);
});

test('promote moves the [Unreleased] body under the new version and retargets links', () => {
  const out = promote(FIXTURE, '1.3.0', '2026-02-03');
  assert.match(out, /## \[Unreleased\]\n\n## \[1\.3\.0\] - 2026-02-03\n\n### Added\n- New `thing` command\./);
  assert.match(out, /\[Unreleased\]: https:\/\/github\.com\/bitgenetics\/aitools\/compare\/v1\.3\.0\.\.\.HEAD\n\[1\.3\.0\]: https:\/\/github\.com\/bitgenetics\/aitools\/compare\/v1\.2\.3\.\.\.v1\.3\.0\n\[1\.2\.3\]:/);
  assert.equal(deriveLevel(parseChangelog(out).sections[0].lines), 'none');
});

test('promote cannot run twice: the promoted file has nothing to promote', () => {
  const once = promote(FIXTURE, '1.3.0', '2026-02-03');
  assert.throws(() => promote(once, '1.4.0', '2026-02-04'), /Nothing to promote/);
});

test('promote keeps CRLF line endings when the input uses them', () => {
  const out = promote(FIXTURE.replace(/\n/g, '\r\n'), '1.3.0', '2026-02-03');
  assert.ok(out.includes('## [1.3.0] - 2026-02-03\r\n'));
  assert.ok(!/[^\r]\n/.test(out));
});

test('notes returns the section body plus a compare link to the previous version', () => {
  assert.equal(notes(FIXTURE, '1.2.3'), '### Fixed\n- Something old.\n\nFull changelog: https://github.com/bitgenetics/aitools/compare/v1.2.2...v1.2.3\n');
});

test('unreleased returns the trimmed [Unreleased] body', () => {
  assert.equal(unreleased(FIXTURE), '### Added\n- New `thing` command.\n\n### Fixed\n- Crash on empty input.');
});

test('the real CHANGELOG.md parses and its top release matches the package version', () => {
  const text = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  assert.doesNotThrow(() => plan(text, readPackageVersion()));
});
