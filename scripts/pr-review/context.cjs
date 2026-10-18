/**
 * Everything the reviewer needs to know about one pull request, read through `gh`.
 */
'use strict';

const { runGh } = require('./gh.cjs');

const PR_FIELDS = 'number,title,body,author,baseRefName,headRefName,headRefOid,commits,files';

/**
 * @param {{ repo: string, number: number, gh?: typeof runGh }} input
 * @returns {{ pr: object, diff: string }}
 */
function loadPullRequest({ repo, number, gh = runGh }) {
  const pr = JSON.parse(gh(['pr', 'view', String(number), '--repo', repo, '--json', PR_FIELDS]));
  const diff = gh(['pr', 'diff', String(number), '--repo', repo]);
  return { pr, diff };
}

module.exports = { loadPullRequest, PR_FIELDS };
