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
import os from 'node:os';
import path from 'node:path';
import { ClaudeAdapter } from './claude.js';
import { CursorAdapter } from './cursor.js';
import { WindsurfAdapter } from './windsurf.js';
import { UniversalAdapter } from './universal.js';
import { VsCodeAdapter } from './vscode.js';

// Use path.resolve so Windows drive letters are included consistently
const CWD = path.resolve('/projects/my-project');
const HOME = os.homedir();

describe('ClaudeAdapter', () => {
  const adapter = new ClaudeAdapter();

  describe('resolveDir()', () => {
    it('returns .claude/skills/ relative to cwd for project-scope skill', () => {
      expect(adapter.resolveDir('skill', 'project', CWD)).toBe(
        path.join(CWD, '.claude', 'skills'),
      );
    });

    it('returns .claude/agents/ relative to cwd for project-scope subagent', () => {
      expect(adapter.resolveDir('subagent', 'project', CWD)).toBe(
        path.join(CWD, '.claude', 'agents'),
      );
    });

    it('returns .claude/commands/ relative to cwd for project-scope prompt', () => {
      expect(adapter.resolveDir('prompt', 'project', CWD)).toBe(
        path.join(CWD, '.claude', 'commands'),
      );
    });

    it('returns ~/.claude/skills/ for user-scope skill', () => {
      expect(adapter.resolveDir('skill', 'user', CWD)).toBe(
        path.join(HOME, '.claude', 'skills'),
      );
    });

    it('returns ~/.claude/agents/ for user-scope subagent', () => {
      expect(adapter.resolveDir('subagent', 'user', CWD)).toBe(
        path.join(HOME, '.claude', 'agents'),
      );
    });
  });

  describe('resolveMcpConfig()', () => {
    it('returns .mcp.json at project root for project scope', () => {
      expect(adapter.resolveMcpConfig('project', CWD)).toBe(path.join(CWD, '.mcp.json'));
    });

    it('returns ~/.claude/mcp.json for user scope', () => {
      expect(adapter.resolveMcpConfig('user', CWD)).toBe(
        path.join(HOME, '.claude', 'mcp.json'),
      );
    });
  });
});

describe('CursorAdapter', () => {
  const adapter = new CursorAdapter();

  describe('resolveDir()', () => {
    it('returns .agents/skills/ for project-scope skill', () => {
      expect(adapter.resolveDir('skill', 'project', CWD)).toBe(
        path.join(CWD, '.agents', 'skills'),
      );
    });

    it('returns ~/.aitools/tools/skills/ for user-scope skill', () => {
      expect(adapter.resolveDir('skill', 'user', CWD)).toBe(
        path.join(HOME, '.aitools', 'tools', 'skills'),
      );
    });
  });

  describe('resolveMcpConfig()', () => {
    it('returns .cursor/mcp.json at project root for project scope', () => {
      expect(adapter.resolveMcpConfig('project', CWD)).toBe(
        path.join(CWD, '.cursor', 'mcp.json'),
      );
    });

    it('returns ~/.cursor/mcp.json for user scope', () => {
      expect(adapter.resolveMcpConfig('user', CWD)).toBe(
        path.join(HOME, '.cursor', 'mcp.json'),
      );
    });
  });
});

describe('WindsurfAdapter', () => {
  const adapter = new WindsurfAdapter();

  describe('resolveDir()', () => {
    it('returns .windsurf/skills/ for project-scope skill', () => {
      expect(adapter.resolveDir('skill', 'project', CWD)).toBe(
        path.join(CWD, '.windsurf', 'skills'),
      );
    });

    it('returns .windsurf/rules/ for project-scope prompt', () => {
      expect(adapter.resolveDir('prompt', 'project', CWD)).toBe(
        path.join(CWD, '.windsurf', 'rules'),
      );
    });

    it('returns ~/.windsurf/skills/ for user-scope skill', () => {
      expect(adapter.resolveDir('skill', 'user', CWD)).toBe(
        path.join(HOME, '.windsurf', 'skills'),
      );
    });
  });

  describe('resolveMcpConfig()', () => {
    it('returns .windsurf/mcp.json at project root for project scope', () => {
      expect(adapter.resolveMcpConfig('project', CWD)).toBe(
        path.join(CWD, '.windsurf', 'mcp.json'),
      );
    });

    it('returns ~/.windsurf/mcp.json for user scope', () => {
      expect(adapter.resolveMcpConfig('user', CWD)).toBe(
        path.join(HOME, '.windsurf', 'mcp.json'),
      );
    });
  });
});

describe('UniversalAdapter', () => {
  const adapter = new UniversalAdapter();

  describe('resolveDir()', () => {
    it('returns .agents/skills/ for project-scope skill', () => {
      expect(adapter.resolveDir('skill', 'project', CWD)).toBe(
        path.join(CWD, '.agents', 'skills'),
      );
    });

    it('returns ~/.aitools/tools/skills/ for user-scope skill', () => {
      expect(adapter.resolveDir('skill', 'user', CWD)).toBe(
        path.join(HOME, '.aitools', 'tools', 'skills'),
      );
    });

    it('returns .agents/agents/ for project-scope subagent', () => {
      expect(adapter.resolveDir('subagent', 'project', CWD)).toBe(
        path.join(CWD, '.agents', 'agents'),
      );
    });
  });

  describe('resolveMcpConfig()', () => {
    it('returns .agents/mcp.json at project root for project scope', () => {
      expect(adapter.resolveMcpConfig('project', CWD)).toBe(
        path.join(CWD, '.agents', 'mcp.json'),
      );
    });

    it('returns ~/.aitools/mcp.json for user scope', () => {
      expect(adapter.resolveMcpConfig('user', CWD)).toBe(
        path.join(HOME, '.aitools', 'mcp.json'),
      );
    });
  });
});

describe('VsCodeAdapter', () => {
  const adapter = new VsCodeAdapter();

  describe('resolveDir()', () => {
    it('returns .agents/skills/ for project-scope skill', () => {
      expect(adapter.resolveDir('skill', 'project', CWD)).toBe(
        path.join(CWD, '.agents', 'skills'),
      );
    });

    it('returns ~/.copilot/skills/ for user-scope skill', () => {
      expect(adapter.resolveDir('skill', 'user', CWD)).toBe(
        path.join(HOME, '.copilot', 'skills'),
      );
    });

    it('returns .github/agents/ for project-scope subagent', () => {
      expect(adapter.resolveDir('subagent', 'project', CWD)).toBe(
        path.join(CWD, '.github', 'agents'),
      );
    });
  });

  describe('resolveMcpConfig()', () => {
    it('returns .vscode/mcp.json at project root for project scope', () => {
      expect(adapter.resolveMcpConfig('project', CWD)).toBe(
        path.join(CWD, '.vscode', 'mcp.json'),
      );
    });

    it('returns ~/.vscode/mcp.json for user scope', () => {
      expect(adapter.resolveMcpConfig('user', CWD)).toBe(
        path.join(HOME, '.vscode', 'mcp.json'),
      );
    });
  });
});
