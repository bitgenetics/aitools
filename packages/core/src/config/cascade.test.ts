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
    const file = path.join(tmp, 'ai-tools.config.json');
    fs.writeFileSync(file, 'not json', 'utf8');
    expect(ConfigCascade.readFile(file)).toBeNull();
  });

  it('returns null when the JSON fails schema validation', () => {
    const file = path.join(tmp, 'ai-tools.config.json');
    fs.writeFileSync(file, JSON.stringify({ defaultScope: 'invalid-scope' }), 'utf8');
    expect(ConfigCascade.readFile(file)).toBeNull();
  });

  it('returns the parsed config for a valid file', () => {
    const file = path.join(tmp, 'ai-tools.config.json');
    fs.writeFileSync(file, JSON.stringify({ defaultScope: 'user' }), 'utf8');
    expect(ConfigCascade.readFile(file)).toEqual({ defaultScope: 'user' });
  });

  it('returns the full registry array from a valid file', () => {
    const config = {
      registries: [{ name: 'test', url: 'https://test.example.com' }],
    };
    const file = path.join(tmp, 'ai-tools.config.json');
    fs.writeFileSync(file, JSON.stringify(config), 'utf8');
    const result = ConfigCascade.readFile(file);
    expect(result?.registries).toHaveLength(1);
    expect(result?.registries?.[0]?.name).toBe('test');
  });
});
