# Constraints & Tradeoffs

> Accepted limitations. Before "fixing" something here, check whether it was intentional.

> Split into topic files on 2026-10-18 (line budget). Entries below are cross-cutting or too small for their own file.

## Topic files

| File | Contents | Load when... |
|---|---|---|
| [cli-and-dev.md](./cli-and-dev.md) | CLI command baselines, repo/test conventions, tooling limitations | Working on cli and dev |
| [platforms-and-placement.md](./platforms-and-placement.md) | Platform adapters, transforms, placementMode, install paths, user-scope roots | Working on platforms and placement |
| [plugins.md](./plugins.md) | Plugin category, bundles, explode, anchor-skill portability grade | Working on plugins |
| [registry-and-server.md](./registry-and-server.md) | Publish, HTTP/git registries, server modes, auth, portals | Working on registry and server |

## Entries

### AI context snapshots — replace-only switch; hash-vs-active dirty rule; project-local state — 2026-10-17 (implemented 2026-10-18, uncommitted)
**Constraint**: AITools moves **on-disk** AI-mech files only; Cursor/Claude/etc. remain the prompt loaders. `switch` always replaces the full catalog and never merges; `merge` is a separate working-tree edit that never changes the active pointer. Paths matched by `context.ignore` are outside the catalog and are never read, copied, or deleted by any `context` command. "Dirty" means working files differ from the active snapshot's SHA-256 hashes; git is neither required nor consulted. Every file path in a snapshot must resolve inside the target root **and** classify as a known catalog kind, or the whole operation aborts before any write. User-scope snapshots are portable across projects by design (role profiles); project-scope snapshots are committable. Active pointer, hashes, and the stash stack live project-local under `.aitools/context/` (`state.json`, `stash/`), which the tool gitignores on first write; they are never in `aitools-lock.json`. `lockfileVersion` stays 1; the old `lock.context` key is removed from the schema.  
**Reason**: One definition of "managed", one definition of "dirty", and one shape for every state remove the modes and parallel paths that caused data loss in the quarantine design. Active state describes this working tree, not a dependency, so it does not belong in the lock.  
**Do not change**: Do not add an overlay/stay mode to `switch`; do not fall back to git porcelain for dirtiness; do not store active state in the lock; do not let `install` write a `context-profile` directly.  
**Key files**: `packages/core/src/context/`, `packages/e2e/src/context-snapshots.test.ts`
