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

export const vscodeSpec: PlatformSpec = {
  id: 'vscode',
  name: 'VS Code / GitHub Copilot',
  docsUrl: 'https://code.visualstudio.com/docs/copilot/customization/agent-skills',
  lastVerified: '2026-06-01',
  supportedCategories: ['skill', 'rule', 'command', 'agent', 'hook', 'mcp-tool', 'subagent', 'prompt'],
  skillFrontmatter: {
    name:                       { required: true,  support: 'supported',   platformExtension: false },
    description:                { required: true,  support: 'supported',   platformExtension: false },
    license:                    { required: false, support: 'supported',   platformExtension: false },
    compatibility:              { required: false, support: 'supported',   platformExtension: false },
    metadata:                   { required: false, support: 'supported',   platformExtension: false },
    'allowed-tools':            { required: false, support: 'supported',   platformExtension: false },
    'argument-hint':            { required: false, support: 'supported',   platformExtension: true,  note: 'Hint shown in chat input when skill is invoked as a slash command' },
    'user-invocable':           { required: false, support: 'supported',   platformExtension: true,  note: 'Defaults to true. Set false to hide from / menu while keeping auto-load' },
    'disable-model-invocation': { required: false, support: 'supported',   platformExtension: true,  note: 'Set true for slash-command-only skills that the agent never auto-loads' },
  },
  installPaths: {
    skill:      { project: '.github/skills',       user: '~/.copilot/skills' },
    rule:       { project: '.github/instructions', user: '~/.copilot/instructions' },
    command:    { project: '.github/prompts',      user: '~/.copilot/prompts' },
    agent:      { project: '.github/agents',       user: '~/.copilot/agents' },
    prompt:     { project: '.github/prompts',      user: '~/.copilot/prompts' },
    subagent:   { project: '.github/agents',       user: '~/.copilot/agents' },
    // User MCP is VS Code profile mcp.json (resolved at runtime by VsCodeAdapter).
    mcpConfig:  { project: '.vscode/mcp.json',     user: '~/.config/Code/User/mcp.json' },
    hookConfig: { project: '.github/hooks/hooks.json', user: '~/.copilot/hooks/hooks.json' },
  },
};
