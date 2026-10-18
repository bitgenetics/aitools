/**
 * Runs the review prompt through a local Cursor SDK agent that can read the checkout
 * but has no edit, shell or network tools.
 */
'use strict';

const { Agent, Cursor } = require('@cursor/sdk');
const { CURSOR_MODEL, READ_ONLY_TOOLS } = require('./constants.cjs');

/** `Agent.create` needs a concrete model id; accept an alias such as `auto`. */
async function resolveModel(apiKey, wanted = CURSOR_MODEL) {
  const models = await Cursor.models.list({ apiKey });
  const found = models.find((m) => m.id === wanted || (m.aliases ?? []).includes(wanted));
  if (!found) throw new Error(`Model "${wanted}" is not available; known ids: ${models.map((m) => m.id).join(', ')}`);
  return found.id;
}

/**
 * @param {{ prompt: string, cwd: string, apiKey: string }} input
 * @returns {Promise<{ text: string, model: string, durationMs: number|undefined, requestId: string|undefined }>}
 */
async function reviewWithCursor({ prompt, cwd, apiKey }) {
  const model = await resolveModel(apiKey);
  const agent = await Agent.create({
    apiKey,
    name: 'aitools PR review',
    model: { id: model },
    local: { cwd },
    tools: READ_ONLY_TOOLS,
  });
  try {
    const run = await agent.send(prompt);
    const result = await run.wait();
    if (result.status !== 'finished' || typeof result.result !== 'string') {
      throw new Error(`Cursor run ended with status ${result.status}${result.error ? `: ${result.error.message}` : ''} (request ${result.requestId ?? 'n/a'})`);
    }
    return { text: result.result, model, durationMs: result.durationMs, requestId: result.requestId };
  } finally {
    agent.close();
  }
}

module.exports = { reviewWithCursor, resolveModel };
