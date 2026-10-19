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

// AI context snapshots (git-style save / switch / stash of on-disk AI-mech files)
export type {
  ContextScope,
  CatalogKind,
  CatalogEntry,
  Catalog,
  SnapshotFile,
  SnapshotOrigin,
  SnapshotManifest,
  SnapshotRef,
  ContextState,
  AiToolsContextConfig,
  SnapshotSource,
  SnapshotMeta,
  FileDiff,
  ContextStoreOptions,
  ListedSnapshot,
  StashEntry,
  OverwriteOptions,
  ApplyResult,
  ContextStatus,
  MergeOptions,
  MergeResult,
  ImportPackageOptions,
  PublishPayload,
  SnapshotPublishMeta,
} from './context/index.js';
export {
  CONTEXT_DIR,
  STASH_DIR,
  STATE_FILE,
  SNAPSHOT_MANIFEST_FILE,
  contextRoot,
  snapshotDir,
  stashRoot,
  statePath,
  ensureProjectContextRoot,
  toProjectRel,
  matchGlob,
  isIgnored,
  normalizeGlobList,
  classify,
  buildCatalog,
  hashFile,
  snapshotExists,
  snapshotFileAbs,
  readSnapshotManifest,
  writeSnapshot,
  removeSnapshot,
  SnapshotNotFoundError,
  EMPTY_STATE,
  readState,
  writeState,
  hashWorkingTree,
  diffFiles,
  dirtyPaths,
  assertCatalogPath,
  clearWorkingTree,
  applySnapshot,
  OutsideCatalogError,
  ContextStore,
  LABEL_PATTERN,
  assertValidLabel,
  readContextIgnore,
  InvalidLabelError,
  UnknownLabelError,
  LabelExistsError,
  ActiveSnapshotError,
  save as saveContext,
  stash as stashContext,
  switchTo as switchContext,
  pop as popContext,
  clear as clearContext,
  status as contextStatus,
  partitionApplicable,
  DirtyWorkingTreeError,
  EmptyStashError,
  merge as mergeContext,
  MergeConflictError,
  CONTEXT_PROFILE_CATEGORY,
  defaultLabelForPackage,
  importSnapshotFromPackage,
  snapshotToPublishPayload,
  NotContextProfileError,
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
  platformSupportsCategory,
  universalSpec,
  vscodeSpec,
  cursorSpec,
  claudeSpec,
  windsurfSpec,
} from './platforms/index.js';


// Vendor file formats (rules, commands, agents, hooks) and conversions between them
export type {
  ContentVendor,
  VendorConversion,
  VendorField,
  FrontmatterDocument,
  FrontmatterCategory,
  HookHandler,
  HookEvents,
  HooksFile,
  HookConversion,
} from './formats/index.js';
export {
  CONTENT_VENDORS,
  isContentVendor,
  parseFrontmatter,
  serializeFrontmatter,
  replaceVendorExtension,
  convertRule,
  convertAgent,
  convertCommand,
  agentsSupported,
  RULE_EXTENSION,
  AGENT_EXTENSION,
  COMMAND_EXTENSION,
  HOOK_EVENTS,
  hookEventName,
  neutralHookEvent,
  readHooksFile,
  writeHooksFile,
  nonEmptyHookEvents,
  convertHookEvents,
  NO_PORTABLE_HOOKS_WARNING,
  vendorHookEvents,
  detectVendorFrontmatter,
} from './formats/index.js';
