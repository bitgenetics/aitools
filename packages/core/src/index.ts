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
// Types
export type { ToolCategory, InstallScope, TargetPlatform, ToolFile, ToolManifest, McpServerConfig, InstalledTool, PlacementMode } from './types/tool.js';
export type {
  ReferenceLayout,
  ReferenceBinding,
  ReferenceBindingInput,
  ReferenceBindingOverride,
  ReferenceBindingOverrideInput,
  ReferenceInstallLock,
  ReferenceLockEntry,
} from './types/reference.js';
export { REJECTED_REFERENCE_INTO_PLUGIN } from './types/reference.js';
export type { NormalizedCategory, FileCategory, CategoryNormalization } from './types/category.js';
export { normalizeCategory, isFileCategory } from './types/category.js';
export type {
  RegistryConfig,
  HttpRegistryConfig,
  GitRegistryConfig,
  RegistryAuth,
  AiToolsConfig,
  AiToolsManifest,
  AitoolsJson,
} from './types/config.js';
export { isGitRegistryConfig } from './types/config.js';
export type { AiToolsLock, LockEntry } from './types/lock.js';
export { toLockEntry, emptyLock } from './types/lock.js';

// AI-mech context swap
export type {
  ContextSwapMode,
  ContextBaselineConfig,
  ContextProfileConfig,
  AiToolsContextConfig,
  AiMechKind,
  AiMechEntry,
  AiMechInventory,
  QuarantineMove,
  QuarantineManifest,
  ContextLockProfile,
  AiToolsContextLock,
  ContextSnapshot,
  ContextStayProposal,
  ContextProfileInstallResult,
  SwapProfilePackage,
  ContextSwapOptions,
  ContextSwapResult,
  ContextRestoreOptions,
  ContextRestoreResult,
  ContextStatus,
  DiscoverOptions,
} from './context/index.js';
export {
  CONTEXT_QUARANTINE_DIR,
  CONTEXT_SNAPSHOTS_DIR,
  CONTEXT_INVENTORY_FILE,
  CONTEXT_STAY_PROPOSAL_FILE,
  quarantineRoot,
  quarantineDir,
  snapshotsRoot,
  inventoryPath,
  stayProposalPath,
  toProjectRel,
  matchStayGlob,
  isStayPath,
  normalizeStayList,
  discoverAiMech,
  swappablePaths,
  quarantineFiles,
  restoreQuarantine,
  quarantineExists,
  ensureQuarantineRoot,
  captureContext,
  readSnapshot,
  dirtyVsSnapshot,
  dirtyTrackedAiMechPaths,
  assertCleanAiMechTree,
  DirtyTreeError,
  acceptStayProposal,
  readStayProposal,
  writeStayProposal,
  installContextProfileTree,
  removeContextProfileFiles,
  swapContextProfile,
  restoreContext,
  getContextStatus,
} from './context/index.js';

// Schemas
export { ToolManifestSchema, ToolFileSchema, ToolCategorySchema, ReferenceBindingSchema } from './schema/tool-schema.js';
export {
  RegistryAuthSchema,
  HttpRegistryConfigSchema,
  GitRegistryConfigSchema,
  RegistryConfigSchema,
  AiToolsConfigSchema,
  AitoolsJsonSchema,
  AiToolsManifestSchema,
  AiToolsLockSchema,
} from './schema/config-schema.js';

// Config cascade
export { ConfigCascade, CONFIG_FILENAME } from './config/cascade.js';

// JSONC (VS Code / Cursor dialect)
export { stripJsonc } from './jsonc/strip-jsonc.js';

// Stored path helpers
export { toPosixPath, toStoredPath, resolveStoredPath } from './paths/stored-path.js';
export { userToolsRoot, trackingRoot } from './paths/tracking-root.js';

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
  LEGACY_PUBLISH_MANIFEST_FILENAME,
  REGISTRY_MANIFEST_FILENAME,
  LEGACY_REGISTRY_MANIFEST_FILENAME,
  readManifest,
  readAitoolsJson,
  writeManifest,
  upsertDependency,
  removeDependency,
  upsertToolDependency,
  removeToolDependency,
  resolvePublishSource,
} from './manifest/manifest-file.js';
export type { ReadManifestOptions, ResolvedPublishSource } from './manifest/manifest-file.js';
export { isPublishable, toPublishManifest } from './manifest/publish-manifest.js';
export {
  sanitizePackageDirName,
  resolvePluginInstallDir,
  resolveCursorLocalPluginDir,
  PLUGIN_PLATFORM_DESCRIPTOR,
} from './manifest/plugin-install.js';
export {
  classifyPluginMembers,
  validatePluginStructure,
  parseCursorPluginJson,
  getPluginBundleScanPlan,
  resolvePluginBundleSources,
} from './manifest/plugin-explode.js';
export type {
  PluginMember,
  PluginMemberKind,
  CursorPluginJsonPaths,
  ClassifyPluginOptions,
  ClassifyPluginResult,
  PluginBundleScanPlan,
} from './manifest/plugin-explode.js';
export {
  loadCursorPluginJsonFromCwd,
  resolvePluginBundleInstallBase,
  resolvePluginBundleMcpConfig,
  resolvePluginBundleHooksConfig,
  findPluginBundleCollisions,
  upsertHostPublishFileEntries,
  removeHostPublishFileEntries,
  assertPluginBundleNestPortability,
  PluginBundleInstallError,
} from './manifest/plugin-bundle-install.js';
export {
  anchorSkillName,
  analyzePluginPortability,
  renderSkillMap,
  extractSkillMapSkills,
  upsertSkillMapSection,
  scaffoldAnchorSkill,
  SKILL_MAP_BEGIN,
  SKILL_MAP_END,
} from './manifest/plugin-anchor.js';
export type {
  PluginPortabilityGrade,
  PluginPortabilityFindingKind,
  PluginPortabilityFinding,
  PluginPortabilityResult,
} from './manifest/plugin-anchor.js';
export {
  DEFAULT_PLACEMENT_MODE,
  effectivePlacementMode,
} from './placement/placement-mode.js';
export {
  REGISTRY_MANIFEST_CANDIDATES,
  pickRegistryManifestBasename,
} from './manifest/registry-manifest.js';

export {
  parseReferenceDeclarations,
  parseReferenceBinding,
  mergeReferenceBindings,
  resolveReferenceLayout,
} from './references/parse.js';
export type { ParsedReferenceDeclarations } from './references/parse.js';
export {
  derivePluginSkillIntoPaths,
  resolveReferenceInstallTargets,
  skillFolderFromInto,
  ReferenceInstallTargetError,
} from './references/install-targets.js';
export type { ResolveInstallTargetsOptions } from './references/install-targets.js';
export {
  referencePackageContentDests,
  planVendoredReferenceFiles,
  toProjectRelativePaths,
} from './references/vendor-paths.js';
export type { VendoredReferenceFile, VendoredReferencePlan } from './references/vendor-paths.js';
export {
  buildReferenceLockEntry,
  collectReferenceLockFilePaths,
} from './references/reference-lock.js';
export type { BuildReferenceLockOptions } from './references/reference-lock.js';

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

