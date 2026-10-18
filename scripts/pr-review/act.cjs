/**
 * Applies a verdict to GitHub: dismiss this bot's earlier reviews, then either approve
 * and merge (merge commit, branch deleted) or request changes. Every call goes through
 * the injected `gh`, which must carry the release App token so the merge triggers CI.
 */
'use strict';

const { runGh } = require('./gh.cjs');
const { REVIEW_BOT_LOGIN, MERGE_METHOD } = require('./constants.cjs');

const DISMISSABLE = new Set(['APPROVED', 'CHANGES_REQUESTED']);

function dismissEarlierReviews({ repo, number, gh }) {
  const reviews = JSON.parse(gh(['api', `repos/${repo}/pulls/${number}/reviews`, '--paginate']));
  const mine = reviews.filter((r) => r.user?.login === REVIEW_BOT_LOGIN && DISMISSABLE.has(r.state));
  for (const review of mine) {
    gh(['api', '-X', 'PUT', `repos/${repo}/pulls/${number}/reviews/${review.id}/dismissals`, '-f', 'message=Superseded by a newer automated review.']);
  }
  return mine.length;
}

function submitReview({ repo, number, event, body, gh }) {
  gh(['api', '-X', 'POST', `repos/${repo}/pulls/${number}/reviews`, '-f', `event=${event}`, '-f', `body=${body}`]);
}

function merge({ repo, number, headSha, headRef, gh }) {
  gh(['api', '-X', 'PUT', `repos/${repo}/pulls/${number}/merge`, '-f', `merge_method=${MERGE_METHOD}`, '-f', `sha=${headSha}`]);
  gh(['api', '-X', 'DELETE', `repos/${repo}/git/refs/heads/${headRef}`]);
}

/**
 * @param {{ repo: string, number: number, headSha: string, headRef: string, verdict: 'approve'|'request_changes', body: string, gh?: typeof runGh }} input
 * @returns {{ action: 'merged'|'changes_requested', dismissed: number }}
 */
function applyVerdict({ repo, number, headSha, headRef, verdict, body, gh = runGh }) {
  const dismissed = dismissEarlierReviews({ repo, number, gh });
  if (verdict === 'approve') {
    submitReview({ repo, number, event: 'APPROVE', body, gh });
    merge({ repo, number, headSha, headRef, gh });
    return { action: 'merged', dismissed };
  }
  submitReview({ repo, number, event: 'REQUEST_CHANGES', body, gh });
  return { action: 'changes_requested', dismissed };
}

module.exports = { applyVerdict };
