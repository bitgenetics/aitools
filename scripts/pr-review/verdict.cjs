/**
 * The agent's answer → a validated verdict → the GitHub review body.
 */
'use strict';

const { VERDICTS, SEVERITIES } = require('./constants.cjs');

const JSON_FENCE = /```json\s*([\s\S]*?)```/g;

/** The last ```json block in the reply is the verdict; anything else is commentary. */
function extractJson(text) {
  let last = null;
  for (const match of text.matchAll(JSON_FENCE)) last = match[1];
  if (last === null) throw new Error('The review reply has no ```json verdict block.');
  return last;
}

function validateFinding(finding, index) {
  const where = `findings[${index}]`;
  if (!finding || typeof finding !== 'object') throw new Error(`${where} is not an object.`);
  if (!SEVERITIES.includes(finding.severity)) throw new Error(`${where}.severity must be one of ${SEVERITIES.join(', ')}.`);
  if (typeof finding.file !== 'string' || finding.file === '') throw new Error(`${where}.file must be a non-empty string.`);
  if (typeof finding.message !== 'string' || finding.message === '') throw new Error(`${where}.message must be a non-empty string.`);
  if (finding.line !== undefined && finding.line !== null && !Number.isInteger(finding.line)) throw new Error(`${where}.line must be an integer.`);
  return { severity: finding.severity, file: finding.file, line: Number.isInteger(finding.line) ? finding.line : null, message: finding.message };
}

/**
 * @returns {{ verdict: 'approve'|'request_changes', summary: string, findings: {severity: string, file: string, line: number|null, message: string}[] }}
 */
function parseVerdict(text) {
  let raw;
  try {
    raw = JSON.parse(extractJson(text));
  } catch (err) {
    throw new Error(`The verdict block is not valid JSON: ${err.message}`);
  }
  if (!VERDICTS.includes(raw.verdict)) throw new Error(`verdict must be one of ${VERDICTS.join(', ')}.`);
  if (typeof raw.summary !== 'string' || raw.summary.trim() === '') throw new Error('summary must be a non-empty string.');
  const findings = Array.isArray(raw.findings) ? raw.findings.map(validateFinding) : [];
  const blocking = findings.some((f) => f.severity === 'blocking');
  if (raw.verdict === 'request_changes' && !blocking) throw new Error('request_changes needs at least one blocking finding.');
  if (raw.verdict === 'approve' && blocking) throw new Error('approve cannot carry a blocking finding.');
  return { verdict: raw.verdict, summary: raw.summary.trim(), findings };
}

function findingLine(f) {
  const location = f.line === null ? f.file : `${f.file}:${f.line}`;
  return `- **${f.severity}** \`${location}\` — ${f.message}`;
}

/** Markdown body for the GitHub review. */
function renderReviewBody({ verdict, summary, findings }, { model } = {}) {
  const heading = verdict === 'approve' ? '✅ Automated review: approved' : '🛑 Automated review: changes requested';
  const lines = [`## ${heading}`, '', summary];
  if (findings.length > 0) lines.push('', ...findings.map(findingLine));
  lines.push('', `_Reviewed by the Cursor agent${model ? ` (${model})` : ''}; verdict applied by \`pr-review.yml\`._`);
  return lines.join('\n') + '\n';
}

module.exports = { parseVerdict, renderReviewBody, extractJson };
