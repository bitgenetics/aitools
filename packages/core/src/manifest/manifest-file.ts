import fs from 'node:fs';
import path from 'node:path';
import type { AiToolsManifest } from '../types/config.js';
import { AiToolsManifestSchema } from '../schema/config-schema.js';

export const MANIFEST_FILENAME = 'ai-tools.json';

/**
 * Read an ai-tools.json manifest from a directory.
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
 * Write an ai-tools.json manifest to disk.
 */
export function writeManifest(dir: string, manifest: AiToolsManifest): void {
  const filePath = path.join(dir, MANIFEST_FILENAME);
  const content = JSON.stringify(manifest, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

/** Add or update a tool dependency in the manifest. */
export function upsertToolDependency(
  manifest: AiToolsManifest,
  name: string,
  version: string,
  dev = false,
): AiToolsManifest {
  if (dev) {
    return { ...manifest, devTools: { ...(manifest.devTools ?? {}), [name]: version } };
  }
  return { ...manifest, tools: { ...(manifest.tools ?? {}), [name]: version } };
}

/** Remove a tool dependency from the manifest. */
export function removeToolDependency(manifest: AiToolsManifest, name: string): AiToolsManifest {
  const tools = { ...(manifest.tools ?? {}) };
  const devTools = { ...(manifest.devTools ?? {}) };
  delete tools[name];
  delete devTools[name];
  return { ...manifest, tools, devTools };
}
