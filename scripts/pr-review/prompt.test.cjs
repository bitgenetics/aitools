'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPrompt } = require('./prompt.cjs');
const { MAX_DIFF_CHARS } = require('./constants.cjs');

const PR = {
  number: 7,
  title: 'fix(cli): thing',
  body: 'Fixes the thing.',
  author: { login: 'octocat' },
  baseRefName: 'main',
  headRefName: 'fix/thing',
  commits: [{ oid: 'abcdef1234567', messageHeadline: 'fix(cli): thing' }],
  files: [{ path: 'packages/cli/src/x.ts', additions: 3, deletions: 1 }],
};

test('buildPrompt places instructions first, then PR metadata, diff and the verdict format', () => {
  const prompt = buildPrompt({ instructions: '# Rules\nBe strict.', pr: PR, diff: 'diff --git a b\n+x\n' });
  const order = ['# Rules', '# Pull request #7: fix(cli): thing', '- abcdef1 fix(cli): thing', '- packages/cli/src/x.ts (+3 −1)', '```diff\ndiff --git a b\n+x\n```', '"verdict": "approve" | "request_changes"'];
  let last = -1;
  for (const marker of order) {
    const at = prompt.indexOf(marker);
    assert.ok(at > last, `expected "${marker}" after the previous marker`);
    last = at;
  }
});

test('buildPrompt truncates an oversized diff and says so', () => {
  const prompt = buildPrompt({ instructions: 'x', pr: PR, diff: 'y'.repeat(MAX_DIFF_CHARS + 10) });
  assert.match(prompt, /\[diff truncated at \d+ characters; read the files in the checkout for the rest\]/);
});

test('buildPrompt shows (empty) for a PR without a description', () => {
  assert.match(buildPrompt({ instructions: 'x', pr: { ...PR, body: '' }, diff: '' }), /## Description\n\n\(empty\)/);
});
