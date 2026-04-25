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
 * Universal platform spec — the agentskills.io baseline.
 * All other platforms extend or restrict this.
 */
export const universalSpec: PlatformSpec = {
  id: 'universal',
  name: 'Universal (agentskills.io)',
  docsUrl: 'https://agentskills.io/docs/spec',
  lastVerified: '2026-05-15',
  supportedCategories: ['skill', 'subagent', 'prompt', 'mcp-tool'],
  skillFrontmatter: {
    name:            { required: true,  support: 'supported', platformExtension: false },
    description:     { required: true,  support: 'supported', platformExtension: false },
    license:         { required: false, support: 'supported', platformExtension: false },
    compatibility:   { required: false, support: 'supported', platformExtension: false },
    metadata:        { required: false, support: 'supported', platformExtension: false },
    'allowed-tools': { required: false, support: 'supported', platformExtension: false, note: 'Experimental — support varies by agent implementation' },
  },
  installPaths: {
    skill:    { project: '.agents/skills',   user: '~/.agents/skills' },
    subagent: { project: '.agents/agents',   user: '~/.agents/agents' },
    prompt:   { project: '.agents/prompts',  user: '~/.agents/prompts' },
  },
};
