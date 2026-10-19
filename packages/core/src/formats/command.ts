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
import { parseFrontmatter, serializeFrontmatter, stringField } from './frontmatter.js';

/**
 * Command (slash command / prompt file / workflow) formats. Verified 2026-10-19.
 * Only `description` is shared. Argument placeholders ($1, $ARGUMENTS, ${input}) are not
 * rewritten: their semantics differ per vendor and a silent rewrite hides that.
 */
export const COMMAND_FIELDS: Record<ContentVendor, readonly string[]> = {
  claude: ['description', 'argument-hint', 'allowed-tools', 'model', 'disable-model-invocation'],
  cursor: ['description'],
  vscode: ['description', 'name', 'agent', 'mode', 'model', 'tools', 'argument-hint'],
  windsurf: ['description'],
};

const COMMAND_COMMON_FIELDS: ReadonlySet<string> = new Set(['description']);

export const COMMAND_EXTENSION: Record<ContentVendor, string> = {
  cursor: '.md',
  vscode: '.prompt.md',
  claude: '.md',
  windsurf: '.md',
};

const WINDSURF_PLACEHOLDER_DESCRIPTION = 'Workflow';

export function convertCommand(content: string, from: ContentVendor, to: ContentVendor): VendorConversion {
  const warnings: string[] = [];
  const doc = parseFrontmatter(content);
  if (doc.error) {
    warnings.push(`Frontmatter not parsed (${doc.error}); content copied unchanged`);
    return { content, extension: COMMAND_EXTENSION[to], warnings, unsupported: false };
  }
  const known = pickKnownFields(doc.fields, new Set(COMMAND_FIELDS[from]), from, warnings);
  let description = stringField(known['description']);
  for (const key of Object.keys(known)) {
    if (!COMMAND_COMMON_FIELDS.has(key)) warnings.push(`Dropped frontmatter field "${key}" (${from} only)`);
  }
  if (to === 'windsurf' && !description) {
    description = WINDSURF_PLACEHOLDER_DESCRIPTION;
    warnings.push('Added placeholder description required by Windsurf workflows');
  }
  return {
    content: serializeFrontmatter({ description }, doc.body),
    extension: COMMAND_EXTENSION[to],
    warnings,
    unsupported: false,
  };
}

export function vendorCommandFields(fields: Record<string, unknown>): VendorField[] {
  return vendorOnlyFields(fields, COMMAND_FIELDS, COMMAND_COMMON_FIELDS);
}
