// Copyright (C) 2026 Nucleic Logic Studios, LLC
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

export const AITOOLS_CONVERT_SKILL_MD = `---
name: aitools-convert
description: Convert an AI tool file from one platform format to another. Use when aitools reports a low-confidence transformation or asks for AI-assisted conversion.
disable-model-invocation: true
---

# aitools-convert

Use this skill when \`aitools install\` or \`aitools_transform\` reports \`medium\`, \`low\`, or \`unsupported\` confidence.

## Workflow

1. Read the target file (often already written as a mechanical skeleton).
2. For **markdown** rule / command / agent files: find inline \`# aitools:\` annotations marking lossy or unresolved sections.
3. For **hooks** (\`hooks.json\`, Claude \`settings.json\` hooks): there are **no** inline \`# aitools:\` markers — rely on install stderr warnings / \`skillPrompt\` instead. Invalid or non-portable hooks are skipped rather than written as annotated JSON.
4. Apply semantic judgment to complete or correct the conversion for the active platform.
5. Write the refined result in-place.
6. Remove resolved \`# aitools:\` annotations from markdown when done.

## Mechanism equivalents

| Concept | Cursor | VS Code / Copilot | Claude Code | Windsurf |
|---|---|---|---|---|
| Skill | \`.cursor/skills/\` | \`.github/skills/\` | \`.claude/skills/\` | \`.windsurf/skills/\` |
| Rule | \`.cursor/rules/*.mdc\` | \`.github/instructions/*.instructions.md\` | \`.claude/rules/*.md\` | \`.devin/rules/*.md\` |
| Command | \`.cursor/commands/\` | \`.github/prompts/*.prompt.md\` | \`.claude/commands/\` | \`.windsurf/workflows/\` |
| Agent | \`.cursor/agents/\` | \`.github/agents/*.agent.md\` | \`.claude/agents/\` | *(no native format)* |
| Hook | \`.cursor/hooks.json\` | \`.github/hooks/hooks.json\` | \`.claude/settings.json\` hooks key | \`.windsurf/hooks.json\` |

## Hook handler types

- \`command\` — portable between most platforms (except Windsurf has limited event overlap).
- \`http\` — portable between Claude Code and GitHub Copilot only.
- \`prompt\` — **not interchangeable** (Cursor inline eval vs Claude single-turn vs Copilot text injection).
- \`mcp_tool\`, \`agent\` — Claude Code only.

## Native compatibility shortcuts

- Claude hooks in \`.claude/settings.json\` are loaded natively by Cursor and GitHub Copilot — prefer installing there when targeting those platforms.
- Skills follow the agentskills.io \`SKILL.md\` standard — minimal transformation needed.

## Tools

When available, call \`aitools_transform\` via the aitools MCP server for structured transform output including \`confidence\`, \`warnings\`, and \`skillPrompt\`.
`;

export const AITOOLS_CONVERT_NAME = 'aitools-convert';
export const AITOOLS_CONVERT_VERSION = '1.0.0';
