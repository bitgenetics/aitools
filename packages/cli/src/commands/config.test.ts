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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createConfigCommand } from './config.js';

describe('config command', () => {
  let tmp: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-config-'));
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true });
    jest.clearAllMocks();
  });

  describe('set subcommand', () => {
    it('writes a key-value pair to the config file', () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['set', 'platform', 'vscode'], { from: 'user' });
      const config = JSON.parse(fs.readFileSync(path.join(tmp, 'ai-tools.config.json'), 'utf8')) as { platform: string };
      expect(config.platform).toBe('vscode');
    });

    it('updates an existing key', () => {
      fs.writeFileSync(path.join(tmp, 'ai-tools.config.json'), JSON.stringify({ platform: 'cursor' }), 'utf8');
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['set', 'platform', 'vscode'], { from: 'user' });
      const config = JSON.parse(fs.readFileSync(path.join(tmp, 'ai-tools.config.json'), 'utf8')) as { platform: string };
      expect(config.platform).toBe('vscode');
    });
  });

  describe('get subcommand', () => {
    it('prints the value of a set key', () => {
      fs.writeFileSync(path.join(tmp, 'ai-tools.config.json'), JSON.stringify({ platform: 'cursor' }), 'utf8');
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
    it('removes the key from the config file', () => {
      fs.writeFileSync(path.join(tmp, 'ai-tools.config.json'), JSON.stringify({ platform: 'cursor', defaultScope: 'project' }), 'utf8');
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['unset', 'platform'], { from: 'user' });
      const config = JSON.parse(fs.readFileSync(path.join(tmp, 'ai-tools.config.json'), 'utf8')) as Record<string, unknown>;
      expect(config['platform']).toBeUndefined();
      expect(config['defaultScope']).toBe('project');
    });
  });

  describe('list subcommand', () => {
    it('prints merged config with key=value format', () => {
      fs.writeFileSync(path.join(tmp, 'ai-tools.config.json'), JSON.stringify({ platform: 'cursor' }), 'utf8');
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createConfigCommand().parse(['list'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('cursor');
      logSpy.mockRestore();
    });
  });
});