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
import YAML from 'yaml';

/** A markdown file split into its YAML frontmatter mapping and body. */
export interface FrontmatterDocument {
  /** Parsed mapping; empty when there is no block or the block is not a mapping. */
  fields: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
  /** Set when a block exists but is not valid YAML or not a key/value mapping. */
  error?: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontmatter(content: string): FrontmatterDocument {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return { fields: {}, body: content, hasFrontmatter: false };
  const block = match[1]!;
  const body = match[2] ?? '';
  let parsed: unknown;
  try {
    parsed = YAML.parse(block);
  } catch (err) {
    return { fields: {}, body, hasFrontmatter: true, error: (err as Error).message };
  }
  if (parsed === null || parsed === undefined) return { fields: {}, body, hasFrontmatter: true };
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { fields: {}, body, hasFrontmatter: true, error: 'frontmatter is not a key/value mapping' };
  }
  return { fields: parsed as Record<string, unknown>, body, hasFrontmatter: true };
}

/** Serialize fields (undefined values skipped) as a frontmatter block followed by the body. */
export function serializeFrontmatter(fields: Record<string, unknown>, body: string): string {
  const ordered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) ordered[key] = value;
  }
  if (Object.keys(ordered).length === 0) return body;
  const yaml = YAML.stringify(ordered, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n${body}`;
}

/** Read a scalar string field; non-strings are ignored. */
export function stringField(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Read a list field written either as a YAML list or as a comma-separated string. */
export function stringListField(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }
  if (typeof value === 'string') {
    const items = value.split(',').map((v) => v.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }
  return undefined;
}

export function toCommaList(items: string[]): string {
  return items.join(',');
}
