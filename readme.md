# ai-tools

A package manager for AI tools — discover, install, update, and publish **skills**, **subagents**, **prompts**, and **MCP tools** across projects and IDE environments.

Think `npm` but for the AI tooling ecosystem. Tools can be scoped to a project (committed to your repo) or installed at the user level (available across all projects in your IDE).

---

## Features

- **Install / uninstall / update** AI tools by name and version
- **Project-scope and user-scope** installs with sensible default paths per category
- **Smart search** — describe what you need in plain language; an AI agent finds the best match
- **Publish tools** — package and upload skills, agents, and prompts to any registry
- **Cascading config** — `ai-tools.config.json` merges from home directory down to project directory, like `.npmrc`
- **Lock file** — `ai-tools-lock.json` pins exact versions for reproducible installs
- **Self-hosted registry** — run your own private registry and chain it with public ones
- **Registry chaining** — multiple registries resolved by priority; proxy search merges results

---

## Requirements

- Node.js >= 20
- npm >= 10

---

## Installation

```bash
npm install -g @ai-tools/cli
```

---

## Quick Start

```bash
# Initialise a project (creates ai-tools.json)
ai-tools init

# Search for tools
ai-tools search copilot

# Smart search — describe what you need
ai-tools find "I need something that reviews pull requests automatically"

# Install a tool (project scope by default)
ai-tools install @scope/my-skill

# Install a specific version
ai-tools install @scope/my-skill@1.2.0

# Install to user scope (available in all projects)
ai-tools install @scope/my-agent --scope user

# List installed tools
ai-tools list

# Update all tools
ai-tools update

# Remove a tool
ai-tools uninstall @scope/my-skill
```

---

## CLI Reference

| Command | Description |
|---|---|
| `ai-tools init` | Create `ai-tools.json` in the current directory |
| `ai-tools install <name[@version]>` | Install a tool |
| `ai-tools uninstall <name>` | Remove a tool and its files |
| `ai-tools update [name]` | Update one or all installed tools |
| `ai-tools search <query>` | Search the registry by keyword |
| `ai-tools find <description>` | Smart search using natural language |
| `ai-tools list` | List tools recorded in the lock file |
| `ai-tools registry list` | Show configured registries |
| `ai-tools registry add <url>` | Add a registry to the project config |
| `ai-tools registry add <url> --global` | Add a registry to the user config |
| `ai-tools registry remove <name>` | Remove a registry |
| `ai-tools config list` | Show all config files and their values |
| `ai-tools config get <key>` | Get an effective config value |
| `ai-tools config set <key> <value>` | Set a config value in the project config |
| `ai-tools config set <key> <value> --global` | Set a config value in the user config |
| `ai-tools config unset <key>` | Remove a config key |
| `ai-tools config edit` | Open the project config in your editor |
| `ai-tools config edit --global` | Open the user config in your editor |
| `ai-tools manifest init` | Create an `ai-tools.manifest.json` for publishing |
| `ai-tools manifest bump <patch\|minor\|major\|x.y.z>` | Bump the manifest version |
| `ai-tools publish` | Publish the tool to a registry |
| `ai-tools publish --dry-run` | Validate without uploading |

### Install options

| Flag | Default | Description |
|---|---|---|
| `--scope <project\|user>` | `project` | Where to install the tool |
| `--dev` | `false` | Save as a dev dependency in `ai-tools.json` |

### Registry options

| Flag | Description |
|---|---|
| `-n, --name <name>` | Registry name (defaults to hostname) |
| `-p, --priority <n>` | Priority — lower number = queried first (default: 100) |
| `--token <token>` | Bearer token for authentication |
| `-g, --global` | Write to user-level config (`~/ai-tools.config.json`) |

### Config keys

| Key | Allowed values | Description |
|---|---|---|
| `platform` | `vscode`, `claude`, `cursor`, `windsurf` | Target IDE — controls install directory layout |
| `defaultScope` | `project`, `user` | Default install scope when `--scope` is omitted |
| `installPaths.<scope>.<category>` | Any path | Override install directory for a specific category and scope |

---

## Publishing Tools

### Workflow

```bash
# 1. Create the publish manifest (once)
ai-tools manifest init --category skill --description "My skill"

# 2. Edit ai-tools.manifest.json and add your files, then publish
ai-tools publish

# 3. To release an update, bump the version first
ai-tools manifest bump patch     # 1.0.0 -> 1.0.1
ai-tools manifest bump minor     # 1.0.0 -> 1.1.0
ai-tools manifest bump major     # 1.0.0 -> 2.0.0
ai-tools manifest bump 2.0.0     # explicit version

# 4. Publish the new version
ai-tools publish
```

> Each `name@version` combination is immutable once published. The registry returns 409 if you re-publish the same version.

### Configuring the target registry

```bash
# Save the registry to user config (applies to all projects)
ai-tools registry add http://localhost:4873 --name my-registry --global

# Or per-project
ai-tools registry add http://localhost:4873 --name my-registry

# Publish with no flags — registry is picked from config automatically
ai-tools publish

# Or override for a single publish
ai-tools publish --registry http://localhost:4873
```

### `ai-tools.manifest.json`

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "Does something useful",
  "category": "skill",
  "files": [
    { "src": "skill.md", "dest": "my-skill.md" }
  ],
  "keywords": ["code-review", "typescript"],
  "author": "Your Name"
}
```

`dest` is relative to the category install directory — do not repeat the category name (use `my-skill.md`, not `skills/my-skill.md`).

**Field reference**

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Scoped package name (`@scope/name` or `name`) — lowercase, hyphens |
| `version` | Yes | Semver string |
| `description` | Yes | Short description |
| `category` | Yes | `skill`, `subagent`, `prompt`, or `mcp-tool` |
| `files` | Yes | Array of `{ src, dest }` file entries |
| `keywords` | | Array of strings for search |
| `author` | | Author name or email |
| `repository` | | URL to the source repository |
| `tags` | | Additional search tags |
| `dependencies` | | Map of tool name to semver range |

---

## Project Files

### `ai-tools.json` — dependency manifest

Tracks which tools your project depends on, similar to `package.json`.

```json
{
  "name": "my-project",
  "tools": {
    "@scope/my-skill": "^1.0.0"
  },
  "devTools": {
    "@scope/review-agent": "^2.1.0"
  }
}
```

### `ai-tools-lock.json` — lock file

Pins exact installed versions. Commit this file.

```json
{
  "lockfileVersion": 1,
  "tools": {
    "@scope/my-skill": {
      "version": "1.0.3",
      "resolved": "http://localhost:4873",
      "integrity": "sha256-...",
      "files": ["skill.md"],
      "installedAt": "2026-04-24T10:00:00.000Z"
    }
  }
}
```

### `ai-tools.config.json` — configuration

Config cascades from your home directory (`~/ai-tools.config.json`) down to the project directory. Project values override user values; registry lists are merged with project registries taking priority.

The file supports JSONC (comments allowed):

```jsonc
{
  // Target platform — controls install directory layout.
  // Allowed: vscode | claude | cursor | windsurf
  // "platform": "vscode",

  // Default install scope when --scope flag is omitted.
  // Allowed: project | user
  // "defaultScope": "project",

  // Registry endpoints. Lower priority number = queried first.
  "registries": [
    {
      "name": "my-private",
      "url": "https://registry.example.com",
      "priority": 1,
      "auth": { "type": "bearer", "token": "..." }
    }
  ],

  // Override install directories for specific category + scope combinations.
  // "installPaths": {
  //   "project.skill": ".custom/skills"
  // }
}
```

Open the config in your editor:

```bash
ai-tools config edit           # project config
ai-tools config edit --global  # user config (~/ai-tools.config.json)
```

---

## Tool Categories & Install Paths

Set `platform` in `ai-tools.config.json` to adapt installs to your IDE.

> **Note:** When no `platform` is set, ai-tools uses a universal layout. Always set a `platform` value so installed files land where your IDE expects them.

### `skill`

| Platform | Project scope | User scope |
|---|---|---|
| `vscode` | `.github/prompts/skills/` | `~/.vscode/prompts/skills/` |
| `claude` | `.claude/skills/` | `~/.claude/skills/` |
| `cursor` | `.cursor/skills/` | `~/.cursor/skills/` |
| `windsurf` | `.windsurf/skills/` | `~/.windsurf/skills/` |

### `subagent`

| Platform | Project scope | User scope |
|---|---|---|
| `vscode` | `.github/agents/` | `~/.vscode/agents/` |
| `claude` | `.claude/agents/` | `~/.claude/agents/` |
| `cursor` | `.cursor/agents/` | `~/.cursor/agents/` |
| `windsurf` | `.windsurf/agents/` | `~/.windsurf/agents/` |

### `prompt`

| Platform | Project scope | User scope |
|---|---|---|
| `vscode` | `.github/prompts/` | `~/.vscode/prompts/` |
| `claude` | `.claude/commands/` | `~/.claude/commands/` |
| `cursor` | `.cursor/rules/` | `~/.cursor/rules/` |
| `windsurf` | `.windsurf/rules/` | `~/.windsurf/rules/` |

### `mcp-tool`

MCP tools inject a server entry into the platform's `mcp.json` config file.

| Platform | Project config | User config |
|---|---|---|
| `vscode` | `.vscode/mcp.json` | `~/.vscode/mcp.json` |
| `claude` | `.mcp.json` | `~/.claude/mcp.json` |
| `cursor` | `.cursor/mcp.json` | `~/.cursor/mcp.json` |
| `windsurf` | `.windsurf/mcp.json` | `~/.windsurf/mcp.json` |

---

## Self-Hosted Registry

Run your own registry with `@ai-tools/server`:

```bash
npm install -g @ai-tools/server
AI_TOOLS_DATA_DIR=./data node dist/index.js
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4873` | Port to listen on |
| `HOST` | `0.0.0.0` | Host to bind |
| `AI_TOOLS_DATA_DIR` | (required) | Directory where tool versions are stored |
| `UPSTREAMS` | | Comma-separated `name=url` upstream registry pairs |

### Example with upstreams

```bash
AI_TOOLS_DATA_DIR=/var/lib/ai-tools \
PORT=4873 \
HOST=0.0.0.0 \
UPSTREAMS="public=https://registry.ai-tools.dev" \
node dist/index.js
```

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/tools` | List all tools (latest versions) |
| `GET` | `/search?q=<query>` | Search tools |
| `GET` | `/tools/:name` | Get latest manifest for a tool |
| `GET` | `/tools/:name/versions` | List all versions |
| `GET` | `/tools/:name/:version` | Get specific version manifest |
| `GET` | `/tools/:name/:version/tarball` | Download tool tarball |
| `POST` | `/tools` | Publish a tool version |
| `GET` | `/upstream` | List configured upstream registries |
| `GET` | `/proxy/search?q=<query>` | Search across all upstreams |

### Registry chaining

Point a registry at one or more upstreams to federate results:

```bash
UPSTREAMS="public=https://registry.ai-tools.dev,internal=https://internal.example.com"
```

Registries are resolved in priority order; the first match wins for installs, and search results are merged.

---

## Monorepo Structure

```
ai-tools/
├── packages/
│   ├── core/        # @ai-tools/core — shared types, schemas, config cascade, lock utilities
│   ├── cli/         # @ai-tools/cli  — the `ai-tools` CLI
│   └── server/      # @ai-tools/server — self-hosted registry server
├── tsconfig.base.json
└── package.json
```

---

## Development

```bash
# Install dependencies
npm install

# Build all packages (order matters: core -> cli -> server)
npm run build

# Run tests
npm test

# Run tests with coverage
npm test -w @ai-tools/core -- --coverage
npm test -w @ai-tools/server -- --coverage
npm test -w @ai-tools/cli -- --coverage
```

### Test coverage targets

- `@ai-tools/core` and `@ai-tools/cli`: >= 80% statements / branches / functions
- `@ai-tools/server` route handlers: integration-tested via Fastify `inject()` — no real HTTP port

---

## License

MIT