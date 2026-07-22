# Archived Decisions

> Superseded, obsolete, or reverse-chronology storage. Never delete — history matters.
> Entries below were pruned from active section files for size (~150-line budget) on 2026-07-22; content remains accurate unless noted.

---

### README registry types documentation — 2026-06-26 `52eaa5a`
**Archived from**: `features.md` (docs-only; low coding-session value)  
**What**: `readme.md` reorganized with table of contents, quick-start slot for lightweight git registry, and a **Registry types** reference (git vs HTTP comparison, repo layout, config examples, CLI flags).  
**Key files**: `readme.md`, `docs/deployment.md` (link to `#registry-types`)

---

### init — 2026-04-26 `d0b6f60`
**Archived from**: `features.md` (stable baseline; rarely changed)  
**What**: `aitools init` creates `aitools.json` in the current directory with sensible defaults (project name from directory name, empty tools/devTools).  
**Key files**: `packages/cli/src/commands/init.ts`

---

### manifest platforms field — 2026-04-26 `d719124`
**Archived from**: `features.md`  
**What**: `ToolManifest` optional `platforms?: TargetPlatform[]` — when set, install rejects if configured platform is not listed (and `'universal'` absent). Omit = all platforms.  
**Key files**: `packages/core/src/types/tool.ts`, `packages/core/src/schema/tool-schema.ts`, `packages/cli/src/utils/installer.ts`

---

### manifest update — 2026-04-27 `d719124`
**Archived from**: `features.md`  
**What**: `aitools manifest update` edits fields interactively or via flags (`--yes` applies only passed flags). Files preserved; use `manifest init --force` to re-scaffold files.  
**Key files**: `packages/cli/src/commands/manifest.ts`

---

### Expanded tool categories + `nativeFor` — 2026-06-27 `6eba41d`
**Archived from**: `features.md` (covered by architecture transform + adapter entries)  
**What**: `ToolCategory` adds `rule`, `command`, `agent`, `hook` (legacy `subagent`/`prompt` via `normalizeCategory`). Optional `nativeFor`. Adapters expose hooks config.  
**Key files**: `packages/core/src/types/tool.ts`, `packages/core/src/types/category.ts`, `packages/cli/src/adapters/`

---

### `npm run test:coverage` + server thresholds — 2026-06-28 `e0a753f`
**Archived from**: `features.md` (CI mechanics)  
**What**: Root Jest `--coverage` on core/cli/server; CI `test.yml`; reports under `packages/*/coverage/` (gitignored). Server thresholds 80%/70% branches.  
**Key files**: `package.json`, `.github/workflows/test.yml`, `packages/server/jest.config.cjs`

---

### Gitea web install wizard unsuitable for automation — 2026-06-26 `d7f8fa0`
**Archived from**: `constraints.md` (e2e infra detail)  
**Constraint**: Do not bootstrap Gitea in CI/e2e via POST to the install page — use `gitea migrate` + `gitea admin user create` with `INSTALL_LOCK=true` instead.  
**Reason**: Install POST triggers a fatal `MustInstalled()` race when `GITEA__security__INSTALL_LOCK=false` env vars are present.  
**Key files**: `packages/e2e/gitea/bootstrap.sh`, `docker-compose.e2e.yml`
