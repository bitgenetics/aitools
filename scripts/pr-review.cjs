#!/usr/bin/env node
/**
 * Automated PR review (the `pr-review.yml` workflow): read the PR, have a read-only
 * Cursor agent review it against .github/pr-review/INSTRUCTIONS.md, then approve +
 * merge or request changes with the release App's token.
 *
 *   PR_NUMBER=5 GITHUB_REPOSITORY=bitgenetics/aitools CURSOR_API_KEY=… GH_TOKEN=… node scripts/pr-review.cjs
 *   node scripts/pr-review.cjs --dry-run      → prints the prompt; no agent call, no GitHub writes
 */
'use strict';

const fs = require('node:fs');
const { REPO_ROOT, INSTRUCTIONS_PATH } = require('./pr-review/constants.cjs');
const { loadPullRequest } = require('./pr-review/context.cjs');
const { buildPrompt } = require('./pr-review/prompt.cjs');
const { parseVerdict, renderReviewBody } = require('./pr-review/verdict.cjs');
const { applyVerdict } = require('./pr-review/act.cjs');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set.`);
  return value;
}

function appendSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
}

async function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const repo = requireEnv('GITHUB_REPOSITORY');
  const number = Number(requireEnv('PR_NUMBER'));
  if (!Number.isInteger(number) || number <= 0) throw new Error('PR_NUMBER must be a positive integer.');

  const { pr, diff } = loadPullRequest({ repo, number });
  const prompt = buildPrompt({ instructions: fs.readFileSync(INSTRUCTIONS_PATH, 'utf8'), pr, diff });
  if (dryRun) {
    process.stdout.write(prompt);
    return;
  }

  const { reviewWithCursor } = require('./pr-review/agent.cjs');
  const review = await reviewWithCursor({ prompt, cwd: REPO_ROOT, apiKey: requireEnv('CURSOR_API_KEY') });
  console.log(`Cursor review finished (model ${review.model}, ${review.durationMs ?? '?'} ms, request ${review.requestId ?? 'n/a'}).`);

  // The review is the expensive part, so it reaches the job summary before any step
  // that can still fail (a malformed reply, or a GitHub write the token cannot make).
  let verdict;
  try {
    verdict = parseVerdict(review.text);
  } catch (err) {
    appendSummary(`### Review reply (no valid verdict)\n\n${review.text}\n`);
    throw err;
  }
  const body = renderReviewBody(verdict, { model: review.model });
  appendSummary(`${body}\n`);

  const outcome = applyVerdict({ repo, number, headSha: pr.headRefOid, headRef: pr.headRefName, verdict: verdict.verdict, body });
  console.log(`PR #${number}: ${outcome.action} (${outcome.dismissed} earlier review(s) dismissed).`);
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
