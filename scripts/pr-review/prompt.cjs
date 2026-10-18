/**
 * Builds the single prompt the review agent receives: the repo's review instructions,
 * the PR metadata, the diff, and the exact verdict format to answer with.
 */
'use strict';

const { MAX_DIFF_CHARS } = require('./constants.cjs');

const VERDICT_FORMAT = `Finish your reply with exactly one fenced \`\`\`json block (nothing after it) of this shape:

\`\`\`json
{
  "verdict": "approve" | "request_changes",
  "summary": "one or two sentences for the review body",
  "findings": [
    { "severity": "blocking" | "suggestion", "file": "path/from/repo/root", "line": 42, "message": "what is wrong and what to do" }
  ]
}
\`\`\`

Rules for the verdict: "request_changes" only when at least one finding is "blocking". "approve" otherwise, even with suggestions. \`line\` is optional. Do not invent findings to seem thorough; an empty findings list with "approve" is a valid outcome.`;

function truncateDiff(diff) {
  if (diff.length <= MAX_DIFF_CHARS) return diff;
  return `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated at ${MAX_DIFF_CHARS} characters; read the files in the checkout for the rest]\n`;
}

function commitList(commits) {
  return commits.map((c) => `- ${c.oid.slice(0, 7)} ${c.messageHeadline}`).join('\n');
}

/**
 * @param {{ instructions: string, pr: { number: number, title: string, body: string, author: { login: string }, baseRefName: string, headRefName: string, commits: { oid: string, messageHeadline: string }[], files: { path: string, additions: number, deletions: number }[] }, diff: string }} input
 */
function buildPrompt({ instructions, pr, diff }) {
  const files = pr.files.map((f) => `- ${f.path} (+${f.additions} −${f.deletions})`).join('\n');
  return [
    instructions.trim(),
    '',
    '---',
    '',
    `# Pull request #${pr.number}: ${pr.title}`,
    '',
    `Author: ${pr.author.login}. Branch: ${pr.headRefName} → ${pr.baseRefName}. The checkout you can read is the PR head.`,
    '',
    '## Description',
    '',
    (pr.body || '(empty)').trim(),
    '',
    '## Commits',
    '',
    commitList(pr.commits),
    '',
    '## Files',
    '',
    files,
    '',
    '## Diff',
    '',
    '```diff',
    truncateDiff(diff).trimEnd(),
    '```',
    '',
    '---',
    '',
    VERDICT_FORMAT,
    '',
  ].join('\n');
}

module.exports = { buildPrompt, VERDICT_FORMAT };
