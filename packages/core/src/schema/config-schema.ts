import { z } from 'zod';

// ── Registry auth ───────────────────────────────────────────────────────────

export const RegistryAuthSchema = z.object({
  type: z.enum(['bearer', 'basic']),
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

// ── Registry config ─────────────────────────────────────────────────────────

export const RegistryConfigSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  priority: z.number().int().min(0).optional(),
  auth: RegistryAuthSchema.optional(),
});

// ── ai-tools.config.json ────────────────────────────────────────────────────

// 'universal' is intentionally excluded — it is our internal cache/storage
// convention and not a valid user-facing platform target.
export const TargetPlatformSchema = z.enum(['vscode', 'claude', 'cursor', 'windsurf']);

export const AiToolsConfigSchema = z.object({
  registries: z.array(RegistryConfigSchema).optional(),
  defaultScope: z.enum(['project', 'user']).optional(),
  platform: TargetPlatformSchema.optional(),
  installPaths: z.record(z.string()).optional(),
});

// ── ai-tools.json ───────────────────────────────────────────────────────────

export const AiToolsManifestSchema = z.object({
  name: z.string().optional(),
  tools: z.record(z.string()).optional(),
  devTools: z.record(z.string()).optional(),
  registries: z.array(RegistryConfigSchema).optional(),
});

// ── ai-tools-lock.json ──────────────────────────────────────────────────────

export const LockEntrySchema = z.object({
  version: z.string(),
  resolved: z.string().url(),
  integrity: z.string(),
  files: z.array(z.string()),
  installedAt: z.string().datetime(),
});

export const AiToolsLockSchema = z.object({
  lockfileVersion: z.literal(1),
  tools: z.record(LockEntrySchema),
});

export type AiToolsConfigInput = z.input<typeof AiToolsConfigSchema>;
export type AiToolsManifestInput = z.input<typeof AiToolsManifestSchema>;
export type AiToolsLockInput = z.input<typeof AiToolsLockSchema>;

