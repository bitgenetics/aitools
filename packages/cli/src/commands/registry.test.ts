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
import { createRegistryCommand } from './registry.js';
import { ConfigManager } from '../utils/config-manager.js';
import type { AiToolsConfig } from '@aitools/core';

jest.mock('../utils/config-manager.js');

function makeMockConfigManager(initialRegistries: AiToolsConfig['registries'] = []) {
  let currentRegistries = [...(initialRegistries ?? [])];
  const mockWriteProjectConfig = jest.fn((patch: Partial<AiToolsConfig>) => {
    if (patch.registries !== undefined) {
      currentRegistries = patch.registries;
    }
  });
  const instance = {
    get: jest.fn(() => ({ registries: currentRegistries })),
    getRegistries: jest.fn(() => [...(currentRegistries ?? [])]),
    writeProjectConfig: mockWriteProjectConfig,
    writeUserConfig: jest.fn(),
    getDefaultScope: jest.fn(() => 'project' as const),
    getPlatform: jest.fn(() => 'universal' as const),
    resolveInstallPath: jest.fn(),
    resolveMcpConfig: jest.fn(),
    getAdapter: jest.fn(),
    _getWrittenRegistries: () => currentRegistries,
  };
  (ConfigManager as jest.Mock).mockImplementation(() => instance);
  return instance;
}

afterEach(() => jest.clearAllMocks());

describe('registry command', () => {
  describe('add subcommand', () => {
    it('adds a registry with the given name and URL', () => {
      const mock = makeMockConfigManager([]);
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['add', 'http://registry.example.com', '--name', 'my-reg'], { from: 'user' });
      const written = mock._getWrittenRegistries();
      expect(written).toContainEqual(expect.objectContaining({ name: 'my-reg', url: 'http://registry.example.com' }));
    });

    it('derives registry name from ssh git URL when name is omitted', () => {
      const mock = makeMockConfigManager([]);
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['add', 'git@github.com:org/registry.git', '--type', 'git'], { from: 'user' });
      const written = mock._getWrittenRegistries();
      expect(written?.[0]?.name).toBe('github.com');
    });

    it('derives a fallback registry name from malformed urls', () => {
      const mock = makeMockConfigManager([]);
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['add', '!!!not-a-url!!!', '--type', 'git'], { from: 'user' });
      const written = mock._getWrittenRegistries();
      expect(written?.[0]?.name).toBeTruthy();
    });

    it('appends to existing registries', () => {
      const mock = makeMockConfigManager([{ name: 'existing', url: 'http://existing.example.com' }]);
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['add', 'http://new.example.com', '--name', 'new-reg'], { from: 'user' });
      const written = mock._getWrittenRegistries();
      expect(written).toContainEqual(expect.objectContaining({ name: 'existing' }));
      expect(written).toContainEqual(expect.objectContaining({ name: 'new-reg' }));
    });

    it('updates an existing registry when name already present', () => {
      const mock = makeMockConfigManager([{ name: 'my-reg', url: 'http://old.example.com' }]);
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['add', 'http://new.example.com', '--name', 'my-reg'], { from: 'user' });
      const written = mock._getWrittenRegistries();
      const reg = written?.find((r: { name: string }) => r.name === 'my-reg');
      expect(reg?.url).toBe('http://new.example.com');
    });

    it('adds a git registry with branch and path options', () => {
      const mock = makeMockConfigManager([]);
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(
        [
          'add',
          'git@github.com:org/registry.git',
          '--name',
          'team-tools',
          '--type',
          'git',
          '--read-branch',
          'main',
          '--publish-branch',
          'releases',
          '--path',
          'packages/registry/',
        ],
        { from: 'user' },
      );
      const written = mock._getWrittenRegistries();
      expect(written).toContainEqual(
        expect.objectContaining({
          type: 'git',
          name: 'team-tools',
          url: 'git@github.com:org/registry.git',
          readBranch: 'main',
          publishBranch: 'releases',
          path: 'packages/registry/',
        }),
      );
    });
  });

  describe('remove subcommand', () => {
    it('removes a registry from the config', () => {
      const mock = makeMockConfigManager([{ name: 'my-reg', url: 'http://my.example.com' }]);
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['remove', 'my-reg'], { from: 'user' });
      const written = mock._getWrittenRegistries();
      expect(written?.find((r: { name: string }) => r.name === 'my-reg')).toBeUndefined();
    });

    it('logs a "not found" warning when registry does not exist', () => {
      makeMockConfigManager([]);
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['remove', 'ghost-reg'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output.toLowerCase()).toContain('not found');
      logSpy.mockRestore();
    });
  });

  describe('list subcommand', () => {
    it('prints configured registries', () => {
      makeMockConfigManager([{ name: 'my-reg', url: 'http://my.example.com' }]);
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['list'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('my-reg');
      logSpy.mockRestore();
    });

    it('prints a message when no registries are configured', () => {
      makeMockConfigManager([]);
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['list'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output.toLowerCase()).toContain('no registr');
      logSpy.mockRestore();
    });

    it('prints git registry details including branches and path', () => {
      makeMockConfigManager([
        {
          type: 'git',
          name: 'git-reg',
          url: 'git@github.com:org/registry.git',
          readBranch: 'main',
          publishBranch: 'releases',
          path: 'packages/',
          priority: 5,
        },
      ]);
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['list'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('git-reg');
      expect(output).toContain('read branch: main');
      expect(output).toContain('publish branch: releases');
      expect(output).toContain('path: packages/');
      expect(output).toContain('priority: 5');
      logSpy.mockRestore();
    });

    it('prints priority for http registries when set', () => {
      makeMockConfigManager([{ name: 'pri-reg', url: 'http://x.example.com', priority: 2 }]);
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['list'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('priority: 2');
      logSpy.mockRestore();
    });

    it('prints http registry auth type when configured', () => {
      makeMockConfigManager([
        {
          type: 'http',
          name: 'auth-reg',
          url: 'http://secure.example.com',
          auth: { type: 'bearer', token: 'secret' },
        },
      ]);
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['list'], { from: 'user' });
      const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
      expect(output).toContain('auth: bearer');
      logSpy.mockRestore();
    });
  });

  describe('add validation', () => {
    function mockExit(): jest.SpiedFunction<typeof process.exit> {
      return jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`process.exit:${code ?? 0}`);
      }) as never);
    }

    it('exits for invalid registry type', () => {
      makeMockConfigManager([]);
      const exitSpy = mockExit();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() =>
        createRegistryCommand().parse(['add', 'http://x.com', '--type', 'ftp'], { from: 'user' }),
      ).toThrow('process.exit:1');
      exitSpy.mockRestore();
    });

    it('exits when token is passed for git registry', () => {
      makeMockConfigManager([]);
      const exitSpy = mockExit();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() =>
        createRegistryCommand().parse(
          ['add', 'git@github.com:org/r.git', '--type', 'git', '--token', 'x'],
          { from: 'user' },
        ),
      ).toThrow('process.exit:1');
      exitSpy.mockRestore();
    });

    it('adds http registry with bearer token', () => {
      const mock = makeMockConfigManager([]);
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(
        ['add', 'http://secure.example.com', '--name', 'secure', '--token', 'tok'],
        { from: 'user' },
      );
      const written = mock._getWrittenRegistries();
      expect(written?.[0]).toEqual(
        expect.objectContaining({
          auth: { type: 'bearer', token: 'tok' },
        }),
      );
    });

    it('writes to user config with --global', () => {
      const mock = makeMockConfigManager([]);
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['add', 'http://global.example.com', '--name', 'global-reg', '--global'], {
        from: 'user',
      });
      expect(mock.writeUserConfig).toHaveBeenCalled();
    });
  });

  describe('remove global', () => {
    it('removes registry from user config with --global', () => {
      const mock = makeMockConfigManager([{ name: 'my-reg', url: 'http://my.example.com' }]);
      jest.spyOn(console, 'log').mockImplementation(() => {});
      createRegistryCommand().parse(['remove', 'my-reg', '--global'], { from: 'user' });
      expect(mock.writeUserConfig).toHaveBeenCalled();
    });
  });
});