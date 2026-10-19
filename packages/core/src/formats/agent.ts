// Copyright (C) 2026 Nucleic Logic Studios, LLC
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
import type { ContentVendor, VendorConversion, VendorField } from './types.js';
import { pickKnownFields, vendorOnlyFields } from './types.js';
import { parseFrontmatter, serializeFrontmatter, stringField, stringListField } from './frontmatter.js';

/**
 * Agent (subagent persona) formats. Verified 2026-10-19. Windsurf has no agent files.
 * Common fields: name, description, model. `tools` exists on Claude Code and VS Code but
 * names differ per vendor, so it is kept with a review warning. Claude `background` and
 * Cursor `is_background` mean the same thing.
 */
export const AGENT_FIELDS: Record<ContentVendor, readonly string[]> = {
  claude: [
    'name', 'description', 'model', 'tools', 'disallowedTools', 'permissionMode', 'maxTurns',
    'autoCompactWindow', 'skills', 'mcpServers', 'hooks', 'memory', 'background', 'omitClaudeMd',
    'effort', 'isolation', 'color', 'initialPrompt', 'experimental',
  ],
  cursor: ['name', 'description', 'model', 'readonly', 'is_background'],
  vscode: [
    'name', 'description', 'model', 'tools', 'argument-hint', 'agents', 'user-invocable',
    'disable-model-invocation', 'infer', 'target', 'mcp-servers', 'handoffs', 'hooks',
  ],
  windsurf: [],
};

const AGENT_COMMON_FIELDS: ReadonlySet<string> = new Set(['name', 'description', 'model']);

export const AGENT_EXTENSION: Record<ContentVendor, string> = {
  cursor: '.md',
  vscode: '.agent.md',
  claude: '.md',
  windsurf: '.md',
};

export function agentsSupported(vendor: ContentVendor): boolean {
  return AGENT_FIELDS[vendor].length > 0;
}

interface AgentModel {
  name?: string;
  description?: string;
  model?: string;
  tools?: string[];
  background?: boolean;
}

function readAgent(fields: Record<string, unknown>, from: ContentVendor, warnings: string[]): AgentModel {
  const known = pickKnownFields(fields, new Set(AGENT_FIELDS[from]), from, warnings);
  const model: AgentModel = {
    name: stringField(known['name']),
    description: stringField(known['description']),
    model: stringField(known['model']),
  };
  const mapped = new Set(['name', 'description', 'model']);
  if (from === 'claude' || from === 'vscode') {
    model.tools = stringListField(known['tools']);
    mapped.add('tools');
  }
  if (from === 'claude' && typeof known['background'] === 'boolean') {
    model.background = known['background'];
    mapped.add('background');
  }
  if (from === 'cursor' && typeof known['is_background'] === 'boolean') {
    model.background = known['is_background'];
    mapped.add('is_background');
  }
  for (const key of Object.keys(known)) {
    if (!mapped.has(key)) warnings.push(`Dropped frontmatter field "${key}" (${from} only)`);
  }
  return model;
}

function writeAgent(model: AgentModel, from: ContentVendor, to: ContentVendor, warnings: string[]): Record<string, unknown> {
  const fields: Record<string, unknown> = { name: model.name, description: model.description, model: model.model };
  if (model.tools) {
    if (to === 'claude' || to === 'vscode') {
      fields['tools'] = model.tools;
      if (from !== to) warnings.push(`Kept "tools" but tool names are ${from}-specific; verify each name exists on ${to}`);
    } else {
      warnings.push(`Dropped frontmatter field "tools" (no ${to} equivalent)`);
    }
  }
  if (model.background !== undefined) {
    if (to === 'claude') fields['background'] = model.background;
    else if (to === 'cursor') fields['is_background'] = model.background;
    else warnings.push(`Dropped background flag (no ${to} equivalent)`);
  }
  return fields;
}

export function convertAgent(content: string, from: ContentVendor, to: ContentVendor): VendorConversion {
  if (!agentsSupported(to)) {
    return { content: '', extension: AGENT_EXTENSION[to], warnings: [`${to} has no agent file format`], unsupported: true };
  }
  const warnings: string[] = [];
  const doc = parseFrontmatter(content);
  if (doc.error) {
    warnings.push(`Frontmatter not parsed (${doc.error}); content copied unchanged`);
    return { content, extension: AGENT_EXTENSION[to], warnings, unsupported: false };
  }
  if (!doc.hasFrontmatter) {
    warnings.push('No frontmatter: agents need name and description on every platform');
    return { content, extension: AGENT_EXTENSION[to], warnings, unsupported: false };
  }
  const model = readAgent(doc.fields, from, warnings);
  const fields = writeAgent(model, from, to, warnings);
  return { content: serializeFrontmatter(fields, doc.body), extension: AGENT_EXTENSION[to], warnings, unsupported: false };
}

export function vendorAgentFields(fields: Record<string, unknown>): VendorField[] {
  return vendorOnlyFields(fields, AGENT_FIELDS, AGENT_COMMON_FIELDS);
}
