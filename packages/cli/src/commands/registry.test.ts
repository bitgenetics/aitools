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
import type { AiToolsConfig } from '@ai-tools/core';

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
  });
});