'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseVerdict, renderReviewBody } = require('./verdict.cjs');

function reply(json, prose = 'Looked at everything.\n\n') {
  return `${prose}\`\`\`json\n${JSON.stringify(json)}\n\`\`\`\n`;
}

test('parseVerdict reads an approve verdict with no findings', () => {
  assert.deepEqual(parseVerdict(reply({ verdict: 'approve', summary: 'Fine.', findings: [] })), {
    verdict: 'approve',
    summary: 'Fine.',
    findings: [],
  });
});

test('parseVerdict uses the last json block when the reply contains several', () => {
  const text = reply({ verdict: 'request_changes', summary: 'draft' }) + reply({ verdict: 'approve', summary: 'Final.', findings: [] });
  assert.equal(parseVerdict(text).verdict, 'approve');
});

test('parseVerdict normalises a finding without a line to line null', () => {
  const v = parseVerdict(reply({ verdict: 'approve', summary: 'ok', findings: [{ severity: 'suggestion', file: 'a.ts', message: 'm' }] }));
  assert.deepEqual(v.findings, [{ severity: 'suggestion', file: 'a.ts', line: null, message: 'm' }]);
});

test('parseVerdict rejects request_changes without a blocking finding', () => {
  assert.throws(() => parseVerdict(reply({ verdict: 'request_changes', summary: 'x', findings: [] })), /needs at least one blocking/);
});

test('parseVerdict rejects approve that carries a blocking finding', () => {
  const json = { verdict: 'approve', summary: 'x', findings: [{ severity: 'blocking', file: 'a.ts', message: 'bug' }] };
  assert.throws(() => parseVerdict(reply(json)), /approve cannot carry a blocking/);
});

test('parseVerdict rejects an unknown verdict, a missing block and invalid JSON', () => {
  assert.throws(() => parseVerdict(reply({ verdict: 'maybe', summary: 'x' })), /verdict must be one of/);
  assert.throws(() => parseVerdict('no block here'), /no ```json verdict block/);
  assert.throws(() => parseVerdict('```json\n{nope\n```'), /not valid JSON/);
});

test('renderReviewBody lists findings with file:line and names the model', () => {
  const body = renderReviewBody(
    { verdict: 'request_changes', summary: 'Two issues.', findings: [{ severity: 'blocking', file: 'src/a.ts', line: 12, message: 'Null deref.' }] },
    { model: 'auto' },
  );
  assert.match(body, /^## 🛑 Automated review: changes requested\n\nTwo issues\.\n\n- \*\*blocking\*\* `src\/a\.ts:12` — Null deref\.\n\n_Reviewed by the Cursor agent \(auto\)/);
});
