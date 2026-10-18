#!/usr/bin/env node
/**
 * Manual release from a developer machine: bump + promote CHANGELOG.md (shared with CI),
 * then commit, tag and push with local git. Run via `npm run version:<level>` so `verify`
 * runs first. CI ships the release once Test and E2E pass on the pushed commit.
 *
 *   node scripts/release.cjs [patch|minor|major]   (level may raise, never lower, what the commits since the last tag imply)
 */
'use strict';

const { prepareRelease } = require('./release/prepare.cjs');
const { commitLocal } = require('./release/commit-local.cjs');

const VALID_LEVELS = new Set(['patch', 'minor', 'major']);

function parseLevel(argv) {
  const level = argv[2];
  if (level === undefined) return undefined;
  if (!VALID_LEVELS.has(level)) throw new Error('Usage: node scripts/release.cjs [patch|minor|major]');
  return level;
}

function main() {
  const release = prepareRelease({ level: parseLevel(process.argv) });
  const { tag } = commitLocal(release);
  console.log(`Pushed ${tag} (${release.level} from ${release.previous}). CI publishes it once Test and E2E pass on that commit.`);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
