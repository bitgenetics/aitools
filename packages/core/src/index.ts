// Types
export type { ToolCategory, InstallScope, TargetPlatform, ToolFile, ToolManifest, McpServerConfig, InstalledTool } from './types/tool.js';
export type { RegistryConfig, RegistryAuth, AiToolsConfig, AiToolsManifest } from './types/config.js';
export type { AiToolsLock, LockEntry } from './types/lock.js';
export { toLockEntry, emptyLock } from './types/lock.js';

// Schemas
export { ToolManifestSchema, ToolFileSchema } from './schema/tool-schema.js';
export {
  RegistryConfigSchema,
  AiToolsConfigSchema,
  AiToolsManifestSchema,
  AiToolsLockSchema,
} from './schema/config-schema.js';

// Config cascade
export { ConfigCascade } from './config/cascade.js';

// Lock file utilities
export {
  LOCK_FILENAME,
  readLockFile,
  writeLockFile,
  upsertLockEntry,
  removeLockEntry,
} from './lock/lock-file.js';

// Manifest utilities
export {
  MANIFEST_FILENAME,
  readManifest,
  writeManifest,
  upsertToolDependency,
  removeToolDependency,
} from './manifest/manifest-file.js';
