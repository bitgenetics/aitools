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
import { McpServerConfigSchema, ToolCategorySchema, ToolFileSchema, ReferenceBindingSchema, ReferenceBindingOverrideSchema } from './tool-schema.js';

function normalizeLegacyDepFields(val: unknown): unknown {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return val;
  const obj = { ...(val as Record<string, unknown>) };
  if ('tools' in obj && !('dependencies' in obj)) {
    obj.dependencies = obj.tools;
    delete obj.tools;
  }
  if ('devTools' in obj && !('devDependencies' in obj)) {
    obj.devDependencies = obj.devTools;
    delete obj.devTools;
  }
  return obj;
}

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
  referenceBindings: z.record(z.record(ReferenceBindingOverrideSchema)).optional(),
});

// -- aitools.json -----------------------------------------------------------

const PlatformWithUniversalSchema = z.enum(['vscode', 'claude', 'cursor', 'windsurf', 'universal']);

/** Unified per-project manifest: dependencies + optional publish fields. */
export const AitoolsJsonSchema = z.preprocess(
  normalizeLegacyDepFields,
  z.object({
    name: z.string().optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
    registries: z.array(RegistryConfigSchema).optional(),
    // Publish fields (optional until publishing)
    version: z.string().optional(),
    description: z.string().min(1).optional(),
    category: ToolCategorySchema.optional(),
    nativeFor: PlatformWithUniversalSchema.optional(),
    files: z.array(ToolFileSchema).optional(),
    mcpServer: McpServerConfigSchema.optional(),
    keywords: z.array(z.string()).optional(),
    author: z.string().optional(),
    repository: z.string().url().optional(),
    tags: z.array(z.string()).optional(),
    references: z.record(ReferenceBindingSchema).optional(),
    platforms: z.array(PlatformWithUniversalSchema).optional(),
    private: z.boolean().optional(),
  }),
);

/** @deprecated Use AitoolsJsonSchema — alias kept for internal references. */
export const AiToolsManifestSchema = AitoolsJsonSchema;

// -- aitools-lock.json ------------------------------------------------------

const ReferenceInstallLockSchema = z.object({
  into: z.string(),
  destWithinCategory: z.string(),
  files: z.array(z.string()),
});

const ReferenceLockEntrySchema = z.object({
  version: z.string(),
  resolved: z.string().min(1),
  integrity: z.string(),
  layout: z.enum(['named', 'flat']).optional(),
  installedAt: z.string().datetime(),
  installs: z.array(ReferenceInstallLockSchema),
});

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
  mcpKeys: z.array(z.string()).optional(),
  mcpConfig: z.string().optional(),
  hooksAdded: z.record(z.array(z.unknown())).optional(),
  hooksConfig: z.string().optional(),
  references: z.record(ReferenceLockEntrySchema).optional(),
  installMethod: z.enum(['cursor-plugin-local', 'plugin-bundle']).optional(),
});

export const AiToolsLockSchema = z.object({
  lockfileVersion: z.literal(1),
  tools: z.record(LockEntrySchema),
});

export type AiToolsConfigInput = z.input<typeof AiToolsConfigSchema>;
export type AitoolsJsonInput = z.input<typeof AitoolsJsonSchema>;
export type AiToolsManifestInput = AitoolsJsonInput;
export type AiToolsLockInput = z.input<typeof AiToolsLockSchema>;

