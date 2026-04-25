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
 * Windsurf IDE (Codeium) platform spec.
 * Docs: https://docs.codeium.com/windsurf/mcp
 */
export const windsurfSpec: PlatformSpec = {
  id: 'windsurf',
  name: 'Windsurf',
  docsUrl: 'https://docs.codeium.com/windsurf/mcp',
  lastVerified: '2026-05-15',
  supportedCategories: ['skill', 'subagent', 'prompt', 'mcp-tool'],
  skillFrontmatter: {
    name:                       { required: true,  support: 'supported',   platformExtension: false },
    description:                { required: true,  support: 'supported',   platformExtension: false },
    license:                    { required: false, support: 'unknown',     platformExtension: false, note: 'Not documented; behaviour unverified' },
    compatibility:              { required: false, support: 'unknown',     platformExtension: false, note: 'Not documented; behaviour unverified' },
    metadata:                   { required: false, support: 'unknown',     platformExtension: false, note: 'Not documented; behaviour unverified' },
    'allowed-tools':            { required: false, support: 'unknown',     platformExtension: false, note: 'Not documented; behaviour unverified' },
    'argument-hint':            { required: false, support: 'ignored',     platformExtension: true,  note: 'VS Code-only extension; Windsurf ignores this field' },
    'user-invocable':           { required: false, support: 'ignored',     platformExtension: true,  note: 'VS Code-only extension; Windsurf ignores this field' },
    'disable-model-invocation': { required: false, support: 'unknown',     platformExtension: true,  note: 'Not documented; behaviour unverified' },
  },
  installPaths: {
    skill:     { project: '.windsurf/skills',   user: '~/.windsurf/skills' },
    subagent:  { project: '.windsurf/agents',   user: '~/.windsurf/agents' },
    prompt:    { project: '.windsurf/rules',    user: '~/.windsurf/rules' },
    mcpConfig: { project: '.windsurf/mcp.json', user: '~/.codeium/windsurf/mcp_config.json' },
  },
};
