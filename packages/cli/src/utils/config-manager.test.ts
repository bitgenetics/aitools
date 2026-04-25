import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigManager } from '../utils/config-manager.js';

describe('ConfigManager.getDefaultScope', () => {
  it('returns "project" when no config files are present', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-cm-'));
    try {
      expect(new ConfigManager(tmp).getDefaultScope()).toBe('project');
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('returns the scope set in the project config', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-cm-'));
    try {
      fs.writeFileSync(
        path.join(tmp, 'ai-tools.config.json'),
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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-cm-'));
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
      path.join(tmp, 'ai-tools.config.json'),
      JSON.stringify({ installPaths: { 'project.skill': customPath } }),
      'utf8',
    );
    const overrideManager = new ConfigManager(tmp);
    expect(overrideManager.resolveInstallPath('skill', 'project')).toBe(customPath);
  });
});

describe('ConfigManager.getRegistries', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-cm-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  it('returns an empty array when no registries are configured', () => {
    expect(new ConfigManager(tmp).getRegistries()).toEqual([]);
  });

  it('sorts registries by priority ascending so lower numbers are queried first', () => {
    fs.writeFileSync(
      path.join(tmp, 'ai-tools.config.json'),
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
      path.join(tmp, 'ai-tools.config.json'),
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

