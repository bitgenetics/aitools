# create-ai-tool

**Purpose**: Create tool packages that are compatible with the AITools registry so they can be published, discovered, and installed by other developers and AI agents.

---

## Overview

The AITools registry distributes four types of AI tool packages:

| Category | What it is | Installed to |
|---|---|---|
| `skill` | A SKILL.md instruction file teaching an agent a specialised workflow | `.agents/skills/` |
| `subagent` | An agent definition file describing a reusable specialised agent | `.agents/agents/` |
| `prompt` | A reusable prompt template (slash command / instruction file) | `.agents/prompts/` |
| `mcp-tool` | An MCP server registration + optional server files | platform `mcp.json` |

Every package must have an `aitools.manifest.json` at its root.

---

## Manifest Format

```jsonc
{
  "name": "@scope/my-skill",          // required — npm-style, lowercase, hyphens allowed
  "version": "1.0.0",                  // required — semver
  "description": "One-line summary",  // required
  "category": "skill",                 // required — skill | subagent | prompt | mcp-tool
  "files": [                           // required (except mcp-tool with no extra files)
    {
      "src": "SKILL.md",               // path relative to manifest file
      "dest": "my-skill/SKILL.md"      // path relative to category install dir
    }
  ],
  "author": "Your Name",              // optional
  "repository": "https://github.com/…", // optional, must be a valid URL
  "keywords": ["testing", "jest"],    // optional — freeform search terms
  "tags": ["typescript", "unit-test"],// optional — metadata for AI discovery
  "dependencies": {                   // optional — other ai-tools packages required
    "base-skill": "^1.0.0"
  }
}
```

### `dest` path rules

- **Do not repeat the category directory** in `dest`. The installer prepends the category dir automatically.
- A skill at `.agents/skills/my-skill/SKILL.md` has `"dest": "my-skill/SKILL.md"`.
- A flat file at `.agents/skills/my-skill.md` has `"dest": "my-skill.md"`.

### `template` flag

Add `"template": true` to a file entry to enable Handlebars variable substitution during install. Use `{{variableName}}` placeholders for values the installer fills in. Omit the flag for static files.

---

## Creating a Skill

A skill is a Markdown file (`SKILL.md` by convention) that gives an AI agent step-by-step instructions for a specialised domain or workflow.

**File structure:**
```
my-skill/
├── aitools.manifest.json
└── SKILL.md
```

**SKILL.md anatomy:**
```markdown
# skill-name

**Purpose**: One sentence describing exactly what this skill enables.

---

## When to use this skill
<!-- Trigger conditions — what user requests should invoke it -->

## Prerequisites
<!-- Tools, files, or context the agent needs before starting -->

## Workflow

### Step 1: …
<!-- Concrete, actionable instructions. Prefer numbered steps. -->

### Step 2: …

## Rules
<!-- Hard constraints the agent must follow -->

## Examples
<!-- Show expected inputs and outputs -->
```

**Best practices:**
- Write for the agent, not the human. Use imperative language ("Run X", "Read Y before Z").
- Be explicit about tool calls and their order.
- Keep each step atomic — one action per step.
- Include edge-case handling and what to do when something fails.

**Example manifest:**
```json
{
  "name": "@acme/jest-tdd-skill",
  "version": "1.0.0",
  "description": "Step-by-step TDD workflow using Jest and ts-jest",
  "category": "skill",
  "files": [
    { "src": "SKILL.md", "dest": "jest-tdd/SKILL.md" }
  ],
  "keywords": ["testing", "jest", "tdd", "typescript"],
  "tags": ["testing", "typescript"]
}
```

---

## Creating a Subagent

A subagent is a Markdown agent definition file — loaded by the IDE as a custom agent mode or persona.

**File structure:**
```
my-agent/
├── aitools.manifest.json
└── agent.md
```

**agent.md anatomy:**
```markdown
---
name: My Agent
description: One sentence — when should this agent be used?
tools:
  - read_file
  - run_in_terminal
  - semantic_search
---

# Role and Expertise

You are an expert in … 

## Responsibilities

- …

## Rules

- …

## Output Format

- …
```

**Best practices:**
- List only the tools the agent actually needs in the frontmatter.
- Define clear scope boundaries — what this agent does AND what it does not do.
- Keep the persona description tight; do not re-define base behaviours.

**Example manifest:**
```json
{
  "name": "@acme/code-review-agent",
  "version": "1.0.0",
  "description": "Automated code review agent focused on correctness and security",
  "category": "subagent",
  "files": [
    { "src": "agent.md", "dest": "code-review.md" }
  ],
  "tags": ["code-review", "security"]
}
```

---

## Creating a Prompt

A prompt is a reusable instruction template — a slash command, system prompt fragment, or parameterised instruction.

**File structure:**
```
my-prompt/
├── aitools.manifest.json
└── prompt.md
```

**Example manifest:**
```json
{
  "name": "@acme/commit-message",
  "version": "1.0.0",
  "description": "Generate conventional commit messages from staged changes",
  "category": "prompt",
  "files": [
    { "src": "prompt.md", "dest": "commit-message.md" }
  ],
  "tags": ["git", "commits"]
}
```

---

## Creating an MCP Tool

An MCP tool registers a Model Context Protocol server into the platform's MCP config (`mcp.json`). It may optionally ship server files.

**Manifest with `mcpServer`:**
```json
{
  "name": "@acme/postgres-mcp",
  "version": "1.0.0",
  "description": "MCP server for PostgreSQL query execution",
  "category": "mcp-tool",
  "mcpServer": {
    "command": "node",
    "args": ["${installDir}/server.js"],
    "env": {
      "DATABASE_URL": "${env:DATABASE_URL}"
    },
    "type": "stdio"
  },
  "files": [
    { "src": "server.js", "dest": "server.js" }
  ],
  "tags": ["database", "postgresql"]
}
```

**For remote HTTP MCP servers (no files needed):**
```json
{
  "mcpServer": {
    "url": "https://my-mcp-server.example.com/mcp",
    "type": "http"
  },
  "files": []
}
```

**`mcpServer` fields:**
| Field | Type | Description |
|---|---|---|
| `command` | string | Executable path or shell command (local servers) |
| `args` | string[] | Arguments passed to the command |
| `env` | Record\<string, string\> | Environment variables for the server process |
| `url` | string | Remote server URL (HTTP transport — overrides `command`) |
| `type` | `"stdio"` \| `"http"` | Transport type. Defaults to `"stdio"` |

---

## CLI Workflow

### 1. Initialise a manifest interactively
```bash
cd my-skill/
aitools manifest init
```
Prompts for name, version, description, category, author, repository, keywords, and tags. Auto-detects files matching the category's extensions.

Skip prompts with `--yes` (non-interactive):
```bash
aitools manifest init --yes \
  --name "@acme/my-skill" \
  --category skill \
  --description "My skill description"
```

### 2. Validate before publishing
```bash
aitools manifest validate
```
Checks schema validity and confirms every `src` file exists on disk. Fix all reported errors before publishing.

### 3. Publish to the registry
```bash
aitools publish
```
Reads `aitools.manifest.json`, bundles all declared files, and uploads to the configured registry.

Preview what would be published without uploading:
```bash
aitools publish --dry-run
```

### 4. Bump the version
```bash
aitools manifest bump patch   # 1.0.0 → 1.0.1
aitools manifest bump minor   # 1.0.0 → 1.1.0
aitools manifest bump major   # 1.0.0 → 2.0.0
aitools manifest bump 1.2.3   # explicit version
```

---

## Platform Install Paths

When a user runs `aitools install <name>`, files land at:

| Platform | Scope | skill | subagent | prompt | mcp config |
|---|---|---|---|---|---|
| universal | project | `.agents/skills/` | `.agents/agents/` | `.agents/prompts/` | — |
| vscode | project | `.agents/skills/` | `.github/agents/` | `.agents/prompts/` | `.vscode/mcp.json` |
| vscode | user | `~/.copilot/skills/` | `~/.copilot/agents/` | `~/.copilot/prompts/` | `~/.vscode/mcp.json` |
| claude | project | `.claude/skills/` | `.claude/agents/` | `.claude/commands/` | `.mcp.json` |
| claude | user | `~/.claude/skills/` | `~/.claude/agents/` | `~/.claude/commands/` | `~/.claude/mcp.json` |
| cursor | project | `.agents/skills/` | `.agents/agents/` | `.agents/prompts/` | `.cursor/mcp.json` |

The `dest` path in the manifest is appended to whichever category dir the platform resolves. Design `dest` values to be meaningful subdirectory paths (e.g. `my-skill/SKILL.md`) so they don't collide with other installed tools.

---

## Checklist Before Publishing

- [ ] `name` is lowercase, hyphen-separated, and unique on the target registry
- [ ] `version` is a valid semver string
- [ ] `description` is a clear one-liner (shown in search results)
- [ ] `category` is correct for the content type
- [ ] All `src` paths exist on disk and are relative to the manifest file
- [ ] `dest` paths do NOT start with the category directory name
- [ ] `aitools manifest validate` passes with no errors
- [ ] `aitools publish --dry-run` shows the expected files
- [ ] A `README.md` exists for human readers (not included in the package by default)
