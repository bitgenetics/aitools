# AITools

> **Project home:** [github.com/bitgenetics/aitools](https://github.com/bitgenetics/aitools) — maintained by [Nucleic Logic Studios, LLC](https://github.com/bitgenetics). Formerly `turbofoxwave/aitools` (GitHub redirects automatically).
>
> **npm (CLI):** `@bitgenetics/aitools-cli` (pulls in `@bitgenetics/aitools-core`) — `npm install -g @bitgenetics/aitools-cli`.
>
> **HTTP registry:** build from this repo, Docker, or `ghcr.io/bitgenetics/aitools` — not published to npm.
>
> **Registry (your AI tools):** publish and install under your own scope, e.g. `aitools install @bitgenetics/my-skill` — separate from the platform package names above.

A package manager for AI tools — discover, install, update, and publish **skills**, **subagents**, **prompts**, and **MCP tools** across projects and IDE environments.

Think `npm` but for the AI tooling ecosystem. Tools can be scoped to a project (committed to your repo) or installed at the user level (available across all projects in your IDE).

> **Experimental software.** This project is under active development. APIs, file formats, and behavior may change without notice. There are **no warranties of any kind**, express or implied. **Use at your own risk.**

## Table of contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick starts](#quick-starts)
  - [Using AITools in a project](#1-using-aitools-in-your-project)
  - [Lightweight git registry](#2-lightweight-git-registry)
  - [Local HTTP registry](#3-local-http-registry)
  - [Enterprise multi-registry](#4-enterprise-multi-registry)
  - [Developing AITools](#5-developing-aitools)
- [CLI reference](#cli-reference)
- [Publishing tools](#publishing-tools)
- [Project files](#project-files)
- [Tool categories & install paths](#tool-categories--install-paths)
- [Registry types](#registry-types)
- [Self-hosted HTTP registry](#self-hosted-http-registry)
- [Monorepo structure](#monorepo-structure)
- [Development](#development)
- [License](#license)

---

## Features

- **Install / uninstall / update** AI tools by name and version
- **Project-scope and user-scope** installs with sensible default paths per category
- **Extended search** — search by name, description, keywords, and tags across all configured registries
- **Publish tools** — package and upload skills, agents, and prompts to any registry
- **Two registry types** — full HTTP server (`@bitgenetics/aitools-server`) or a **lightweight git-backed registry** (any git remote, no server to run)
- **Cascading config** — `aitools.config.json` merges from home directory down to project directory, like `.npmrc`
- **Lock file** — `aitools-lock.json` pins exact versions for reproducible installs
- **Registry chaining** — multiple registries resolved by priority; proxy search merges results

---

## Requirements

- Node.js >= 20
- npm >= 10

---

## Installation

```bash
npm install -g @bitgenetics/aitools-cli
```

---

## Quick starts

### 1. Using AITools in your project

```bash
# Tell aitools which IDE you use (once, global)
aitools config set platform vscode   # vscode | claude | cursor | windsurf (user config by default)

# Initialise a project (creates aitools.json)
aitools init

# Search for tools
aitools search copilot

# Extended search — searches name, description, keywords, and tags
aitools find "pull request review"

# Install a tool (project scope by default)
aitools install @scope/my-skill

# Install a specific version
aitools install @scope/my-skill@1.2.0

# Install to user scope (available in all projects)
aitools install @scope/my-agent --scope user

# List installed tools
aitools list

# Update all tools
aitools update

# Remove a tool
aitools uninstall @scope/my-skill
```

---

### 2. Lightweight git registry

Use a **git repository as your registry** — no HTTP server, no database, no Docker. The CLI clones the repo locally (cached under `~/.aitools/git-cache/<name>/`), reads tool packages from a `registry/` tree, and publishes by committing and pushing.

| | Git registry | HTTP registry (`@bitgenetics/aitools-server`) |
|---|---|---|
| **Server to run** | None — any git host (GitHub, Gitea, bare repo) | Yes — Fastify process |
| **Auth** | System git credentials (SSH keys, credential manager, CI tokens) | Bearer tokens / user accounts |
| **Best for** | Solo devs, small teams, repos you already have | LAN teams, enterprise, upstream chaining |
| **Config `type`** | `git` | `http` (default when omitted) |

**Repository layout** — tools live under `registry/` by default:

```
my-tools-registry/
└── registry/
    └── @scope__tool-name/
        └── 1.0.0/
            ├── aitools.json
            └── tool.json      # JSON tarball: [{ "path", "content" }, ...]
```

Scoped names use `__` instead of `/` in directory names (`@acme__review-skill`).

**Add a git registry:**

```bash
# SSH remote (read + publish on main)
aitools registry add git@github.com:myorg/ai-tools-registry.git \
  --name team-tools --type git --global

# HTTPS with separate read/publish branches
aitools registry add https://github.com/myorg/ai-tools-registry.git \
  --name team-tools --type git \
  --read-branch main --publish-branch releases \
  --path registry/ --global
```

**Publish and install** work the same as with an HTTP registry:

```bash
aitools publish
aitools install @scope/my-tool
aitools search "code review"
```

Publish rebases on remote changes before pushing, so concurrent publishers can share one repo.

**GitHub Actions (private repo)** — configure git credentials before calling `aitools`:

```yaml
- run: git config --global url."https://x-access-token:${{ secrets.REGISTRY_TOKEN }}@github.com".insteadOf "https://github.com"
- run: aitools install @scope/my-tool
```

Git registries chain with HTTP registries — set `--priority` to control query order. See [Registry types](#registry-types) for full configuration reference.

---

### 3. Local HTTP registry

Run a private registry on your LAN — no Docker, no database. Tools are stored on the local filesystem. Build the server from the repo (not published to npm):

```bash
git clone https://github.com/bitgenetics/aitools && cd aitools
npm ci && npm run build -w @bitgenetics/aitools-server

# bash (from repo root)
AITOOLS_DATA_DIR=./data \
AITOOLS_ADMIN_TOKEN=change-me \
AITOOLS_PUBLISHER_TOKENS='{"your-token":{"userId":"you","orgs":["my-org"]}}' \
node packages/server/dist/index.js

# PowerShell
$env:AITOOLS_DATA_DIR = ".\data"
$env:AITOOLS_ADMIN_TOKEN = "change-me"
$env:AITOOLS_PUBLISHER_TOKENS = '{"your-token":{"userId":"you","orgs":["my-org"]}}'
node packages/server/dist/index.js
```

Point any client machine at it:

```bash
aitools registry add http://<server-ip>:4873 --name team --token your-token --global
```

See [Self-hosted HTTP registry](#self-hosted-http-registry) for all configuration options and environment variables.

---

### 4. Enterprise multi-registry

Full setup with user accounts, a database, and multi-registry chaining for supply-chain control.

#### Server setup (Docker + Postgres)

```bash
# Grab the repo (or just docker-compose.yml + .env.example)
git clone https://github.com/your-org/ai-tools && cd ai-tools

cp .env.example .env   # set POSTGRES_PASSWORD, AITOOLS_ADMIN_TOKEN, etc.
docker compose up -d
```

The server starts at `http://localhost:4873`. Register the first user:

```bash
curl -s -X POST http://localhost:4873/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"strong-pass"}' | jq .token
```

See [`docs/deployment.md`](docs/deployment.md) for Kubernetes, systemd, and nginx reverse proxy recipes.

#### Multi-registry chaining

The recommended enterprise pattern is **two HTTP registries with priority-based chaining**:

| Registry | Purpose | Who publishes | Access |
|----------|---------|---------------|--------|
| **Internal** (priority 1) | Your team's own skills, agents, and prompts | Your developers | Private, token-gated |
| **Curated** (priority 2) | Vetted 3rd-party tools that passed review | Review board / ops | Private, read-only for consumers |

The CLI queries registries in priority order. Internal tools shadow anything with the same name in the curated registry. Install and search merge results from both.

```bash
# Developer workstation setup (run once)
aitools registry add http://internal.corp:4873 --name internal --token $MY_TOKEN --priority 1 --global
aitools registry add http://curated.corp:4873 --name curated --token $READ_TOKEN --priority 2 --global
```

**Workflow:**
1. Teams publish internal tools directly to the internal registry via `aitools publish`.
2. Third-party tools are reviewed (security, quality, compatibility) then published to the curated registry by an authorized reviewer.
3. Developers consume from both transparently — `aitools install some-tool` resolves from internal first, then curated.

You can mix HTTP and git registries in the same chain — for example, an internal HTTP registry at priority 1 and a team git repo at priority 2. See [Registry types](#registry-types).

---

### 5. Developing AITools

For hacking on the AITools codebase itself:

```bash
git clone https://github.com/your-org/ai-tools && cd ai-tools
npm install
npm run build       # core → cli → server in dependency order
npm test            # all packages
```

Spin up a local registry backed by the built server:

```bash
# bash
AITOOLS_DATA_DIR=/tmp/ai-tools-dev PORT=4873 HOST=127.0.0.1 \
  node packages/server/dist/index.js

# PowerShell
$env:AITOOLS_DATA_DIR = "$env:TEMP\ai-tools-dev"
$env:PORT = "4873"; $env:HOST = "127.0.0.1"
node packages/server/dist/index.js
```

#### Running with debugger support (no build required)

The server can be started directly from TypeScript source using `tsx` — no build step needed. This is the recommended approach during active development.

```bash
# bash — run from TypeScript source with file-watching
AITOOLS_DATA_DIR=/tmp/ai-tools-dev PORT=4873 HOST=127.0.0.1 \
  npm run dev -w @bitgenetics/aitools-server

# PowerShell
$env:AITOOLS_DATA_DIR = "$env:TEMP\ai-tools-dev"
$env:PORT = "4873"; $env:HOST = "127.0.0.1"
npm run dev -w @bitgenetics/aitools-server
```

To attach a debugger (e.g. VS Code **Attach to Node Process**), use the `debug:watch` script — it exposes the inspector on port `9229` and restarts on file changes:

```bash
# bash
AITOOLS_DATA_DIR=/tmp/ai-tools-dev PORT=4873 HOST=127.0.0.1 \
  npm run debug:watch -w @bitgenetics/aitools-server

# PowerShell
$env:AITOOLS_DATA_DIR = "$env:TEMP\ai-tools-dev"
$env:PORT = "4873"; $env:HOST = "127.0.0.1"
npm run debug:watch -w @bitgenetics/aitools-server
```

Then in VS Code open the **Run and Debug** panel and choose **Attach to Node Process** (port `9229`). Set breakpoints in any file under `packages/server/src/`.

Use the locally built CLI against it (no global install needed):

```bash
# bash — add a shell alias
alias aitools="node $PWD/packages/cli/dist/cli.js"

# PowerShell — add a function
function aitools { node "$PWD/packages/cli/dist/cli.js" @args }
```

Use `aitools dev-init` to install the bundled `create-ai-tool` skill without needing a registry running at all — useful when you just want the AI authoring instructions locally:

```bash
aitools dev-init
```

---

## CLI reference

| Command | Description |
|---|---|
| `aitools init` | Create `aitools.json` in the current directory |
| `aitools install <name[@version]>` | Install a tool |
| `aitools uninstall <name>` | Remove a tool and its files |
| `aitools update [name]` | Update one or all installed tools |
| `aitools search <query>` | Search the registry by keyword |
| `aitools find <description>` | Extended search across name, description, keywords, and tags |
| `aitools list` | List tools recorded in the lock file |
| `aitools registry list` | Show configured registries |
| `aitools registry add <url>` | Add a registry to user config (`~/.aitools.config.json`) |
| `aitools registry add <url> --type git` | Add a git-backed registry |
| `aitools registry add <url> --project` | Add a registry to the current project only |
| `aitools registry remove <name>` | Remove a registry |
| `aitools config list` | Show all config files and their values |
| `aitools config get <key>` | Get an effective config value |
| `aitools config set <key> <value>` | Set a config value in user config (`~/.aitools.config.json`) |
| `aitools config set <key> <value> --project` | Set a config value in the project config |
| `aitools config unset <key>` | Remove a config key from user config |
| `aitools config unset <key> --project` | Remove a config key from project config |
| `aitools config edit` | Open user config in your editor |
| `aitools config edit --project` | Open project config in your editor |
| `aitools manifest init` | Add publish fields to `aitools.json` |
| `aitools manifest migrate` | Merge legacy `aitools.manifest.json` into `aitools.json` |
| `aitools manifest validate` | Validate an existing manifest against the schema |
| `aitools manifest bump <patch\|minor\|major\|x.y.z>` | Bump the manifest version |
| `aitools publish` | Publish the tool to a registry |
| `aitools publish --dry-run` | Validate without uploading |
| `aitools compat` | Audit platform compatibility of a tool package |

### Install options

| Flag | Default | Description |
|---|---|---|
| `--scope <project\|user>` | `project` | Where to install the tool |
| `-g, --global` | | Install to user scope (same as `--scope user`) |
| `--dev` | `false` | Save as a dev dependency in `aitools.json` |
| `-v, --version <version>` | | Specific version to install (overrides `@version` in name) |

### Update options

| Flag | Default | Description |
|---|---|---|
| `-s, --scope <project\|user>` | `project` | Scope of packages to update |

### List options

| Flag | Description |
|---|---|
| `--json` | Output raw JSON |

### Publish options

| Flag | Description |
|---|---|
| `-r, --registry <url>` | Registry URL (overrides config for this publish) |
| `--dry-run` | Validate and show what would be published without uploading |
| `--strict` | Block publish if the skill has frontmatter fields unsupported on any platform |

### Registry options

| Flag | Applies to | Description |
|---|---|---|
| `-n, --name <name>` | both | Registry name (defaults to hostname or SSH host) |
| `-p, --priority <n>` | both | Priority — lower number = queried first (default: 100) |
| `-t, --type <http\|git>` | both | Registry type (default: `http`) |
| `--read-branch <branch>` | git | Branch for install/search (default: `main`) |
| `--publish-branch <branch>` | git | Branch for publish (default: read branch) |
| `--path <path>` | git | Directory inside the repo (default: `registry/`) |
| `--token <token>` | http | Bearer token for authentication |
| `-g, --global` | both | Write to user-level config (`~/aitools.config.json`) |

> Git registries use system git credentials. `--token` is rejected for `--type git`.

### Config keys

| Key | Allowed values | Description |
|---|---|---|
| `platform` | `vscode`, `claude`, `cursor`, `windsurf` | Target IDE — controls install directory layout |
| `defaultScope` | `project`, `user` | Default install scope when `--scope` is omitted |
| `installPaths.<scope>.<category>` | Any path | Override install directory for a specific category and scope |

### Compat options

| Flag | Description |
|---|---|
| `-m, --manifest <path>` | Path to manifest file (default: `./aitools.json`) |
| `-p, --platform <platform>` | Check a specific platform only |
| `--fix` | Rewrite the SKILL.md file, stripping frontmatter fields unsupported on the target platform(s) |

---

## Publishing tools

### Workflow

```bash
# 1. Create the publish manifest (once)
aitools manifest init --category skill --description "My skill"

# 2. Edit aitools.json publish fields and add your files, then publish
aitools publish

# 3. To release an update, bump the version first
aitools manifest bump patch     # 1.0.0 -> 1.0.1
aitools manifest bump minor     # 1.0.0 -> 1.1.0
aitools manifest bump major     # 1.0.0 -> 2.0.0
aitools manifest bump 2.0.0     # explicit version

# 4. Publish the new version
aitools publish
```

> Each `name@version` combination is immutable once published. The registry returns 409 if you re-publish the same version.

### Configuring the target registry

```bash
# Default: user config (all projects)
aitools registry add http://localhost:4873 --name my-registry

# Per-project override (e.g. team repo pins a registry)
aitools registry add http://localhost:4873 --name my-registry --project

# Publish with no flags — registry is picked from config automatically
aitools publish

# Or override for a single publish
aitools publish --registry http://localhost:4873
```

### Publish fields in `aitools.json`

Consumer projects and publishable packages share one file. Publish fields (`version`, `category`, `files`, …) are optional until you publish. `aitools publish` sends a publish subset to the registry (omits `devDependencies`).

Legacy `aitools.manifest.json` is still read with a deprecation warning — run `aitools manifest migrate` to merge it.

```json
{
  "name": "@team/my-skill",
  "version": "1.0.0",
  "description": "Does something useful",
  "category": "skill",
  "files": [
    { "src": "skill.md", "dest": "my-skill.md" }
  ],
  "dependencies": {
    "@team/base-skill": "^1.0.0"
  },
  "devDependencies": {
    "@team/create-ai-tool": "^1.0.0"
  },
  "keywords": ["code-review", "typescript"],
  "author": "Your Name"
}
```

`dest` is relative to the category install directory — do not repeat the category name (use `my-skill.md`, not `skills/my-skill.md`).

Each entry may include an optional `platform` field (`vscode`, `claude`, `cursor`, `windsurf`, or `universal`) to restrict a file to a specific IDE. When multiple entries share the same `dest`, the platform-specific entry takes precedence over an unscoped entry for the active platform. Entries for other platforms are skipped.

```json
"files": [
  { "src": "SKILL.vscode.md", "dest": "SKILL.md", "platform": "vscode" },
  { "src": "SKILL.claude.md", "dest": "SKILL.md", "platform": "claude" },
  { "src": "SKILL.md",        "dest": "SKILL.md" }
]
```

**Field reference**

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Scoped package name (`@scope/name` or `name`) — lowercase, hyphens |
| `version` | Yes | Semver string |
| `description` | Yes | Short description |
| `category` | Yes | `skill`, `subagent`, `prompt`, or `mcp-tool` |
| `files` | Yes | Array of `{ src, dest, platform? }` file entries |
| `keywords` | | Array of strings for search |
| `author` | | Author name or email |
| `repository` | | URL to the source repository |
| `tags` | | Additional search tags |
| `dependencies` | | Map of tool name to semver range |
| `private` | | `true` — hides the tool from unauthenticated reads when the registry runs with `REGISTRY_ACCESS=public`. Can also be toggled after publish via `PATCH /tools/:name` (owner org only). |

---

## Project files

### `aitools.json` — unified manifest (npm-style)

Tracks registry dependencies and optional publish fields in one file.

```json
{
  "name": "my-project",
  "dependencies": {
    "@scope/my-skill": "^1.0.0"
  },
  "devDependencies": {
    "@scope/review-agent": "^2.1.0"
  }
}
```

Installed packages include a publish-subset `aitools.json` beside their content (like `package.json` in `node_modules`).

### `aitools-lock.json` — lock file

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

`resolved` is the registry URL — an HTTP base URL or a git remote, depending on which registry satisfied the install.

### `aitools.config.json` — configuration

Config cascades from your home directory (`~/aitools.config.json`) down to the project directory. Project values override user values; registry lists are merged with project registries taking priority.

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
      "type": "http",
      "name": "my-private",
      "url": "https://registry.example.com",
      "priority": 1,
      "auth": { "type": "bearer", "token": "..." }
    },
    {
      "type": "git",
      "name": "team-tools",
      "url": "git@github.com:myorg/ai-tools-registry.git",
      "readBranch": "main",
      "publishBranch": "main",
      "path": "registry/",
      "priority": 2
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
aitools config edit           # project config
aitools config edit --global  # user config (~/aitools.config.json)
```

---

## Tool categories & install paths

Set `platform` in `aitools.config.json` to adapt installs to your IDE.

> **Note:** When no `platform` is set, aitools uses a universal layout. Always set a `platform` value so installed files land where your IDE expects them.

### `skill`

| Platform | Project scope | User scope |
|---|---|---|
| `vscode` | `.agents/skills` | `~/.copilot/skills` |
| `claude` | `.claude/skills` | `~/.claude/skills` |
| `cursor` | `.agents/skills` | `~/.agents/skills` |
| `windsurf` | `.windsurf/skills` | `~/.windsurf/skills` |

### `subagent`

| Platform | Project scope | User scope |
|---|---|---|
| `vscode` | `.github/agents` | `~/.copilot/agents` |
| `claude` | `.claude/agents` | `~/.claude/agents` |
| `cursor` | `.agents/agents` | `~/.agents/agents` |
| `windsurf` | `.windsurf/agents` | `~/.windsurf/agents` |

### `prompt`

| Platform | Project scope | User scope |
|---|---|---|
| `vscode` | `.agents/prompts` | `~/.copilot/prompts` |
| `claude` | `.claude/commands` | `~/.claude/commands` |
| `cursor` | `.agents/prompts` | `~/.agents/prompts` |
| `windsurf` | `.windsurf/rules` | `~/.windsurf/rules` |

### `mcp-tool`

MCP tools inject a server entry into the platform's `mcp.json` config file.

| Platform | Project config | User config |
|---|---|---|
| `vscode` | `.vscode/mcp.json` | `~/.vscode/mcp.json` |
| `claude` | `.mcp.json` | `~/.claude/mcp.json` |
| `cursor` | `.cursor/mcp.json` | `~/.cursor/mcp.json` |
| `windsurf` | `.windsurf/mcp.json` | `~/.codeium/windsurf/mcp_config.json` |

---

## Registry types

`aitools` supports two registry backends. Configure one or both in `aitools.config.json` and chain them with `priority`.

| | Git (`type: "git"`) | HTTP (`type: "http"`) |
|---|---|---|
| **What it is** | A git remote whose `registry/` tree holds tool packages | A running `@bitgenetics/aitools-server` instance |
| **Server required** | No — GitHub, GitLab, Gitea, or a bare repo on disk | Yes |
| **Authentication** | SSH keys, git credential manager, CI tokens | Bearer token or user login |
| **Local cache** | Clone at `~/.aitools/git-cache/<name>/` | HTTP responses (no persistent clone) |
| **Publish** | Commit + push to `publishBranch` (rebases on conflict) | `POST /tools` |
| **When to pick it** | Lightweight team registry, infra you already have | Search proxy, upstream chaining, admin UI |

Omitting `type` in config defaults to `http` for backward compatibility.

### Git-backed registry (lightweight)

Point the CLI at any git remote URL. No `@bitgenetics/aitools-server` process is involved — the registry **is** the repository.

**How it works**

1. On first use, the CLI clones the repo into `~/.aitools/git-cache/<registry-name>/`.
2. **Install** and **search** read semver directories under `<path>/<scoped-name>/<version>/`.
3. **Publish** writes `aitools.json` and `tool.json`, commits, rebases onto the remote branch if needed, then pushes.
4. Separate **read** and **publish** branches are supported (useful for a `releases` branch fed by CI).

**Repository layout**

```
tools-registry/                 # your git repo
└── registry/                   # default path (override with --path)
    └── @acme__review-skill/    # @acme/review-skill — / becomes __
        ├── 1.0.0/
        │   ├── aitools.json      # publish subset
        │   └── tool.json       # JSON tarball: [{ "path", "content" }, ...]
        └── 1.1.0/
            ├── aitools.json
            └── tool.json
```

Initialize an empty registry by creating the path and pushing:

```bash
mkdir -p registry && touch registry/.gitkeep
git add registry && git commit -m "init registry root" && git push
```

**CLI setup**

```bash
aitools registry add git@github.com:myorg/tools-registry.git \
  --name team --type git --global

# Optional: split read vs publish branches
aitools registry add https://git.example.com/team/tools-registry.git \
  --name team --type git \
  --read-branch main --publish-branch releases \
  --path registry/ --priority 10 --global
```

**Config file example**

```jsonc
{
  "registries": [
    {
      "type": "git",
      "name": "team-tools",
      "url": "git@github.com:myorg/tools-registry.git",
      "readBranch": "main",
      "publishBranch": "main",
      "path": "registry/",
      "priority": 1
    }
  ]
}
```

**Lock file note:** `resolved` in `aitools-lock.json` stores the git remote URL (not an HTTP endpoint).

**CI authentication** — use whatever git auth your runner supports. For GitHub Actions with a private repo:

```yaml
- run: git config --global url."https://x-access-token:${{ secrets.REGISTRY_TOKEN }}@github.com".insteadOf "https://github.com"
- run: aitools publish
```

### HTTP registry (self-hosted)

The full Fastify server supports user accounts, upstream chaining, tarball storage, and an admin portal. See [Self-hosted HTTP registry](#self-hosted-http-registry) below.

---

## Self-hosted HTTP registry

Run your own registry with `@bitgenetics/aitools-server` from this repository, via Docker Compose, or the GHCR image (`ghcr.io/bitgenetics/aitools` on release tags). The server is **not** published to npm.

```bash
git clone https://github.com/bitgenetics/aitools && cd aitools
npm ci && npm run build -w @bitgenetics/aitools-server
```

---

### Mode 1 — Local (no database, token auth)

Best for a single team or personal use. No external services required.

```bash
# bash
AITOOLS_DATA_DIR=./data \
AUTH_BACKEND=simple \
AITOOLS_ADMIN_TOKEN=secret-admin \
AITOOLS_PUBLISH_TOKEN=secret-publish \
node dist/index.js

# PowerShell
$env:AITOOLS_DATA_DIR = ".\data"
$env:AUTH_BACKEND     = "simple"
$env:AITOOLS_ADMIN_TOKEN   = "secret-admin"
$env:AITOOLS_PUBLISH_TOKEN = "secret-publish"
node dist/index.js
```

| Variable | Required | Description |
|---|---|---|
| `AITOOLS_DATA_DIR` | Yes | Directory where tool tarballs and manifests are stored |
| `AUTH_BACKEND` | | `simple` (default) |
| `REGISTRY_ACCESS` | | `private` (default) — all reads require auth; `public` — reads are open, tools with `"private": true` are hidden |
| `AITOOLS_PUBLISH_TOKEN` | | Single shared Bearer token for publish (`POST /tools`) |
| `AITOOLS_PUBLISHER_TOKENS` | | Multi-user token map (JSON, see below) — takes precedence over `AITOOLS_PUBLISH_TOKEN` |
| `AITOOLS_ADMIN_TOKEN` | | Bearer token for the `/portal/admin` management UI |
| `PORT` | | Port to listen on (default `4873`) |
| `HOST` | | Host to bind (default `0.0.0.0`) |

**Multi-user publish tokens** — set `AITOOLS_PUBLISHER_TOKENS` to a JSON object where each key is a Bearer token:

```bash
AITOOLS_PUBLISHER_TOKENS='{"token-alice":{"userId":"alice","orgs":["my-org"]},"token-bob":{"userId":"bob","orgs":["my-org"]}}'
```

When publishing, pass the matching token in the `Authorization` header and optionally `X-AI-Tools-Org` to select an org.

---

### Mode 2 — Dev / team (filesystem + Postgres user auth)

Adds user registration, login, and per-user API tokens stored in a Postgres database. Storage stays on the local filesystem.

```bash
# bash
AITOOLS_DATA_DIR=./data \
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_tools \
AITOOLS_ADMIN_TOKEN=secret-admin \
node dist/index.js

# PowerShell
$env:AITOOLS_DATA_DIR   = ".\data"
$env:DATABASE_URL         = "postgresql://user:pass@localhost:5432/ai_tools"
$env:AITOOLS_ADMIN_TOKEN = "secret-admin"
node dist/index.js
```

| Variable | Required | Description |
|---|---|---|
| `AITOOLS_DATA_DIR` | Yes | Directory where tool tarballs and manifests are stored |
| `DATABASE_URL` | Yes | Postgres connection string — triggers `AUTH_BACKEND=database` automatically |
| `REGISTRY_ACCESS` | | `private` (default) — all reads require auth; `public` — reads are open, tools with `"private": true` are hidden |
| `AITOOLS_ADMIN_TOKEN` | | Bearer token for the `/portal/admin` management UI |
| `PORT` | | Port to listen on (default `4873`) |
| `HOST` | | Host to bind (default `0.0.0.0`) |

The server runs schema migrations on startup. Users register via `POST /api/auth/register`, log in via `POST /api/auth/login`, and manage API tokens via `/api/auth/tokens`.

**Docker Compose example:**

Use the bundled `docker-compose.yml` — copy `.env.example` to `.env`, fill in the secrets, then:

```bash
cp .env.example .env   # edit AITOOLS_ADMIN_TOKEN, POSTGRES_PASSWORD, DATABASE_URL
docker compose up -d
```

Never commit `.env`. See [`docs/deployment.md`](docs/deployment.md) for Kubernetes and systemd instructions.

---

### Mode 3 — Production (cloud storage + OIDC)

> **Note:** Azure, S3, and OIDC backends are currently stubs. This mode documents the intended configuration for when they are fully implemented.

```bash
# Azure Blob Storage + OIDC
STORAGE_BACKEND=azure \
AUTH_BACKEND=oidc \
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;..." \
AZURE_STORAGE_CONTAINER=ai-tools \
OIDC_ISSUER=https://login.microsoftonline.com/<tenant>/v2.0 \
OIDC_AUDIENCE=api://ai-tools \
AITOOLS_ADMIN_TOKEN=secret-admin \
node dist/index.js
```

```bash
# AWS S3 + OIDC
STORAGE_BACKEND=s3 \
AUTH_BACKEND=oidc \
AWS_S3_BUCKET=my-ai-tools-bucket \
AWS_REGION=us-east-1 \
OIDC_ISSUER=https://accounts.google.com \
OIDC_AUDIENCE=my-client-id \
node dist/index.js
```

| Variable | Required | Description |
|---|---|---|
| `STORAGE_BACKEND` | | `filesystem` (default), `azure`, or `s3` |
| `AUTH_BACKEND` | | `simple` (default), `database`, or `oidc` |
| `AZURE_STORAGE_CONNECTION_STRING` | azure | Azure Blob Storage connection string |
| `AZURE_STORAGE_CONTAINER` | azure | Blob container name |
| `AWS_S3_BUCKET` | s3 | S3 bucket name |
| `AWS_REGION` | s3 | AWS region |
| `OIDC_ISSUER` | oidc | OIDC issuer URL |
| `OIDC_AUDIENCE` | oidc | Expected token audience |
| `OIDC_ADMIN_ROLE` | | Claim value that grants admin access (optional) |
| `OIDC_ORG_CLAIM` | | JWT claim name to extract org membership (optional) |

---

### Common environment variables

These apply to all modes:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4873` | Port to listen on |
| `HOST` | `0.0.0.0` | Host to bind |
| `REGISTRY_ACCESS` | `private` | `private` — all reads require a valid publisher token. `public` — reads are open; tools marked `"private": true` in their manifest are hidden from unauthenticated callers. |
| `UPSTREAMS` | | Comma-separated `name=url` upstream registry pairs |
| `CORS_ORIGINS` | _(deny all)_ | Comma-separated list of allowed CORS origins (e.g. `https://app.example.com`) |
| `LOG_LEVEL` | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |

See `.env.example` in the repo root for a full reference with descriptions of every variable.

### Example with upstreams

```bash
AITOOLS_DATA_DIR=/var/lib/ai-tools \
UPSTREAMS="public=https://registry.aitools.dev" \
node dist/index.js
```

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check — always `200 { status: "ok" }` |
| `GET` | `/health/ready` | Readiness check — `503` when DB is unreachable |
| `GET` | `/tools` | List all tools (latest versions) |
| `GET` | `/search?q=<query>` | Search tools |
| `GET` | `/tools/:name` | Get latest manifest for a tool |
| `GET` | `/tools/:name/versions` | List all versions |
| `GET` | `/tools/:name/:version` | Get specific version manifest |
| `GET` | `/tools/:name/:version/tarball` | Download tool tarball |
| `POST` | `/tools` | Publish a tool version |
| `PATCH` | `/tools/:name` | Update tool-level settings (owner org only) |
| `GET` | `/upstream` | List configured upstream registries |
| `GET` | `/proxy/search?q=<query>` | Search across all upstreams |

### Per-tool privacy control

Once a tool is published the owning org can toggle its visibility at any time without republishing:

```bash
# Make a tool private (hidden from unauthenticated callers in public mode)
curl -X PATCH https://registry.example.com/tools/my-skill \
  -H "Authorization: Bearer <owner-token>" \
  -H "Content-Type: application/json" \
  -d '{"private": true}'

# Restore public visibility
curl -X PATCH https://registry.example.com/tools/my-skill \
  -H "Authorization: Bearer <owner-token>" \
  -H "Content-Type: application/json" \
  -d '{"private": false}'
```

**Auth rules:** `401` if unauthenticated, `403` if the caller's org is not the tool owner, `404` if the tool doesn't exist.

**Precedence:** The owner-level flag (set via `PATCH`) overrides the `"private"` field in any individual version's manifest, so one call applies to all versions.

### Registry chaining

Point a registry at one or more upstreams to federate results:

```bash
UPSTREAMS="public=https://registry.aitools.dev,internal=https://internal.example.com"
```

Registries are resolved in priority order; the first match wins for installs, and search results are merged.

---

## Monorepo structure

```
ai-tools/
├── packages/
│   ├── core/        # @bitgenetics/aitools-core — shared types, schemas, config cascade, lock utilities
│   ├── cli/         # @bitgenetics/aitools-cli  — the `aitools` CLI
│   ├── server/      # @bitgenetics/aitools-server — self-hosted HTTP registry
│   └── e2e/         # @bitgenetics/aitools-e2e  — end-to-end tests (HTTP + Gitea git registry)
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

# Run tests with coverage (core, cli, server)
npm run test:coverage
```

### Unit / integration tests

`npm test` covers all three packages. Server route handlers are tested via Fastify `inject()` — no real HTTP port needed.

### End-to-end tests

E2e tests live in `packages/e2e/` and run the CLI binary against a live server.

**Option A — Docker**

```bash
npm run test:e2e          # tear down stale volumes, build images, run tests (jest output only)
npm run test:e2e:verbose  # same, but shows registry logs too
npm run test:e2e:down     # remove containers and volumes manually
```

Requires Docker with the default (Linux) engine. The script tears down any previous volumes before starting, so repeated runs always get a clean registry.

Docker e2e spins up three backing services:

| Service | Role |
|---------|------|
| `test-registry` | HTTP registry (`@bitgenetics/aitools-server`) |
| `gitea-init` + `gitea` | Real Git remote for git-registry publish/install/search tests |
| `e2e` | Jest runner |

Git registry tests use Gitea when `GITEA_URL` is set (Docker). Locally they fall back to a temporary bare repository.

**Option B — local server**

1. Build:

   ```bash
   npm run build -w @bitgenetics/aitools-core && npm run build -w @bitgenetics/aitools-cli
   ```

2. Start a fresh registry in one terminal:

   ```bash
   # PowerShell
   $env:AITOOLS_DATA_DIR = "$env:TEMP\aitools-e2e-data"
   $env:PORT = "4873"; $env:HOST = "127.0.0.1"
   node packages/server/dist/index.js

   # bash
   AITOOLS_DATA_DIR=/tmp/aitools-e2e-data PORT=4873 HOST=127.0.0.1 \
     node packages/server/dist/index.js
   ```

3. Run the suite in another terminal:

   ```bash
   # PowerShell
   $env:REGISTRY_URL = "http://localhost:4873"
   $env:AITOOLS_CLI = "node $PWD/packages/cli/dist/cli.js"
   npm test -w @bitgenetics/aitools-e2e

   # bash
   REGISTRY_URL=http://localhost:4873 \
   AITOOLS_CLI="node $(pwd)/packages/cli/dist/cli.js" \
   npm test -w @bitgenetics/aitools-e2e
   ```

   > Re-running against the same server can cause 409 conflicts. Delete the data directory and restart the server before re-running.

### Test coverage targets

- `@bitgenetics/aitools-core` and `@bitgenetics/aitools-cli`: >= 80% statements / branches / functions
- `@bitgenetics/aitools-server` route handlers: integration-tested via Fastify `inject()` — no real HTTP port

---

## License

[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).

This software is provided **as is**, without warranty of any kind. See the experimental notice at the top of this document.