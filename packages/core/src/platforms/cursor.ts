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
import type { PlatformSpec } from './types.js';

/**
 * Cursor IDE platform spec.
 * Docs: https://cursor.com/docs/skills, /rules, /hooks, /subagents
 */
export const cursorSpec: PlatformSpec = {
  id: 'cursor',
  name: 'Cursor',
  docsUrl: 'https://cursor.com/docs/skills#frontmatter-fields',
  lastVerified: '2026-06-01',
  supportedCategories: ['skill', 'rule', 'command', 'agent', 'hook', 'mcp-tool', 'subagent', 'prompt'],
  skillFrontmatter: {
    name:                       { required: true,  support: 'supported',   platformExtension: false },
    description:                { required: true,  support: 'supported',   platformExtension: false },
    license:                    { required: false, support: 'supported',   platformExtension: false },
    compatibility:              { required: false, support: 'supported',   platformExtension: false },
    metadata:                   { required: false, support: 'supported',   platformExtension: false },
    paths:                      { required: false, support: 'supported',   platformExtension: true,  note: 'File path globs for skill scoping (globs is legacy alias)' },
    'allowed-tools':            { required: false, support: 'unknown',     platformExtension: false, note: 'Not documented; behaviour unverified' },
    'argument-hint':            { required: false, support: 'ignored',     platformExtension: true,  note: 'VS Code-only extension; Cursor ignores this field' },
    'user-invocable':           { required: false, support: 'ignored',     platformExtension: true,  note: 'VS Code-only extension; Cursor ignores this field' },
    'disable-model-invocation': { required: false, support: 'supported',   platformExtension: true,  note: 'Cursor supports this — skill becomes slash-command-only' },
  },
  installPaths: {
    skill:     { project: '.cursor/skills',    user: '~/.cursor/skills' },
    rule:      { project: '.cursor/rules',     user: '~/.cursor/rules' },
    command:   { project: '.cursor/commands',  user: '~/.cursor/commands' },
    agent:     { project: '.cursor/agents',    user: '~/.cursor/agents' },
    prompt:    { project: '.cursor/commands',  user: '~/.cursor/commands' },
    subagent:  { project: '.cursor/agents',    user: '~/.cursor/agents' },
    mcpConfig: { project: '.cursor/mcp.json',  user: '~/.cursor/mcp.json' },
    hookConfig: { project: '.cursor/hooks.json', user: '~/.cursor/hooks.json' },
  },
};
