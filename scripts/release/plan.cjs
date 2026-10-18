#!/usr/bin/env node
/**
 * Release plan: the next version follows from the Conventional Commits since the last
 * release tag; CHANGELOG.md must be consistent with the package version but does not
 * decide the level.
 *
 *   node scripts/release/plan.cjs   → level=…, previous=…, next=…, commits=…, invalid=…
 */
'use strict';

const fs = require('node:fs');
const changelog = require('../changelog.cjs');
const commits = require('../commits.cjs');
const { releaseTag } = require('./constants.cjs');

/**
 * Pure: what releasing `history` on top of `packageVersion` would do.
 * @param {{ changelogText: string, packageVersion: string, history: {subject: string, body?: string}[] }} input
 * @returns {{ level: string, previous: string, next: string|null, commits: number, invalid: string[] }}
 */
function planRelease({ changelogText, packageVersion, history }) {
  changelog.validate(changelogText, packageVersion);
  const { level, invalid } = commits.levelFromCommits(history);
  return {
    level,
    previous: packageVersion,
    next: level === 'none' ? null : changelog.nextVersion(packageVersion, level),
    commits: history.length,
    invalid,
  };
}

/** The plan for the checked-out tree: commits since the tag of the current package version. */
function currentPlan() {
  const packageVersion = changelog.readPackageVersion();
  return planRelease({
    changelogText: fs.readFileSync(changelog.CHANGELOG_PATH, 'utf8'),
    packageVersion,
    history: commits.commitsInRange(`${releaseTag(packageVersion)}..HEAD`),
  });
}

function formatPlan(p) {
  return `level=${p.level}\nprevious=${p.previous}\nnext=${p.next ?? ''}\ncommits=${p.commits}\ninvalid=${p.invalid.length}\n`;
}

if (require.main === module) {
  try {
    const p = currentPlan();
    process.stdout.write(formatPlan(p));
    for (const subject of p.invalid) console.error(`ignored non-conventional commit: ${subject}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

module.exports = { planRelease, currentPlan, formatPlan };
