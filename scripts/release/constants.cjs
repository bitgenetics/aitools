'use strict';

const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RELEASE_BRANCH = 'main';
/** Workspaces published to npm; all must carry the released version. */
const PUBLISHED_PACKAGES = ['core', 'cursor', 'cli'];

function releaseCommitMessage(version) {
  return `chore(release): v${version}`;
}

function releaseTag(version) {
  return `v${version}`;
}

module.exports = { REPO_ROOT, RELEASE_BRANCH, PUBLISHED_PACKAGES, releaseCommitMessage, releaseTag };
