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
import { ToolStore, ToolStoreError } from '../storage/tool-store.js';
import type { ToolManifest } from '@bitgenetics/aitools-core';

const BASE_MANIFEST: ToolManifest = {
  name: 'my-skill',
  version: '1.0.0',
  description: 'A test skill',
  category: 'skill',
  files: [{ src: 'skill.md', dest: 'skills/skill.md' }],
};

const BASE_FILES = { 'skill.md': '# My Skill\nContent here.' };

describe('ToolStore', () => {
  let tmp: string;
  let store: ToolStore;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-store-'));
    store = new ToolStore(tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  describe('publish', () => {
    it('stores a tool so that get() can retrieve it', async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES);
      expect((await store.get('my-skill', '1.0.0'))?.manifest.name).toBe('my-skill');
    });

    it('throws when the same version is published twice', async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES);
      await expect(store.publish(BASE_MANIFEST, BASE_FILES)).rejects.toThrow('already published');
    });

    it('allows publishing a different version of the same tool', async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES);
      await expect(
        store.publish({ ...BASE_MANIFEST, version: '2.0.0' }, BASE_FILES),
      ).resolves.not.toThrow();
    });

    it('stores ownership metadata when published by an authenticated org user', async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES, { userId: 'alice', org: 'acme' });
      expect(await store.getOwner('my-skill')).toMatchObject({ org: 'acme', createdBy: 'alice' });
    });

    it('allows new versions from users in the same owner org', async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES, { userId: 'alice', org: 'acme' });
      await expect(
        store.publish({ ...BASE_MANIFEST, version: '2.0.0' }, BASE_FILES, {
          userId: 'bob',
          org: 'acme',
        }),
      ).resolves.not.toThrow();
    });

    it('rejects publish from a different org when owner metadata exists', async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES, { userId: 'alice', org: 'acme' });
      await expect(
        store.publish({ ...BASE_MANIFEST, version: '2.0.0' }, BASE_FILES, {
          userId: 'mallory',
          org: 'other-org',
        }),
      ).rejects.toThrow(ToolStoreError);
    });
  });

  describe('get', () => {
    it('returns null for a non-existent tool', async () => {
      expect(await store.get('ghost', 'latest')).toBeNull();
    });

    it('returns null for a non-existent version of an existing tool', async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES);
      expect(await store.get('my-skill', '9.9.9')).toBeNull();
    });

    it('resolves "latest" to the highest-sorted published version', async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES);
      await store.publish({ ...BASE_MANIFEST, version: '2.0.0' }, BASE_FILES);
      expect((await store.get('my-skill', 'latest'))?.manifest.version).toBe('2.0.0');
    });

    it('returns a specific version when explicitly requested', async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES);
      await store.publish({ ...BASE_MANIFEST, version: '2.0.0' }, BASE_FILES);
      expect((await store.get('my-skill', '1.0.0'))?.manifest.version).toBe('1.0.0');
    });
  });

  describe('listVersions', () => {
    it('returns an empty array for an unknown tool', async () => {
      expect(await store.listVersions('ghost')).toEqual([]);
    });

    it('returns all published versions sorted newest first', async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES);
      await store.publish({ ...BASE_MANIFEST, version: '1.1.0' }, BASE_FILES);
      await store.publish({ ...BASE_MANIFEST, version: '2.0.0' }, BASE_FILES);
      const versions = await store.listVersions('my-skill');
      expect(versions[0]).toBe('2.0.0');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES);
      await store.publish(
        {
          ...BASE_MANIFEST,
          name: 'code-reviewer',
          description: 'Reviews pull requests',
          version: '1.0.0',
        },
        BASE_FILES,
      );
    });

    it('returns all tools for an empty query', async () => {
      expect(await store.search('')).toHaveLength(2);
    });

    it('filters tools by name', async () => {
      const results = await store.search('my-skill');
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('my-skill');
    });

    it('filters tools by description', async () => {
      const results = await store.search('pull requests');
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('code-reviewer');
    });

    it('returns an empty array when no tools match', async () => {
      expect(await store.search('zzz-no-match-xyz')).toHaveLength(0);
    });

    it('is case-insensitive', async () => {
      expect(await store.search('MY-SKILL')).toHaveLength(1);
    });
  });

  describe('buildTarball', () => {
    it('produces a JSON array of { path, content } entries', async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES);
      const buf = await store.buildTarball('my-skill', '1.0.0');
      const entries = JSON.parse(buf.toString('utf8')) as Array<{
        path: string;
        content: string;
      }>;
      expect(entries[0]?.path).toBe('skill.md');
      expect(entries[0]?.content).toBe(BASE_FILES['skill.md']);
    });

    it('throws for an unknown tool', async () => {
      await expect(store.buildTarball('ghost', '1.0.0')).rejects.toThrow('Not found');
    });
  });

  describe('integrity', () => {
    it('returns a sha256- prefixed string', async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES);
      expect(await store.integrity('my-skill', '1.0.0')).toMatch(/^sha256-/);
    });

    it('returns the same hash for the same content', async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES);
      expect(await store.integrity('my-skill', '1.0.0')).toBe(
        await store.integrity('my-skill', '1.0.0'),
      );
    });
  });

  describe('setPrivacy', () => {
    const actor = { userId: 'alice', org: 'acme' };

    beforeEach(async () => {
      await store.publish(BASE_MANIFEST, BASE_FILES, actor);
    });

    it('returns 404 for an unknown tool', async () => {
      await expect(store.setPrivacy('ghost', true, actor)).rejects.toThrow(ToolStoreError);
    });

    it('returns 403 when the caller is not from the owner org', async () => {
      const other = { userId: 'mallory', org: 'other' };
      await expect(store.setPrivacy('my-skill', true, other)).rejects.toThrow(ToolStoreError);
    });

    it('sets private=true so that get() reflects the change', async () => {
      await store.setPrivacy('my-skill', true, actor);
      const stored = await store.get('my-skill', 'latest');
      expect(stored?.manifest.private).toBe(true);
    });

    it('sets private=false to make a previously-private tool public', async () => {
      await store.setPrivacy('my-skill', true, actor);
      await store.setPrivacy('my-skill', false, actor);
      const stored = await store.get('my-skill', 'latest');
      expect(stored?.manifest.private).toBe(false);
    });

    it('owner-level flag overrides per-version manifest private field', async () => {
      // Publish a second version with private: true in the manifest
      await store.publish({ ...BASE_MANIFEST, version: '2.0.0', private: true }, BASE_FILES, actor);
      // Set owner-level to false � should override manifest
      await store.setPrivacy('my-skill', false, actor);
      const stored = await store.get('my-skill', '2.0.0');
      expect(stored?.manifest.private).toBe(false);
    });

    it('search() reflects the owner-level privacy flag', async () => {
      await store.setPrivacy('my-skill', true, actor);
      const results = await store.search('');
      expect(results[0]?.private).toBe(true);
    });
  });
});
