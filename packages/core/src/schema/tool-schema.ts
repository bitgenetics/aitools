import { z } from 'zod';

// ── Tool manifest schema ────────────────────────────────────────────────────

export const ToolFileSchema = z.object({
  src: z.string().min(1),
  dest: z.string().min(1),
  template: z.boolean().optional(),
});

export const ToolManifestSchema = z.object({
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
  category: z.enum(['skill', 'subagent', 'prompt', 'mcp-tool']),
  files: z.array(ToolFileSchema).min(1),
  keywords: z.array(z.string()).optional(),
  author: z.string().optional(),
  repository: z.string().url().optional(),
  dependencies: z.record(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export type ToolManifestInput = z.input<typeof ToolManifestSchema>;
