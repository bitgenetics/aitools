/** Commit, tag and push a prepared release with the local git client (manual path). */
'use strict';

const { RELEASE_BRANCH, releaseCommitMessage, releaseTag } = require('./constants.cjs');
const { runGit } = require('./exec.cjs');

function commitLocal({ version, changedFiles }) {
  const tag = releaseTag(version);
  runGit(['add', '--', ...changedFiles]);
  runGit(['commit', '-m', releaseCommitMessage(version)]);
  runGit(['tag', tag]);
  // Atomic: either both the branch and the tag land, or neither (an existing remote tag rejects the push).
  runGit(['push', '--atomic', 'origin', `HEAD:${RELEASE_BRANCH}`, `refs/tags/${tag}`], { stdio: 'inherit' });
  return { tag };
}

module.exports = { commitLocal };
