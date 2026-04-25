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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-search-'));
    fs.writeFileSync(
      path.join(tmp, 'ai-tools.config.json'),
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
});

describe('find command', () => {
  let tmp: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-find-'));
    fs.writeFileSync(
      path.join(tmp, 'ai-tools.config.json'),
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
});
