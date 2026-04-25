# Maintaining ai-tools

This document covers ongoing maintenance tasks for contributors and project owners.

---

## Repository layout

```
aitools/
├── packages/
│   ├── core/     @ai-tools/core   — shared types, schemas, config, lock utilities, platform specs
│   ├── cli/      @ai-tools/cli    — the `aitools` CLI binary
│   └── server/   @ai-tools/server — self-hosted registry (Fastify)
├── tools/
│   └── create-ai-tool/            — skill published to the registry; teaches agents to author tools
├── .agents/
│   └── skills/
│       ├── add-cli-command/        — project skill: how to add a CLI command
│       ├── add-platform/           — project skill: how to add a new IDE platform
│       └── update-platform-spec/   — project skill: how to update/re-verify spec data
├── .github/
│   └── workflows/
│       ├── test.yml    — unit + integration tests on every PR and push to main
│       ├── docker.yml  — builds Docker image; pushes to GHCR on version tags
│       └── e2e.yml     — end-to-end tests against a live Docker Compose stack
├── docs/
│   ├── deployment.md   — Docker, Kubernetes, systemd, reverse proxy recipes
│   └── operations.md   — monitoring, log shipping, backups, token rotation
├── .env.example           — reference for all supported environment variables
├── AGENTS.md              — AI agent instructions (testing rules, conventions)
└── MAINTAINING.md         — this file
```

---

## Build

Build order is mandatory — `core` must compile before `cli` or `server`.

```bash
npm install                          # install all workspace dependencies
npm run build                        # builds core → cli → server in order
npm run build -w @ai-tools/core      # rebuild only core
npm run build -w @ai-tools/cli       # rebuild only cli (requires core already built)
npm run build -w @ai-tools/server    # rebuild only server
```

The CLI binary is globally linked during development via `npm link` from `packages/cli`.
Rebuilding `@ai-tools/cli` is enough to update the global `aitools` command.

---

## Tests

### Unit and integration tests

```bash
npm test                              # run all workspaces (core + cli + server)
npm test -w @ai-tools/core            # single package
npm test -w @ai-tools/cli
npm test -w @ai-tools/server
npm test -- --coverage                # emit coverage report to /coverage
```

Coverage floors: **≥ 80% statements / branches / functions** on `@ai-tools/core` and `@ai-tools/cli`.
Server route handlers are integration-tested via Fastify `inject()` — no real HTTP port.

See `AGENTS.md` for the full testing ruleset (what to test, what to skip, naming conventions).

### End-to-end tests

E2e tests live in `packages/e2e/` and exercise the CLI binary and HTTP API against a live server.

**Option A — Docker (CI / clean-room)**

```bash
npm run test:e2e          # tear down stale volumes, build images, run tests
npm run test:e2e:down     # manually stop and remove containers + volumes
```

Requires Docker with the default (Linux) engine. The script tears down any previous volumes before
starting, so repeated runs always get a clean registry and the publish tests always see 201.

**Option B — local server (faster iteration)**

1. Build the packages that need to be current:

   ```bash
   npm run build -w @ai-tools/core
   npm run build -w @ai-tools/cli
   ```

2. Start a fresh registry server in one terminal:

   ```bash
   $env:AI_TOOLS_DATA_DIR = "$env:TEMP\ai-tools-e2e-data"
   $env:PORT = "4873"
   $env:HOST = "127.0.0.1"
   node packages/server/dist/index.js
   ```

   On macOS/Linux:

   ```bash
   AI_TOOLS_DATA_DIR=/tmp/ai-tools-e2e-data PORT=4873 HOST=127.0.0.1 \
     node packages/server/dist/index.js
   ```

3. Run the e2e suite in a second terminal:

   ```bash
   # PowerShell
   $env:REGISTRY_URL = "http://localhost:4873"
   $env:AI_TOOLS_CLI = "node $PWD/packages/cli/dist/cli.js"
   npm test -w @ai-tools/e2e

   # bash
   REGISTRY_URL=http://localhost:4873 \
   AI_TOOLS_CLI="node $(pwd)/packages/cli/dist/cli.js" \
   npm test -w @ai-tools/e2e
   ```

> **Note:** Re-running against the same local server instance causes 409 conflicts on the
> publish tests because registry data persists. Delete `$env:TEMP\ai-tools-e2e-data`
> (or `/tmp/ai-tools-e2e-data`) and restart the server before re-running.

---

## Adding a new CLI command

Follow the `.agents/skills/add-cli-command/SKILL.md` skill. Summary:

1. Create `packages/cli/src/commands/<name>.ts` — export `create<Name>Command(): Command`
2. Register in `packages/cli/src/cli.ts` — import + `program.addCommand(...)`
3. Write `packages/cli/src/commands/<name>.test.ts`
4. `npm run build -w @ai-tools/cli` + smoke-test with `aitools <name> --help`

All local imports use `.js` extensions (Node16 ESM). See the skill for utility reuse table
and gotchas.

---

## Adding a new platform

Follow the `.agents/skills/add-platform/SKILL.md` skill. Summary:

1. Add the platform string to `TargetPlatform` in `packages/core/src/types/tool.ts`
2. Create `packages/cli/src/adapters/<platform>.ts`
3. Register in `packages/cli/src/adapters/index.ts` (import, export, `ADAPTERS` entry)
4. **Add a `PlatformSpec` data file** in `packages/core/src/platforms/<platform>.ts` — export the spec and add it to `PLATFORM_SPECS` in `packages/core/src/platforms/index.ts`
5. Export the new spec from `packages/core/src/index.ts`
6. Build: `npm run build -w @ai-tools/core && npm run build -w @ai-tools/cli`
7. Update `tools/create-ai-tool/references/platform-paths.md` with the new platform's install paths
8. Bump and republish `tools/create-ai-tool`

---

## Platform spec maintenance (`packages/core/src/platforms/`)

Follow the `.agents/skills/update-platform-spec/SKILL.md` skill for step-by-step guidance. Summary below.

Each platform has a `PlatformSpec` data file that records:

- Supported `ToolCategory` values
- SKILL.md frontmatter field support (supported / ignored / unsupported / unknown)
- Install paths (project scope + user scope per category)
- A `lastVerified` ISO-8601 date

**The `compat` command warns when `lastVerified` is more than 90 days old** (`SPEC_STALE_DAYS = 90`).

### When to update specs

| Trigger | Action |
|---|---|
| A platform ships a new frontmatter field | Add the field to the relevant spec file; set `support` accurately |
| A platform changes install directory conventions | Update `installPaths` in the spec AND in the adapter's `DIRS` object |
| A platform drops support for a category | Set `supportedCategories` accordingly |
| Spec data is >90 days old | Re-verify against platform docs, update `lastVerified` |

### Verifying specs

Each spec file has a `docsUrl`. Check the linked docs, update the spec, and bump `lastVerified` to today's date:

```
packages/core/src/platforms/universal.ts  → https://agentskills.io/specification
packages/core/src/platforms/vscode.ts     → https://code.visualstudio.com/docs/copilot/customization/agent-skills
packages/core/src/platforms/cursor.ts     → https://cursor.com/docs/skills
packages/core/src/platforms/claude.ts     → https://docs.anthropic.com/en/docs/claude-code/skills
packages/core/src/platforms/windsurf.ts   → https://docs.windsurf.com/windsurf/skills
```

After updating any spec, rebuild core and run the compat command against a known tool to sanity-check output:

```bash
npm run build -w @ai-tools/core
cd tools/create-ai-tool
aitools compat
```

---

## Publishing tools to the registry

The `tools/` directory contains tools that are published to the ai-tools registry and usable by anyone.

### Routine publish workflow

```bash
cd tools/create-ai-tool          # (or any tool directory)
aitools manifest bump patch     # bump version
aitools publish --dry-run       # validate before uploading
aitools publish                 # publish to configured registry
```

### When to republish `create-ai-tool`

- A new platform is added (update `references/platform-paths.md`)
- A new SKILL.md frontmatter field is documented
- The publish workflow or manifest format changes
- Any `references/` file is updated

---

## Registry server

The `@ai-tools/server` package is a self-hosted Fastify registry. Start it locally for development:

```bash
AI_TOOLS_DATA_DIR=./packages/e2e/fixtures node packages/server/dist/index.js
```

For a full local stack with PostgreSQL, copy `.env.example` to `.env` and run:

```bash
docker compose up -d
```

See [`docs/deployment.md`](docs/deployment.md) for production deployment recipes (Kubernetes, systemd, reverse proxy) and [`docs/operations.md`](docs/operations.md) for the operations runbook.

Key environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4873` | Port to listen on |
| `HOST` | `0.0.0.0` | Host to bind |
| `AI_TOOLS_DATA_DIR` | (required) | Directory where tool tarballs are stored |
| `AUTH_BACKEND` | `simple` | `simple`, `database`, or `oidc` |
| `DATABASE_URL` | | Postgres connection string (required when `AUTH_BACKEND=database`) |
| `REGISTRY_ACCESS` | `private` | `private` or `public` |
| `AI_TOOLS_ADMIN_TOKEN` | | Admin portal Bearer token |
| `AI_TOOLS_PUBLISHER_TOKENS` | | Multi-user token map JSON |
| `CORS_ORIGINS` | _(deny all)_ | Comma-separated allowed origins |
| `LOG_LEVEL` | `info` | Pino log level |
| `UPSTREAMS` | | Comma-separated `name=url` upstream pairs |
| `STORAGE_BACKEND` | `filesystem` | `filesystem`, `azure`, or `s3` |

See `.env.example` for the full reference.

Published tool data lives under `AI_TOOLS_DATA_DIR/tools/<name>/<version>/`. Do not edit these files manually — use the registry API or `aitools publish`.

---

## Project-level AI skills

The `.agents/skills/` directory contains project-scoped skills loaded by GitHub Copilot (and compatible IDEs) when working in this repo. These are **not** published to the registry — they are development guides for contributors and AI agents.

| Skill | Purpose |
|---|---|
| `add-cli-command` | How to add a new CLI command |
| `add-platform` | How to add a new IDE platform |
| `update-platform-spec` | How to update or re-verify platform spec data |

Keep these skills up to date when the patterns they describe change. After editing a skill, verify the YAML frontmatter `name` field still matches the folder name.

---

## TypeScript conventions

- **Module resolution**: `"module": "Node16"`, `"moduleResolution": "Node16"` — all local imports must use `.js` extensions on the import path (not the filename on disk).
- **Strict mode**: `"strict": true` — no `any` casts, no `// @ts-ignore` in production code.
- **Build info**: Each package has its own `tsconfig.json` extending `../../tsconfig.base.json`.
- **ESM only**: All packages have `"type": "module"` — no CommonJS.

---

## Dependency management

- Keep `@ai-tools/core` dependency-free where possible — it is imported by both `cli` and `server`.
- `commander`, `chalk`, `ora`, `semver` are CLI-only dependencies — do not add them to `core`.
- `fastify`, `zod` are used in `server` and `core` respectively — check the package's `package.json` before importing a new library.
- After adding a dependency, rebuild the affected package and run its tests.
