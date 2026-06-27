// Copyright (C) 2026 Michael Benjamin (turbofoxwave@gmail.com)
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
import type { AiToolsManifest } from '../types/config.js';
import { AiToolsManifestSchema } from '../schema/config-schema.js';

export const MANIFEST_FILENAME = 'aitools.json';

/**
 * Read an aitools.json manifest from a directory.
 * Returns null if the file does not exist.
 */
export function readManifest(dir: string): AiToolsManifest | null {
  const filePath = path.join(dir, MANIFEST_FILENAME);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse ${filePath}: ${(err as Error).message}`);
  }
  const result = AiToolsManifestSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid manifest at ${filePath}: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Write an aitools.json manifest to disk.
 */
export function writeManifest(dir: string, manifest: AiToolsManifest): void {
  const filePath = path.join(dir, MANIFEST_FILENAME);
  const content = JSON.stringify(manifest, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

/** Add or update a tool dependency in the manifest.
 * If the tool already exists in the opposite bucket (tools vs devTools),
 * it is removed from there to prevent the same tool appearing in both.
 */
export function upsertToolDependency(
  manifest: AiToolsManifest,
  name: string,
  version: string,
  dev = false,
): AiToolsManifest {
  if (dev) {
    const tools = { ...(manifest.tools ?? {}) };
    delete tools[name];
    return { ...manifest, tools, devTools: { ...(manifest.devTools ?? {}), [name]: version } };
  }
  const devTools = { ...(manifest.devTools ?? {}) };
  delete devTools[name];
  return { ...manifest, tools: { ...(manifest.tools ?? {}), [name]: version }, devTools };
}

/** Remove a tool dependency from the manifest. */
export function removeToolDependency(manifest: AiToolsManifest, name: string): AiToolsManifest {
  const tools = { ...(manifest.tools ?? {}) };
  const devTools = { ...(manifest.devTools ?? {}) };
  delete tools[name];
  delete devTools[name];
  return { ...manifest, tools, devTools };
}
