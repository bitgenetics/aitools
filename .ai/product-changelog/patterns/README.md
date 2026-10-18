# Design Patterns

> Recurring patterns used across the codebase. New code should follow these unless there's a documented reason not to.

> Split into topic files on 2026-10-18 (line budget). Entries below are cross-cutting or too small for their own file.

## Topic files

| File | Contents | Load when... |
|---|---|---|
| [cli-and-dev.md](./cli-and-dev.md) | CLI command baselines, repo/test conventions, tooling limitations | Working on cli and dev |
| [platforms-and-placement.md](./platforms-and-placement.md) | Platform adapters, transforms, placementMode, install paths, user-scope roots | Working on platforms and placement |

## Entries

### Store-first, pointer-before-tree context mutation — 2026-10-17 (implemented 2026-10-18, uncommitted)
**Used for**: Every `context` command that overwrites working files (`switch`, `pop`, `clear`, `merge --overwrite`).  
**How**: (1) Fully materialise the source snapshot first (for `pull`, download and unpack into the store before anything else). (2) Check working tree is clean against the active snapshot's hashes, or `--discard` was passed. (3) Write the new active label + target hashes to `state.json`. (4) Only then delete/copy catalog files. A crash between 3 and 4 leaves `status` reporting "dirty vs active" and `switch <label> --discard` repairs it; nothing is ever moved aside before the replacement exists. Snapshots are immutable except via `save` to the same label.  
**Example**: `packages/core/src/context/operations.ts` (`replaceWorkingTree`)  
**Do not**: Move working files aside and then download; write the pointer after the tree; derive "what is active" from the presence of a backup folder.

---

### Lock file as source of truth for installed state
**Used for**: Everything that reads or writes installed tool state.  
**How**: `readLockFile(cwd)` → mutate with `upsertLockEntry` / `removeLockEntry` → `writeLockFile(cwd, lock)`. Always re-read before writing; never cache the lock object across async boundaries.  
**Example**: `packages/cli/src/utils/installer.ts`, `packages/cli/src/commands/dev-init.ts`  
**Do not**: Write directly to `aitools-lock.json` — always use the lock utilities so the schema stays valid.

---

### Plugin explode path rewrite — 2026-07-14 `8a80e17`
**Used for**: After classifying plugin members, rewrite relative refs in hook/skill/MCP content so they point at final install locations.  
**How**: Build a bundle-rel → final-rel `PluginPathMap`; run `rewriteRelativePaths(content, pathMap)` (quoted paths + markdown links under scripts/assets/skills/…). Applies even when source and target platforms match (layout relocate).  
**Example**: `packages/cli/src/transformers/path-rewrite.ts`, `packages/cli/src/utils/installer.ts`  
**Do not**: Leave `./scripts/…` references pointing at the pre-explode package tree after install.

---

### Plugin-bundle author-root path resolution — 2026-07-16 `8c15b68` (nest `2026-07-28`)
**Used for**: `--plugin-bundle` installs that place packages (including nested `category: plugin`) into plugin author layout instead of platform vendor dirs.  
**How**: When `InstallOptions.pluginBundle` is set, resolve category bases via `resolvePluginBundleInstallBase` / MCP / hooks helpers (from `getPluginBundleScanPlan` + optional host `.cursor-plugin/plugin.json`), not `adapter.resolveDir`. Nested plugins use `installPlugin(..., pluginBundle)` with portability preflight (`assertPluginBundleNestPortability`), collision preflight (`findPluginBundleCollisions`), and host `files[]` sync (`upsertHostPublishFileEntries` / `removeHostPublishFileEntries`). Record `installMethod: 'plugin-bundle'` on the lock.  
**Example**: `packages/core/src/manifest/plugin-bundle-install.ts`, `packages/cli/src/utils/installer.ts`  
**Do not**: Overload `PlatformAdapter.resolveDir` for author layout; do not treat plugin-bundle as explode or `--cursor-plugin`; do not overwrite host `.cursor-plugin/` when nesting.
