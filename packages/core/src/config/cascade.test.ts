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
import { ConfigCascade } from '../config/cascade.js';

describe('ConfigCascade.merge', () => {
  it('returns an empty config when given no layers', () => {
    expect(ConfigCascade.merge([])).toEqual({});
  });

  it('uses the last layer value for defaultScope', () => {
    const result = ConfigCascade.merge([
      { defaultScope: 'user' },
      { defaultScope: 'project' },
    ]);
    expect(result.defaultScope).toBe('project');
  });

  it('uses a single layer defaultScope unchanged', () => {
    const result = ConfigCascade.merge([{ defaultScope: 'user' }]);
    expect(result.defaultScope).toBe('user');
  });

  it('merges installPaths so later layers override earlier keys', () => {
    const result = ConfigCascade.merge([
      { installPaths: { 'project.skill': '/base' } },
      { installPaths: { 'project.skill': '/override', 'user.skill': '/user' } },
    ]);
    expect(result.installPaths).toEqual({
      'project.skill': '/override',
      'user.skill': '/user',
    });
  });

  it('prepends higher-priority registries so they are queried first', () => {
    const result = ConfigCascade.merge([
      { registries: [{ name: 'base', url: 'https://base.example.com' }] },
      { registries: [{ name: 'project', url: 'https://project.example.com' }] },
    ]);
    expect(result.registries?.[0]?.name).toBe('project');
    expect(result.registries?.[1]?.name).toBe('base');
  });

  it('deduplicates registries by name, keeping the higher-priority entry', () => {
    const result = ConfigCascade.merge([
      { registries: [{ name: 'shared', url: 'https://old.example.com' }] },
      { registries: [{ name: 'shared', url: 'https://new.example.com' }] },
    ]);
    expect(result.registries).toHaveLength(1);
    expect(result.registries?.[0]?.url).toBe('https://new.example.com');
  });

  it('accumulates registries from multiple layers without duplication', () => {
    const result = ConfigCascade.merge([
      { registries: [{ name: 'a', url: 'https://a.example.com' }] },
      { registries: [{ name: 'b', url: 'https://b.example.com' }] },
      { registries: [{ name: 'c', url: 'https://c.example.com' }] },
    ]);
    expect(result.registries).toHaveLength(3);
  });

  it('merges platform so the project layer overrides the base', () => {
    const result = ConfigCascade.merge([{ platform: 'claude' }, { platform: 'vscode' }]);
    expect(result.platform).toBe('vscode');
  });

  it('picks up platform from a single layer', () => {
    const result = ConfigCascade.merge([{ platform: 'cursor' }]);
    expect(result.platform).toBe('cursor');
  });
});

describe('ConfigCascade.stripComments', () => {
  it('removes line comments outside quoted strings', () => {
    const input = '{\n  "platform": "cursor" // project default\n}';
    expect(JSON.parse(ConfigCascade.stripComments(input))).toEqual({ platform: 'cursor' });
  });

  it('removes block comments outside quoted strings', () => {
    const input = '{\n  /* choose platform */\n  "platform": "cursor"\n}';
    expect(JSON.parse(ConfigCascade.stripComments(input))).toEqual({ platform: 'cursor' });
  });

  it('preserves // sequences inside quoted strings', () => {
    const input = '{"url":"https://example.com//path"}';
    expect(JSON.parse(ConfigCascade.stripComments(input))).toEqual({ url: 'https://example.com//path' });
  });

  it('strips trailing commas so VS Code JSONC configs parse', () => {
    const input = '{\n  "platform": "cursor",\n}\n';
    expect(JSON.parse(ConfigCascade.stripComments(input))).toEqual({ platform: 'cursor' });
  });
});

describe('ConfigCascade.readFile', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-cascade-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  it('returns null when the file does not exist', () => {
    expect(ConfigCascade.readFile(path.join(tmp, 'nonexistent.json'))).toBeNull();
  });

  it('returns null for a file containing invalid JSON', () => {
    const file = path.join(tmp, 'aitools.config.json');
    fs.writeFileSync(file, 'not json', 'utf8');
    expect(ConfigCascade.readFile(file)).toBeNull();
  });

  it('returns null when the JSON fails schema validation', () => {
    const file = path.join(tmp, 'aitools.config.json');
    fs.writeFileSync(file, JSON.stringify({ defaultScope: 'invalid-scope' }), 'utf8');
    expect(ConfigCascade.readFile(file)).toBeNull();
  });

  it('returns the parsed config for a valid file', () => {
    const file = path.join(tmp, 'aitools.config.json');
    fs.writeFileSync(file, JSON.stringify({ defaultScope: 'user' }), 'utf8');
    expect(ConfigCascade.readFile(file)).toEqual({ defaultScope: 'user' });
  });

  it('parses JSONC config files with line comments', () => {
    const file = path.join(tmp, 'aitools.config.json');
    fs.writeFileSync(
      file,
      '{\n  // user default\n  "defaultScope": "user"\n}',
      'utf8',
    );
    expect(ConfigCascade.readFile(file)).toEqual({ defaultScope: 'user' });
  });

  it('returns the full registry array from a valid file', () => {
    const config = {
      registries: [{ name: 'test', url: 'https://test.example.com' }],
    };
    const file = path.join(tmp, 'aitools.config.json');
    fs.writeFileSync(file, JSON.stringify(config), 'utf8');
    const result = ConfigCascade.readFile(file);
    expect(result?.registries).toHaveLength(1);
    expect(result?.registries?.[0]?.name).toBe('test');
  });
});


describe('ConfigCascade.load', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-cascade-load-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  it('returns a config without project-specific entries when no local config file exists', () => {
    const result = ConfigCascade.load(tmp);
    // Result may include user-level home dir config; just verify it's an object
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  it('reads platform from a project-level config file', () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'vscode' }),
      'utf8',
    );
    expect(ConfigCascade.load(tmp).platform).toBe('vscode');
  });

  it('reads defaultScope from a project-level config file', () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ defaultScope: 'user' }),
      'utf8',
    );
    expect(ConfigCascade.load(tmp).defaultScope).toBe('user');
  });

  it('project-level platform overrides a parent-level platform', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-parent-'));
    try {
      const child = fs.mkdtempSync(path.join(parent, 'child-'));
      fs.writeFileSync(
        path.join(parent, 'aitools.config.json'),
        JSON.stringify({ platform: 'claude' }),
        'utf8',
      );
      fs.writeFileSync(
        path.join(child, 'aitools.config.json'),
        JSON.stringify({ platform: 'cursor' }),
        'utf8',
      );
      expect(ConfigCascade.load(child).platform).toBe('cursor');
    } finally {
      fs.rmSync(parent, { recursive: true });
    }
  });

  it('silently skips a file with an invalid schema', () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ defaultScope: 'not-a-valid-scope' }),
      'utf8',
    );
    // Invalid config is discarded; load() should not throw
    expect(() => ConfigCascade.load(tmp)).not.toThrow();
    // The invalid defaultScope value should not appear in the merged result
    const result = ConfigCascade.load(tmp);
    expect(result.defaultScope).not.toBe('not-a-valid-scope');
  });
});

describe('ConfigCascade.resolveConfigFiles', () => {
  it('includes the home directory path', () => {
    const files = ConfigCascade.resolveConfigFiles('/tmp/some-project');
    const homeConfig = path.join(os.homedir(), 'aitools.config.json');
    expect(files).toContain(homeConfig);
  });

  it('includes the cwd itself', () => {
    const files = ConfigCascade.resolveConfigFiles('/tmp/myproject');
    expect(files.some((f) => f.endsWith(`myproject${path.sep}aitools.config.json`))).toBe(true);
  });

  it('does not include the home directory config twice when cwd is the home dir', () => {
    const homeConfig = path.join(os.homedir(), 'aitools.config.json');
    const files = ConfigCascade.resolveConfigFiles(os.homedir());
    const count = files.filter((f) => f === homeConfig).length;
    expect(count).toBe(1);
  });

  it('lists home config before project config (home is lower priority)', () => {
    const files = ConfigCascade.resolveConfigFiles('/tmp/myproject');
    const homeIndex = files.findIndex((f) => f === path.join(os.homedir(), 'aitools.config.json'));
    const projIndex = files.findIndex((f) => f.includes('myproject'));
    expect(homeIndex).toBeLessThan(projIndex);
  });

  it('stops walking at AITOOLS_CONFIG_ROOT when set', () => {
    const root = path.join(os.tmpdir(), 'config-root-boundary');
    const project = path.join(root, 'nested', 'project');
    const previousRoot = process.env['AITOOLS_CONFIG_ROOT'];
    process.env['AITOOLS_CONFIG_ROOT'] = root;
    try {
      const files = ConfigCascade.resolveConfigFiles(project);
      const homeConfig = path.join(os.homedir(), 'aitools.config.json');
      const walkedFiles = files.filter((f) => f !== homeConfig);
      expect(walkedFiles.every((f) => f.startsWith(root))).toBe(true);
      expect(walkedFiles).toEqual([
        path.join(root, 'aitools.config.json'),
        path.join(root, 'nested', 'aitools.config.json'),
        path.join(project, 'aitools.config.json'),
      ]);
    } finally {
      if (previousRoot === undefined) delete process.env['AITOOLS_CONFIG_ROOT'];
      else process.env['AITOOLS_CONFIG_ROOT'] = previousRoot;
    }
  });
});
