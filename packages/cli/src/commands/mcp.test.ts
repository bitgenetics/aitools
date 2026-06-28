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
import { ConfigManager } from '../utils/config-manager.js';
import { Installer } from '../utils/installer.js';
import {
  detectMcpTargets,
  writeMcpEntry,
  removeMcpEntry,
  handleMcpToolCall,
  createMcpCommand,
} from './mcp.js';
import { writeLockFile, upsertLockEntry, emptyLock } from '@bitgenetics/aitools-core';

const mockGetManifest = jest.fn();
const mockSearch = jest.fn();
const mockDownload = jest.fn();

jest.mock('../utils/registry-client.js', () => ({
  createRegistryClient: jest.fn(() => ({
    config: { name: 'reg', url: 'http://localhost:4873', type: 'http' },
    getManifest: (...args: unknown[]) => mockGetManifest(...args),
    search: (...args: unknown[]) => mockSearch(...args),
    download: (...args: unknown[]) => mockDownload(...args),
    listVersions: jest.fn().mockResolvedValue(['1.0.0']),
    publish: jest.fn(),
  })),
}));

function parseToolResponse(response: { content: Array<{ text: string }> }): unknown {
  return JSON.parse(response.content[0]!.text);
}

describe('handleMcpToolCall', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-mcp-handler-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns transform result from aitools_transform', async () => {
    const configManager = new ConfigManager(tmp);
    const ctx = {
      cwd: tmp,
      configManager,
      installer: new Installer(configManager, tmp),
    };

    const response = await handleMcpToolCall(
      'aitools_transform',
      {
        content: 'Run lint on $1',
        category: 'command',
        from: 'cursor',
        to: 'claude',
      },
      ctx,
    );

    const data = parseToolResponse(response) as { content: string; confidence: string };
    expect(data.content).toBe('Run lint on $ARGUMENTS');
    expect(data.confidence).toBe('high');
  });

  it('returns compat matrix from aitools_compat', async () => {
    const manifestPath = path.join(tmp, 'aitools.manifest.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        name: 'my-hook',
        version: '1.0.0',
        description: 'Hooks',
        category: 'hook',
        nativeFor: 'cursor',
        files: [{ src: 'hooks.json', dest: 'hooks.json' }],
      }),
      'utf8',
    );

    const configManager = new ConfigManager(tmp);
    const response = await handleMcpToolCall(
      'aitools_compat',
      { manifestPath },
      {
        cwd: tmp,
        configManager,
        installer: new Installer(configManager, tmp),
      },
    );

    const data = parseToolResponse(response) as {
      nativeFor: string;
      matrix: Array<{ platform: string; confidence: string }>;
    };
    expect(data.nativeFor).toBe('cursor');
    expect(data.matrix.find((m) => m.platform === 'windsurf')?.confidence).toBe('low');
  });

  it('returns error when no registries are configured for aitools_search', async () => {
    const configManager = new ConfigManager(tmp);
    const response = await handleMcpToolCall(
      'aitools_search',
      { query: 'skill' },
      {
        cwd: tmp,
        configManager,
        installer: new Installer(configManager, tmp),
      },
    );

    expect(response.isError).toBe(true);
    const data = parseToolResponse(response) as { error: string };
    expect(data.error).toContain('No registries configured');
  });
});

describe('mcp config helpers', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-mcp-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects cursor project config when .cursor exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.cursor'));
    const targets = detectMcpTargets(tmpDir, false);
    expect(targets.some((t) => t.platform === 'cursor')).toBe(true);
  });

  it('writes and removes aitools entry in mcpServers format', () => {
    const configPath = path.join(tmpDir, '.cursor', 'mcp.json');
    writeMcpEntry(configPath, 'mcpServers');
    const written = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(written.mcpServers.aitools).toEqual({ command: 'aitools', args: ['mcp'] });
    expect(removeMcpEntry(configPath, 'mcpServers')).toBe(true);
    const after = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(after.mcpServers.aitools).toBeUndefined();
  });

  it('throws when existing MCP config is invalid JSON', () => {
    const configPath = path.join(tmpDir, '.cursor', 'mcp.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, '{ bad json', 'utf8');
    expect(() => writeMcpEntry(configPath, 'mcpServers')).toThrow('Cannot parse');
  });

  it('returns false when removing from missing or invalid config', () => {
    expect(removeMcpEntry(path.join(tmpDir, 'missing.json'), 'mcpServers')).toBe(false);
    const badPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(badPath, '{ bad', 'utf8');
    expect(removeMcpEntry(badPath, 'mcpServers')).toBe(false);
  });

  it('detects vscode and windsurf project configs', () => {
    fs.mkdirSync(path.join(tmpDir, '.vscode'));
    fs.mkdirSync(path.join(tmpDir, '.windsurf'));
    const targets = detectMcpTargets(tmpDir, false);
    expect(targets.some((t) => t.platform === 'vscode')).toBe(true);
    expect(targets.some((t) => t.platform === 'windsurf')).toBe(true);
  });

  it('detects claude project config via .mcp.json', () => {
    fs.writeFileSync(path.join(tmpDir, '.mcp.json'), '{}', 'utf8');
    const targets = detectMcpTargets(tmpDir, false);
    expect(targets.some((t) => t.platform === 'claude')).toBe(true);
  });

  it('detects user-level cursor config when --user is requested', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-mcp-home-'));
    const homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(home);
    fs.mkdirSync(path.join(home, '.cursor'));
    const targets = detectMcpTargets(tmpDir, true);
    expect(targets.some((t) => t.platform === 'cursor' && t.configPath.includes('.cursor'))).toBe(true);
    homedirSpy.mockRestore();
    fs.rmSync(home, { recursive: true, force: true });
  });
});

describe('mcp command action', () => {
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-mcp-cmd-'));
    process.chdir(tmpDir);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('install subcommand writes entries for detected platforms', () => {
    fs.mkdirSync(path.join(tmpDir, '.cursor'));
    createMcpCommand().parse(['install'], { from: 'user' });
    expect(fs.existsSync(path.join(tmpDir, '.cursor', 'mcp.json'))).toBe(true);
  });

  it('install subcommand warns when no platforms detected', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    createMcpCommand().parse(['install'], { from: 'user' });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('No platform directories detected');
  });

  it('remove subcommand removes aitools entry', () => {
    fs.mkdirSync(path.join(tmpDir, '.cursor'), { recursive: true });
    const configPath = path.join(tmpDir, '.cursor', 'mcp.json');
    writeMcpEntry(configPath, 'mcpServers');
    createMcpCommand().parse(['remove'], { from: 'user' });
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers.aitools).toBeUndefined();
  });

  it('remove subcommand reports when no entries were removed', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    createMcpCommand().parse(['remove'], { from: 'user' });
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('No aitools MCP entries found');
  });
});

describe('handleMcpToolCall extended', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-mcp-handler-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns installed tools from aitools_list', async () => {
    writeLockFile(
      tmp,
      upsertLockEntry(emptyLock(), 'my-skill', {
        version: '1.0.0',
        resolved: 'http://example.com',
        integrity: 'sha256-x',
        files: ['skill.md'],
        installedAt: new Date().toISOString(),
      }),
    );
    const configManager = new ConfigManager(tmp);
    const response = await handleMcpToolCall('aitools_list', {}, {
      cwd: tmp,
      configManager,
      installer: new Installer(configManager, tmp),
    });
    const data = parseToolResponse(response) as { tools: Array<{ name: string }> };
    expect(data.tools.some((t) => t.name === 'my-skill')).toBe(true);
  });

  it('returns error for unknown tool name', async () => {
    const configManager = new ConfigManager(tmp);
    const response = await handleMcpToolCall('unknown_tool', {}, {
      cwd: tmp,
      configManager,
      installer: new Installer(configManager, tmp),
    });
    expect(response.isError).toBe(true);
  });

  it('installs a package via aitools_install when registries are configured', async () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({
        platform: 'vscode',
        registries: [{ type: 'http', name: 'reg', url: 'http://localhost:4873' }],
      }),
      'utf8',
    );
    mockGetManifest.mockResolvedValue({
      name: 'mcp-skill',
      version: '1.0.0',
      description: 'MCP skill',
      category: 'skill',
      files: [{ src: 'skill.md', dest: 'skill.md' }],
    });
    mockDownload.mockResolvedValue({
      data: Buffer.from(JSON.stringify([{ path: 'skill.md', content: '# Skill' }])),
    });

    const configManager = new ConfigManager(tmp);
    const response = await handleMcpToolCall(
      'aitools_install',
      { name: 'mcp-skill' },
      { cwd: tmp, configManager, installer: new Installer(configManager, tmp) },
    );

    const data = parseToolResponse(response) as { name: string; version: string };
    expect(data.name).toBe('mcp-skill');
    expect(data.version).toBe('1.0.0');
  });

  it('returns search results from aitools_search', async () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ registries: [{ type: 'http', name: 'reg', url: 'http://localhost:4873' }] }),
      'utf8',
    );
    mockSearch.mockResolvedValue([
      { name: 'found', version: '1.0.0', description: 'Found', category: 'skill', registry: 'http://localhost:4873' },
    ]);

    const configManager = new ConfigManager(tmp);
    const response = await handleMcpToolCall(
      'aitools_search',
      { query: 'found' },
      { cwd: tmp, configManager, installer: new Installer(configManager, tmp) },
    );

    const data = parseToolResponse(response) as { results: Array<{ name: string }> };
    expect(data.results[0]?.name).toBe('found');
  });

  it('returns compat error for invalid manifest', async () => {
    const manifestPath = path.join(tmp, 'bad.manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify({ name: 'incomplete' }), 'utf8');
    const configManager = new ConfigManager(tmp);
    const response = await handleMcpToolCall(
      'aitools_compat',
      { manifestPath },
      { cwd: tmp, configManager, installer: new Installer(configManager, tmp) },
    );
    expect(response.isError).toBe(true);
  });

  it('uninstalls a tool via aitools_uninstall', async () => {
    const skillPath = path.join(tmp, '.github', 'skills', 'old-skill.md');
    fs.mkdirSync(path.dirname(skillPath), { recursive: true });
    fs.writeFileSync(skillPath, '# Old', 'utf8');
    writeLockFile(
      tmp,
      upsertLockEntry(emptyLock(), 'old-skill', {
        version: '1.0.0',
        resolved: 'http://example.com',
        integrity: 'sha256-x',
        files: ['.github/skills/old-skill.md'],
        installedAt: new Date().toISOString(),
      }),
    );
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ platform: 'vscode' }),
      'utf8',
    );

    const configManager = new ConfigManager(tmp);
    const response = await handleMcpToolCall(
      'aitools_uninstall',
      { name: 'old-skill' },
      { cwd: tmp, configManager, installer: new Installer(configManager, tmp) },
    );

    const data = parseToolResponse(response) as { removed: string[] };
    expect(data.removed.length).toBeGreaterThan(0);
  });
});
