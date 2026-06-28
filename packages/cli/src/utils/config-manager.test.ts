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
import { ConfigCascade } from '@bitgenetics/aitools-core';
import { ConfigManager, detectPlatformFromEnv } from '../utils/config-manager.js';

describe('ConfigManager.getDefaultScope', () => {
  it('returns "project" when no config files are present', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cm-'));
    const loadSpy = jest.spyOn(ConfigCascade, 'load').mockReturnValue({});
    try {
      expect(new ConfigManager(tmp).getDefaultScope()).toBe('project');
    } finally {
      loadSpy.mockRestore();
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('returns the scope set in the project config', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cm-'));
    try {
      fs.writeFileSync(
        path.join(tmp, 'aitools.config.json'),
        JSON.stringify({ defaultScope: 'user' }),
        'utf8',
      );
      expect(new ConfigManager(tmp).getDefaultScope()).toBe('user');
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
});

describe('ConfigManager.resolveInstallPath', () => {
  let tmp: string;
  let manager: ConfigManager;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cm-'));
    manager = new ConfigManager(tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  it('returns a path under the project directory for project scope', () => {
    const resolved = manager.resolveInstallPath('skill', 'project');
    expect(resolved.startsWith(tmp)).toBe(true);
  });

  it('returns a path under the home directory for user scope', () => {
    const resolved = manager.resolveInstallPath('skill', 'user');
    expect(resolved.startsWith(os.homedir())).toBe(true);
  });

  it('returns different paths for different tool categories in the same scope', () => {
    const skillPath = manager.resolveInstallPath('skill', 'project');
    const subagentPath = manager.resolveInstallPath('subagent', 'project');
    expect(skillPath).not.toBe(subagentPath);
  });

  it('honours an installPaths override from the config file', () => {
    const customPath = path.join(tmp, 'custom-skills');
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ installPaths: { 'project.skill': customPath } }),
      'utf8',
    );
    const overrideManager = new ConfigManager(tmp);
    expect(overrideManager.resolveInstallPath('skill', 'project')).toBe(customPath);
  });
});

describe('ConfigManager.getRegistries', () => {
  let tmp: string;
  let resolveConfigSpy: jest.SpyInstance;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cm-'));
    // Prevent the cascade from walking up into ancestor dirs (e.g. the real ~/aitools.config.json)
    resolveConfigSpy = jest.spyOn(ConfigCascade, 'resolveConfigFiles')
      .mockImplementation((cwd: string) => [path.join(cwd, 'aitools.config.json')]);
  });

  afterEach(() => {
    resolveConfigSpy.mockRestore();
    fs.rmSync(tmp, { recursive: true });
  });

  it('returns an empty array when no registries are configured', () => {
    expect(new ConfigManager(tmp).getRegistries()).toEqual([]);
  });

  it('sorts registries by priority ascending so lower numbers are queried first', () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({
        registries: [
          { name: 'low-priority', url: 'https://low.example.com', priority: 200 },
          { name: 'high-priority', url: 'https://high.example.com', priority: 50 },
        ],
      }),
      'utf8',
    );
    const sorted = new ConfigManager(tmp).getRegistries();
    expect(sorted[0]?.name).toBe('high-priority');
    expect(sorted[1]?.name).toBe('low-priority');
  });

  it('treats registries without a priority as priority 100', () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({
        registries: [
          { name: 'no-priority', url: 'https://a.example.com' },
          { name: 'explicit-50', url: 'https://b.example.com', priority: 50 },
        ],
      }),
      'utf8',
    );
    const sorted = new ConfigManager(tmp).getRegistries();
    expect(sorted[0]?.name).toBe('explicit-50');
  });
});

describe('ConfigManager layer reads', () => {
  let tmp: string;
  let isolatedHome: string;
  let homedirSpy: jest.SpiedFunction<typeof os.homedir>;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cm-layers-'));
    isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cm-home-'));
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(isolatedHome);
    process.env['AITOOLS_CONFIG_ROOT'] = tmp;
  });

  afterEach(() => {
    homedirSpy.mockRestore();
    delete process.env['AITOOLS_CONFIG_ROOT'];
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(isolatedHome, { recursive: true, force: true });
  });

  it('readUserConfig returns only the home file contents', () => {
    fs.writeFileSync(
      path.join(isolatedHome, 'aitools.config.json'),
      JSON.stringify({ platform: 'claude' }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'cursor' }),
      'utf8',
    );
    expect(new ConfigManager(tmp).readUserConfig().platform).toBe('claude');
  });

  it('readProjectConfig returns only the project file contents', () => {
    fs.writeFileSync(
      path.join(isolatedHome, 'aitools.config.json'),
      JSON.stringify({ platform: 'claude' }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'cursor' }),
      'utf8',
    );
    expect(new ConfigManager(tmp).readProjectConfig().platform).toBe('cursor');
  });

  it('get merges project over user for effective reads', () => {
    fs.writeFileSync(
      path.join(isolatedHome, 'aitools.config.json'),
      JSON.stringify({ platform: 'claude', defaultScope: 'user' }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'cursor' }),
      'utf8',
    );
    const manager = new ConfigManager(tmp);
    expect(manager.get().platform).toBe('cursor');
    expect(manager.getDefaultScope()).toBe('user');
  });
});

describe('detectPlatformFromEnv', () => {
  let tmp: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-detect-'));
    for (const key of ['VSCODE_PID', 'TERM_PROGRAM', 'CURSOR_TRACE_ID']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    fs.rmSync(tmp, { recursive: true });
  });

  it('returns "vscode" when VSCODE_PID is set', () => {
    process.env['VSCODE_PID'] = '12345';
    expect(detectPlatformFromEnv(tmp)).toBe('vscode');
  });

  it('returns "vscode" when TERM_PROGRAM is "vscode"', () => {
    process.env['TERM_PROGRAM'] = 'vscode';
    expect(detectPlatformFromEnv(tmp)).toBe('vscode');
  });

  it('returns "cursor" when CURSOR_TRACE_ID is set', () => {
    process.env['CURSOR_TRACE_ID'] = 'some-trace-id';
    expect(detectPlatformFromEnv(tmp)).toBe('cursor');
  });

  it('returns "vscode" when .vscode/ directory exists and no env vars are set', () => {
    fs.mkdirSync(path.join(tmp, '.vscode'));
    expect(detectPlatformFromEnv(tmp)).toBe('vscode');
  });

  it('returns "cursor" when .cursor/ directory exists and no env vars are set', () => {
    fs.mkdirSync(path.join(tmp, '.cursor'));
    expect(detectPlatformFromEnv(tmp)).toBe('cursor');
  });

  it('returns undefined when no signals are present', () => {
    expect(detectPlatformFromEnv(tmp)).toBeUndefined();
  });

  it('prefers VSCODE_PID over .cursor/ directory', () => {
    process.env['VSCODE_PID'] = '1';
    fs.mkdirSync(path.join(tmp, '.cursor'));
    expect(detectPlatformFromEnv(tmp)).toBe('vscode');
  });
});

describe('ConfigManager.detectedPlatform', () => {
  let tmp: string;
  const savedEnv: Record<string, string | undefined> = {};
  let resolveConfigSpy: jest.SpyInstance;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-dp-'));
    for (const key of ['VSCODE_PID', 'TERM_PROGRAM', 'CURSOR_TRACE_ID']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    // Isolate from ancestor/user configs so platform is never set by cascade
    resolveConfigSpy = jest.spyOn(ConfigCascade, 'resolveConfigFiles')
      .mockImplementation((cwd: string) => [path.join(cwd, 'aitools.config.json')]);
  });

  afterEach(() => {
    resolveConfigSpy.mockRestore();
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    fs.rmSync(tmp, { recursive: true });
  });

  it('is undefined when platform is explicitly configured', () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'vscode' }),
      'utf8',
    );
    process.env['VSCODE_PID'] = '1';
    expect(new ConfigManager(tmp).detectedPlatform).toBeUndefined();
  });

  it('is set and routes to the correct adapter when auto-detected via VSCODE_PID', () => {
    process.env['VSCODE_PID'] = '1';
    const cm = new ConfigManager(tmp);
    expect(cm.detectedPlatform).toBe('vscode');
    expect(cm.getPlatform()).toBe('vscode');
    // subagents should go to .github/agents/ not .agents/agents/
    const subagentPath = cm.resolveInstallPath('subagent', 'project');
    expect(subagentPath).toContain('.github');
  });

  it('is undefined and falls back to universal when no signals exist', () => {
    const cm = new ConfigManager(tmp);
    expect(cm.detectedPlatform).toBeUndefined();
    expect(cm.getPlatform()).toBe('universal');
  });
});
