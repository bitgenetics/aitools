# Constraints & Tradeoffs — registry-and-server

> Publish, HTTP/git registries, server modes, auth, portals. Part of [constraints/](./README.md).

### Registry publish endpoint is unauthenticated by default
**Constraint**: When `publishToken` is not set in `ServerOptions`, the `POST /tools` endpoint accepts any publish request without authentication.  
**Reason**: Simplifies local dev and first-run experience. Production deployments should always set `AITOOLS_PUBLISH_TOKEN`.  
**Do not change**: The unauthenticated default — it is intentional for development. Always set the token in production. The server logs a warning at startup if `logger: true` and no token is set.  
**Key files**: `packages/server/src/app.ts`, `packages/server/src/routes/tools.ts`

---

### Git registry — no AI-assisted find, local search only — 2026-06-26 `d7f8fa0`
**Constraint**: Git registries implement substring search over cloned manifests locally. `aitools find` (natural-language / AI-assisted search) is an HTTP registry feature only.  
**Reason**: No server endpoint exists in git-backed mode; the registry is just files in a repo.  
**Do not change**: Do not add HTTP fallbacks silently — document the limitation and keep search behaviour explicit per registry type.  
**Key files**: `packages/cli/src/utils/git-registry-client.ts`, `readme.md` (#registry-types)

---

### Legacy `aitools.manifest.json` publish source removed — 2026-07-14 `a708c41`
**Constraint**: `resolvePublishSource` only accepts unified `aitools.json`. Passing or discovering `aitools.manifest.json` throws and directs users to `aitools manifest migrate`.  
**Reason**: Dual publish-manifest formats increased bugs and test surface; unified doc is the single authoring path.  
**Do not change**: Do not reintroduce silent fallback to the legacy filename.  
**Key files**: `packages/core/src/manifest/manifest-file.ts`, `packages/cli/src/commands/publish.ts`, `packages/e2e/src/cli.test.ts`
