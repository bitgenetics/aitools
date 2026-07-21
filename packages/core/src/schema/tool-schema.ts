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
import { z } from 'zod';

// ── MCP server config schema ────────────────────────────────────────────────

export const McpServerConfigSchema = z
  .object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
    url: z.string().url().optional(),
    type: z.enum(['stdio', 'http']).optional(),
  })
  .superRefine((data, ctx) => {
    const hasCommand = data.command !== undefined;
    const hasUrl = data.url !== undefined;
    if (hasCommand && hasUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mcpServer cannot specify both command (stdio) and url (http) — use one or the other',
        path: ['url'],
      });
    } else if (!hasCommand && !hasUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mcpServer must specify either command (stdio) or url (http)',
        path: ['command'],
      });
    }
  });

// ── Tool manifest schema ────────────────────────────────────────────────────

export const ToolFileSchema = z.object({
  src: z.string().min(1),
  dest: z.string().min(1),
  placementMode: z.enum(['strict', 'verbatim', 'transform']).optional(),
  template: z.boolean().optional(),
  platform: z.enum(['vscode', 'claude', 'cursor', 'windsurf', 'universal']).optional(),
});

export const ToolCategorySchema = z.enum([
  'skill',
  'rule',
  'command',
  'agent',
  'hook',
  'mcp-tool',
  'plugin',
  'reference',
  'subagent',
  'prompt',
]);

const ReferenceBindingObjectSchema = z
  .object({
    range: z.string().min(1),
    into: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
    layout: z.enum(['named', 'flat']).optional(),
  })
  .superRefine((data, ctx) => {
    const intoList = data.into === undefined ? [] : Array.isArray(data.into) ? data.into : [data.into];
    for (const into of intoList) {
      if (into === 'plugin') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'references.into cannot be "plugin" — use skills/<name> paths',
          path: ['into'],
        });
      }
    }
  });

export const ReferenceBindingSchema = z.union([z.string().min(1), ReferenceBindingObjectSchema]);

const ReferenceBindingOverrideObjectSchema = z
  .object({
    range: z.string().min(1).optional(),
    into: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
    layout: z.enum(['named', 'flat']).optional(),
  })
  .superRefine((data, ctx) => {
    const intoList = data.into === undefined ? [] : Array.isArray(data.into) ? data.into : [data.into];
    for (const into of intoList) {
      if (into === 'plugin') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'references.into cannot be "plugin" — use skills/<name> paths',
          path: ['into'],
        });
      }
    }
  });

/** Consumer override in aitools.config.json — `range` optional when patching manifest bindings. */
export const ReferenceBindingOverrideSchema = z.union([
  z.string().min(1),
  ReferenceBindingOverrideObjectSchema,
]);

const REFERENCE_METADATA = new Set(['index.md', 'readme.md', 'license', 'license.md', 'license.txt']);

function referenceContentFileCount(files: { dest: string }[]): number {
  return files.filter((f) => {
    const base = f.dest.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? '';
    return base.length > 0 && !REFERENCE_METADATA.has(base);
  }).length;
}

export const ToolManifestSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .regex(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/, {
        message: 'Invalid package name — use lowercase letters, numbers, hyphens, or scoped @scope/name',
      }),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/, {
        message: 'version must be a valid semver string',
      }),
    description: z.string().min(1),
    category: ToolCategorySchema,
    nativeFor: z.enum(['vscode', 'claude', 'cursor', 'windsurf', 'universal']).optional(),
    files: z.array(ToolFileSchema),
    mcpServer: McpServerConfigSchema.optional(),
    keywords: z.array(z.string()).optional(),
    author: z.string().optional(),
    repository: z.string().url().optional(),
    dependencies: z.record(z.string()).optional(),
    references: z.record(ReferenceBindingSchema).optional(),
    tags: z.array(z.string()).optional(),
    platforms: z.array(z.enum(['vscode', 'claude', 'cursor', 'windsurf', 'universal'])).optional(),
    /** When true, this tool is hidden from unauthenticated (public-mode) reads. */
    private: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.category === 'mcp-tool') {
      if (!data.mcpServer) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mcp-tool manifests must include an mcpServer descriptor',
          path: ['mcpServer'],
        });
      }
    } else if (data.category === 'plugin') {
      if (!data.nativeFor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'plugin manifests must include nativeFor (source layout family)',
          path: ['nativeFor'],
        });
      }
      if (data.nativeFor === 'cursor') {
        const hasCursorPlugin = data.files.some(
          (f) => f.src.replace(/\\/g, '/') === '.cursor-plugin/plugin.json',
        );
        if (!hasCursorPlugin) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'cursor plugins must include .cursor-plugin/plugin.json in files',
            path: ['files'],
          });
        }
      }
      if (data.files.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'files must contain at least one entry for plugin category',
          path: ['files'],
        });
      }
    } else if (data.category === 'reference') {
      if (referenceContentFileCount(data.files) === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'reference manifests must include at least one content file (not only index.md or README)',
          path: ['files'],
        });
      }
    } else {
      if (data.files.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'files must contain at least one entry for non-mcp-tool categories',
          path: ['files'],
        });
      }
    }
  });

export type ToolManifestInput = z.input<typeof ToolManifestSchema>;
