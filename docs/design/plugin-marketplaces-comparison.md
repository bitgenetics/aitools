# Plugin marketplaces vs aitools registry

This document compares two independent channels for distributing AI IDE plugins. They serve different install flows and must not be conflated.

## Two channels

| Channel | Install command | Where files go | Who loads them |
|---------|-----------------|----------------|----------------|
| **aitools registry** | `aitools install @team/my-plugin` | aitools-managed paths (project or user scope) | aitools lock + your tooling; **not** Cursor plugin loader |
| **Cursor marketplace** | Cursor UI / `/add-plugin` | Cursor plugin discovery paths | Cursor |

**aitools install never writes to `.cursor/plugins/local/` or other platform plugin discovery paths.**

`aitools uninstall` removes files from the aitools install location only (paths recorded in `aitools-lock.json`).

## Author layout (unified `aitools.json`)

Authors maintain one `aitools.json` with publish fields plus optional `dependencies` / `devDependencies`:

```text
my-review-plugin/
├── .cursor-plugin/
│   └── plugin.json              # platform layout (for marketplace / git)
├── skills/, rules/, mcp.json    # plugin content
├── aitools.json                 # unified: publish + dependencies
├── aitools-lock.json            # excluded from files[] on init
└── aitools.config.json          # optional; excluded from files[]
```

`manifest init --category plugin` walks the plugin tree and merges publish fields into `aitools.json`. Bookkeeping files (`aitools.json`, `aitools-lock.json`, `aitools.config.json`) are never added to `files[]`.

## Publish and install model

```text
Author aitools.json (full)
  → aitools publish (toPublishManifest)
  → Registry .../aitools.json (publish subset, no devDependencies)
  → Installed package dir (publish-subset aitools.json + bundle content)
```

| Location | `aitools.json` contents |
|----------|-------------------------|
| Author repo | Full: publish fields + `dependencies` + `devDependencies` |
| Registry per version | Publish subset only |
| Installed package dir | Same publish subset at package root |

## aitools install paths

Plugin installs use **platform-agnostic** aitools paths regardless of `platform` in `aitools.config.json`:

| Scope | Install root |
|-------|--------------|
| **project** | `.agents/plugins/<package-dir>/` |
| **user** | `~/.aitools/tools/plugins/<package-dir>/` |

`<package-dir>` is the sanitized package name (`@team/code-review-plugin` → `@team__code-review-plugin`).

Expected installed tree:

```text
.agents/plugins/@team__code-review-plugin/
├── aitools.json
├── .cursor-plugin/plugin.json
└── skills/...
```

`nativeFor` on the manifest describes the **source layout family** for publish validation (e.g. cursor plugins must list `.cursor-plugin/plugin.json` in `files[]`). It does **not** route installs into Cursor plugin directories.

## Config overrides

Optional `installPaths` in `aitools.config.json`:

- `project.plugin` — base directory for project-scope plugin installs (package subdir appended)
- `user.plugin` — base directory for user-scope plugin installs

## Author workflow

```bash
mkdir my-review-plugin && cd my-review-plugin
# .cursor-plugin/plugin.json, skills/, rules/ ...

aitools manifest init --category plugin --nativeFor cursor
aitools publish
# separately: git + Cursor marketplace for Cursor-native install
```

## Consumer workflow (aitools only)

```bash
aitools install @team/my-review-plugin              # project scope (default)
aitools install @team/my-review-plugin --global     # user scope
aitools uninstall @team/my-review-plugin
```

## Deferred (v1)

- Auto-compose registry skills into author tree before publish
- `dependencies` resolution at install time
- Standalone `aitools plugin validate` CLI
- Bridging aitools install to platform loaders
