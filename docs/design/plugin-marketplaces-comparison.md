# Plugin marketplaces vs aitools registry

This document compares two independent channels for distributing AI IDE plugins. They serve different install flows and must not be conflated.

## Two channels

| Channel | Install command | Where files go | Who loads them |
|---------|-----------------|----------------|----------------|
| **aitools registry** | `aitools install @team/my-plugin` | Elements explode into normal platform paths (skills, rules, MCP, hooks, …) | IDE loaders for those element types |
| **Cursor marketplace** | Cursor UI / `/add-plugin` | Cursor plugin discovery paths (`.cursor/plugins/…`) | Cursor plugin loader |

**aitools install never writes whole packages to `.cursor/plugins/local/`.** It places each member where a standalone skill/rule/command/agent/MCP/hook would land for the active platform and scope.

`aitools uninstall` removes every path and merged config key recorded in `aitools-lock.json` for that package (no dirty-file checks — post-install edits are overwritten on remove).

## Author layout (unified `aitools.json`)

Authors maintain one `aitools.json` with publish fields plus optional `dependencies` / `devDependencies`:

```text
my-review-plugin/
├── .cursor-plugin/
│   └── plugin.json              # required for nativeFor: cursor (marketplace metadata)
├── skills/, rules/, agents/, commands/
├── hooks/hooks.json
├── mcp.json
├── scripts/, assets/            # plugin-level; install under synthetic skill package
├── aitools.json                 # unified: publish + dependencies
├── aitools-lock.json            # excluded from files[] on init
└── aitools.config.json          # optional; excluded from files[]
```

`manifest init --category plugin` walks the plugin tree and merges publish fields into `aitools.json`. Bookkeeping files are never added to `files[]`.

**Structure validation:** every path in `files[]` must have an install home (`manifest validate` + install). Orphans fail. Allowed skips: `.cursor-plugin/**`, README/LICENSE, aitools bookkeeping.

## Explode install model

```text
Author aitools.json (full)
  → aitools publish (toPublishManifest)
  → Registry .../aitools.json (publish subset)
  → Install: classify → path map → transform/rewrite → write to platform dirs
  → Lock entry: files[] + mcpKeys + hooksAdded
```

### Destination mapping (example: `platform: cursor`, project scope)

| Bundle path | Install destination |
|-------------|---------------------|
| `skills/review/SKILL.md` (+ siblings) | `.cursor/skills/review/…` |
| `rules/*.mdc` | `.cursor/rules/…` |
| `commands/*`, `agents/*` | Cursor command / agent dirs |
| `mcp.json` | Merge into `.cursor/mcp.json`; lock `mcpKeys` |
| `hooks/hooks.json` | Merge into `.cursor/hooks.json`; rewrite `./scripts/…` |
| `scripts/*`, `assets/*` | `.cursor/skills/<sanitized-pkg>/scripts|assets/…` |
| `.cursor-plugin/plugin.json` | Skip install (validation / marketplace only) |

User scope (`-g` / `--global`) uses the same categories under user adapter paths.

Relative references in hooks, skills, and MCP configs are rewritten via the transform path-map layer so they survive relocate across platforms.

## Registry reference packages (planned)

Skills and plugins can declare a `references` field in their publish manifest to vendor `category: "reference"` packages at install time — for example, a shared accessibility checklist used by multiple skills.

See **[Shared References](shared-references.md)** for the full design: flatten-on-vendor layout, plugin fan-out via `into`, lock-file provenance, and Cursor plugin filesystem alignment.

This is **not** install-time transitive `dependencies` resolution for arbitrary package types — only explicit reference vendoring into skill `references/` folders.

## Author workflow

```bash
mkdir my-review-plugin && cd my-review-plugin
# .cursor-plugin/plugin.json, skills/, rules/, scripts/ ...

aitools manifest init --category plugin --nativeFor cursor
aitools manifest validate
aitools publish
# separately: git + Cursor marketplace for Cursor-native plugin loader install
```

## Consumer workflow (aitools)

```bash
aitools install @team/my-review-plugin              # project scope (default)
aitools install @team/my-review-plugin --global     # user scope
aitools uninstall @team/my-review-plugin
```

## Out of scope

- Writing whole packages into `.cursor/plugins/local/`
- Install-time transitive `dependencies` resolution for arbitrary package types (see [Shared References](shared-references.md) for planned `category: "reference"` vendoring only)
- Auto-compose registry skills into author trees before publish
- Standalone `aitools plugin validate` (use `manifest validate`)
