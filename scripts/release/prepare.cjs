/**
 * Shared release preparation for the manual (release.cjs) and CI (release-ci.cjs) paths:
 * check the tree is releasable, bump every workspace to the version the commits imply,
 * and promote [Unreleased]. Touches the working tree only; committing is the caller's job.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const changelog = require('../changelog.cjs');
const { LEVELS } = require('../commits.cjs');
const { currentPlan } = require('./plan.cjs');
const { REPO_ROOT, RELEASE_BRANCH, PUBLISHED_PACKAGES, releaseTag } = require('./constants.cjs');
const { runGit, runNpm, readJson } = require('./exec.cjs');

const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function assertCleanTree() {
  if (runGit(['status', '--porcelain'])) {
    throw new Error('Working tree is not clean; commit or stash before releasing.');
  }
}

function assertOnReleaseBranch() {
  const branch = runGit(['branch', '--show-current']);
  if (branch !== RELEASE_BRANCH) throw new Error(`Releases are cut from ${RELEASE_BRANCH}; current branch is "${branch || 'detached HEAD'}".`);
}

function assertAtRemoteTip() {
  runGit(['fetch', 'origin', RELEASE_BRANCH]);
  const head = runGit(['rev-parse', 'HEAD']);
  const remote = runGit(['rev-parse', `origin/${RELEASE_BRANCH}`]);
  if (head !== remote) throw new Error(`HEAD is not the tip of origin/${RELEASE_BRANCH}; pull first.`);
}

/** An explicit level may raise the commit-derived one, never lower it. */
function chooseLevel(derived, explicit) {
  if (!explicit) return derived;
  if (LEVELS.indexOf(explicit) < LEVELS.indexOf(derived)) {
    throw new Error(`Requested a ${explicit} release but the commits since the last tag require at least ${derived}.`);
  }
  return explicit;
}

function workspacePackageJsons() {
  return fs
    .readdirSync(PACKAGES_DIR)
    .map((name) => path.join('packages', name, 'package.json'))
    .filter((rel) => fs.existsSync(path.join(REPO_ROOT, rel)));
}

function assertPublishedPackagesAt(version) {
  for (const name of PUBLISHED_PACKAGES) {
    const file = path.join(PACKAGES_DIR, name, 'package.json');
    const actual = readJson(file).version;
    if (actual !== version) throw new Error(`packages/${name}/package.json is ${actual}; expected ${version} after bump.`);
  }
}

/**
 * @param {{ level?: 'patch'|'minor'|'major', today?: string }} options
 * @returns {{ version: string, previous: string, level: string, changedFiles: string[] }} paths relative to the repo root
 */
function prepareRelease(options = {}) {
  assertCleanTree();
  assertOnReleaseBranch();
  assertAtRemoteTip();

  const planned = currentPlan();
  const level = chooseLevel(planned.level, options.level);
  if (level === 'none') {
    throw new Error(`Nothing to release: no feat, fix or breaking commits since ${releaseTag(planned.previous)}.`);
  }
  const version = changelog.nextVersion(planned.previous, level);

  const text = fs.readFileSync(changelog.CHANGELOG_PATH, 'utf8');
  runNpm(['version', version, '--workspaces', '--no-git-tag-version']);
  assertPublishedPackagesAt(version);
  fs.writeFileSync(changelog.CHANGELOG_PATH, changelog.promote(text, version, options.today ?? todayIso()));

  return { version, previous: planned.previous, level, changedFiles: ['CHANGELOG.md', 'package-lock.json', ...workspacePackageJsons()] };
}

module.exports = { prepareRelease, chooseLevel };
