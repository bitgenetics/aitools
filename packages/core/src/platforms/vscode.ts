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

/**
 * VS Code / GitHub Copilot platform spec.
 * Docs: https://code.visualstudio.com/docs/copilot/customization/agent-skills
 */
export const vscodeSpec: PlatformSpec = {
  id: 'vscode',
  name: 'VS Code / GitHub Copilot',
  docsUrl: 'https://code.visualstudio.com/docs/copilot/customization/agent-skills#_skillmd-file-format',
  lastVerified: '2026-05-15',
  supportedCategories: ['skill', 'subagent', 'prompt', 'mcp-tool'],
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
    skill:     { project: '.agents/skills',  user: '~/.copilot/skills' },
    subagent:  { project: '.github/agents',  user: '~/.copilot/agents' },
    prompt:    { project: '.agents/prompts', user: '~/.copilot/prompts' },
    mcpConfig: { project: '.vscode/mcp.json', user: '~/.vscode/mcp.json' },
  },
};
