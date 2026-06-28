# Platform Reference

## Install paths

The `dest` in the manifest is appended to the category directory shown below.

## Project scope

| Platform | skill | subagent | prompt | mcp config |
|---|---|---|---|---|
| **universal** | `.agents/skills/` | `.agents/agents/` | `.agents/prompts/` | — |
| **vscode** | `.agents/skills/` | `.github/agents/` | `.agents/prompts/` | `.vscode/mcp.json` |
| **cursor** | `.agents/skills/` | `.agents/agents/` | `.agents/prompts/` | `.cursor/mcp.json` |
| **windsurf** | `.agents/skills/` | `.agents/agents/` | `.agents/prompts/` | `.windsurf/mcp.json` |
| **claude** | `.claude/skills/` | `.claude/agents/` | `.claude/commands/` | `.mcp.json` |

## User scope (global)

| Platform | skill | subagent | prompt | mcp config |
|---|---|---|---|---|
| **vscode** | `~/.copilot/skills/` | `~/.copilot/agents/` | `~/.copilot/prompts/` | `~/.vscode/mcp.json` |
| **cursor** | `~/.agents/skills/` | `~/.agents/agents/` | `~/.agents/prompts/` | `~/.cursor/mcp.json` |
| **claude** | `~/.claude/skills/` | `~/.claude/agents/` | `~/.claude/commands/` | `~/.claude/mcp.json` |

## Example

A skill manifest with `"dest": "jest-tdd/SKILL.md"` installs to:

| Platform | Project scope result |
|---|---|
| universal / vscode / cursor | `.agents/skills/jest-tdd/SKILL.md` |
| claude | `.claude/skills/jest-tdd/SKILL.md` |

## Designing `dest` values

- Use a subdirectory matching the package name so skills don't collide: `"dest": "my-skill/SKILL.md"` not `"dest": "SKILL.md"`.
- For skills, the folder name in `dest` **must match the `name` field in the `SKILL.md` frontmatter** — that's how agents find the skill file.
- For subagents and prompts, a flat `"dest": "my-agent.md"` is fine if only one file is shipped.

---

## Platform-specific SKILL.md frontmatter fields

Beyond the base [agentskills.io spec](https://agentskills.io/specification) (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`), VS Code and Cursor support additional frontmatter fields.

### `disable-model-invocation`

**Supported by**: VS Code, Cursor

When `true`, the skill is never auto-loaded by the agent based on context. It only activates when the user explicitly types `/skill-name` in chat. Use this for skills that should be on-demand slash commands rather than auto-triggered.

```yaml
---
name: my-skill
description: …
disable-model-invocation: true
---
```

Default: `false` (agent auto-loads when relevant).

### `user-invocable`

**Supported by**: VS Code only

Controls whether the skill appears in the `/` slash command menu in chat. Defaults to `true`.

Set to `false` to hide the skill from the `/` menu while still allowing the agent to load it automatically based on context. Useful for background knowledge skills you don't want cluttering the slash command list.

```yaml
---
name: my-skill
description: …
user-invocable: false
---
```

| `user-invocable` | `disable-model-invocation` | Slash menu | Auto-load |
|---|---|---|---|
| `true` (default) | `false` (default) | ✅ | ✅ |
| `false` | `false` | ❌ | ✅ |
| `true` | `true` | ✅ | ❌ |
| `false` | `true` | ❌ | ❌ (disabled) |

### `argument-hint`

**Supported by**: VS Code only

Hint text shown in the chat input field when the skill is invoked as a slash command. Helps the user know what additional context to provide.

```yaml
---
name: run-tests
description: …
argument-hint: "[test file] [--watch]"
---
```

The hint appears as placeholder text after `/run-tests` in the chat input.

