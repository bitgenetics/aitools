'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { applyVerdict } = require('./act.cjs');
const { REVIEW_BOT_LOGIN } = require('./constants.cjs');

/** Records every gh call; answers the reviews listing with `reviews`. */
function fakeGh(reviews) {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    if (args[0] === 'api' && args[1].endsWith('/reviews') && args[2] === '--paginate') return JSON.stringify(reviews);
    return '';
  };
  return { gh, calls };
}

const INPUT = { repo: 'o/r', number: 9, headSha: 'abc', headRef: 'feat/x', body: 'B' };

test('approve submits an APPROVE review, merges with a merge commit at the head sha, and deletes the branch', () => {
  const { gh, calls } = fakeGh([]);
  const out = applyVerdict({ ...INPUT, verdict: 'approve', gh });
  assert.deepEqual(out, { action: 'merged', dismissed: 0 });
  assert.deepEqual(calls.slice(1), [
    ['api', '-X', 'POST', 'repos/o/r/pulls/9/reviews', '-f', 'event=APPROVE', '-f', 'body=B'],
    ['api', '-X', 'PUT', 'repos/o/r/pulls/9/merge', '-f', 'merge_method=merge', '-f', 'sha=abc'],
    ['api', '-X', 'DELETE', 'repos/o/r/git/refs/heads/feat/x'],
  ]);
});

test('request_changes submits a REQUEST_CHANGES review and does not merge', () => {
  const { gh, calls } = fakeGh([]);
  const out = applyVerdict({ ...INPUT, verdict: 'request_changes', gh });
  assert.equal(out.action, 'changes_requested');
  assert.deepEqual(calls.slice(1), [['api', '-X', 'POST', 'repos/o/r/pulls/9/reviews', '-f', 'event=REQUEST_CHANGES', '-f', 'body=B']]);
});

test('earlier approve/changes-requested reviews by the bot are dismissed first; others are left alone', () => {
  const { gh, calls } = fakeGh([
    { id: 1, state: 'CHANGES_REQUESTED', user: { login: REVIEW_BOT_LOGIN } },
    { id: 2, state: 'COMMENTED', user: { login: REVIEW_BOT_LOGIN } },
    { id: 3, state: 'APPROVED', user: { login: 'human' } },
  ]);
  const out = applyVerdict({ ...INPUT, verdict: 'approve', gh });
  assert.equal(out.dismissed, 1);
  assert.deepEqual(calls[1], ['api', '-X', 'PUT', 'repos/o/r/pulls/9/reviews/1/dismissals', '-f', 'message=Superseded by a newer automated review.']);
});
