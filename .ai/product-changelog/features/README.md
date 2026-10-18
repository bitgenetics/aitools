# Feature Completions

> Stable, completed features. Capture enough that an AI can work with or near them without re-reading the code.

> Split into topic files on 2026-10-18 (line budget). Entries below are cross-cutting or too small for their own file.

## Topic files

| File | Contents | Load when... |
|---|---|---|
| [cli-and-dev.md](./cli-and-dev.md) | CLI command baselines, repo/test conventions, tooling limitations | Working on cli and dev |
| [platforms-and-placement.md](./platforms-and-placement.md) | Platform adapters, transforms, placementMode, install paths, user-scope roots | Working on platforms and placement |
| [plugins.md](./plugins.md) | Plugin category, bundles, explode, anchor-skill portability grade | Working on plugins |
| [registry-and-server.md](./registry-and-server.md) | Publish, HTTP/git registries, server modes, auth, portals | Working on registry and server |

## Entries

### AI context snapshots (git-style save / switch / stash) — 2026-10-17 (implemented 2026-10-18 `6a98d0c`; supersedes `304ed2d`)
**What**: `aitools context` manages the project's on-disk AI-mechanism files as named **snapshots**. `ls` prints the **catalog**: the deterministic list of managed paths (`AGENTS.md` / `CLAUDE.md` / `GEMINI.md` at any depth, `.cursorrules`, `.cursor/**`, `.claude/**`, `.agents/**`, `.github/copilot-instructions.md`, MCP/hook configs); `context.ignore` globs in `aitools.json` remove paths from management entirely. `save <label>` copies the catalog into a snapshot (same label overwrites). `switch <label>` **replaces** the whole catalog with that snapshot and records it active. `stash` / `pop` are an unlabeled LIFO stack of snapshots. `clear` removes every cataloged file. `merge <label>` copies a snapshot's files over the working tree without changing active; same path with different content is a conflict that aborts unless `--overwrite`. `list`, `show <label>` (files + diff vs working), `status` (active label, stack depth, files changed since switch), `drop <label>`, `rename <old> <new>`. `pull <pkg> [--as <label>]` imports a registry `context-profile` as a local snapshot; `push <label> <pkg>` publishes one. Every overwrite op (`switch`, `pop`, `clear`) refuses when working files differ (SHA-256) from the active snapshot unless `--discard`; the message names `save` / `stash`. `--json` on every read command and `--dry-run` on every write command.  
**Why**: The quarantine swap was a one-slot stash with asymmetric sides (named package → unnamed tree): A→B switching and repeat round-trips lost files (confirmed 2026-10-17). Git's model (every state is a named thing; refuse checkout when dirty) is familiar and makes every transition the same operation.  
**Impact**: Replaces `swap` / `restore` / `accept-stay` / `capture` / `publish-baseline`, `aitools.json` `context.{stay,profiles,baseline}`, `lock.context`, and `tools/propose-context-stay/`. Snapshot scope follows the settings model: default user (`~/.aitools/context/<label>/`), `--project` writes `<repo>/.aitools/context/<label>/`; reads resolve project then user. Stash and active state are always project-local. E2e: `packages/e2e/src/context-snapshots.test.ts` (replaces `context-swap.test.ts`).  
**Key files**: `packages/core/src/context/`, `packages/cli/src/commands/context.ts`, `packages/e2e/src/context-snapshots.test.ts`, `docs/design/context-snapshots.md`

---

### cursor load (multi-root agent from .code-workspace) — 2026-07-22 `620018f` (updated 2026-08-12 `c55af39` / `059f411`)
**What**: Modular package `@bitgenetics/aitools-cursor` (bin: `aitools-cursor`) parses a VS Code/Cursor multi-root `.code-workspace` file, resolves each `folders[].path` against the workspace file directory, and launches the Cursor Agent CLI (`agent`) with the first folder as `--workspace` and each additional folder as `--add-dir` (Cursor's real multi-root flag; not `--add-path`). Exposed as `aitools cursor load <workspaceFile> [options] [agentArgs...]` (Commander `.usage` is workspace-first; aitools flags `--dry-run` / `--agent-bin` may appear before or after the file). Unknown flags after the file are forwarded as agentArgs (`allowUnknownOption`; `--` optional). Help labels those options as aitools-only and includes examples. On Windows, spawn uses `shell: true` (required for `agent.cmd`) and **cmd-quotes** argv so prompts with spaces/parentheses are not mangled. Workspace parse uses shared VS Code JSONC normalization (`stripJsonc`: comments, trailing commas, UTF-8 BOM).  
**Why**: `.code-workspace` multi-root layouts are not accepted as `--workspace` by the agent CLI; authors need a one-shot map into agent roots. Real workspace files often include trailing commas / comments; default Commander usage also misread as “options must precede the path.”  
**Impact**: Unit tests cover JSONC parse, path resolution, argv building, dry-run, unknown-option forwarding, and Windows quoting; spawn is injectable. E2e: `packages/e2e/src/cursor-workspace.test.ts` (incl. JSONC trailing-comma fixtures).  
**Key APIs**: `parseCodeWorkspaceFile`, `resolveWorkspaceFolders`, `buildAgentArgv`, `quoteWindowsCmdArg`, `loadWorkspaceFromFile`, `spawnAgentCli`, `createCursorProgram`, `stripJsonc`  
**Key files**: `packages/cursor/src/`, `packages/cursor/src/commands/load.ts`, `packages/core/src/jsonc/strip-jsonc.ts`, `packages/cli/src/commands/cursor.ts`, `packages/e2e/src/cursor-workspace.test.ts`

---

### cursor worker (multi-root self-hosted worker from .code-workspace) — 2026-07-26 `8d487ed` (updated 2026-08-12 `059f411`)
**What**: `aitools cursor worker <workspaceFile> [options] [workerArgs...]` maps the same `.code-workspace` folders into `agent worker` with one `--worker-dir` per folder (first folder = assignment identity). Usage is workspace-first; aitools-only `--dry-run` / `--agent-bin` may appear before or after the file. Extra args (e.g. `--pool`, `start`, `debug`) forward after the dir flags; put worker flags before the action; `--` optional (`allowUnknownOption`). Caps at Cursor’s 20 `--worker-dir` limit. Reuses workspace parse/resolve (incl. `stripJsonc`), Windows cmd-quote spawn, and dry-run preview from the load path.  
**Why**: Self-hosted multi-repo workers need repeatable `--worker-dir` roots; authors already keep those roots in `.code-workspace` for `cursor load`. Help must distinguish aitools options from forwarded worker args.  
**Impact**: Unit tests cover argv building, dry-run, >20 refusal, and CLI dry-run via `aitools cursor`. E2e: `packages/e2e/src/cursor-workspace.test.ts` asserts `worker` + `--worker-dir` per folder and forwards worker args (`start`, `--pool`).  
**Key APIs**: `buildWorkerArgv`, `workerWorkspaceFromFile`, `createWorkerCommand`  
**Key files**: `packages/cursor/src/agent-args.ts`, `packages/cursor/src/worker.ts`, `packages/cursor/src/commands/worker.ts`, `packages/cli/src/commands/cursor.test.ts`, `packages/e2e/src/cursor-workspace.test.ts`
