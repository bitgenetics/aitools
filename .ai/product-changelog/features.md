# Feature Completions

> Stable, completed features. Capture enough that an AI can work with or near them without re-reading the code.

---

### install / uninstall / update — 2026-04-26 `d0b6f60`
**What**: Full package lifecycle. `aitools install <name[@version]>` downloads from the highest-priority registry that has the package, extracts to cache, copies files to the platform-specific install path, and records the result in `aitools-lock.json`. `uninstall` removes files and the lock entry. `update` re-fetches latest (or a specified version).  
**Key APIs**: `Installer.install(client, manifest, scope)`, `Installer.uninstall(name, cwd)`, `CacheManager.get/set`  
**Key files**: `packages/cli/src/commands/install.ts`, `packages/cli/src/commands/uninstall.ts`, `packages/cli/src/commands/update.ts`, `packages/cli/src/utils/installer.ts`, `packages/cli/src/utils/cache-manager.ts`

---

### search / find — 2026-04-26 `d0b6f60`
**What**: `aitools search <query>` queries all configured registries and merges results. `aitools find <description>` is a natural-language smart search — the description is forwarded to the registry's AI-assisted search endpoint.  
**Key files**: `packages/cli/src/commands/search.ts`, `packages/server/src/routes/tools.ts` (`GET /search?q=`)

---

### publish — 2026-04-26 `d0b6f60`
**What**: `aitools publish` packages the current directory's `aitools.manifest.json` + declared files into a tarball and POSTs it to the configured registry. Requires `Bearer` token auth when the registry has `publishToken` set. Shows a meaningful error when the registry is unreachable (ECONNREFUSED / ENOTFOUND / ETIMEDOUT).  
**Key files**: `packages/cli/src/commands/publish.ts`, `packages/cli/src/utils/registry-client.ts`

---

### compat — 2026-04-26 `d0b6f60` (updated `6eba41d`)
**What**: `aitools compat [--platform <p>] [--manifest <path>] [--fix]` checks manifest files against platform specs. Reports unsupported frontmatter fields; `--fix` strips them. Warns on stale specs (>90 days). When `nativeFor` differs from the target platform, shows per-category **transform confidence** (`high`/`medium`/`low`/`unsupported`) via `estimateCategoryConfidence`.  
**Key files**: `packages/cli/src/commands/compat.ts`, `packages/cli/src/transformers/hook.ts`, `packages/core/src/platforms/`

---

### config — 2026-04-26 `d0b6f60`
**What**: `aitools config get <key>`, `aitools config set <key> <value>`, `aitools config list` — reads/writes the project-level `aitools.config.json`. Keys use dot notation: `platform`, `defaultScope`, `registries.0.url`, etc.  
**Key files**: `packages/cli/src/commands/config.ts`, `packages/core/src/config/cascade.ts`

---

### registry — 2026-04-26 `d0b6f60` (updated `d7f8fa0`)
**What**: `aitools registry add/remove/list` — manages the `registries` array in config. Supports HTTP registries (default) and git-backed registries (`--type git`, `--read-branch`, `--publish-branch`, `--path`). Git registries use system git credentials; `--token` is rejected for git type.  
**Key files**: `packages/cli/src/commands/registry.ts`, `packages/cli/src/utils/git-registry-client.ts`, `packages/core/src/schema/config-schema.ts`

---

### E2E git registry round-trip — 2026-06-26 `d7f8fa0`
**What**: Docker e2e runs publish → install → search against a Gitea-hosted git registry; local e2e uses a temporary bare repo when `GITEA_URL` is unset. Shared helpers in `test-env.ts` isolate `HOME`/`AITOOLS_CONFIG_ROOT` so user config does not leak into tests.  
**Key files**: `packages/e2e/src/cli.test.ts`, `packages/e2e/src/test-env.ts`, `packages/e2e/global-setup.cjs`, `packages/e2e/gitea-setup.cjs`

---

### README registry types documentation — 2026-06-26 `52eaa5a`
**What**: `readme.md` reorganized with table of contents, quick-start slot for lightweight git registry, and a **Registry types** reference (git vs HTTP comparison, repo layout, config examples, CLI flags).  
**Key files**: `readme.md`, `docs/deployment.md` (link to `#registry-types`)

---

### dev-init — 2026-04-26 `d0b6f60`
**What**: `aitools dev-init [--force] [--scope project|user]` installs the bundled `create-ai-tool` skill directly from the CLI package binary — no registry required. Writes to `aitools-lock.json` and `aitools.json` (as a devDependency). Useful for bootstrapping a new project before a registry is configured.  
**Key files**: `packages/cli/src/commands/dev-init.ts`, `packages/cli/src/bundled/create-ai-tool.ts`

---

### manifest init / validate / bump — 2026-04-26 `d0b6f60`
**What**: `aitools manifest init` scaffolds `aitools.manifest.json` interactively or with `--yes` for non-interactive defaults. Interactive mode uses `detectSkillFolders` to find subdirectories that directly contain content files, then prompts per folder (`Include .agents/skills/create-ai-tool? (Y/n)`). `validate` runs Zod schema checks + verifies declared files exist. `bump patch|minor|major` increments the version with semver.  
**Key files**: `packages/cli/src/commands/manifest.ts`

---

### list — 2026-04-26 `d0b6f60`
**What**: `aitools list [--scope project|user]` reads `aitools-lock.json` and prints installed tools with version, category, scope, and install date.  
**Key files**: `packages/cli/src/commands/list.ts`

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

