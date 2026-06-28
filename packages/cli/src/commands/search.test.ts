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
import { createSearchCommand, createFindCommand } from './search.js';
import { createRegistryClient } from '../utils/registry-client.js';
import type { SearchResult } from '../utils/registry-client.js';

jest.mock('../utils/registry-client.js');

const mockSearch = jest.fn<Promise<SearchResult[]>, [string]>();
const mockClient = { search: mockSearch };

beforeEach(() => {
  (createRegistryClient as jest.Mock).mockReturnValue(mockClient);
  mockSearch.mockResolvedValue([]);
});

afterEach(() => jest.clearAllMocks());

describe('search command', () => {
  let tmp: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-search-'));
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ registries: [{ name: 'test', url: 'http://registry.example.com' }] }),
      'utf8',
    );
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true });
  });

  it('calls search with the provided query', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await createSearchCommand().parseAsync(['my-query'], { from: 'user' });
    expect(mockSearch).toHaveBeenCalledWith('my-query');
  });

  it('prints "no results" when search returns empty', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createSearchCommand().parseAsync(['empty-query'], { from: 'user' });
    const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
    expect(output.toLowerCase()).toContain('no result');
    logSpy.mockRestore();
  });

  it('prints tool names when results are returned', async () => {
    mockSearch.mockResolvedValue([
      { name: 'found-skill', version: '1.0.0', description: 'A skill', category: 'skill', registry: 'http://registry.example.com' },
    ]);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createSearchCommand().parseAsync(['found-skill'], { from: 'user' });
    const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
    expect(output).toContain('found-skill');
    logSpy.mockRestore();
  });

  it('outputs raw JSON with --json flag', async () => {
    mockSearch.mockResolvedValue([
      { name: 'skill-a', version: '2.0.0', description: 'desc', category: 'skill', registry: 'http://r.example.com' },
    ]);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createSearchCommand().parseAsync(['skill-a', '--json'], { from: 'user' });
    const raw = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw) as SearchResult[];
    expect(parsed[0]?.name).toBe('skill-a');
    logSpy.mockRestore();
  });

  it('exits when no registries are configured', async () => {
    fs.writeFileSync(path.join(tmp, 'aitools.config.json'), JSON.stringify({ platform: 'vscode' }), 'utf8');
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(createSearchCommand().parseAsync(['query'], { from: 'user' })).rejects.toThrow('process.exit:1');
    exitSpy.mockRestore();
  });

  it('searches a specific registry URL with --registry', async () => {
    mockSearch.mockResolvedValue([
      { name: 'remote-skill', version: '1.0.0', description: 'Remote', category: 'skill', registry: 'http://other.example.com' },
    ]);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createSearchCommand().parseAsync(['remote', '--registry', 'http://other.example.com'], { from: 'user' });
    expect(mockSearch).toHaveBeenCalledWith('remote');
    const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
    expect(output).toContain('remote-skill');
    logSpy.mockRestore();
  });

  it('continues when a registry search throws', async () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({
        registries: [
          { name: 'bad', url: 'http://bad.example.com' },
          { name: 'good', url: 'http://good.example.com' },
        ],
      }),
      'utf8',
    );
    mockSearch.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([
      { name: 'found', version: '1.0.0', description: 'Found', category: 'skill', registry: 'http://good.example.com' },
    ]);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createSearchCommand().parseAsync(['found'], { from: 'user' });
    const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
    expect(output).toContain('found');
    logSpy.mockRestore();
  });

  it('prints keywords when present on search results', async () => {
    mockSearch.mockResolvedValue([
      {
        name: 'tagged-skill',
        version: '1.0.0',
        description: 'Tagged',
        category: 'skill',
        registry: 'http://registry.example.com',
        keywords: ['lint', 'fix'],
      },
    ]);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createSearchCommand().parseAsync(['tagged'], { from: 'user' });
    const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
    expect(output).toContain('keywords: lint, fix');
    logSpy.mockRestore();
  });
});

describe('find command', () => {
  let tmp: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-find-'));
    fs.writeFileSync(
      path.join(tmp, 'aitools.config.json'),
      JSON.stringify({ registries: [{ name: 'test', url: 'http://registry.example.com' }] }),
      'utf8',
    );
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true });
  });

  it('runs without throwing for a valid query', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await expect(createFindCommand().parseAsync(['my-query'], { from: 'user' })).resolves.not.toThrow();
  });

  it('exits when no registries are configured', async () => {
    fs.writeFileSync(path.join(tmp, 'aitools.config.json'), JSON.stringify({ platform: 'vscode' }), 'utf8');
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(createFindCommand().parseAsync(['need a linter'], { from: 'user' })).rejects.toThrow('process.exit:1');
    exitSpy.mockRestore();
  });

  it('prints matching tools when smart search returns results', async () => {
    mockSearch.mockResolvedValue([
      { name: 'smart-skill', version: '1.0.0', description: 'Smart', category: 'skill', registry: 'http://registry.example.com' },
    ]);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createFindCommand().parseAsync(['linter tool'], { from: 'user' });
    const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
    expect(output).toContain('smart-skill');
    logSpy.mockRestore();
  });

  it('outputs JSON results with --json', async () => {
    mockSearch.mockResolvedValue([
      { name: 'smart-skill', version: '1.0.0', description: 'Smart', category: 'skill', registry: 'http://registry.example.com' },
    ]);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createFindCommand().parseAsync(['linter tool', '--json'], { from: 'user' });
    const raw = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw) as SearchResult[];
    expect(parsed[0]?.name).toBe('smart-skill');
    logSpy.mockRestore();
  });

  it('prints no matching tools when smart search returns empty', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await createFindCommand().parseAsync(['nothing matches'], { from: 'user' });
    const output = logSpy.mock.calls.map((a) => String(a[0])).join('\n');
    expect(output).toContain('No matching tools found');
    logSpy.mockRestore();
  });
});
