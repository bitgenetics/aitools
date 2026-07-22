# aitools.json — Full Field Reference

Publish fields live in the unified `aitools.json` at the package root (same file as `dependencies` / `devDependencies` for author repos). `aitools publish` sends a publish subset only (`devDependencies` omitted).

## Required fields

| Field | Type | Rules |
|---|---|---|
| `name` | string | npm-style: lowercase, hyphens, numbers. Scoped (`@scope/name`) allowed. |
| `version` | string | Semver: `1.0.0`, `1.0.0-beta.1`, `1.0.0+build.1` |
| `description` | string | One-liner shown in registry search results. Non-empty. |
| `category` | enum | `skill` \| `subagent` \| `prompt` \| `mcp-tool` \| `plugin` \| `context-profile` (plus canonical `rule` \| `command` \| `agent` \| `hook` \| `reference`) |
| `files` | array | At least one entry (except `mcp-tool` with no extra files). See File entries below. |

### Plugin-specific

| Field | Type | Rules |
|---|---|---|
| `nativeFor` | enum | **Required** when `category` is `plugin`. Source layout family: `cursor` \| `vscode` \| `claude` \| `windsurf` \| `universal` |
| `files` | array | When `nativeFor` is `cursor`, must include `.cursor-plugin/plugin.json`. Every path must have an install home (skills/rules/…/scripts/assets); orphans fail `manifest validate`. |

## Plugin authoring convention (anchor skill)

A plugin should have one **anchor** (hub) skill named after the package — `skills/<name>/` where `<name>` is the sanitized package name (`@scope/pkg` → `@scope__pkg`). The anchor owns shared content and documents how the member skills work together via a managed **skill-map** section in its `SKILL.md`.

- **Keep shared content under the anchor**: put shared references, assets, and scripts under `skills/<name>/references/`, `skills/<name>/assets/`, `skills/<name>/scripts/`. Member skills link back with `../<name>/references/…`. Because sibling skills explode to `.cursor/skills/<folder>/`, those relative links resolve 1:1 with **no path rewrite** — the plugin is graded **path-rewrite-free**.
- **Avoid plugin-root `assets/` / `scripts/`**: these install under a synthetic `<name>/…` package and require link rewriting at install time — graded **rewrite-required**. Prefer the anchor layout above.
- **Orphans are fatal**: any file with no install home fails `manifest validate` — graded **unsupported**.

**Grade scope:** `path-rewrite-free` is about shared-content *paths* only. Vendor skill/rule/agent **frontmatter and format differences are still transformed** when installing across platforms — the anchor convention does not make installs free of all transforms.

`aitools manifest init --category plugin` scaffolds `skills/<name>/SKILL.md` (with a skill-map) when no anchor exists. `aitools compat` prints the portability grade; `aitools compat --fix` scaffolds/refreshes the anchor skill-map. The grade is **advisory** in `validate` / `compat` (warnings only). At **`publish`**, orphan findings fail the publish; `rewrite-required` / `missing-anchor` warnings prompt to continue or abort (`--yes` skips the prompt, `--strict` blocks warnings).

Single-skill plugins use the same shape: one `skills/<name>/SKILL.md` that is both the anchor and the only skill.

## Context-profile packages (role stacks)

`category: "context-profile"` packages are **tree overlays** of AI-mech paths (rules, skills, agents, `AGENTS.md`, etc.). They are consumed by `aitools context swap`, not exploded like plugins.

- Each `files[]` entry uses a **project-relative** `dest` (e.g. `.cursor/rules/role.mdc`, `AGENTS.md`). Prefer `placementMode: "verbatim"`.
- Requires a CLI that understands `context-profile` (older CLIs reject the category).
- Consumer projects author stay/baseline/profiles under optional `aitools.json` → `context`:

```json
{
  "context": {
    "baseline": { "package": "my-project-baseline" },
    "stay": ["AGENTS.md", ".cursor/rules/local/**"],
    "profiles": {
      "researcher": { "package": "role-researcher", "mode": "overlay" },
      "ship": { "package": "role-ship", "mode": "replace" }
    }
  }
}
```

Overlay stay must be authored (or proposed via `propose-context-stay` then `aitools context accept-stay`). Every swap quarantines displaced files under `.aitools/context-quarantine/` (primary restore).

## Optional fields

| Field | Type | Notes |
|---|---|---|
| `author` | string | Free-form author name or email |
| `repository` | string (URL) | Must be a full URL — `https://github.com/user/repo`, not `user/repo` |
| `keywords` | string[] | Freeform search terms shown in registry |
| `tags` | string[] | Metadata for AI discovery / smart-find |
| `dependencies` | Record\<string, string\> | Other ai-tools packages required. Key = package name, value = semver range |
| `platforms` | TargetPlatform[] | When set, install is rejected unless the active platform is in this list. Omit to support all platforms. Values: `vscode` \| `claude` \| `cursor` \| `windsurf` \| `universal` |
| `mcpServer` | object | Required when `category` is `mcp-tool`. See mcpServer block below. |

## File entries (`files[]`)

```jsonc
{
  "src": "SKILL.md",            // path relative to the manifest file
  "dest": "my-skill/SKILL.md",  // path relative to the category install dir
  "template": true              // optional — enables Handlebars {{variable}} substitution
}
```

`dest` rule: the installer prepends the category directory automatically.
- ✅ `"dest": "my-skill/SKILL.md"` → `.agents/skills/my-skill/SKILL.md`
- ❌ `"dest": "skills/my-skill/SKILL.md"` — do not repeat the category dir

## `mcpServer` block

Used only when `category` is `"mcp-tool"`.

```jsonc
{
  "command": "node",              // executable (local servers)
  "args": ["server.js"],         // arguments
  "env": {                       // environment variables
    "DB_URL": "${env:DB_URL}"
  },
  "url": "https://…/mcp",        // remote HTTP server (overrides command)
  "type": "stdio"                // "stdio" (default) | "http"
}
```

For a local stdio server:
```json
{
  "mcpServer": {
    "command": "node",
    "args": ["server.js"],
    "type": "stdio"
  }
}
```

For a remote HTTP server (no files needed):
```json
{
  "mcpServer": {
    "url": "https://my-mcp-server.example.com/mcp",
    "type": "http"
  },
  "files": []
}
```

## Full example — skill

```json
{
  "name": "@acme/jest-tdd",
  "version": "1.0.0",
  "description": "TDD workflow for Jest + ts-jest projects",
  "category": "skill",
  "files": [
    { "src": "SKILL.md", "dest": "jest-tdd/SKILL.md" }
  ],
  "author": "Acme Corp",
  "repository": "https://github.com/acme/jest-tdd-skill",
  "keywords": ["testing", "jest", "tdd"],
  "tags": ["typescript", "testing"]
}
```

## Full example — mcp-tool

```json
{
  "name": "@acme/postgres-mcp",
  "version": "1.0.0",
  "description": "MCP server for PostgreSQL — run queries, inspect schema",
  "category": "mcp-tool",
  "mcpServer": {
    "command": "node",
    "args": ["server.js"],
    "env": { "DATABASE_URL": "${env:DATABASE_URL}" },
    "type": "stdio"
  },
  "files": [
    { "src": "server.js", "dest": "server.js" }
  ],
  "tags": ["database", "postgresql"]
}
```
