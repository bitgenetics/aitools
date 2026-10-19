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
import { parseFrontmatter, serializeFrontmatter, stringField, stringListField, toCommaList } from './frontmatter.js';

/**
 * Rule (always-on / scoped instruction file) formats.
 * Verified 2026-10-19: Cursor `.mdc` (description, globs, alwaysApply); VS Code
 * `.instructions.md` (description, applyTo; `**` = every file); Claude Code reads only
 * `paths` and loads rules without `paths` in every session; Windsurf `trigger`
 * (always_on | glob | model_decision | manual), globs, description.
 */
export const RULE_FIELDS: Record<ContentVendor, readonly string[]> = {
  cursor: ['description', 'globs', 'alwaysApply'],
  vscode: ['description', 'name', 'applyTo', 'excludeAgent'],
  claude: ['description', 'paths'],
  windsurf: ['description', 'trigger', 'globs'],
};

const RULE_COMMON_FIELDS: ReadonlySet<string> = new Set(['description']);

export const RULE_EXTENSION: Record<ContentVendor, string> = {
  cursor: '.mdc',
  vscode: '.instructions.md',
  claude: '.md',
  windsurf: '.md',
};

const VSCODE_ALL_FILES = '**';

/** Vendor-neutral rule scoping. `always` wins over `globs` when both are set. */
interface RuleModel {
  description?: string;
  globs?: string[];
  always: boolean;
}

function readRule(fields: Record<string, unknown>, from: ContentVendor, warnings: string[]): RuleModel {
  const known = pickKnownFields(fields, new Set(RULE_FIELDS[from]), from, warnings);
  const description = stringField(known['description']);
  switch (from) {
    case 'cursor':
      return { description, globs: stringListField(known['globs']), always: known['alwaysApply'] === true };
    case 'vscode': {
      const applyTo = stringListField(known['applyTo']);
      const always = applyTo?.includes(VSCODE_ALL_FILES) ?? false;
      const globs = applyTo?.filter((g) => g !== VSCODE_ALL_FILES);
      if (known['excludeAgent'] !== undefined) {
        warnings.push('Dropped frontmatter field "excludeAgent" (VS Code only)');
      }
      if (known['name'] !== undefined) {
        warnings.push('Dropped frontmatter field "name" (VS Code only)');
      }
      return { description, globs: globs?.length ? globs : undefined, always };
    }
    case 'claude': {
      const paths = stringListField(known['paths']);
      return { description, globs: paths, always: !paths };
    }
    case 'windsurf': {
      const trigger = stringField(known['trigger']);
      const globs = stringListField(known['globs']);
      return { description, globs: trigger === 'glob' || trigger === undefined ? globs : undefined, always: trigger === 'always_on' };
    }
  }
}

function writeRule(model: RuleModel, to: ContentVendor, warnings: string[]): Record<string, unknown> {
  const { description, globs, always } = model;
  switch (to) {
    case 'cursor':
      return { description, globs: globs ? toCommaList(globs) : undefined, alwaysApply: always ? true : undefined };
    case 'vscode':
      return { description, applyTo: always ? VSCODE_ALL_FILES : globs ? toCommaList(globs) : undefined };
    case 'claude':
      if (!always && !globs) {
        warnings.push('Claude Code loads rules without paths in every session; manual or agent-requested scoping is lost');
      }
      return { description, paths: always ? undefined : globs };
    case 'windsurf': {
      const trigger = always ? 'always_on' : globs ? 'glob' : description ? 'model_decision' : 'manual';
      return { description, trigger, globs: !always && globs ? toCommaList(globs) : undefined };
    }
  }
}

export function convertRule(content: string, from: ContentVendor, to: ContentVendor): VendorConversion {
  const warnings: string[] = [];
  const doc = parseFrontmatter(content);
  if (doc.error) {
    warnings.push(`Frontmatter not parsed (${doc.error}); content copied unchanged`);
    return { content, extension: RULE_EXTENSION[to], warnings, unsupported: false };
  }
  const model = readRule(doc.fields, from, warnings);
  const fields = writeRule(model, to, warnings);
  return { content: serializeFrontmatter(fields, doc.body), extension: RULE_EXTENSION[to], warnings, unsupported: false };
}

export function vendorRuleFields(fields: Record<string, unknown>): VendorField[] {
  return vendorOnlyFields(fields, RULE_FIELDS, RULE_COMMON_FIELDS);
}
