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
import { ToolCategorySchema } from './tool-schema.js';

// -- Registry auth -----------------------------------------------------------

export const RegistryAuthSchema = z
  .object({
    type: z.enum(['bearer', 'basic']),
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'bearer' && !data.token) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'bearer auth requires a token',
        path: ['token'],
      });
    } else if (data.type === 'basic' && (!data.username || !data.password)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'basic auth requires both username and password',
        path: ['username'],
      });
    }
  });

// -- Registry config ---------------------------------------------------------

export const HttpRegistryConfigSchema = z.object({
  type: z.literal('http'),
  name: z.string().min(1),
  url: z.string().url(),
  priority: z.number().int().min(0).optional(),
  auth: RegistryAuthSchema.optional(),
});

export const GitRegistryConfigSchema = z.object({
  type: z.literal('git'),
  name: z.string().min(1),
  url: z.string().min(1),
  readBranch: z.string().min(1).default('main'),
  publishBranch: z.string().min(1).optional(),
  path: z.string().min(1).default('registry/'),
  priority: z.number().int().min(0).optional(),
});

/** Configs without `type` are treated as HTTP for backward compatibility. */
export const RegistryConfigSchema = z.preprocess(
  (val) => {
    if (val && typeof val === 'object' && !Array.isArray(val) && !('type' in val)) {
      return { ...(val as Record<string, unknown>), type: 'http' };
    }
    return val;
  },
  z.discriminatedUnion('type', [HttpRegistryConfigSchema, GitRegistryConfigSchema]),
);

// -- aitools.config.json ----------------------------------------------------

// 'universal' is intentionally excluded � it is our internal cache/storage
// convention and not a valid user-facing platform target.
export const TargetPlatformSchema = z.enum(['vscode', 'claude', 'cursor', 'windsurf']);

export const AiToolsConfigSchema = z.object({
  registries: z.array(RegistryConfigSchema).optional(),
  defaultScope: z.enum(['project', 'user']).optional(),
  platform: TargetPlatformSchema.optional(),
  installPaths: z.record(z.string()).optional(),
});

// -- aitools.json -----------------------------------------------------------

export const AiToolsManifestSchema = z.object({
  name: z.string().optional(),
  tools: z.record(z.string()).optional(),
  devTools: z.record(z.string()).optional(),
  registries: z.array(RegistryConfigSchema).optional(),
});

// -- aitools-lock.json ------------------------------------------------------

export const LockEntrySchema = z.object({
  version: z.string(),
  /** HTTP tarball URL, git remote URL, or other registry-specific locator. */
  resolved: z.string().min(1),
  integrity: z.string(),
  files: z.array(z.string()),
  installedAt: z.string().datetime(),
  // Optional: absent on entries written by older versions of ai-tools.
  platform: z.enum(['universal', 'vscode', 'claude', 'cursor', 'windsurf']).optional(),
  category: ToolCategorySchema.optional(),
  scope: z.enum(['project', 'user']).optional(),
});

export const AiToolsLockSchema = z.object({
  lockfileVersion: z.literal(1),
  tools: z.record(LockEntrySchema),
});

export type AiToolsConfigInput = z.input<typeof AiToolsConfigSchema>;
export type AiToolsManifestInput = z.input<typeof AiToolsManifestSchema>;
export type AiToolsLockInput = z.input<typeof AiToolsLockSchema>;

