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
// Types
export type { ToolCategory, InstallScope, TargetPlatform, ToolFile, ToolManifest, McpServerConfig, InstalledTool } from './types/tool.js';
export type { RegistryConfig, RegistryAuth, AiToolsConfig, AiToolsManifest } from './types/config.js';
export type { AiToolsLock, LockEntry } from './types/lock.js';
export { toLockEntry, emptyLock } from './types/lock.js';

// Schemas
export { ToolManifestSchema, ToolFileSchema } from './schema/tool-schema.js';
export {
  RegistryAuthSchema,
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

// Platform specs
export type { PlatformSpec, SkillFieldSpec, FieldSupport, InstallPathSpec } from './platforms/index.js';
export {
  PLATFORM_SPECS,
  SPEC_STALE_DAYS,
  isSpecStale,
  universalSpec,
  vscodeSpec,
  cursorSpec,
  claudeSpec,
  windsurfSpec,
} from './platforms/index.js';

