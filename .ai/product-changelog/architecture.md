# Architecture Decisions

> ADR-style entries for major structural choices. Explain **why** — not just what.

---

### ESM-only monorepo with Node16 module resolution — 2026-04-26 `d0b6f60`
**What**: All four packages are pure ESM (`"type": "module"`), TypeScript compiled with `"moduleResolution": "node16"`.  
**Why**: Ensures compatibility with modern Node.js and avoids dual CJS/ESM packaging complexity. Node16 resolution requires explicit `.js` extensions on all local imports.  
**Impact**: Every local import must end in `.js` — even when the source file is `.ts`. Forgetting this causes a runtime `ERR_MODULE_NOT_FOUND`.  
**Key files**: `tsconfig.base.json`, each package's `tsconfig.json`

---

### Platform adapter pattern for install path resolution — 2026-04-26 `d0b6f60`
**What**: A `PlatformAdapter` interface (`resolveDir`, `resolveMcpConfig`) is implemented by five adapters: `universal`, `vscode`, `claude`, `cursor`, `windsurf`. `ConfigManager` selects the active adapter from `aitools.config.json`.  
**Why**: Each IDE places skills/agents/prompts in different directories and config formats. The adapter isolates this variation so `Installer` never needs to branch on platform.  
**Impact**: Adding a new platform requires only a new adapter class + platform spec entry. No changes to install, uninstall, or update logic.  
**Key files**: `packages/cli/src/adapters/`, `packages/core/src/platforms/`, `packages/cli/src/utils/config-manager.ts`

---

### Git-backed registry mode — 2026-06-26 `d7f8fa0`
**What**: Registries can be `type: "git"` — tool packages are stored in a git repo under `registry/<tool>/<version>/` (`manifest.json` + `tool.json`). The CLI maintains a local clone at `~/.aitools/git-cache/<name>/` and delegates auth to system git.  
**Why**: Small teams and solo devs often already have a private git repo; this avoids hosting `@aitools/server` while still supporting install/search/publish through the same CLI commands.  
**Impact**: `RegistryConfig` is a discriminated union (`http` | `git`). `createRegistryClient()` dispatches to `HttpRegistryClient` or `GitRegistryClient`. Configs without `type` remain HTTP for backward compatibility. Lock `resolved` accepts git remote URLs.  
**Key files**: `packages/cli/src/utils/git-registry-client.ts`, `packages/core/src/schema/config-schema.ts`, `packages/cli/src/commands/registry.ts`

---

### Config cascade (home → project) — 2026-04-26 `d0b6f60` (updated `d7f8fa0`)
**What**: `ConfigCascade.load()` walks from `cwd` up to the filesystem root, then the user home, reading `aitools.config.json` at each level. Lower-level files win; arrays (registries) are merged with lower-level entries prepended. `AITOOLS_CONFIG_ROOT` stops the upward walk at a boundary (used by e2e to isolate from the real user profile on Windows).  
**Why**: Users need project-level overrides (platform, registry) without touching a global config. Mirrors the mental model of `.npmrc`.  
**Impact**: Project-level config always beats home config. Never mutate the merged result — reload after writes.  
**Key files**: `packages/core/src/config/cascade.ts`, `packages/core/src/types/config.ts`

---

### Fastify registry server with ToolStore JSON persistence — 2026-04-26 `d0b6f60`
**What**: `@aitools/server` is a standalone Fastify v5 HTTP server exposing REST endpoints for tool discovery, download, and publish. `ToolStore` persists manifests as JSON + tarballs under `./data/`.  
**Why**: A self-hosted registry allows teams to publish internal tools privately. Fastify was chosen for its TypeScript-first design and low overhead. `buildApp()` is separated from `listen()` so tests can inject requests without binding a port.  
**Impact**: The server is stateless per request; all state lives in `ToolStore`. Registry chaining (proxy search to upstreams) is handled in `routes/registry.ts`.  
**Key files**: `packages/server/src/app.ts`, `packages/server/src/storage/tool-store.ts`, `packages/server/src/routes/`

---

### Registry chaining with priority ordering — 2026-04-26 `d0b6f60`
**What**: Multiple registries are configured as an ordered list in `aitools.config.json`. The CLI queries them by priority (lower number = higher priority). Search merges results across all registries; install/fetch stops at the first registry that has the package.  
**Why**: Enables a private registry to shadow public tools by name while still falling back to the public registry for everything else. Mirrors npm scoped registry behaviour.  
**Impact**: The first registry with a matching tool name wins for installs. Search results may contain duplicates across registries — the CLI deduplicates by name.  
**Key files**: `packages/cli/src/utils/registry-client.ts`, `packages/server/src/routes/registry.ts`

---

### Two Docker Compose files — persistent dev registry vs ephemeral E2E — 2026-04-26 `d0b6f60` (updated `d7f8fa0`)
**What**: `docker-compose.yml` runs a persistent local registry on port 4873 with a named volume. `docker-compose.e2e.yml` runs `test-registry` (HTTP), `gitea-init` + `gitea` (git registry e2e), and the `e2e` Jest container; tears down volumes after each run.  
**Why**: Mixing the dev registry with E2E tests caused port conflicts and state pollution. Git registry tests need a real remote — Gitea in Docker exercises publish/install/search against HTTP auth URLs.  
**Impact**: `npm run test:e2e` uses only `docker-compose.e2e.yml`. Local e2e without Docker falls back to a bare repo; Docker sets `GITEA_URL` and bootstraps via `gitea-init`.  
**Key files**: `docker-compose.yml`, `docker-compose.e2e.yml`, `packages/e2e/gitea/bootstrap.sh`, `packages/e2e/gitea-setup.cjs`

---

### Gitea e2e bootstrap via CLI migrate — 2026-06-26 `d7f8fa0`
**What**: `gitea-init` one-shot container runs `gitea migrate` + `gitea admin user create` with `INSTALL_LOCK=true` on a shared volume before `gitea` web starts. Web install wizard is not used (it crashes mid-submit when env vars conflict).  
**Why**: POST to Gitea's install page saves `app.ini` then fatals with `MustInstalled()`; the container never serves `/api/v1/version`. CLI bootstrap matches Gitea's documented unattended Docker pattern.  
**Impact**: E2e global-setup only creates the `tools-registry` repo and seeds `registry/` — it assumes Gitea is already installed. Bootstrap script is piped through `tr -d '\r'` when mounted from Windows hosts.  
**Key files**: `packages/e2e/gitea/bootstrap.sh`, `docker-compose.e2e.yml`, `packages/e2e/gitea-setup.cjs`

---

### Storage & Auth abstraction layers — 2026-04-30 `d22c706`
**What**: `IStorageProvider` and `IAuthProvider` interfaces were introduced so the server can run in three deployment modes without code changes: (1) local/no-DB with filesystem storage + simple token auth, (2) dev with filesystem + DB-backed user auth, (3) production with cloud storage (Azure/S3 stubs) + OIDC/external auth (stub).
**Why**: Previously storage paths were hardcoded to `fs` calls and auth logic was inlined in every route. This made it impossible to swap backends without touching all routes. Three concrete providers: `LocalStorageProvider`, `AzureStorageProvider` (stub), `S3StorageProvider` (stub). Three auth providers: `SimpleAuthProvider`, `DatabaseAuthProvider`, `OidcAuthProvider` (stub). Factory functions `createStorageProvider()` and `createAuthProvider()` read from env vars (`STORAGE_BACKEND`, `AUTH_BACKEND`).
**Impact**: `ToolStore` and `OrgStore` are now async throughout. All route handlers receive `IAuthProvider` or sub-interfaces (`IPublisherAuth`, `IAdminAuth`). Legacy `ServerOptions` fields (`publishToken`, `adminToken`, `userStore`) still work via auto-construction of the appropriate provider. `startServer()` and `buildApp()` both exported from `app.ts`.
**Key files**: `packages/server/src/providers/`, `packages/server/src/storage/tool-store.ts`, `packages/server/src/storage/org-store.ts`, `packages/server/src/app.ts`

---

### AGPL-3.0-or-later project license — 2026-06-15 `95123f3`
**What**: The project is licensed under GNU Affero GPL v3.0 (`AGPL-3.0-or-later`). Root `LICENSE` plus a standard copyright header on every source file. All `package.json` files declare `"license": "AGPL-3.0-or-later"`.  
**Why**: Copyleft protects network-hosted registry use (AGPL source-offer obligations). Copyright holder can still grant separate commercial/enterprise licenses alongside the public AGPL release.  
**Impact**: External contributions are under AGPL. Do not relicense to MIT/permissive without explicit contributor agreements. Azure/OIDC enterprise docs describe optional dual-licensing, not a change to the public license.  
**Key files**: `LICENSE`, `package.json`, `packages/*/package.json`

---

### GitHub Actions CI — 2026-06-15 `95123f3`
**What**: Three workflows: `test.yml` (build core/cli/server + Jest with coverage on push/PR), `e2e.yml` (Docker Compose E2E gate), `docker.yml` (registry image build).  
**Why**: Catch regressions before merge; E2E validates CLI against a live registry in CI.  
**Impact**: PRs to `main` should pass unit tests locally (`npm test`) before push. Full E2E requires Docker (`npm run test:e2e`).  
**Key files**: `.github/workflows/test.yml`, `.github/workflows/e2e.yml`, `.github/workflows/docker.yml`

---

### Design documentation aligned with implementation — 2026-06-15 `21e553f`
**What**: Comprehensive `docs/design/` suite updated to reflect actual behaviour: filesystem tool storage, bearer auth (not JWT), `aitools` binary name, four packages, real endpoint catalog.  
**Why**: Original May 2026 docs described aspirational PostgreSQL/Redis/JWT architecture that was never implemented.  
**Impact**: Prefer `docs/design/` over `readme.md` for API accuracy. `docs/setup-plans/github-azure.md` documents target Azure deployment; Azure Blob and OIDC providers remain stubs in code.  
**Key files**: `docs/design/DESIGN-INDEX.md`, `docs/design/api-design.md`, `docs/deployment.md`, `docs/setup-plans/github-azure.md`
