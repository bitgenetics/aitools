# Integration Points

> How subsystems connect. Critical context when working across module boundaries.

---

### `ConfigCascade` (core) ↔ `ConfigManager` (cli)
**How they connect**: `ConfigManager` calls `ConfigCascade.load(cwd)` in its constructor. The resulting `AiToolsConfig` drives all downstream decisions (platform adapter, default scope, registry list, install path overrides). `ConfigManager.resolveInstallPath(category, scope)` checks `config.installPaths` for overrides before delegating to the platform adapter.  
**Key files**: `packages/core/src/config/cascade.ts` (source), `packages/cli/src/utils/config-manager.ts` (consumer)  
**Gotchas**: `ConfigCascade.load()` is called once at `ConfigManager` construction. If the config file is written during the same process (e.g. `aitools config set`), the in-memory config is stale — re-construct `ConfigManager` or reload explicitly.

---

### `PlatformAdapter` (cli) ↔ `PlatformSpec` (core)
**How they connect**: Each adapter in `packages/cli/src/adapters/` implements `PlatformAdapter` and handles runtime path resolution. Each platform also has a `PlatformSpec` in `packages/core/src/platforms/` that describes frontmatter field support and install paths declaratively (used by `compat` command). The two are parallel — the adapter is the runtime behaviour, the spec is the metadata.  
**Key files**: `packages/cli/src/adapters/types.ts` (interface), `packages/core/src/platforms/types.ts` (spec type), `packages/core/src/platforms/index.ts` (`PLATFORM_SPECS` map)  
**Gotchas**: Adding a new platform requires changes in both places — the adapter (runtime) and the spec (metadata). The `compat` command uses specs, not adapters.

---

### `RegistryClient` (cli) ↔ `@aitools/server` REST API
**How they connect**: `createRegistryClient(config)` dispatches on `config.type`. HTTP clients call `GET /tools/:name/:version`, `GET /tools/:name/:version/tarball`, `GET /search?q=`, `POST /tools`. Auth is sent as `Bearer` or `Basic` via the `Authorization` header.  
**Key files**: `packages/cli/src/utils/registry-client.ts` (client), `packages/server/src/routes/tools.ts` (server)  
**Gotchas**: The server returns non-JSON on some errors (Fastify default error bodies). `RegistryClient` wraps `JSON.parse` in a try-catch and re-throws with a descriptive message. On ECONNREFUSED/ENOTFOUND/ETIMEDOUT the `publish` command shows the registry URL and a "server not reachable" message.

---

### `GitRegistryClient` (cli) ↔ git remote — 2026-06-26 `d7f8fa0`
**How they connect**: When `registries[].type === "git"`, `createGitRegistryClient()` clones/fetches the remote into `~/.aitools/git-cache/<name>/`, reads `registry/<tool>/<version>/manifest.json` and `tool.json`, and publishes via `git add/commit/push` (with `pull --rebase` on push conflict). No HTTP calls — auth comes from the system git credential helper.  
**Key files**: `packages/cli/src/utils/git-registry-client.ts`, `packages/core/src/types/config.ts` (`GitRegistryConfig`)  
**Gotchas**: Git search is local substring matching over manifests (no server-side AI search). `listVersions` walks semver directories on disk. Lock file `resolved` may be a git remote URL, not an HTTP tarball URL. Scoped package dirs use `@scope__name` (`/` → `__`).

---

### E2E global-setup ↔ Gitea + HTTP registry — 2026-06-26 `d7f8fa0`
**How they connect**: Jest `globalSetup` ensures HTTP registry health (`REGISTRY_URL`), then when `GITEA_URL` is set calls `setupGiteaRegistry()` to create `tools-registry`, seed `registry/`, and write state to `/tmp/ai-tools-e2e-git-registry.json`. Tests read that via `getGitRegistryRemote()` / `initGitRegistry()` in `test-env.ts`.  
**Key files**: `packages/e2e/global-setup.cjs`, `packages/e2e/gitea-setup.cjs`, `packages/e2e/src/test-env.ts`, `docker-compose.e2e.yml`  
**Gotchas**: `gitea-init` must complete before `gitea` starts — do not revert to web-install bootstrap. E2e Dockerfile includes `git` for clone/push during setup.

---

### `Installer` (cli) ↔ `CacheManager` + `RegistryClient`
**How they connect**: `Installer.installFiles(client, manifest, scope)` first checks `CacheManager.get(name, version)`. On cache miss it calls `client.download(name, version)` → `CacheManager.set(name, version, tarball, manifest)` → copies files from `cacheEntry.agentsDir` to the resolved install path. On cache hit it skips the download entirely.  
**Key files**: `packages/cli/src/utils/installer.ts`, `packages/cli/src/utils/cache-manager.ts`, `packages/cli/src/utils/registry-client.ts`  
**Gotchas**: `installFiles` strips the install-base prefix from `file.dest` before resolving — see `constraints.md`. The cache stores files under a universal `.agents/` layout; the adapter path is applied only at copy-time.

---

### `ToolStore` (server) ↔ `IStorageProvider`
**How they connect**: `ToolStore` persists manifests as `manifest.json` + `files.json` under `<dataDir>/<name>/<version>/`. Tarballs are synthesised on download as JSON arrays (not gzip). `search()` scans in-memory manifests loaded via the storage provider.  
**Key files**: `packages/server/src/storage/tool-store.ts`, `packages/server/src/providers/storage/local.ts`  
**Gotchas**: All store methods are `async`. Tool data is filesystem-backed by default — PostgreSQL is auth-only (`UserStore`), not tool storage.

---

### `ToolStore` / `OrgStore` ↔ `IStorageProvider` — 2026-04-30 `d22c706`
**How they connect**: Both stores now accept `IStorageProvider | string` in their constructors. Passing a string auto-wraps it in `LocalStorageProvider`. All store methods are `async`. Stores use relative paths (e.g. `'tools/<name>/<version>/manifest.json'`) — the provider resolves these to absolute paths internally.
**Key files**: `packages/server/src/storage/tool-store.ts`, `packages/server/src/storage/org-store.ts`, `packages/server/src/providers/storage/local.ts`
**Gotchas**: All callers must `await` every store method. Tests use `new ToolStore(tmpDir)` (string shorthand) — this still works.

---

### Routes ↔ `IAuthProvider` — 2026-04-30 `d22c706`
**How they connect**: `registerToolRoutes`, `registerOrgRoutes`, `registerAdminRoutes`, and `registerPortalRoutes` all receive `IAuthProvider` (or its sub-interfaces `IPublisherAuth` / `IAdminAuth`) instead of raw tokens or `UserStore`. Publisher auth is resolved via `auth.publisher.resolve(req.headers)`. Admin auth via `adminAuth.check({ headers, cookies })`. Session create/invalidate via optional `adminAuth.createSession()` / `adminAuth.invalidateSession()`.
**Key files**: `packages/server/src/routes/tools.ts`, `packages/server/src/routes/org.ts`, `packages/server/src/routes/admin.ts`, `packages/server/src/routes/portal.ts`
**Gotchas**: `auth.ts` (user registration/login routes) still takes `UserStore` directly — it uses `resolveFromHeaders` and `resolveToken` which are not on `IUserManagement`. Only registered when `authProvider.userManagement` is present.

---

### `@aitools/cli` ↔ `@aitools/core` (shared types and utilities)
**How they connect**: `@aitools/core` is a peer dependency of `@aitools/cli`. The CLI imports schemas (`ToolManifestSchema`), types (`ToolManifest`, `InstalledTool`, `PlatformSpec`), config utilities (`ConfigCascade`), lock utilities (`readLockFile`, `writeLockFile`, `upsertLockEntry`), manifest utilities, and platform specs. Core never imports from CLI.  
**Key files**: `packages/core/src/index.ts` (all exports), `packages/cli/src/` (all consumers)  
**Gotchas**: Core is compiled before CLI (`npm run build` order: core → cli → server). If you change a core export, rebuild core before testing the CLI.
