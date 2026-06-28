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
  'subagent',
  'prompt',
]);

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
