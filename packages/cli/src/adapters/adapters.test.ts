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
import os from 'node:os';
import path from 'node:path';
import { ClaudeAdapter } from './claude.js';
import { CursorAdapter } from './cursor.js';
import { WindsurfAdapter } from './windsurf.js';
import { UniversalAdapter } from './universal.js';
import { VsCodeAdapter, resolveVsCodeUserMcpConfig } from './vscode.js';
import { getAdapter } from './index.js';
import { resolveFileCategory } from './types.js';

const CWD = path.resolve('/projects/my-project');
const HOME = os.homedir();

describe('ClaudeAdapter', () => {
  const adapter = new ClaudeAdapter();

  it('returns .claude/rules/ for project-scope rule', () => {
    expect(adapter.resolveDir('rule', 'project', CWD)).toBe(path.join(CWD, '.claude', 'rules'));
  });

  it('returns user-scope skill path', () => {
    expect(adapter.resolveDir('skill', 'user', CWD)).toBe(path.join(HOME, '.claude', 'skills'));
  });

  it('returns .claude/agents/ for project-scope agent', () => {
    expect(adapter.resolveDir('agent', 'project', CWD)).toBe(path.join(CWD, '.claude', 'agents'));
  });

  it('maps subagent alias to agents path', () => {
    expect(adapter.resolveDir('subagent', 'project', CWD)).toBe(path.join(CWD, '.claude', 'agents'));
  });

  it('returns settings.json for hooks config', () => {
    expect(adapter.resolveHooksConfig('project', CWD)).toBe(path.join(CWD, '.claude', 'settings.json'));
  });

  it('returns user-scope hooks config', () => {
    expect(adapter.resolveHooksConfig('user', CWD)).toBe(path.join(HOME, '.claude', 'settings.json'));
  });

  it('returns user-scope mcp config path', () => {
    expect(adapter.resolveMcpConfig('user', CWD)).toBe(path.join(HOME, '.claude.json'));
  });

  it('returns project-scope mcp config path', () => {
    expect(adapter.resolveMcpConfig('project', CWD)).toBe(path.join(CWD, '.mcp.json'));
  });
});

describe('CursorAdapter', () => {
  const adapter = new CursorAdapter();

  it('returns .cursor/rules/ for project-scope rule', () => {
    expect(adapter.resolveDir('rule', 'project', CWD)).toBe(path.join(CWD, '.cursor', 'rules'));
  });

  it('returns .cursor/commands/ for project-scope command', () => {
    expect(adapter.resolveDir('command', 'project', CWD)).toBe(path.join(CWD, '.cursor', 'commands'));
  });

  it('returns hooks.json for hooks config', () => {
    expect(adapter.resolveHooksConfig('project', CWD)).toBe(path.join(CWD, '.cursor', 'hooks.json'));
  });

  it('returns user-scope hooks config', () => {
    expect(adapter.resolveHooksConfig('user', CWD)).toBe(path.join(HOME, '.cursor', 'hooks.json'));
  });

  it('returns user-scope skill, command, and agent paths', () => {
    expect(adapter.resolveDir('skill', 'user', CWD)).toBe(path.join(HOME, '.cursor', 'skills'));
    expect(adapter.resolveDir('command', 'user', CWD)).toBe(path.join(HOME, '.cursor', 'commands'));
    expect(adapter.resolveDir('agent', 'user', CWD)).toBe(path.join(HOME, '.cursor', 'agents'));
  });

  it('returns user-scope rule path', () => {
    expect(adapter.resolveDir('rule', 'user', CWD)).toBe(path.join(HOME, '.cursor', 'rules'));
  });

  it('returns project and user mcp config paths', () => {
    expect(adapter.resolveMcpConfig('project', CWD)).toBe(path.join(CWD, '.cursor', 'mcp.json'));
    expect(adapter.resolveMcpConfig('user', CWD)).toBe(path.join(HOME, '.cursor', 'mcp.json'));
  });
});

describe('WindsurfAdapter', () => {
  const adapter = new WindsurfAdapter();

  it('returns .devin/rules/ for project-scope rule', () => {
    expect(adapter.resolveDir('rule', 'project', CWD)).toBe(path.join(CWD, '.devin', 'rules'));
  });

  it('returns .windsurf/workflows/ for project-scope command', () => {
    expect(adapter.resolveDir('command', 'project', CWD)).toBe(path.join(CWD, '.windsurf', 'workflows'));
  });

  it('returns user-scope hooks config', () => {
    expect(adapter.resolveHooksConfig('user', CWD)).toBe(path.join(HOME, '.windsurf', 'hooks.json'));
  });

  it('returns project-scope hooks config', () => {
    expect(adapter.resolveHooksConfig('project', CWD)).toBe(path.join(CWD, '.windsurf', 'hooks.json'));
  });

  it('returns user-scope command path', () => {
    expect(adapter.resolveDir('command', 'user', CWD)).toBe(path.join(HOME, '.windsurf', 'workflows'));
  });

  it('returns project and user mcp config paths', () => {
    expect(adapter.resolveMcpConfig('project', CWD)).toBe(path.join(CWD, '.windsurf', 'mcp.json'));
    expect(adapter.resolveMcpConfig('user', CWD)).toBe(path.join(HOME, '.windsurf', 'mcp.json'));
  });
});

describe('UniversalAdapter', () => {
  const adapter = new UniversalAdapter();

  it('returns null for hooks config', () => {
    expect(adapter.resolveHooksConfig('project', CWD)).toBeNull();
  });

  it('returns .agents/commands/ for project-scope command', () => {
    expect(adapter.resolveDir('command', 'project', CWD)).toBe(path.join(CWD, '.agents', 'commands'));
  });

  it('returns user-scope skill path', () => {
    expect(adapter.resolveDir('skill', 'user', CWD)).toBe(path.join(HOME, '.aitools', 'tools', 'skills'));
  });

  it('returns universal mcp config paths', () => {
    expect(adapter.resolveMcpConfig('project', CWD)).toBe(path.join(CWD, '.agents', 'mcp.json'));
    expect(adapter.resolveMcpConfig('user', CWD)).toBe(path.join(HOME, '.aitools', 'mcp.json'));
  });
});

describe('VsCodeAdapter', () => {
  const adapter = new VsCodeAdapter();

  it('returns .github/instructions/ for project-scope rule', () => {
    expect(adapter.resolveDir('rule', 'project', CWD)).toBe(path.join(CWD, '.github', 'instructions'));
  });

  it('returns .github/prompts/ for project-scope command', () => {
    expect(adapter.resolveDir('command', 'project', CWD)).toBe(path.join(CWD, '.github', 'prompts'));
  });

  it('returns .github/agents/ for project-scope agent', () => {
    expect(adapter.resolveDir('agent', 'project', CWD)).toBe(path.join(CWD, '.github', 'agents'));
  });

  it('returns user-scope mcp config path', () => {
    expect(adapter.resolveMcpConfig('user', CWD)).toBe(resolveVsCodeUserMcpConfig());
  });

  it('resolveVsCodeUserMcpConfig uses platform profile paths', () => {
    const home = path.join(path.sep, 'Users', 'dev');
    const originalPlatform = process.platform;
    const originalAppData = process.env.APPDATA;
    try {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      expect(resolveVsCodeUserMcpConfig(home)).toBe(
        path.join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'),
      );
      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(resolveVsCodeUserMcpConfig(home)).toBe(
        path.join(home, '.config', 'Code', 'User', 'mcp.json'),
      );
      Object.defineProperty(process, 'platform', { value: 'win32' });
      delete process.env.APPDATA;
      expect(resolveVsCodeUserMcpConfig(home)).toBe(
        path.join(home, 'AppData', 'Roaming', 'Code', 'User', 'mcp.json'),
      );
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      if (originalAppData === undefined) delete process.env.APPDATA;
      else process.env.APPDATA = originalAppData;
    }
  });

  it('returns user-scope skill and agent paths under ~/.copilot', () => {
    expect(adapter.resolveDir('skill', 'user', CWD)).toBe(path.join(HOME, '.copilot', 'skills'));
    expect(adapter.resolveDir('agent', 'user', CWD)).toBe(path.join(HOME, '.copilot', 'agents'));
    expect(adapter.resolveDir('command', 'user', CWD)).toBe(path.join(HOME, '.copilot', 'prompts'));
  });

  it('returns project-scope mcp config path', () => {
    expect(adapter.resolveMcpConfig('project', CWD)).toBe(path.join(CWD, '.vscode', 'mcp.json'));
  });

  it('returns project-scope hooks config', () => {
    expect(adapter.resolveHooksConfig('project', CWD)).toBe(path.join(CWD, '.github', 'hooks', 'hooks.json'));
  });

  it('returns user-scope hooks config', () => {
    expect(adapter.resolveHooksConfig('user', CWD)).toBe(path.join(HOME, '.copilot', 'hooks', 'hooks.json'));
  });
});

describe('getAdapter', () => {
  it('returns universal adapter by default', () => {
    expect(getAdapter().platform).toBe('universal');
  });

  it('returns platform-specific adapters', () => {
    expect(getAdapter('cursor').platform).toBe('cursor');
    expect(getAdapter('windsurf').platform).toBe('windsurf');
    expect(getAdapter('claude').platform).toBe('claude');
    expect(getAdapter('vscode').platform).toBe('vscode');
  });
});

describe('resolveFileCategory', () => {
  it('maps deprecated subagent alias to agent directories', () => {
    expect(resolveFileCategory('subagent')).toBe('agent');
  });

  it('throws for non file-based categories', () => {
    expect(() => resolveFileCategory('hook' as never)).toThrow('not file-based');
  });
});
