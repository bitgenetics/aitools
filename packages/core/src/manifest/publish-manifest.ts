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
import type { AiToolsManifest } from '../types/config.js';
import type { ToolManifest } from '../types/tool.js';
import { ToolManifestSchema } from '../schema/tool-schema.js';

/** Returns true when the document has the minimum fields required to publish. */
export function isPublishable(doc: AiToolsManifest): boolean {
  return !!(
    doc.name &&
    doc.version &&
    doc.description &&
    doc.category &&
    doc.files &&
    (doc.category === 'mcp-tool' || doc.files.length > 0)
  );
}

/**
 * Extract the registry publish subset from a unified aitools.json document.
 * Omits devDependencies and other consumer-only fields.
 */
export function toPublishManifest(doc: AiToolsManifest): ToolManifest {
  if (!isPublishable(doc)) {
    throw new Error(
      'aitools.json is missing publish fields (name, version, description, category, files). ' +
        'Run: aitools manifest init',
    );
  }

  const subset: Record<string, unknown> = {
    name: doc.name,
    version: doc.version,
    description: doc.description,
    category: doc.category,
    files: doc.files,
  };

  if (doc.nativeFor !== undefined) subset.nativeFor = doc.nativeFor;
  if (doc.mcpServer !== undefined) subset.mcpServer = doc.mcpServer;
  if (doc.keywords !== undefined) subset.keywords = doc.keywords;
  if (doc.author !== undefined) subset.author = doc.author;
  if (doc.repository !== undefined) subset.repository = doc.repository;
  if (doc.dependencies !== undefined) subset.dependencies = doc.dependencies;
  if (doc.references !== undefined) subset.references = doc.references;
  if (doc.tags !== undefined) subset.tags = doc.tags;
  if (doc.platforms !== undefined) subset.platforms = doc.platforms;
  if (doc.private !== undefined) subset.private = doc.private;

  const parsed = ToolManifestSchema.safeParse(subset);
  if (!parsed.success) {
    throw new Error(`Publish manifest validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}
