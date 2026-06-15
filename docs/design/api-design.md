# API Design

**Last Updated**: June 13, 2026

## Overview

The ai-tools registry server is built with **Fastify** and exposes a REST API for tool discovery, publishing, and org management. A separate HTML portal serves browse and admin UI routes.

Default listen address: `http://localhost:4873`

---

## Authentication

### Registry access modes

Controlled by `REGISTRY_ACCESS`:

| Mode | Read endpoints | Write endpoints |
|------|----------------|-----------------|
| `private` (default) | Bearer token required | Bearer token required |
| `public` | Open; tools with `"private": true` hidden from unauthenticated callers | Bearer token required |

```http
Authorization: Bearer <token>
```

### Auth backends

The server uses pluggable `IAuthProvider` implementations (see `packages/server/src/providers/auth/`):

| Backend | When used | Notes |
|---------|-----------|-------|
| **SimpleAuthProvider** | Default local/dev | Static tokens via `AI_TOOLS_PUBLISH_TOKEN`, `AI_TOOLS_PUBLISHER_TOKENS`, or `AI_TOOLS_ADMIN_TOKEN` |
| **DatabaseAuthProvider** | `DATABASE_URL` set + user management enabled | Users, org tokens, and admin tokens stored in PostgreSQL |
| **OidcAuthProvider** | Stub | Not yet implemented |

Admin portal access uses `X-Admin-Token` header or an admin session cookie set via `POST /admin/login`.

---

## Error responses

Most errors return a plain string:

```json
{ "error": "Not found" }
```

Validation errors (Zod) return a flattened object:

```json
{ "error": { "fieldErrors": {}, "formErrors": [] } }
```

HTTP status codes follow Fastify conventions (400, 401, 403, 404, 409, 429, 500).

---

## Tool endpoints

### List all tools

```http
GET /api/tools
```

Returns the latest version of every tool as a bare `ToolManifest[]` (not wrapped in `{ tools: [...] }`).

**Auth**: Required in private mode; optional in public mode (private tools filtered out when unauthenticated).

---

### Search tools

```http
GET /api/search?q=<query>
```

Returns a summary array:

```json
[
  {
    "name": "my-skill",
    "version": "1.2.0",
    "description": "A Python skill",
    "category": "skill",
    "keywords": ["python"],
    "tags": ["llm"]
  }
]
```

---

### Get tool manifest

```http
GET /api/tools/:name
GET /api/tools/:name/:version
```

Returns the full `ToolManifest` for the latest or specific version.

Pseudo-routes on the two-segment path:

| Path | Response |
|------|----------|
| `GET /api/tools/:name/versions` | `{ name, versions: string[] }` |
| `GET /api/tools/:name/owner` | `{ name, owner: { org, userId, publishedAt } }` |

---

### Download tarball

```http
GET /api/tools/:name/:version/tarball
```

The tarball is a **JSON array** of `{ path, content }` objects (not gzip).

```http
Content-Type: application/json
Content-Disposition: attachment; filename="<name>-<version>.json"
X-Integrity: sha256-<base64-hash>
```

The CLI verifies integrity using the `X-Integrity` header.

---

### Publish tool

```http
POST /api/tools
Content-Type: application/json
Authorization: Bearer <token>
```

**Body**:

```json
{
  "manifest": { "name": "...", "version": "...", "category": "skill", "files": [...], ... },
  "files": { "skill.md": "# content..." }
}
```

**Response** (201):

```json
{
  "name": "my-skill",
  "version": "1.2.0",
  "integrity": "sha256-..."
}
```

**Rate limit**: 100 requests per hour per token or IP.

---

### Update tool privacy

```http
PATCH /api/tools/:name
Authorization: Bearer <token>
```

**Body**: `{ "private": true }`

Only the owning org may update privacy settings.

---

### Current identity

```http
GET /api/me
```

```json
{ "authenticated": true, "userId": "alice", "org": "acme" }
```

Returns `{ "authenticated": false }` when no valid token is present (does not 401).

---

### List org tools (public read)

```http
GET /api/org/:org/tools
```

Returns all latest-version manifests owned by the given org. Same auth rules as other read endpoints.

---

## Registry and health endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/upstream` | List configured upstream registries |
| GET | `/proxy/search?q=<query>` | Proxy search to upstream registries |
| GET | `/health` | Liveness check (200 OK) |
| GET | `/health/ready` | Readiness check |

---

## Registry exploration endpoints

Public routes for cross-registry discovery:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/registries` | List local + upstream registries |
| GET | `/api/search/all` | Search local and upstream registries with pagination |

**`/api/search/all` query parameters**:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `q` | `""` | Search query |
| `sortBy` | `age` | `name` or `age` |
| `sortDir` | `desc` | `asc` or `desc` |
| `page` | `1` | Page number |
| `pageSize` | `10` | Results per page (max 100) |

---

## Org management endpoints

All routes under `/api/org` require Bearer authentication.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/org/info` | Current user's org identity |
| GET | `/api/org/tools` | Tools published by caller's org |
| GET | `/api/org/members` | Org members (stub; use admin API for details) |
| POST | `/api/org/tools/:name/deprecate?version=<ver>` | Mark a version deprecated |
| POST | `/api/org/tools/:name/unpublish?version=<ver>` | Remove a version (omit version to remove all) |

---

## Admin endpoints

Require `X-Admin-Token` header or valid admin session cookie.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/orgs` | Create org `{ name, metadata? }` |
| GET | `/api/admin/orgs` | List all orgs |
| GET | `/api/admin/orgs/:name` | Get org details |
| POST | `/api/admin/orgs/:name/members` | Add member `{ userId }` |
| DELETE | `/api/admin/orgs/:name` | Delete org |
| POST | `/api/admin/tokens` | Generate publisher token `{ org, userId }` |
| GET | `/api/admin/audit-log?org=<name>` | Audit log entries |

---

## User auth endpoints

Registered when `DatabaseAuthProvider` with user management is active.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account `{ username, password }` |
| POST | `/api/auth/login` | Login `{ username, password, org? }` → bearer token |
| GET | `/api/auth/tokens` | List caller's API tokens (Bearer required) |
| POST | `/api/auth/tokens` | Create token for org (Bearer required) |
| DELETE | `/api/auth/tokens/:id` | Revoke token (Bearer required) |

Registration is rate-limited to 3 attempts per hour.

---

## HTML portal routes

These serve HTML, not JSON:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Tool browse/search page |
| GET | `/skills/:name` | Tool detail page |
| GET | `/admin/login` | Admin login form |
| POST | `/admin/login` | Submit admin token (sets session cookie) |
| GET | `/admin/logout` | Clear admin session |
| GET | `/admin` | Admin dashboard (requires session) |

---

## Environment variables

See `packages/server/.env.example` for the full list. Key variables:

| Variable | Purpose |
|----------|---------|
| `PORT` | Listen port (default 4873) |
| `HOST` | Bind address (default 0.0.0.0) |
| `AI_TOOLS_DATA_DIR` | Tool storage directory |
| `REGISTRY_ACCESS` | `private` or `public` |
| `UPSTREAMS` | Comma-separated `name=url` upstream registries |
| `DATABASE_URL` | PostgreSQL for user/auth (optional) |
| `AI_TOOLS_PUBLISH_TOKEN` | Single static publish token |
| `AI_TOOLS_PUBLISHER_TOKENS` | JSON map of token → `{ userId, orgs }` |
| `AI_TOOLS_ADMIN_TOKEN` | Admin portal token |
| `CORS_ORIGINS` | Comma-separated allowed origins |

---

## Rate limiting

Rate limiting is **per-route**, not global. Currently applied to:

- `POST /api/tools` — 100/hour per token or IP
- `POST /api/auth/register` — 3/hour
- `POST /api/auth/login` — rate limited

---

## Not implemented

The following endpoints described in earlier design drafts do **not** exist:

- `GET /api/registry` / `GET /api/registry/search`
- `GET /api/portal` / `GET /api/admin` (JSON dashboards)
- `GET /api/orgs` (use `/api/admin/orgs` instead)
- JWT-based session auth with token rotation
- Redis caching layer
