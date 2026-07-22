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
import fs from 'node:fs';
import path from 'node:path';

export interface CodeWorkspaceFolder {
  path: string;
  name?: string;
}

export interface CodeWorkspaceDocument {
  folders: CodeWorkspaceFolder[];
  /** Other workspace keys are ignored. */
  [key: string]: unknown;
}

/**
 * Strip // and /* *\/ comments from JSONC (VS Code .code-workspace files).
 * Not a full JSONC parser — good enough for typical workspace files.
 */
export function stripJsonc(text: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  let escape = false;

  while (i < text.length) {
    const ch = text[i]!;
    const next = text[i + 1];

    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      i += 2;
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

export function parseCodeWorkspaceJson(raw: string): CodeWorkspaceDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonc(raw));
  } catch (err) {
    throw new Error(`Invalid .code-workspace JSON: ${(err as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid .code-workspace: root must be an object');
  }

  const folders = (parsed as { folders?: unknown }).folders;
  if (!Array.isArray(folders) || folders.length === 0) {
    throw new Error('Invalid .code-workspace: folders[] must be a non-empty array');
  }

  const normalized: CodeWorkspaceFolder[] = [];
  for (let idx = 0; idx < folders.length; idx++) {
    const entry = folders[idx];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Invalid .code-workspace: folders[${idx}] must be an object`);
    }
    const folderPath = (entry as { path?: unknown }).path;
    if (typeof folderPath !== 'string' || folderPath.trim() === '') {
      throw new Error(`Invalid .code-workspace: folders[${idx}].path must be a non-empty string`);
    }
    const name = (entry as { name?: unknown }).name;
    normalized.push({
      path: folderPath,
      ...(typeof name === 'string' ? { name } : {}),
    });
  }

  return { ...(parsed as object), folders: normalized };
}

export function parseCodeWorkspaceFile(workspaceFile: string): CodeWorkspaceDocument {
  const abs = path.resolve(workspaceFile);
  if (!fs.existsSync(abs)) {
    throw new Error(`Workspace file not found: ${abs}`);
  }
  const raw = fs.readFileSync(abs, 'utf8');
  return parseCodeWorkspaceJson(raw);
}

/**
 * Resolve each folder path relative to the directory containing the workspace file.
 * Returns absolute paths in declaration order.
 */
export function resolveWorkspaceFolders(
  workspaceFile: string,
  doc: CodeWorkspaceDocument,
): string[] {
  const baseDir = path.dirname(path.resolve(workspaceFile));
  return doc.folders.map((folder) => path.resolve(baseDir, folder.path));
}
