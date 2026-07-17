# Design Patterns

> Recurring patterns used across the codebase. New code should follow these unless there's a documented reason not to.

---

### Commander v12 action signature
**Used for**: Every CLI command handler.  
**How**: The action callback receives `(options, cmd)` where `cmd` is the `Command` instance. For subcommands with positional args, it's `(arg, options, cmd)`. Always check `cmd.args[0] === 'help'` at the top of the action to intercept `ai-tools <command> help` before running logic.  
**Example**: `packages/cli/src/commands/publish.ts` — top of action block  
**Do not**: Use the deprecated `action((arg, options) => {...})` without `cmd` — you can't call `cmd.help()` or inspect `cmd.args`.

---

### Zod validation at system boundaries only
**Used for**: Validating external data — registry responses, manifest files, config files, publish request bodies.  
**How**: Parse with `Schema.safeParse(data)` and handle the error branch explicitly. Do not use Zod inside internal functions that only receive already-validated data.  
**Example**: `packages/core/src/schema/tool-schema.ts`, `packages/server/src/routes/tools.ts` (`PublishBodySchema`)  
**Do not**: Re-validate data that was already validated at the entry point. Only validate at the boundary where external input enters the system.

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

### Copilot-ignored files — use terminal for reads and writes
**Used for**: All files under `packages/cli/src/` and `packages/core/src/`.  
**How**: Use PowerShell `Get-Content` to read. For multi-line writes/edits, write a Python script to a file using single-quoted heredoc (`@'...'@`), run `python script.py`, then delete the script. Never use Python `-c` with multiline strings in PowerShell.  
**Example**: Every file edit in this session used this pattern.  
**Do not**: Use `read_file` or `replace_string_in_file` on files under those paths — the tools will fail silently or with an "ignored" error.

---

### Fastify `buildApp()` / `inject()` for server tests
**Used for**: Testing `@bitgenetics/aitools-server` route handlers.  
**How**: Call `buildApp(options)` to get a Fastify instance, then use `app.inject({ method, url, payload })` to fire requests without binding a network port. No `supertest` or real HTTP needed.  
**Example**: `packages/server/src/routes/tools.test.ts`  
**Do not**: Start the server with `app.listen()` in tests — it causes port conflicts and slow teardown.

---

### Lock file as source of truth for installed state
**Used for**: Everything that reads or writes installed tool state.  
**How**: `readLockFile(cwd)` → mutate with `upsertLockEntry` / `removeLockEntry` → `writeLockFile(cwd, lock)`. Always re-read before writing; never cache the lock object across async boundaries.  
**Example**: `packages/cli/src/utils/installer.ts`, `packages/cli/src/commands/dev-init.ts`  
**Do not**: Write directly to `aitools-lock.json` — always use the lock utilities so the schema stays valid.

---

### Content file detection for `manifest init` and `manifest files` — `dee6a92` / `b653839` (updated dest nesting)
**Used for**: `manifest init` and `manifest files` — finding skill/subagent/prompt/mcp-tool/plugin content to include.  
**How**: `detectDirectContentFiles` finds root-level matches; `detectContentFolders(root, exts)` finds subdirectories that **directly** contain at least one file matching `exts`. Plugin category uses `getPluginBundleScanPlan` / `resolvePluginBundleSources` (skills/rules/agents/commands/hooks/assets/scripts + `.cursor-plugin/`). Interactive init prompts per root group and per folder; when nothing is selected, offers `promptForManifestFiles`. `manifest files` / init `--yes` default `dest` via `defaultInstallDest`: skill/subagent/prompt nest under the package install folder (e.g. `my-skill/SKILL.md`); mcp-tool and plugin keep author-relative `dest: src`.  
**Example**: `packages/cli/src/commands/manifest.ts`, `packages/e2e/src/cli.test.ts` (manifest init/files dest nesting)  
**Do not**: Use raw `detectFiles` in interactive folder mode — it returns flat file lists rather than logical content units. Do not scaffold skill `dest` as a bare filename at the category root.

---

### Shared `--platform` CLI option — 2026-07-14 `4452a4d`
**Used for**: `install`, `uninstall`, `update`, `dev-init` (and any install-family command).  
**How**: Import `PLATFORM_OPTION_DESCRIPTION` + `resolvePlatformOption` from `platform-option.ts`; pass result into `ConfigManager(cwd, { platform })`. Unknown platforms exit with known-list error.  
**Example**: `packages/cli/src/utils/platform-option.ts`, `packages/cli/src/commands/install.ts`  
**Do not**: Duplicate per-command platform parsing after this helper exists.

---

### Portable stored paths in lock/manifest — 2026-07-14 `80f6568`
**Used for**: Writing/reading install paths in `aitools-lock.json` / related manifests.  
**How**: `toStoredPath(root, absPath)` → relative-to-root or `~/…`; `resolveStoredPath(root, stored)` → absolute. Never persist absolute paths when they can be re-encoded.  
**Example**: `packages/core/src/paths/stored-path.ts`, `packages/cli/src/utils/installer.ts`  
**Do not**: Write machine-specific absolute paths into the lock when a portable form exists.

---

### Plugin explode path rewrite — 2026-07-14 `8a80e17`
**Used for**: After classifying plugin members, rewrite relative refs in hook/skill/MCP content so they point at final install locations.  
**How**: Build a bundle-rel → final-rel `PluginPathMap`; run `rewriteRelativePaths(content, pathMap)` (quoted paths + markdown links under scripts/assets/skills/…). Applies even when source and target platforms match (layout relocate).  
**Example**: `packages/cli/src/transformers/path-rewrite.ts`, `packages/cli/src/utils/installer.ts`  
**Do not**: Leave `./scripts/…` references pointing at the pre-explode package tree after install.

---

### Adapter file categories exclude reference — 2026-07-16 `43b5c50`
**Used for**: Mapping manifest categories to `PlatformAdapter.resolveDir`.  
**How**: `AdapterFileCategory` / `toAdapterFileCategory` exclude `mcp-tool`, `hook`, `plugin`, and `reference`. Those use specialized install paths (MCP/hooks merge, explode, or future reference vendoring).  
**Example**: `packages/cli/src/adapters/types.ts`  
**Do not**: Call `resolveDir('reference', …)` — it is not a regular file-based category.

---

### Plugin-bundle author-root path resolution — 2026-07-16 `8c15b68`
**Used for**: `--plugin-bundle` installs that place packages into plugin author layout instead of platform vendor dirs.  
**How**: When `InstallOptions.pluginBundle` is set, resolve category bases via `resolvePluginBundleInstallBase` / MCP / hooks helpers (from `getPluginBundleScanPlan` + optional `.cursor-plugin/plugin.json`), not `adapter.resolveDir`. Record `installMethod: 'plugin-bundle'` on the lock. Reinstall/update read that method like `cursor-plugin-local`. Keep platform adapters platform-only.  
**Example**: `packages/core/src/manifest/plugin-bundle-install.ts`, `packages/cli/src/utils/installer.ts`  
**Do not**: Overload `PlatformAdapter.resolveDir` for author layout; do not treat plugin-bundle as explode or `--cursor-plugin`.

---

### File placementMode resolution — 2026-07-17 `31b7508`
**Used for**: Deciding whether `files[].dest` is honored 1:1 or remapped at install.  
**How**: Call `effectivePlacementMode(file)` (`packages/core/src/placement/placement-mode.ts`). Omitted → `strict` (project-relative `dest`). `transform` enables plugin explode remaps and content `destExtension`. Manifest generators always emit `placementMode: 'strict'` via `fileEntry()`.  
**Example**: `packages/cli/src/utils/installer.ts` (explode + `installFiles`), `packages/cli/src/commands/manifest.ts`  
**Do not**: Assume legacy asset remapping when `placementMode` is absent.

---

### `createRegistryClient()` factory dispatch — 2026-06-26 `d7f8fa0`
**Used for**: All CLI commands that talk to a configured registry (install, search, publish, update).  
**How**: `createRegistryClient(config)` checks `config.type === 'git'` (via `isGitRegistryConfig`) and returns `GitRegistryClient` or `HttpRegistryClient`. Both implement the shared `RegistryClient` interface. Omitting `type` in config defaults to HTTP.  
**Example**: `packages/cli/src/utils/registry-client.ts`, `packages/cli/src/utils/git-registry-client.ts`  
**Do not**: Branch on registry type inside command handlers — always go through the factory so HTTP and git stay interchangeable at the call site.

---

### Config write target resolution — 2026-06-28 `e0a753f`
**Used for**: Any CLI command that mutates `aitools.config.json` (`config set/unset/edit`, `registry add/remove`).  
**How**: Call `assertExclusiveConfigTarget(options)` then `resolveConfigWriteTarget(options)` → `'user' | 'project'`. Default is user (`~/.aitools.config.json`); `--project` selects `./aitools.config.json`. Read layer via `readUserConfig()` / `readProjectConfig()`, write via `writeUserConfig()` / `writeProjectConfig()`.  
**Example**: `packages/cli/src/utils/config-write-target.ts`, `packages/cli/src/commands/registry.ts`  
**Do not**: Write the merged `ConfigManager.config` object back to disk — that loses layer separation.

---

### Config layer test contract — 2026-06-28 `e0a753f`
**Used for**: Any change to settings writes, cascade reads, or install scope defaults.  
**How**: Unit tests in `config-write-target.test.ts`, `config.test.ts`, `registry.test.ts`, `config-manager.test.ts`, `install.test.ts`. E2E in `config-layers.test.ts`. Isolate user home with mocked `os.homedir()` or `AITOOLS_CONFIG_ROOT` in unit tests; e2e uses `E2E_USER_CONFIG`.  
**Example**: `AGENTS.md` Testing section, `packages/e2e/src/config-layers.test.ts`  
**Do not**: Ship config-layer behaviour changes without updating both unit and e2e contracts.

---

### Changelog-first e2e contracts — 2026-07-16 `ad7a20d`
**Used for**: Any product-behaviour change that will (or should) be covered by `packages/e2e`.  
**How**: When writing an implementation plan, include a **Update product changelog** step (skill: `project-changelog`) *before* e2e todos. Record the intended CLI/user-visible behaviour in `features.md` (plus `constraints.md` / `patterns.md` as needed) with the e2e suite under **Key files**. Implement e2e against that entry — not the reverse.  
**Example**: `.agents/skills/project-changelog/SKILL.md` Workflow §0, `AGENTS.md` Testing  
**Do not**: Treat e2e `it(...)` names as the product spec when the changelog is silent or stale; do not generate plans with e2e work and no preceding changelog step.
