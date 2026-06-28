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
import { CacheManager } from '../utils/cache-manager.js';
import type { ToolManifest } from '@bitgenetics/aitools-core';

const MANIFEST: ToolManifest = {
  name: '@scope/my-skill',
  version: '1.0.0',
  description: 'A skill',
  category: 'skill',
  files: [{ src: 'skill.md', dest: 'my-skill/SKILL.md' }],
};

const TARBALL = Buffer.from(
  JSON.stringify([{ path: 'skill.md', content: '# My Skill' }]),
  'utf8',
);

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-cache-'));
}

describe('CacheManager.has', () => {
  it('returns false when no cache entry exists', () => {
    const tmp = makeTmp();
    try {
      const cache = new CacheManager(tmp);
      expect(cache.has('@scope/my-skill', '1.0.0')).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('returns true after storing a tarball', () => {
    const tmp = makeTmp();
    try {
      const cache = new CacheManager(tmp);
      cache.store(MANIFEST.name, MANIFEST.version, TARBALL, MANIFEST);
      expect(cache.has(MANIFEST.name, MANIFEST.version)).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
});

describe('CacheManager.store', () => {
  let tmp: string;
  let cache: CacheManager;

  beforeEach(() => {
    tmp = makeTmp();
    cache = new CacheManager(tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  it('writes tarball files under <agentsDir>/<file.src>', () => {
    const entry = cache.store(MANIFEST.name, MANIFEST.version, TARBALL, MANIFEST);
    const expectedFile = path.join(entry.agentsDir, 'skill.md');
    expect(fs.existsSync(expectedFile)).toBe(true);
    expect(fs.readFileSync(expectedFile, 'utf8')).toBe('# My Skill');
  });

  it('writes a cache-metadata.json with name, version, and integrity', () => {
    const entry = cache.store(MANIFEST.name, MANIFEST.version, TARBALL, MANIFEST);
    const meta = JSON.parse(fs.readFileSync(path.join(entry.dir, 'cache-metadata.json'), 'utf8'));
    expect(meta.name).toBe(MANIFEST.name);
    expect(meta.version).toBe(MANIFEST.version);
    expect(meta.integrity).toMatch(/^sha256-/);
  });

  it('stores scoped packages under scope/name on disk (no leading @)', () => {
    cache.store('@scope/my-skill', '1.0.0', TARBALL, MANIFEST);
    const expected = path.join(tmp, 'scope', 'my-skill', '1.0.0');
    expect(fs.existsSync(expected)).toBe(true);
  });

  it('throws when a file in the manifest is absent from the tarball', () => {
    const emptyTarball = Buffer.from(JSON.stringify([]), 'utf8');
    expect(() => cache.store(MANIFEST.name, MANIFEST.version, emptyTarball, MANIFEST))
      .toThrow('missing file: skill.md');
  });
});

describe('CacheManager.getMetadata', () => {
  it('returns stored metadata after a successful store', () => {
    const tmp = makeTmp();
    try {
      const cache = new CacheManager(tmp);
      cache.store(MANIFEST.name, MANIFEST.version, TARBALL, MANIFEST);
      const meta = cache.getMetadata(MANIFEST.name, MANIFEST.version);
      expect(meta.name).toBe(MANIFEST.name);
      expect(meta.version).toBe(MANIFEST.version);
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });

  it('throws when the entry does not exist', () => {
    const tmp = makeTmp();
    try {
      const cache = new CacheManager(tmp);
      expect(() => cache.getMetadata('ghost', '1.0.0')).toThrow('Cache entry not found');
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
});

describe('CacheManager.clear', () => {
  let tmp: string;
  let cache: CacheManager;

  beforeEach(() => {
    tmp = makeTmp();
    cache = new CacheManager(tmp);
    cache.store(MANIFEST.name, MANIFEST.version, TARBALL, MANIFEST);
    cache.store(MANIFEST.name, '2.0.0', TARBALL, { ...MANIFEST, version: '2.0.0' });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('removes a specific version when name and version are given', () => {
    cache.clear(MANIFEST.name, '1.0.0');
    expect(cache.has(MANIFEST.name, '1.0.0')).toBe(false);
    expect(cache.has(MANIFEST.name, '2.0.0')).toBe(true);
  });

  it('removes all versions of a tool when only name is given', () => {
    cache.clear(MANIFEST.name);
    expect(cache.has(MANIFEST.name, '1.0.0')).toBe(false);
    expect(cache.has(MANIFEST.name, '2.0.0')).toBe(false);
  });

  it('clears the entire cache when called with no arguments', () => {
    cache.clear();
    expect(fs.existsSync(tmp)).toBe(false);
  });
});
