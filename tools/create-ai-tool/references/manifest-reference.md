# aitools.json — Full Field Reference

Publish fields live in the unified `aitools.json` at the package root (same file as `dependencies` / `devDependencies` for author repos). `aitools publish` sends a publish subset only (`devDependencies` omitted).

## Required fields

| Field | Type | Rules |
|---|---|---|
| `name` | string | npm-style: lowercase, hyphens, numbers. Scoped (`@scope/name`) allowed. |
| `version` | string | Semver: `1.0.0`, `1.0.0-beta.1`, `1.0.0+build.1` |
| `description` | string | One-liner shown in registry search results. Non-empty. |
| `category` | enum | `skill` \| `subagent` \| `prompt` \| `mcp-tool` \| `plugin` |
| `files` | array | At least one entry (except `mcp-tool` with no extra files). See File entries below. |

### Plugin-specific

| Field | Type | Rules |
|---|---|---|
| `nativeFor` | enum | **Required** when `category` is `plugin`. Source layout family: `cursor` \| `vscode` \| `claude` \| `windsurf` \| `universal` |
| `files` | array | When `nativeFor` is `cursor`, must include `.cursor-plugin/plugin.json`. Every path must have an install home (skills/rules/…/scripts/assets); orphans fail `manifest validate`. |

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
