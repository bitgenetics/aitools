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
import {
  loadCursorPluginJsonFromCwd,
  resolvePluginBundleHooksConfig,
  resolvePluginBundleInstallBase,
  resolvePluginBundleMcpConfig,
} from './plugin-bundle-install.js';

describe('plugin-bundle-install', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-bundle-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  describe('resolvePluginBundleInstallBase', () => {
    it('resolves default skill root under cwd', () => {
      expect(resolvePluginBundleInstallBase('skill', tmp)).toBe(path.resolve(tmp, 'skills'));
    });

    it('resolves rule, command, and agent defaults', () => {
      expect(resolvePluginBundleInstallBase('rule', tmp)).toBe(path.resolve(tmp, 'rules'));
      expect(resolvePluginBundleInstallBase('command', tmp)).toBe(path.resolve(tmp, 'commands'));
      expect(resolvePluginBundleInstallBase('agent', tmp)).toBe(path.resolve(tmp, 'agents'));
    });

    it('respects plugin.json path overrides', () => {
      const base = resolvePluginBundleInstallBase('skill', tmp, {
        skills: 'custom-skills/',
      });
      expect(base).toBe(path.resolve(tmp, 'custom-skills'));
    });
  });

  describe('resolvePluginBundleMcpConfig', () => {
    it('defaults to mcp.json at project root', () => {
      expect(resolvePluginBundleMcpConfig(tmp)).toBe(path.resolve(tmp, 'mcp.json'));
    });

    it('respects mcpServers string override', () => {
      expect(resolvePluginBundleMcpConfig(tmp, { mcpServers: 'config/mcp.json' })).toBe(
        path.resolve(tmp, 'config/mcp.json'),
      );
    });
  });

  describe('resolvePluginBundleHooksConfig', () => {
    it('defaults to hooks/hooks.json', () => {
      expect(resolvePluginBundleHooksConfig(tmp)).toBe(path.resolve(tmp, 'hooks', 'hooks.json'));
    });

    it('uses hooks file path when plugin.json points at a json file', () => {
      expect(resolvePluginBundleHooksConfig(tmp, { hooks: 'hooks/hooks.json' })).toBe(
        path.resolve(tmp, 'hooks/hooks.json'),
      );
    });
  });

  describe('loadCursorPluginJsonFromCwd', () => {
    it('returns null when descriptor is missing', () => {
      expect(loadCursorPluginJsonFromCwd(tmp)).toBeNull();
    });

    it('parses descriptor when present', () => {
      fs.mkdirSync(path.join(tmp, '.cursor-plugin'), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, '.cursor-plugin', 'plugin.json'),
        JSON.stringify({ name: 'demo', skills: 'skills/' }),
        'utf8',
      );
      expect(loadCursorPluginJsonFromCwd(tmp)).toEqual({ name: 'demo', skills: 'skills/' });
    });
  });
});
