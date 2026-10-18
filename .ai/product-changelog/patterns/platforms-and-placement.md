# Design Patterns — platforms-and-placement

> Platform adapters, transforms, placementMode, install paths, user-scope roots. Part of [patterns/](./README.md).

### Shared VS Code JSONC normalize — 2026-08-12 `c55af39`
**Used for**: Parsing editor JSONC (`.code-workspace`, `aitools.config.json`) with comments, trailing commas, and UTF-8 BOM before `JSON.parse`.  
**How**: Call `stripJsonc` from `@bitgenetics/aitools-core` (`packages/core/src/jsonc/strip-jsonc.ts`). `ConfigCascade.stripComments` delegates to it; `aitools cursor load` / `worker` parse workspace files through the same helper.  
**Example**: `packages/core/src/jsonc/strip-jsonc.ts`, `packages/cursor/src/workspace.ts`  
**Do not**: Re-implement comment/trailing-comma stripping in callers; do not use full JSON5 (unquoted keys / single quotes) — stick to the VS Code JSONC dialect.

---

### Platform adapter interface for path resolution
**Used for**: Resolving where tool files should be installed for each IDE.  
**How**: Implement `PlatformAdapter` (`resolveDir(category, scope, cwd)`, `resolveMcpConfig(scope, cwd)`, `resolveHooksConfig(scope, cwd)` for hook category). Register in `ADAPTERS` map in `packages/cli/src/adapters/index.ts`. Add a `PlatformSpec` entry in `packages/core/src/platforms/`.  
**Example**: `packages/cli/src/adapters/vscode.ts`  
**Do not**: Branch on platform name inside `Installer` or command handlers — always go through the adapter.

---

### Transformer layer for cross-platform content — 2026-06-27 `6eba41d`
**Used for**: Converting rule/command/agent/hook file content between IDE formats at install time.  
**How**: Call `transform(content, category, from, to, ctx)` from `packages/cli/src/transformers/index.ts`. Category-specific logic lives in `rule.ts`, `command.ts`, `agent.ts`, `hook.ts`. Return `TransformResult` with `confidence`, optional `destExtension`, `skillPrompt`, and `# aitools:` annotations. Use `normalizeCategory()` before routing. Skills and mcp-tool categories passthrough.  
**Example**: `packages/cli/src/utils/installer.ts` — transform branch in `installFiles`  
**Do not**: Branch on platform inside command handlers — keep conversion rules in transformers so `compat` and MCP can reuse `estimateCategoryConfidence`.

---

### `nativeFor` manifest field for authorship platform — 2026-06-27 `6eba41d`
**Used for**: Packages authored for one IDE but installed on another.  
**How**: Set `nativeFor: "cursor"` (etc.) on `aitools.manifest.json`. Omit or match active platform for no transform. Installer compares `nativeFor ?? 'universal'` to `ConfigManager` platform.  
**Example**: `packages/core/src/types/tool.ts`, `tools/create-ai-tool/references/manifest-reference.md`  
**Do not**: Encode platform in `file.dest` paths — use `nativeFor` + transformers so a single package publishes once.

---

### Content file detection for `manifest init` and `manifest files` — `dee6a92` / `b653839` (updated dest nesting)
**Used for**: `manifest init` and `manifest files` — finding skill/subagent/prompt/mcp-tool/plugin content to include.  
**How**: `detectDirectContentFiles` finds root-level matches; `detectContentFolders(root, exts)` finds subdirectories that **directly** contain at least one file matching `exts`. Plugin category uses `getPluginBundleScanPlan` / `resolvePluginBundleSources` (skills/rules/agents/commands/hooks/assets/scripts + `.cursor-plugin/`). Interactive init prompts per root group and per folder; when nothing is selected, offers `promptForManifestFiles`. `manifest files` / init `--yes` default `dest` via `defaultInstallDest`: skill/subagent/prompt nest under the package install folder (e.g. `my-skill/SKILL.md`); mcp-tool and plugin keep author-relative `dest: src`.  
**Example**: `packages/cli/src/commands/manifest.ts`, `packages/e2e/src/cli.test.ts` (manifest init/files dest nesting)  
**Do not**: Use raw `detectFiles` in interactive folder mode — it returns flat file lists rather than logical content units. Do not scaffold skill `dest` as a bare filename at the category root.

---

### Portable stored paths in lock/manifest — 2026-07-14 `80f6568`
**Used for**: Writing/reading install paths in `aitools-lock.json` / related manifests.  
**How**: `toStoredPath(root, absPath)` → relative-to-root or `~/…`; `resolveStoredPath(root, stored)` → absolute. Never persist absolute paths when they can be re-encoded.  
**Example**: `packages/core/src/paths/stored-path.ts`, `packages/cli/src/utils/installer.ts`  
**Do not**: Write machine-specific absolute paths into the lock when a portable form exists.

---

### Adapter file categories exclude reference — 2026-07-16 `43b5c50`
**Used for**: Mapping manifest categories to `PlatformAdapter.resolveDir`.  
**How**: `AdapterFileCategory` / `toAdapterFileCategory` exclude `mcp-tool`, `hook`, `plugin`, and `reference`. Those use specialized install paths (MCP/hooks merge, explode, or future reference vendoring).  
**Example**: `packages/cli/src/adapters/types.ts`  
**Do not**: Call `resolveDir('reference', …)` — it is not a regular file-based category.

---

### File placementMode resolution — 2026-07-17 `31b7508`
**Used for**: Deciding whether `files[].dest` is honored 1:1 or remapped at install.  
**How**: Call `effectivePlacementMode(file)` (`packages/core/src/placement/placement-mode.ts`). Omitted → `strict` (project-relative `dest`). `transform` enables plugin explode remaps and content `destExtension`. Manifest generators always emit `placementMode: 'strict'` via `fileEntry()`.  
**Example**: `packages/cli/src/utils/installer.ts` (explode + `installFiles`), `packages/cli/src/commands/manifest.ts`  
**Do not**: Assume legacy asset remapping when `placementMode` is absent.
