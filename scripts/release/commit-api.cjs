/**
 * Commit and tag a prepared release through the GitHub API (CI path). Commits created
 * with createCommitOnBranch are signed by GitHub, which satisfies the branch ruleset's
 * signature requirement; a push from a runner's git client would not be.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { REPO_ROOT, RELEASE_BRANCH, releaseCommitMessage, releaseTag } = require('./constants.cjs');

const API_URL = 'https://api.github.com';

const CREATE_COMMIT = `
mutation ($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) { commit { oid url } }
}`;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set.`);
  return value;
}

async function request(url, token, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`${url} → ${response.status}: ${JSON.stringify(json)}`);
  return json;
}

async function createCommit({ token, repository, expectedHeadOid, version, changedFiles }) {
  const additions = changedFiles.map((rel) => ({
    path: rel.split(path.sep).join('/'),
    contents: fs.readFileSync(path.join(REPO_ROOT, rel)).toString('base64'),
  }));
  const input = {
    branch: { repositoryNameWithOwner: repository, branchName: RELEASE_BRANCH },
    message: { headline: releaseCommitMessage(version) },
    expectedHeadOid,
    fileChanges: { additions },
  };
  const json = await request(`${API_URL}/graphql`, token, { query: CREATE_COMMIT, variables: { input } });
  if (json.errors) throw new Error(`createCommitOnBranch failed: ${JSON.stringify(json.errors)}`);
  return json.data.createCommitOnBranch.commit;
}

async function createTag({ token, repository, version, sha }) {
  await request(`${API_URL}/repos/${repository}/git/refs`, token, { ref: `refs/tags/${releaseTag(version)}`, sha });
}

/** Env: GH_TOKEN (App installation token), GITHUB_REPOSITORY, GITHUB_SHA (expected tip of main). */
async function commitViaApi({ version, changedFiles }) {
  const token = requiredEnv('GH_TOKEN');
  const repository = requiredEnv('GITHUB_REPOSITORY');
  const expectedHeadOid = requiredEnv('GITHUB_SHA');
  const commit = await createCommit({ token, repository, expectedHeadOid, version, changedFiles });
  await createTag({ token, repository, version, sha: commit.oid });
  return { oid: commit.oid, url: commit.url, tag: releaseTag(version) };
}

module.exports = { commitViaApi };
