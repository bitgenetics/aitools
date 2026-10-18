# Archived Decisions

> Superseded, obsolete, or reverse-chronology storage. Never delete — history matters.
> Entries below were pruned from active section files for size (~150-line budget) on 2026-07-22; content remains accurate unless noted.

---

## Superseded 2026-10-17 — quarantine context swap replaced by snapshot model

> The five entries below describe `aitools context` as shipped in `304ed2d`. Superseded by the planned snapshot redesign (see `features/README.md` "AI context snapshots", `docs/design/context-snapshots.md`). Kept for the rationale.

### AI-mech context swap (role profiles) — 2026-07-22 `304ed2d`
**Archived from**: `features/README.md`  
**What**: `aitools context` hot-swapped project AI-mech files. Modes `replace` (full) and `overlay` (preserve authored `context.stay` globs). Every `swap` quarantined displaced files under `.aitools/context-quarantine/<id>/` (primary restore). Profile packages (`category: context-profile`) installed as a tree overlay. Optional baseline package / capture hashes for registry fallback. `discover` deterministic; stay judgment assist-only via proposal file + `accept-stay`. Dirty tracked git paths blocked swap/restore unless `--force`.  
**Why superseded**: Confirmed data loss (failed download stranded files; second swap orphaned the original; profile overwrite of a stay path deleted it on restore), two install paths with different rules, and "active" derived from a backup folder's presence.  
**Key files**: `packages/core/src/context/`, `packages/cli/src/commands/context.ts`, `packages/e2e/src/context-swap.test.ts`, `tools/propose-context-stay/`

### AI-mech context swap — coordinator not loader; quarantine primary — 2026-07-22 `304ed2d`
**Archived from**: `constraints/README.md`  
**Constraint**: Overlay stay-set authored only. Quarantine primary restore; registry baseline fallback. `lock.context` optional on `lockfileVersion: 1`. Refuse on dirty **tracked** AI-mech paths unless `--force`. Stated "quarantine is gitignored" but nothing wrote a `.gitignore`.  
**Carried forward**: "AITools moves files only; IDEs remain loaders" and "`lockfileVersion` stays 1" survive in the new constraint entry.

### Quarantine-primary context undo — 2026-07-22 `304ed2d`
**Archived from**: `patterns/README.md`  
**How**: Move swappable paths into quarantine with a path map, record `quarantineId` + moves on `lock.context`, install overlay; restore prefers quarantine. Replaced by "Store-first, pointer-before-tree context mutation".

### AI-mech context coordinator (not vendor loader) — 2026-07-22 `304ed2d`
**Archived from**: `architecture.md`  
**What**: Context swap in core with thin CLI; `context-profile` category as project-relative tree overlay; local quarantine as authoritative undo buffer. Replaced by "AI context as a snapshot store, not a quarantine".

### `aitools context` (cli) ↔ core context module ↔ registry `context-profile` — 2026-07-22 `304ed2d`
**Archived from**: `integrations.md`  
**How they connected**: CLI resolved profile/baseline packages via `RegistryClient` + `CacheManager` → core `swapContextProfile` / `restoreContext`. Direct `aitools install` of `context-profile` used `Installer.installContextProfile` (a second write path). Lock state in `aitools-lock.json` → `context`.

---

### README registry types documentation — 2026-06-26 `52eaa5a`
**Archived from**: `features/registry-and-server.md` (docs-only; low coding-session value)  
**What**: `readme.md` reorganized with table of contents, quick-start slot for lightweight git registry, and a **Registry types** reference (git vs HTTP comparison, repo layout, config examples, CLI flags).  
**Key files**: `readme.md`, `docs/deployment.md` (link to `#registry-types`)

---

### init — 2026-04-26 `d0b6f60`
**Archived from**: `features/cli-and-dev.md` (stable baseline; rarely changed)  
**What**: `aitools init` creates `aitools.json` in the current directory with sensible defaults (project name from directory name, empty tools/devTools).  
**Key files**: `packages/cli/src/commands/init.ts`

---

### manifest platforms field — 2026-04-26 `d719124`
**Archived from**: `features/cli-and-dev.md`  
**What**: `ToolManifest` optional `platforms?: TargetPlatform[]` — when set, install rejects if configured platform is not listed (and `'universal'` absent). Omit = all platforms.  
**Key files**: `packages/core/src/types/tool.ts`, `packages/core/src/schema/tool-schema.ts`, `packages/cli/src/utils/installer.ts`

---

### manifest update — 2026-04-27 `d719124`
**Archived from**: `features/cli-and-dev.md`  
**What**: `aitools manifest update` edits fields interactively or via flags (`--yes` applies only passed flags). Files preserved; use `manifest init --force` to re-scaffold files.  
**Key files**: `packages/cli/src/commands/manifest.ts`

---

### Expanded tool categories + `nativeFor` — 2026-06-27 `6eba41d`
**Archived from**: `features/platforms-and-placement.md` (covered by architecture transform + adapter entries)  
**What**: `ToolCategory` adds `rule`, `command`, `agent`, `hook` (legacy `subagent`/`prompt` via `normalizeCategory`). Optional `nativeFor`. Adapters expose hooks config.  
**Key files**: `packages/core/src/types/tool.ts`, `packages/core/src/types/category.ts`, `packages/cli/src/adapters/`

---

### `npm run test:coverage` + server thresholds — 2026-06-28 `e0a753f`
**Archived from**: `features/cli-and-dev.md` (CI mechanics)  
**What**: Root Jest `--coverage` on core/cli/server; CI `test.yml`; reports under `packages/*/coverage/` (gitignored). Server thresholds 80%/70% branches.  
**Key files**: `package.json`, `.github/workflows/test.yml`, `packages/server/jest.config.cjs`

---

### Gitea web install wizard unsuitable for automation — 2026-06-26 `d7f8fa0`
**Archived from**: `constraints/registry-and-server.md` (e2e infra detail)  
**Constraint**: Do not bootstrap Gitea in CI/e2e via POST to the install page — use `gitea migrate` + `gitea admin user create` with `INSTALL_LOCK=true` instead.  
**Reason**: Install POST triggers a fatal `MustInstalled()` race when `GITEA__security__INSTALL_LOCK=false` env vars are present.  
**Key files**: `packages/e2e/gitea/bootstrap.sh`, `docker-compose.e2e.yml`

---

### Double-nested install path was a bug (now fixed)
**Archived from**: `constraints/platforms-and-placement.md` (fixed bug; kept for history)  
**Constraint**: The `Installer.installFiles` method now strips the install-base prefix from `file.dest` before resolving the destination path. This was a bug where manifests using project-relative paths (e.g. `.agents/skills/create-ai-tool/SKILL.md` as `dest`) would install to `.agents/skills/.agents/skills/create-ai-tool/SKILL.md`.  
**Reason**: Fix applied 2026-04-26. Manifests with `dest` already relative to the install base work correctly. Manifests with absolute or project-relative `dest` paths are normalised by stripping the install base prefix.  
**Do not change**: The stripping logic in `installFiles`. Tool authors should use install-base-relative paths in `dest` (e.g. `create-ai-tool/SKILL.md`, not `.agents/skills/create-ai-tool/SKILL.md`).  
**Scope note (2026-07-21)**: The strip prefix is derived from the **project-relative** category dir (scope-independent), so a project-relative `dest` re-homes onto the user install base at user scope (`~/.cursor/skills/x`) instead of double-nesting under it (`~/.cursor/skills/.cursor/skills/x`).  
**Key files**: `packages/cli/src/utils/installer.ts`
