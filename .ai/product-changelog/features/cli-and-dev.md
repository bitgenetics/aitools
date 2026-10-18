# Feature Completions — cli-and-dev

> CLI command baselines, repo/test conventions, tooling limitations. Part of [features/](./README.md).

### install / uninstall / update — 2026-04-26 `d0b6f60` (updated `ad7a20d`)
**What**: Full package lifecycle. `aitools install <name[@version]>` downloads from the highest-priority registry that has the package, extracts to cache, copies files to the platform-specific install path, and records the result in the scope’s lock file. Default install scope is **project** (`./aitools.json` + `./aitools-lock.json`); `-g`/`--global` (or `--scope user`) installs to platform user paths and tracks under `~/.aitools/`. `uninstall` / `list` / `update` accept `-g` / `--scope` to target the matching tracking root.  
**Why**: User-scope tracking must not be coupled to cwd; project and user installs are independent trees.  
**Impact**: E2e must assert lock/deps location by scope; no automatic migration of old project-lock `scope: user` entries.  
**Key APIs**: `Installer.install(client, manifest, scope, options?)`, `Installer.uninstall(name, scope)`, `trackingRoot()`, `CacheManager.get/set`  
**Key files**: `packages/cli/src/commands/install.ts`, `packages/cli/src/utils/installer.ts`, `packages/core/src/paths/tracking-root.ts`, `packages/e2e/src/config-layers.test.ts`

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

### version (show / bump) — 2026-08-09
**What**: `aitools version` prints the current publish version from `aitools.json`. `aitools version patch|minor|major` (or an explicit semver) bumps/sets that version and writes the file. Same behaviour as `aitools manifest bump`; shared helper is `bumpManifestVersion`. Does not change the CLI binary version (`aitools --version` / `-V`).  
**Why**: Shorter authoring UX for package version bumps without the `manifest` prefix.  
**Impact**: Requires a publishable `aitools.json` (same as `manifest bump`). Explicit versions must be greater than current.  
**Key files**: `packages/cli/src/commands/pkg-version.ts`, `packages/cli/src/utils/bump-version.ts`, `packages/e2e/src/cli.test.ts`

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

### `aitools mcp` — 2026-06-27 `6eba41d`
**What**: `aitools mcp` runs an MCP stdio server exposing registry search/install and on-demand `aitools_transform`. Subcommands `mcp install` / `mcp remove` register the server in detected platform `mcp.json` files (project or `--user`). Uses `@modelcontextprotocol/sdk`.  
**Key files**: `packages/cli/src/commands/mcp.ts`, `packages/cli/src/cli.ts`

---

### E2E config layer contract — 2026-06-28 `e0a753f` (updated `ad7a20d`)
**What**: `packages/e2e/src/config-layers.test.ts` is the executable e2e for settings write targets, cascade read merge, and install scope (including user tracking under `~/.aitools/`). Product expectations for that model live in this changelog; e2e implements them.  
**Key files**: `packages/e2e/src/config-layers.test.ts`, `packages/e2e/src/test-env.ts`, `AGENTS.md`, `.agents/skills/project-changelog/SKILL.md`
