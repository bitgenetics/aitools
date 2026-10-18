# Feature Completions — registry-and-server

> Publish, HTTP/git registries, server modes, auth, portals. Part of [features/](./README.md).

### E2E git registry round-trip — 2026-06-26 `d7f8fa0`
**What**: Docker e2e runs publish → install → search against a Gitea-hosted git registry; local e2e uses a temporary bare repo when `GITEA_URL` is unset. Shared helpers in `test-env.ts` isolate `HOME`/`AITOOLS_CONFIG_ROOT` so user config does not leak into tests.  
**Key files**: `packages/e2e/src/cli.test.ts`, `packages/e2e/src/test-env.ts`, `packages/e2e/global-setup.cjs`, `packages/e2e/gitea-setup.cjs`

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
