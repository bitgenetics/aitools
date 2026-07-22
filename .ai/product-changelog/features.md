# Feature Completions

> Stable, completed features. Capture enough that an AI can work with or near them without re-reading the code.

---

### AI-mech context swap (role profiles) — 2026-07-22
**What**: `aitools context` hot-swaps project AI-mechanism files (rules, skills, agents, `AGENTS.md` / `CLAUDE.md`, `.claude/**`, scoped hooks/MCP AI configs). Modes: `replace` (full) and `overlay` (preserve authored `context.stay` globs). Every `swap` **quarantines** displaced files under `.aitools/context-quarantine/<id>/` (primary restore). Profile packages (`category: context-profile`) install as a tree overlay from the registry. Optional baseline package / capture hashes for integrity and registry fallback when quarantine is missing. `discover` is deterministic; stay judgment is assist-only via proposal file + `accept-stay`. Dirty AI-mech git paths block swap/restore unless `--force`.  
**Why**: Developers vs auditors (and similar roles) need reproducible swap/restore of on-disk AI guidance without owning vendor loaders.  
**Impact**: Additive schemas (`context` on `aitools.json` / lock; keep `lockfileVersion: 1`). E2e: `packages/e2e/src/context-swap.test.ts` asserts discover → swap (quarantine) → restore round-trip with stay-set overlay.  
**Key APIs**: `discoverAiMech`, `quarantineAiMech`, `restoreQuarantine`, `resolveStaySet`, `swapContextProfile`, `restoreContext`  
**Key files**: `packages/core/src/context/`, `packages/cli/src/commands/context.ts`, `packages/e2e/src/context-swap.test.ts`

---

### cursor load (multi-root agent from .code-workspace) — 2026-07-22
**What**: Modular package `@bitgenetics/aitools-cursor` (bin: `aitools-cursor`) parses a VS Code/Cursor multi-root `.code-workspace` file, resolves each `folders[].path` against the workspace file directory, and launches the Cursor Agent CLI (`agent`) with the first folder as `--workspace` and each additional folder as `--add-dir` (Cursor's real multi-root flag; not `--add-path`). Exposed as `aitools cursor load <workspace-file> [--dry-run] [--agent-bin <bin>] [-- <agentArgs...>]` via a thin CLI wrapper; the standalone binary supports the same `load` subcommand so the package can be split out later.  
**Why**: `.code-workspace` multi-root layouts (e.g. `chip_agent-hub.code-workspace`) are not accepted as `--workspace` by the agent CLI; authors need a one-shot way to map workspace folders into agent roots.  
**Impact**: Unit tests cover JSONC parse, path resolution, argv building, and dry-run; spawn is injectable. Does not auto-publish `@bitgenetics/aitools-cursor` to npm yet (monorepo-local; published with CLI as a dependency when CLI publishes).  
**Key APIs**: `parseCodeWorkspaceFile`, `resolveWorkspaceFolders`, `buildAgentArgv`, `loadWorkspaceFromFile`, `createCursorProgram`  
**Key files**: `packages/cursor/src/`, `packages/cli/src/commands/cursor.ts`

---

### install / uninstall / update — 2026-04-26 `d0b6f60` (updated `ad7a20d`)
**What**: Full package lifecycle. `aitools install <name[@version]>` downloads from the highest-priority registry that has the package, extracts to cache, copies files to the platform-specific install path, and records the result in the scope’s lock file. Default install scope is **project** (`./aitools.json` + `./aitools-lock.json`); `-g`/`--global` (or `--scope user`) installs to platform user paths and tracks under `~/.aitools/`. `uninstall` / `list` / `update` accept `-g` / `--scope` to target the matching tracking root.  
**Why**: User-scope tracking must not be coupled to cwd; project and user installs are independent trees.  
**Impact**: E2e must assert lock/deps location by scope; no automatic migration of old project-lock `scope: user` entries.  
**Key APIs**: `Installer.install(client, manifest, scope, options?)`, `Installer.uninstall(name, scope)`, `trackingRoot()`, `CacheManager.get/set`  
**Key files**: `packages/cli/src/commands/install.ts`, `packages/cli/src/utils/installer.ts`, `packages/core/src/paths/tracking-root.ts`, `packages/e2e/src/config-layers.test.ts`

---

### Plugin-bundle install layout — 2026-07-16 `8c15b68`
**What**: `aitools install <pkg> --plugin-bundle` installs skill/rule/command/agent/mcp-tool/hook packages into the plugin **author layout** under cwd (`skills/`, `rules/`, `agents/`, `commands/`, `mcp.json`, `hooks/hooks.json` — respecting `.cursor-plugin/plugin.json` path overrides via `getPluginBundleScanPlan`). Lock records `installMethod: plugin-bundle`. Project scope only; rejects `-g` / `--scope user` / `--cursor-plugin`. Reinstall (`aitools install` / `update`) honors the lock method. `list` shows `[plugin-bundle]`. Uninstall deletes locked paths / unmerges MCP/hooks as usual. Default install (no flag) still uses platform dirs (e.g. `.cursor/skills/`). Rejects `category: plugin` and `category: reference` with a clear error. Does not auto-edit the consuming plugin’s publish `files[]` — authors run `manifest files` / validate.  
**Why**: Plugin authors need registry packages as distribute-with-plugin members under author roots; platform install remains the local/dev dependency path (`-D`).  
**Impact**: E2e must assert author-root destinations + lock method for `--plugin-bundle`, platform destinations without the flag, and rejects for `-g` / `--cursor-plugin` / `category: plugin`.  
**Key files**: `packages/core/src/manifest/plugin-bundle-install.ts`, `packages/cli/src/utils/installer.ts`, `packages/cli/src/commands/install.ts`, `packages/e2e/src/cli.test.ts`

---

### File placementMode (strict / verbatim / transform) — 2026-07-17 `31b7508` (redefined `2026-07-21`)
**What**: Each `files[]` entry may set `placementMode`: `strict` (default when omitted), `verbatim`, or `transform`.
- **strict** (default): place relative to the platform's install **area** for the file's category + scope — `resolveInstallPath(category, scope)` + path-within-category. Portable across project/user **and** across platforms (routes per category via the adapter, so it works even where category dirs diverge, e.g. VS Code `.github/agents` vs `~/.copilot/prompts`). No content/extension rewriting.
- **verbatim**: honor `dest` 1:1, relative to the **scope root** (project cwd or user home). Escape hatch for an exact custom path (e.g. an asset placed as a sibling of the platform category dirs, `.cursor/assets/x`).
- **transform**: same category-area placement as strict, **plus** remap (plugin `assets/`/`scripts/` → synthetic skill package) and cross-platform content/`destExtension` rewriting.

`manifest init`/`files` still emit `placementMode: "strict"` on new entries (now the portable default). MCP/hooks merge behaviour is unchanged.  
**Why (redefinition 2026-07-21)**: The prior default (`strict` = 1:1 relative to cwd/home) meant `-g`/user installs of author-layout members wrote into whatever directory the command ran in, and `~/agents/…` was never a real platform location. Making the default place relative to the platform area fixes user-scope installs and removes the need for per-kind special-casing in the installer. The old cwd-literal behaviour moved to the opt-in `verbatim`.  
**Impact**: Manifests that explicitly set `strict` now route by category area instead of cwd-literal; authors who need an exact path must set `verbatim`. Assets with omitted `placementMode` now land under the synthetic skills package (category area), not their literal `dest`. See constraints → *Plugin native members explode by scope, not cwd*.  
**Why**: Authors need predictable dest→disk mapping; opt into transform only when remapping is desired.  
**Impact**: Packages that omit `placementMode` now use strict (breaking vs prior always-remap for plugin assets). E2e asserts strict asset dest (`.cursor/assets/…`) and transform remapping fixtures; manifest init emits `placementMode: "strict"`.  
**Key files**: `packages/core/src/placement/placement-mode.ts`, `packages/core/src/types/tool.ts`, `packages/core/src/schema/tool-schema.ts`, `packages/cli/src/utils/installer.ts`, `packages/cli/src/commands/manifest.ts`, `packages/cli/src/utils/installer.test.ts`, `packages/e2e/src/plugin-install.test.ts`, `packages/e2e/src/cli.test.ts`

---

### search / find — 2026-04-26 `d0b6f60`
**What**: `aitools search <query>` queries all configured registries and merges results. `aitools find <description>` is a natural-language smart search — the description is forwarded to the registry's AI-assisted search endpoint.  
**Key files**: `packages/cli/src/commands/search.ts`, `packages/server/src/routes/tools.ts` (`GET /search?q=`)

---

### publish — 2026-04-26 `d0b6f60` (updated unified `aitools.json`; plugin portability gate `2026-07-21`)
**What**: `aitools publish` reads `aitools.json`, extracts the publish subset via `toPublishManifest()`, bundles declared files into a tarball, and POSTs to the configured registry. Requires `Bearer` token auth when the registry has `publishToken` set. For `category: skill` it warns on frontmatter compat issues (blocks under `--strict`). For `category: plugin` it runs `analyzePluginPortability` and prints the grade: orphan files (`unsupported`) always block; `rewrite-required` / `missing-anchor` warnings prompt `Publish anyway? (y/N)` on a TTY, block under `--strict`, continue with `-y`/`--yes`, and auto-continue (with a notice) when stdin is not a TTY. Declining the prompt cancels publish (no upload, exit 0).  
**Key flags**: `--dry-run` (runs the portability check too), `--strict`, `-y/--yes`, `--registry`, `--manifest`  
**Key files**: `packages/cli/src/commands/publish.ts`, `packages/cli/src/utils/registry-client.ts`, `packages/core/src/manifest/publish-manifest.ts`, `packages/core/src/manifest/plugin-anchor.ts`

---

### plugin category — 2026-06-28 (updated explode `8a80e17`; `--cursor-plugin` `ad7a20d`; `placementMode` `31b7508`)
**What**: `category: plugin` for multi-file plugin bundles. **Default install explodes** members into normal platform paths (skills/rules/commands/agents + MCP/hooks merge) for project or user scope. Explode rewrites relative paths in hooks/skills/MCP via `rewriteRelativePaths` / path maps; lock records `mcpKeys` / `hooksAdded` for uninstall. **`aitools install <pkg> --cursor-plugin`** copies an opaque tree to `~/.cursor/plugins/local/<name>/` (always user scope; rejects `--scope project`; `installMethod: cursor-plugin-local` in `~/.aitools` lock). Per-file `placementMode` controls dest: **transform** remaps `scripts/`/`assets/` under a synthetic skill package; **strict** (default) honors project-relative `dest`. Structure validation requires every `files[]` entry to have an install home.  
**Why**: Explode is the portable default; Cursor’s local plugin loader is an explicit opt-in channel.  
**Impact**: Default explode must not create `plugins/local/`; `--cursor-plugin` must not explode into skill/rule dirs. Remap fixtures need `placementMode: "transform"`. E2e: `plugin-install.test.ts`.  
**Key files**: `packages/core/src/manifest/plugin-explode.ts`, `packages/cli/src/transformers/path-rewrite.ts`, `packages/cli/src/utils/installer.ts`, `packages/e2e/src/plugin-install.test.ts`  
**Design doc**: `docs/design/plugin-marketplaces-comparison.md`

---

### Anchor-skill plugin convention + portability grade — 2026-07-21 (updated 2026-07-22)
**What**: A uniform authoring convention for `category: plugin` bundles. One skill folder named after the package — the **anchor** (`anchorSkillName(name)` = `sanitizePackageDirName(name)`) — is the plugin's hub: it owns shared content (`references/`, `assets/`, `scripts/`) and a **skill-map** documenting how member skills work together. Sibling skills reference the hub via `../<anchor>/…`, which resolves 1:1 after explode (no dynamic path rewrite). `analyzePluginPortability()` grades a plugin `path-rewrite-free` (shared content under `skills/<name>/…`; relative links need no `rewriteRelativePaths`), `rewrite-required` (plugin-root `assets/`/`scripts/` need path rewrite at install), or `unsupported` (orphan files with no install home). The grade + findings are surfaced by `aitools manifest validate` and `aitools compat` (which now has a plugin section). `aitools compat --fix` and `aitools manifest init --category plugin` scaffold/refresh the anchor `SKILL.md` skill-map.  
**Why**: Shared plugin content authored under the anchor skill avoids install-time *path* rewriting; the grade tells authors when they've drifted into rewrite territory before publish.  
**Impact**: `manifest validate` / `compat` are advisory (warn, non-fatal). **`aitools publish` gates on the grade** for plugins: `unsupported` (orphan files) always fails; `rewrite-required` / `missing-anchor` warnings prompt `Publish anyway? (y/N)` on an interactive TTY, are blocked by `--strict`, auto-continue with `--yes`, and proceed with a printed notice when non-interactive. Orphans remain fatal in `validate` via `validatePluginStructure`. Single-skill plugins use the same shape (`skills/<name>/SKILL.md`). E2e: `packages/e2e/src/plugin-anchor.test.ts` asserts a path-rewrite-free anchored plugin explodes with resolving `../<anchor>/…` refs and that a root-`assets` variant grades `rewrite-required`.  
**Key APIs**: `anchorSkillName(name)`, `analyzePluginPortability({ packageName, sources, pluginJson })` → `{ grade, findings }`  
**Key files**: `packages/core/src/manifest/plugin-anchor.ts`, `packages/core/src/manifest/plugin-explode.ts`, `packages/cli/src/commands/manifest.ts`, `packages/cli/src/commands/compat.ts`, `packages/cli/src/commands/publish.ts`, `packages/e2e/src/plugin-anchor.test.ts`

---

### compat — 2026-04-26 `d0b6f60` (updated `6eba41d`)
**What**: `aitools compat [--platform <p>] [--manifest <path>] [--fix]` checks manifest files against platform specs. Reports unsupported frontmatter fields; `--fix` strips them. Warns on stale specs (>90 days). When `nativeFor` differs from the target platform, shows per-category **transform confidence** (`high`/`medium`/`low`/`unsupported`) via `estimateCategoryConfidence`.  
**Key files**: `packages/cli/src/commands/compat.ts`, `packages/cli/src/transformers/hook.ts`, `packages/core/src/platforms/`

---

### config — 2026-04-26 `d0b6f60` (updated `e0a753f`)
**What**: `aitools config get/list` reads the **merged** cascade (project overrides user). `config set/unset/edit` writes to `~/.aitools.config.json` by default; `--project` writes `./aitools.config.json`. `config list --global` shows user-only layer. Keys use dot notation: `platform`, `defaultScope`, `registries.0.url`, etc.  
**Key files**: `packages/cli/src/commands/config.ts`, `packages/cli/src/utils/config-write-target.ts`, `packages/core/src/config/cascade.ts`

---

### registry — 2026-04-26 `d0b6f60` (updated `e0a753f`)
**What**: `aitools registry add/remove/list` — manages the `registries` array. Writes default to user config; `--project` writes project config. Supports HTTP registries (default) and git-backed registries (`--type git`, `--read-branch`, `--publish-branch`, `--path`). Git registries use system git credentials; `--token` is rejected for git type.  
**Key files**: `packages/cli/src/commands/registry.ts`, `packages/cli/src/utils/config-write-target.ts`, `packages/cli/src/utils/git-registry-client.ts`

---

### E2E git registry round-trip — 2026-06-26 `d7f8fa0`
**What**: Docker e2e runs publish → install → search against a Gitea-hosted git registry; local e2e uses a temporary bare repo when `GITEA_URL` is unset. Shared helpers in `test-env.ts` isolate `HOME`/`AITOOLS_CONFIG_ROOT` so user config does not leak into tests.  
**Key files**: `packages/e2e/src/cli.test.ts`, `packages/e2e/src/test-env.ts`, `packages/e2e/global-setup.cjs`, `packages/e2e/gitea-setup.cjs`

---

### README registry types documentation — 2026-06-26 `52eaa5a`
**What**: `readme.md` reorganized with table of contents, quick-start slot for lightweight git registry, and a **Registry types** reference (git vs HTTP comparison, repo layout, config examples, CLI flags).  
**Key files**: `readme.md`, `docs/deployment.md` (link to `#registry-types`)

---

### dev-init — 2026-04-26 `d0b6f60` (updated `cb32793`)
**What**: `aitools dev-init [--force] [--scope project|user] [--platform <p>]` installs the bundled `create-ai-tool` skill from the CLI package — no registry required. Writes lock + `aitools.json` (devDependency). Lock entry records `platform`, `category`, and `scope`.  
**Why**: Bundled bootstrap must honour the same platform override as install-family commands.  
**Impact**: Without `--platform` / config, universal tip suggests configuring platform or passing `--platform`.  
**Key files**: `packages/cli/src/commands/dev-init.ts`, `packages/cli/src/bundled/create-ai-tool.ts`

---

### manifest init / validate / bump — 2026-04-26 `d0b6f60` (updated dest nesting)
**What**: `aitools manifest init` scaffolds publish fields in `aitools.json` interactively or with `--yes`. Interactive mode detects root-level content files and content folders (`detectContentFolders`), prompts per group, and falls back to per-file selection (`--pick-files` or when folder selection is declined). Category-aware placeholders and file extensions for skill, subagent, prompt, and mcp-tool; mcp-tool scaffolds `mcpServer`. Plugin init uses `getPluginBundleScanPlan`. `validate` runs Zod schema checks + verifies declared files exist. `bump patch|minor|major` increments the version with semver.  
**Why**: Authors need category-aware discovery without hand-writing every `files[]` entry.  
**Impact**: For skill/subagent/prompt, default `files[].dest` nests under the package install folder (e.g. `my-skill/SKILL.md`), not a bare filename at the category root. Explicit `src:dest` via `--file` is preserved. MCP tools and plugins keep author-relative dests.  
**Key flags**: `--pick-files`, `--category`, `--nativeFor` (plugin), `-y/--yes`, `--force`  
**Key files**: `packages/cli/src/commands/manifest.ts`, `packages/core/src/manifest/plugin-explode.ts`, `packages/e2e/src/cli.test.ts`

---

### manifest files — 2026-07-15 `dee6a92` (updated dest nesting)
**What**: `aitools manifest files` walks detected publish candidates and lets the user include/exclude each file and set install `dest` paths. Merges with existing `files[]` by default; `--force` replaces the list. `--yes` includes all detected files with default dest (skill/subagent/prompt nest under the package folder; mcp-tool/plugin keep `dest: src`). Re-scaffolds `mcpServer` entry path when needed for mcp-tool packages.  
**Key flags**: `--category` (when no manifest yet), `-y/--yes`, `--force`  
**Key files**: `packages/cli/src/commands/manifest.ts`, `packages/e2e/src/cli.test.ts`

---

### list — 2026-04-26 `d0b6f60` (updated `ad7a20d`)
**What**: `aitools list [-g|--scope project|user] [--json]` reads the scope’s lock and prints installed tools (version, install date, optional `[cursor-plugin]` marker).  
**Key files**: `packages/cli/src/commands/list.ts`, `packages/e2e/src/config-layers.test.ts`, `packages/e2e/src/cli.test.ts`

---

### Shared references (core model) — 2026-07-15 `a556dd4` (adapter typing `43b5c50`)
**What**: Core types and helpers for package `references` — parse ranges, vendor-path layout, install-target resolution, and reference lock provenance. Design: registry DRY + per-consumer vendored copies at install (CLI installer integration still pending per design doc). Platform adapters treat `reference` like `plugin`/`mcp-tool`/`hook`: not a regular file-dir category (`AdapterFileCategory` / `toAdapterFileCategory`).  
**Why**: Reuse markdown/resources across skills without a global shared mutable store.  
**Impact**: Schema/types land in core; do not route `reference` through `resolveDir`; do not assume installer already vendors references until CLI wiring ships.  
**Key files**: `packages/core/src/references/`, `packages/core/src/types/reference.ts`, `packages/cli/src/adapters/types.ts`, `docs/design/shared-references.md`

---

### init — 2026-04-26 `d0b6f60`
**What**: `aitools init` creates `aitools.json` in the current directory with sensible defaults (project name from directory name, empty tools/devTools).  
**Key files**: `packages/cli/src/commands/init.ts`

---

### manifest platforms field — 2026-04-26 `d719124`
**What**: `ToolManifest` now has an optional `platforms?: TargetPlatform[]` field. When set, `Installer.installFiles` rejects the install with a clear error if the configured platform is not in the list (and `'universal'` is not present). Omitting the field means "supports all platforms". Validated by `ToolManifestSchema` (Zod). Documented in `tools/create-ai-tool/references/manifest-reference.md`.  
**Key files**: `packages/core/src/types/tool.ts`, `packages/core/src/schema/tool-schema.ts`, `packages/cli/src/utils/installer.ts`

---

### manifest update — 2026-04-27 `d719124`
**What**: `aitools manifest update` edits fields in an existing `aitools.manifest.json`. Interactive mode (no flags) prompts for every field with the current value as default — press Enter to keep, type a new value to change, type `-` to clear an optional field. `--yes` mode applies only the flags explicitly passed and leaves everything else unchanged. Covers all metadata fields: `name`, `description`, `category`, `author`, `repository`, `keywords`, `tags`, `platforms`. Files are preserved; use `manifest init --force` to re-scaffold files.  
**Key flags**: `--name`, `--description`, `--category`, `--author`, `--keywords`, `--tags`, `--repository`, `--platforms`, `-y/--yes`  
**Key files**: `packages/cli/src/commands/manifest.ts`

---

### Admin portal login — 2026-04-30 `d22c706`
**What**: Session-cookie login flow gating `/portal/admin`. `GET /portal/admin/login` serves a login form; `POST /portal/admin/login` validates the submitted token via `IAdminAuth.createSession()` and sets an `HttpOnly; SameSite=Strict` cookie (`admin_session`). `GET /portal/admin` redirects to login when the session is absent or expired. `GET /portal/admin/logout` invalidates the session. Admin portal routes are only registered when admin auth is configured.
**Key files**: `packages/server/src/routes/portal.ts`, `packages/server/src/providers/auth/simple.ts`, `packages/server/src/providers/auth/database.ts`

---

### Three deployment modes with provider factories — 2026-04-30 `d22c706`
**What**: `createStorageProvider(config?)` and `createAuthProvider(config?)` factory functions select a backend from env vars. Documented deployment modes: (1) local — `STORAGE_BACKEND=filesystem` + `AUTH_BACKEND=simple`; (2) dev — `STORAGE_BACKEND=filesystem` + `AUTH_BACKEND=database` + `DATABASE_URL`; (3) production — `STORAGE_BACKEND=azure|s3` + `AUTH_BACKEND=oidc`.
**Key files**: `packages/server/src/providers/storage/index.ts`, `packages/server/src/providers/auth/index.ts`, `packages/server/src/index.ts`, `packages/server/.env.example`

---

### User auth API — 2026-06-15 `95123f3`
**What**: When `DatabaseAuthProvider` + `UserStore` are active, the server exposes `POST /api/auth/register`, `POST /api/auth/login`, and token CRUD at `/api/auth/tokens`. Users get bearer tokens for publish/org operations.  
**Key files**: `packages/server/src/routes/auth.ts`, `packages/server/src/storage/user-store.ts`, `packages/server/src/db/migrations.ts`

---

### HTML browse portal — 2026-06-15 `95123f3`
**What**: Server serves an HTML tool browser at `GET /` and `GET /skills/:name` (not JSON API). Admin UI at `/admin` with session login (see Admin portal login entry). Cross-registry search via `GET /api/search/all`.  
**Key files**: `packages/server/src/routes/portal.ts`, `packages/server/src/routes/registry-exploration.ts`

---

### Cross-platform install transforms — 2026-06-27 `6eba41d`
**What**: When `nativeFor` on the manifest differs from the configured platform, `Installer` mechanically transforms rule/command/agent/hook files at install time. Hooks merge into platform `hooks.json` / Claude `settings.json`. Unsupported or empty transforms are skipped with stderr guidance; low confidence suggests running `/aitools-convert`.  
**Key APIs**: `transform(content, category, from, to, ctx)`, `mergeHookConfigs`, `estimateCategoryConfidence`  
**Key files**: `packages/cli/src/transformers/`, `packages/cli/src/utils/installer.ts`, `packages/cli/src/bundled/aitools-convert.ts`

---

### Expanded tool categories + `nativeFor` — 2026-06-27 `6eba41d`
**What**: `ToolCategory` adds `rule`, `command`, `agent`, `hook` (legacy `subagent`/`prompt` normalize via `normalizeCategory`). Manifest optional `nativeFor: TargetPlatform` declares authorship platform. Adapters expose category install dirs and `resolveHooksConfig()` for hook merging.  
**Key files**: `packages/core/src/types/tool.ts`, `packages/core/src/types/category.ts`, `packages/cli/src/adapters/`

---

### `aitools mcp` — 2026-06-27 `6eba41d`
**What**: `aitools mcp` runs an MCP stdio server exposing registry search/install and on-demand `aitools_transform`. Subcommands `mcp install` / `mcp remove` register the server in detected platform `mcp.json` files (project or `--user`). Uses `@modelcontextprotocol/sdk`.  
**Key files**: `packages/cli/src/commands/mcp.ts`, `packages/cli/src/cli.ts`

---

### E2E config layer contract — 2026-06-28 `e0a753f` (updated `ad7a20d`)
**What**: `packages/e2e/src/config-layers.test.ts` is the executable e2e for settings write targets, cascade read merge, and install scope (including user tracking under `~/.aitools/`). Product expectations for that model live in this changelog; e2e implements them.  
**Key files**: `packages/e2e/src/config-layers.test.ts`, `packages/e2e/src/test-env.ts`, `AGENTS.md`, `.agents/skills/project-changelog/SKILL.md`

---

### `npm run test:coverage` + server thresholds — 2026-06-28 `e0a753f`
**What**: Root script runs Jest with `--coverage` on core/cli/server; CI `test.yml` invokes it. Reports emit to `packages/*/coverage/` (gitignored). Server adds scoped `collectCoverageFrom`, expanded auth/storage/route tests, and global thresholds (80% stmts/lines/funcs, 70% branches).  
**Key files**: `package.json`, `.github/workflows/test.yml`, `packages/server/jest.config.cjs`, `packages/server/src/auth/publisher-auth.test.ts`

