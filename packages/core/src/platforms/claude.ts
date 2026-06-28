// Copyright (C) 2026 Michael Benjamin (turbofoxwave@gmail.com)
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
import type { PlatformSpec } from './types.js';

export const claudeSpec: PlatformSpec = {
  id: 'claude',
  name: 'Claude Code',
  docsUrl: 'https://code.claude.com/docs/en/hooks',
  lastVerified: '2026-06-01',
  supportedCategories: ['skill', 'rule', 'command', 'agent', 'hook', 'mcp-tool', 'subagent', 'prompt'],
  skillFrontmatter: {
    name:                       { required: true,  support: 'supported',   platformExtension: false },
    description:                { required: true,  support: 'supported',   platformExtension: false },
    license:                    { required: false, support: 'supported',   platformExtension: false },
    compatibility:              { required: false, support: 'supported',   platformExtension: false },
    metadata:                   { required: false, support: 'supported',   platformExtension: false },
    'allowed-tools':            { required: false, support: 'supported',   platformExtension: false },
    'argument-hint':            { required: false, support: 'ignored',     platformExtension: true,  note: 'VS Code-only extension; Claude Code ignores this field' },
    'user-invocable':           { required: false, support: 'ignored',     platformExtension: true,  note: 'VS Code-only extension; Claude Code ignores this field' },
    'disable-model-invocation': { required: false, support: 'unknown',     platformExtension: true,  note: 'Not documented for Claude Code; behaviour unverified' },
  },
  installPaths: {
    skill:      { project: '.claude/skills',   user: '~/.claude/skills' },
    rule:       { project: '.claude/rules',    user: '~/.claude/rules' },
    command:    { project: '.claude/commands', user: '~/.claude/commands' },
    agent:      { project: '.claude/agents',   user: '~/.claude/agents' },
    prompt:     { project: '.claude/commands', user: '~/.claude/commands' },
    subagent:   { project: '.claude/agents',   user: '~/.claude/agents' },
    mcpConfig:  { project: '.mcp.json',        user: '~/.claude/mcp.json' },
    hookConfig: { project: '.claude/settings.json', user: '~/.claude/settings.json' },
  },
};
