'use strict';

const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
/** Review criteria the agent is given verbatim. */
const INSTRUCTIONS_PATH = path.join(REPO_ROOT, '.github', 'pr-review', 'INSTRUCTIONS.md');
/** Cursor model id or alias; resolved against `Cursor.models.list()` at run time. */
const CURSOR_MODEL = 'auto';
/** The agent may inspect the checkout but never change it or run commands. */
const READ_ONLY_TOOLS = ['read', 'grep', 'glob', 'ls'];
/** Diff text beyond this many characters is cut; the agent reads the files for the rest. */
const MAX_DIFF_CHARS = 200_000;
/** GitHub login of the release App's bot user; its own earlier reviews are dismissed before a new one. */
const REVIEW_BOT_LOGIN = 'aitools-release[bot]';
/** Merge commits keep every Conventional Commit, which the release level is derived from. */
const MERGE_METHOD = 'merge';
const VERDICTS = ['approve', 'request_changes'];
const SEVERITIES = ['blocking', 'suggestion'];

module.exports = {
  REPO_ROOT,
  INSTRUCTIONS_PATH,
  CURSOR_MODEL,
  READ_ONLY_TOOLS,
  MAX_DIFF_CHARS,
  REVIEW_BOT_LOGIN,
  MERGE_METHOD,
  VERDICTS,
  SEVERITIES,
};
