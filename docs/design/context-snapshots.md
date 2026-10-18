# AI context snapshots — design and implementation plan

**Status**: implemented 2026-10-18 (steps 1–8; `npm run verify` and local e2e green). Supersedes the quarantine swap shipped in `304ed2d`.
**Changelog**: `.ai/product-changelog/features/README.md` → "AI context snapshots"; constraints, patterns, architecture and integrations entries of the same date.
**Research**: `.ai/research/topics/role-based-ai-context-stacks/`

## 1. Problem

The current `aitools context swap` / `restore` is a one-slot stash. It moves the working AI-mech files aside, copies a registry package over the top, and can move them back once. Probing the built core on 2026-10-17 confirmed:

| Scenario | Result |
|---|---|
| Profile download fails after files were moved aside | Files stranded in quarantine; lock never written; `restore` says nothing to restore |
| `swap a` then `swap b` then `restore` | Profile A comes back; the original tree is orphaned |
| Overlay profile writes to a stay path | Stay file deleted on restore |
| Profile overwrites a tracked path | `restore` refuses without `--force` |
| Profile `dest: "../x"` | Writes outside the project |
| No git repo | No safety check at all, silently |
| `aitools install <context-profile>` | Second write path: no quarantine, no checks, tracked in `lock.tools` not `lock.context` |

Root cause: the two sides of a "swap" are different kinds of thing (named, immutable package vs unnamed, mutable tree), so only one direction is well defined, and "what is active" is inferred from whether a backup folder exists.

## 2. Decisions

1. **Every state is a snapshot.** The working tree, a saved label, a stash entry, and a registry `context-profile` all have the same shape. Switching between any two is one operation.
2. **`switch` replaces; `merge` is separate.** `switch` never merges. `merge` edits the working tree and never changes the active pointer.
3. **Scope follows the settings model.** `save` writes to user scope by default (`~/.aitools/context/<label>/`); `--project` writes to `<repo>/.aitools/context/<label>/`. Reads resolve project first, then user. User-scope snapshots are portable role profiles usable in any project; project-scope snapshots are committable repo states.
4. **Stash and active state are project-local.** They describe *this* working tree. `.aitools/context/stash/` and `.aitools/context/state.json` are gitignored by the tool on first write.
5. **`context.ignore` replaces `stay`.** Paths matched by `context.ignore` in `aitools.json` are outside the catalog. No command reads, copies, or deletes them.
6. **Dirty = hash mismatch vs active, not git status.** Git is not consulted and not required.
7. **Store first, pointer before tree.** Materialise the target, check clean, write `state.json`, then touch files. See `patterns/README.md`.
8. **One install path.** `aitools install <context-profile>` errors with a pointer to `context pull`. `Installer.installContextProfile` is deleted.
9. **Active state leaves the lock.** `lock.context` is removed; `lockfileVersion` stays 1.

## 3. Model

```
catalog     = deterministic list of managed paths under a root, minus context.ignore
snapshot    = folder mirroring catalog files + manifest.json { label?, createdAt, origin?, files: [{path, sha256}] }
store       = { user: ~/.aitools/context/, project: <repo>/.aitools/context/ }  (labels resolve project → user)
stash       = <repo>/.aitools/context/stash/<ISO-timestamp>/   (snapshot folders, LIFO by name)
state       = <repo>/.aitools/context/state.json { active: label | null, scope: 'user'|'project'|null, files: [{path, sha256}] }
registry    = context-profile package  ⇄  snapshot  (pull / push)
```

### Catalog table (single authority)

| Pattern | Kind |
|---|---|
| `**/AGENTS.md`, `**/CLAUDE.md`, `**/GEMINI.md` (outside skipped dirs) | `instructions` |
| `.cursorrules`, `.windsurfrules` | `instructions` |
| `.github/copilot-instructions.md` | `instructions` |
| `.cursor/rules/**` | `rule` |
| `.cursor/skills/**`, `.claude/skills/**`, `.agents/skills/**` | `skill` |
| `.cursor/agents/**`, `.claude/agents/**` | `agent` |
| `.cursor/commands/**`, `.claude/commands/**` | `command` |
| `.cursor/hooks/**`, `.cursor/hooks.json`, `.claude/hooks/**` | `hooks-config` |
| `.cursor/mcp.json`, `.mcp.json`, `mcp.json`, `.claude/settings*.json` | `mcp-config` / `settings` |
| remaining `.claude/**`, `.agents/**` | `vendor-tree` |

Skipped dirs: `node_modules`, `.git`, `.aitools`, `dist`, `build`, `coverage`, `.next`, `out`. One table drives both discovery and classification; `classify(path)` returning `null` means "not an AI mechanism", which is also the containment check for imported snapshots.

### Rules

- `switch`, `pop`, `clear`: refuse if working ≠ active hashes, unless `--discard`. Error text names `save` and `stash`.
- `merge <label>`: for each snapshot file, if the working path exists with different bytes it is a conflict. Any conflict aborts with the list; `--overwrite` applies all. Active unchanged; `status` then shows dirty.
- `save <label>`: overwrites an existing label in the chosen scope and makes it active with the tree clean (like a commit). `stash` also marks the tree clean (its content is safe) without changing active. So `state.files` always means "the last content the tool saved or applied".
- `pull <pkg> [--as <label>] [--project]`: import only; never switches. Every `dest` must classify non-null and resolve inside root, or the import aborts before writing.
- `push <label> <pkg>[@version]`: publish; manifest `category: context-profile`, `files[]` = snapshot files with `dest = path`.
- Labels: `^[a-z0-9][a-z0-9._-]{0,63}$`; `stash` is reserved.

## 4. Command set

| Command | Reads/writes | Notes |
|---|---|---|
| `context ls [--json]` | catalog | Prints managed paths with kind; marks ignored count. |
| `context status [--json]` | state, stash | Active label + scope, dirty files, stack depth, orphaned folders. |
| `context list [--json]` | store | All labels tagged `[user]` / `[project]`, active marked. |
| `context show <label> [--json]` | snapshot, working | Files; added/removed/changed vs working. |
| `context save <label> [--project]` | working → snapshot, state | Label becomes active. |
| `context switch <label> [--discard] [--dry-run]` | snapshot → working, state | |
| `context stash [--dry-run]` | working → stash | Pushes; working unchanged (no implicit clear). |
| `context pop [--discard] [--dry-run]` | stash → working, state | Drops entry after success. Active = null. |
| `context clear [--discard] [--dry-run]` | working, state | Active = null. |
| `context merge <label> [--overwrite] [--dry-run]` | snapshot → working | Never touches state. |
| `context drop <label>` | store | Refuses to drop the active label unless `--force`. |
| `context rename <old> <new>` | store | Updates state if active. |
| `context pull <pkg> [--as <label>] [--project]` | registry → store | |
| `context push <label> <pkg>` | store → registry | |

Removed: `discover`, `capture`, `swap`, `restore`, `accept-stay`, `publish-baseline`.

## 5. Core module layout (`packages/core/src/context/`)

One responsibility per file; all orchestration goes through `ContextStore` so callers cannot skip the safety steps.

| File | Responsibility |
|---|---|
| `catalog.ts` | The table; `catalogPaths(root, ignore)`, `classify(path)`. |
| `ignore-glob.ts` | Glob matcher (today's `stay.ts` matcher, renamed). |
| `snapshot.ts` | Read/write one snapshot folder: manifest, file copy, hashing. Format only. |
| `state.ts` | Read/write `state.json`. |
| `working-tree.ts` | Hash catalog, diff vs snapshot, clear, apply snapshot, containment assert. |
| `store.ts` | `ContextStore`: scope roots, label resolution, list/drop/rename, stash storage, gitignore on first write. Storage only. |
| `operations.ts` | Every state-changing op: save, stash, switch, pop, clear, status. One private `replaceWorkingTree` implements store-first/pointer-before-tree. |
| `merge.ts` | Conflict detection and apply (never touches state). |
| `registry-bridge.ts` | Unpacked package dir → snapshot (with validation); snapshot → publish manifest. |
| `types.ts`, `paths.ts`, `index.ts` | |

Deleted: `accept-stay.ts`, `capture.ts`, `dirty.ts`, `discover.ts`, `profile-install.ts`, `quarantine.ts`, `swap.ts`, `stay.ts`.

Schema (`config-schema.ts`): `aitools.json` `context` becomes `{ ignore?: string[] }`; `AiToolsContextLockSchema` and `lock.context` removed.

## 6. Implementation steps

Order matters: the changelog contract exists before code, code before e2e, removal in the same change as replacement (no second path left standing).

1. **Update product changelog** — done 2026-10-17 (`features/README.md`, `constraints/README.md`, `patterns/README.md`, `architecture.md`, `integrations.md`; old entries archived).
2. **Core store** — done 2026-10-18: `catalog.ts`, `ignore-glob.ts`, `snapshot.ts`, `state.ts`, `working-tree.ts`, `store.ts` with unit tests under `os.tmpdir()`. Includes gitignore-on-first-write and label validation.
3. **Core operations** — done 2026-10-18: `operations.ts`, `merge.ts`; unit tests for: clean/dirty refusal, `--discard`, crash-between-pointer-and-tree recovery, merge conflicts, pop drops only after success, drop-active refusal.
4. **CLI** — done 2026-10-18: `packages/cli/src/commands/context.ts` rewritten to the table in §4; `--json`, `--dry-run`, scope flag; `context.test.ts` asserts the registered subcommands.
5. **Registry bridge** — done 2026-10-18: `registry-bridge.ts`; `pull` / `push` in CLI; `Installer` rejects `context-profile` with a pointer to `context pull`; unit tests for containment rejection (`../`, unknown kind).
6. **Removal** — done 2026-10-18: eight old core files, old CLI subcommands, `tools/propose-context-stay/`, `packages/e2e/src/context-swap.test.ts`, schema fields, `lock.context` type and exports removed.
7. **E2e** — written 2026-10-18, `packages/e2e/src/context-snapshots.test.ts` (needs a running registry: `npm run test:e2e`). Passing required `enablePositionalOptions()` on the root Commander program: without it the root `--version` swallowed `context push … --version` (and `install --version`), so root options are now only recognised before the subcommand name.
   - `ls` prints the catalog and honours `context.ignore`
   - `save a`, edit, `save b`, `switch a` restores exact bytes; `switch b` again; no leftovers
   - `switch` refuses when dirty; message names `save`/`stash`; `--discard` proceeds
   - `stash` → `clear` → `pop` round trip; `status` shows depth 1 then 0
   - `merge` conflict aborts with list; `--overwrite` applies; active unchanged; `status` dirty
   - `save` default is user scope; `--project` writes under repo; project label shadows user label in `list`/`switch`
   - `pull <pkg>` creates a snapshot without switching; `push` publishes; `install <context-profile>` is rejected
   - snapshot with `../` dest or non-catalog path is rejected before any write
   - all of the above in a directory with no git repo
8. **Docs** — readme section "Managing AI context"; update research topic README next-steps; `docs/design/DESIGN-INDEX.md` link.

## 7. Out of scope (follow-ups)

- Structured key-level merge for `mcp.json` / hooks JSON (reuse installer's `mcpKeys` / `hooksAdded` merge).
- Per-mechanism operations (`context remove <skill>`), which need mechanism grouping on top of the catalog.
- Assisted merge proposals (the old `propose-context-stay` idea as `merge --propose`).
- Portability warning when switching a user-scope snapshot whose kinds don't match the project's platform.

## 8. Open questions

- Should `switch` to a user-scope snapshot inside a project record `scope: user` in `state.json` so `status` can say where it came from? (Plan says yes; cheap.)
- `show` diff format: file-level added/removed/changed only, or unified diff for text files? (Start file-level.)
- Does `pull` without `--as` use the package name as the label, including the `@scope/` prefix? (Propose: strip scope, replace `/` with `-`, same as today's baseline naming.)
