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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createConfigCommand } from './config.js';

jest.mock('node:child_process', () => ({
  spawnSync: jest.fn(),
}));

const mockSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

describe('config command', () => {
  let tmp: string;
  let isolatedHome: string;
  const originalCwd = process.cwd();
  let homedirSpy: jest.SpiedFunction<typeof os.homedir>;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-config-'));
    isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-config-home-'));
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(isolatedHome);
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    homedirSpy.mockRestore();
    fs.rmSync(tmp, { recursive: true });
    fs.rmSync(isolatedHome, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('set subcommand', () => {
    it('writes a key-value pair to user config by default', () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['set', 'platform', 'vscode'], { from: 'user' });
      const config = JSON.parse(fs.readFileSync(path.join(isolatedHome, 'aitools.config.json'), 'utf8')) as { platform: string };
      expect(config.platform).toBe('vscode');
    });

    it('writes to project config with --project', () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['set', 'platform', 'vscode', '--project'], { from: 'user' });
      const config = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.config.json'), 'utf8')) as { platform: string };
      expect(config.platform).toBe('vscode');
    });

    it('updates an existing key in project config', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.config.json'), JSON.stringify({ platform: 'cursor' }), 'utf8');
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['set', 'platform', 'vscode', '--project'], { from: 'user' });
      const config = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.config.json'), 'utf8')) as { platform: string };
      expect(config.platform).toBe('vscode');
    });
  });

  describe('get subcommand', () => {
    it('prints the value of a set key', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.config.json'), JSON.stringify({ platform: 'cursor' }), 'utf8');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['get', 'platform'], { from: 'user' });
      expect(logSpy.mock.calls[0]?.[0]).toContain('cursor');
      logSpy.mockRestore();
    });

    it('prints (not set) when the installPaths key has no value in any config', () => {
      // installPaths.user.skill will never be set in any config hierarchy
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['get', 'installPaths.user.skill'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('not set');
      logSpy.mockRestore();
    });
  });

  describe('unset subcommand', () => {
    it('removes the key from user config by default', () => {
      fs.writeFileSync(
        path.join(isolatedHome, 'aitools.config.json'),
        JSON.stringify({ platform: 'cursor', defaultScope: 'project' }),
        'utf8',
      );
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['unset', 'platform'], { from: 'user' });
      const config = JSON.parse(fs.readFileSync(path.join(isolatedHome, 'aitools.config.json'), 'utf8')) as Record<string, unknown>;
      expect(config['platform']).toBeUndefined();
      expect(config['defaultScope']).toBe('project');
    });
  });

  describe('list subcommand', () => {
    it('prints merged config with key=value format', () => {
      fs.writeFileSync(path.join(tmp, 'aitools.config.json'), JSON.stringify({ platform: 'cursor' }), 'utf8');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['list'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('cursor');
      logSpy.mockRestore();
    });

    it('prints registries and installPaths when present', () => {
      fs.writeFileSync(
        path.join(tmp, 'aitools.config.json'),
        JSON.stringify({
          platform: 'cursor',
          registries: [{ name: 'reg', url: 'http://localhost:4873', priority: 1 }],
          installPaths: { 'project.skill': '/custom/skills' },
        }),
        'utf8',
      );
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['list'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('registries');
      expect(output).toContain('installPaths');
      expect(output).toContain('/custom/skills');
      logSpy.mockRestore();
    });
  });

  describe('get subcommand errors', () => {
    function mockExit(): jest.SpiedFunction<typeof process.exit> {
      return jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`process.exit:${code ?? 0}`);
      }) as never);
    }

    it('exits for unknown key', () => {
      const exitSpy = mockExit();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => createConfigCommand().parse(['get', 'bad-key'], { from: 'user' })).toThrow('process.exit:1');
      exitSpy.mockRestore();
    });
  });

  describe('set unknown key', () => {
    function mockExit(): jest.SpiedFunction<typeof process.exit> {
      return jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`process.exit:${code ?? 0}`);
      }) as never);
    }

    it('exits for unknown key', () => {
      const exitSpy = mockExit();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => createConfigCommand().parse(['set', 'bad-key', 'x'], { from: 'user' })).toThrow('process.exit:1');
      exitSpy.mockRestore();
    });
  });

  describe('set validation and installPaths', () => {
    function mockExit(): jest.SpiedFunction<typeof process.exit> {
      return jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`process.exit:${code ?? 0}`);
      }) as never);
    }

    it('exits for invalid platform value', () => {
      const exitSpy = mockExit();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => createConfigCommand().parse(['set', 'platform', 'invalid'], { from: 'user' })).toThrow('process.exit:1');
      exitSpy.mockRestore();
    });

    it('sets installPaths key in user config by default', () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['set', 'installPaths.project.skill', '/tmp/skills'], { from: 'user' });
      const config = JSON.parse(fs.readFileSync(path.join(isolatedHome, 'aitools.config.json'), 'utf8')) as {
        installPaths: Record<string, string>;
      };
      expect(config.installPaths['project.skill']).toBe('/tmp/skills');
    });

    it('sets installPaths in project layer without merging user layer paths', () => {
      fs.writeFileSync(
        path.join(isolatedHome, 'aitools.config.json'),
        JSON.stringify({ installPaths: { 'project.skill': '/user/should-not-appear' } }),
        'utf8',
      );
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['set', 'installPaths.project.skill', '/project/skills', '--project'], {
        from: 'user',
      });
      const userCfg = JSON.parse(fs.readFileSync(path.join(isolatedHome, 'aitools.config.json'), 'utf8')) as {
        installPaths?: Record<string, string>;
      };
      const projectCfg = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.config.json'), 'utf8')) as {
        installPaths: Record<string, string>;
      };
      expect(projectCfg.installPaths['project.skill']).toBe('/project/skills');
      expect(userCfg.installPaths?.['project.skill']).toBe('/user/should-not-appear');
    });

    it('returns project value when user and project both set platform', () => {
      fs.writeFileSync(path.join(isolatedHome, 'aitools.config.json'), JSON.stringify({ platform: 'vscode' }), 'utf8');
      fs.writeFileSync(path.join(tmp, 'aitools.config.json'), JSON.stringify({ platform: 'cursor' }), 'utf8');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['get', 'platform'], { from: 'user' });
      expect(logSpy.mock.calls[0]?.[0]).toContain('cursor');
      logSpy.mockRestore();
    });

    it('sets defaultScope in user config by default', () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['set', 'defaultScope', 'user'], { from: 'user' });
      const config = JSON.parse(fs.readFileSync(path.join(isolatedHome, 'aitools.config.json'), 'utf8')) as {
        defaultScope: string;
      };
      expect(config.defaultScope).toBe('user');
    });

    it('exits when --project and --global are both passed to set', () => {
      const exitSpy = mockExit();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() =>
        createConfigCommand().parse(['set', 'platform', 'vscode', '--project', '--global'], { from: 'user' }),
      ).toThrow('process.exit:1');
      exitSpy.mockRestore();
    });
  });

  describe('unset extended', () => {
    it('unsets installPaths subkey from project config', () => {
      fs.writeFileSync(
        path.join(tmp, 'aitools.config.json'),
        JSON.stringify({ installPaths: { 'project.skill': '/tmp/skills' } }),
        'utf8',
      );
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['unset', 'installPaths.project.skill', '--project'], { from: 'user' });
      const config = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.config.json'), 'utf8')) as Record<string, unknown>;
      expect(config['installPaths']).toBeUndefined();
    });

    it('does nothing when config file is missing', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['unset', 'platform'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('nothing to unset');
      logSpy.mockRestore();
    });

    it('exits for unknown unset key', () => {
      function mockExit(): jest.SpiedFunction<typeof process.exit> {
        return jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
          throw new Error(`process.exit:${code ?? 0}`);
        }) as never);
      }
      const exitSpy = mockExit();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => createConfigCommand().parse(['unset', 'bad-key'], { from: 'user' })).toThrow('process.exit:1');
      exitSpy.mockRestore();
    });

    it('exits when --project and --global are both passed to unset', () => {
      function mockExit(): jest.SpiedFunction<typeof process.exit> {
        return jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
          throw new Error(`process.exit:${code ?? 0}`);
        }) as never);
      }
      const exitSpy = mockExit();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() =>
        createConfigCommand().parse(['unset', 'platform', '--project', '--global'], { from: 'user' }),
      ).toThrow('process.exit:1');
      exitSpy.mockRestore();
    });
  });

  describe('list --global', () => {
    it('shows user config when present', () => {
      fs.writeFileSync(path.join(isolatedHome, 'aitools.config.json'), JSON.stringify({ platform: 'claude' }), 'utf8');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['list', '--global'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('claude');
      logSpy.mockRestore();
    });

    it('reports when user config is missing', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['list', '--global'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('No user config found');
      logSpy.mockRestore();
    });
  });

  describe('edit subcommand', () => {
    function mockExit(): jest.SpiedFunction<typeof process.exit> {
      return jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`process.exit:${code ?? 0}`);
      }) as never);
    }

    beforeEach(() => {
      mockSpawnSync.mockReset();
    });

    it('creates template in user config and opens editor when config is missing', () => {
      mockSpawnSync.mockImplementation((cmd) => {
        if (cmd === 'code') return { status: 0, stdout: '1.0', stderr: '', pid: 1, output: [], signal: null };
        return { status: 0, stdout: '', stderr: '', pid: 1, output: [], signal: null };
      });
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['edit'], { from: 'user' });
      expect(fs.existsSync(path.join(isolatedHome, 'aitools.config.json'))).toBe(true);
    });

    it('exits when editor spawn fails', () => {
      const originalVisual = process.env['VISUAL'];
      process.env['VISUAL'] = 'nano';
      fs.writeFileSync(path.join(isolatedHome, 'aitools.config.json'), '{}', 'utf8');
      mockSpawnSync.mockReturnValue({
        error: new Error('spawn failed'),
        status: null,
        stdout: '',
        stderr: '',
        pid: 1,
        output: [],
        signal: null,
      });
      const exitSpy = mockExit();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'log').mockImplementation(() => {});
      expect(() => createConfigCommand().parse(['edit'], { from: 'user' })).toThrow('process.exit:1');
      exitSpy.mockRestore();
      if (originalVisual) process.env['VISUAL'] = originalVisual;
      else delete process.env['VISUAL'];
    });

    it('uses VISUAL env var when set', () => {
      const originalVisual = process.env['VISUAL'];
      process.env['VISUAL'] = 'nano';
      fs.writeFileSync(path.join(isolatedHome, 'aitools.config.json'), '{}', 'utf8');
      mockSpawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '', pid: 1, output: [], signal: null });
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['edit'], { from: 'user' });
      expect(mockSpawnSync).toHaveBeenCalledWith('nano', expect.any(Array), expect.any(Object));
      if (originalVisual) process.env['VISUAL'] = originalVisual;
      else delete process.env['VISUAL'];
    });

    it('opens config with VS Code when available', () => {
      const originalVisual = process.env['VISUAL'];
      const originalEditor = process.env['EDITOR'];
      delete process.env['VISUAL'];
      delete process.env['EDITOR'];
      fs.writeFileSync(path.join(isolatedHome, 'aitools.config.json'), '{}', 'utf8');
      mockSpawnSync.mockImplementation((cmd) => {
        if (cmd === 'code') return { status: 0, stdout: '1.0', stderr: '', pid: 1, output: [], signal: null };
        return { status: 0, stdout: '', stderr: '', pid: 1, output: [], signal: null };
      });
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['edit'], { from: 'user' });
      expect(mockSpawnSync).toHaveBeenCalledWith('code', ['--wait', path.join(isolatedHome, 'aitools.config.json')], expect.any(Object));
      if (originalVisual) process.env['VISUAL'] = originalVisual;
      if (originalEditor) process.env['EDITOR'] = originalEditor;
    });
  });
});