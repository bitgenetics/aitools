import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ToolStore } from '../storage/tool-store.js';
import type { ToolManifest } from '@ai-tools/core';

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
    it('stores a tool so that get() can retrieve it', () => {
      store.publish(BASE_MANIFEST, BASE_FILES);
      expect(store.get('my-skill', '1.0.0')?.manifest.name).toBe('my-skill');
    });

    it('throws when the same version is published twice', () => {
      store.publish(BASE_MANIFEST, BASE_FILES);
      expect(() => store.publish(BASE_MANIFEST, BASE_FILES)).toThrow('already published');
    });

    it('allows publishing a different version of the same tool', () => {
      store.publish(BASE_MANIFEST, BASE_FILES);
      expect(() =>
        store.publish({ ...BASE_MANIFEST, version: '2.0.0' }, BASE_FILES),
      ).not.toThrow();
    });
  });

  describe('get', () => {
    it('returns null for a non-existent tool', () => {
      expect(store.get('ghost', 'latest')).toBeNull();
    });

    it('returns null for a non-existent version of an existing tool', () => {
      store.publish(BASE_MANIFEST, BASE_FILES);
      expect(store.get('my-skill', '9.9.9')).toBeNull();
    });

    it('resolves "latest" to the highest-sorted published version', () => {
      store.publish(BASE_MANIFEST, BASE_FILES);
      store.publish({ ...BASE_MANIFEST, version: '2.0.0' }, BASE_FILES);
      expect(store.get('my-skill', 'latest')?.manifest.version).toBe('2.0.0');
    });

    it('returns a specific version when explicitly requested', () => {
      store.publish(BASE_MANIFEST, BASE_FILES);
      store.publish({ ...BASE_MANIFEST, version: '2.0.0' }, BASE_FILES);
      expect(store.get('my-skill', '1.0.0')?.manifest.version).toBe('1.0.0');
    });
  });

  describe('listVersions', () => {
    it('returns an empty array for an unknown tool', () => {
      expect(store.listVersions('ghost')).toEqual([]);
    });

    it('returns all published versions sorted newest first', () => {
      store.publish(BASE_MANIFEST, BASE_FILES);
      store.publish({ ...BASE_MANIFEST, version: '1.1.0' }, BASE_FILES);
      store.publish({ ...BASE_MANIFEST, version: '2.0.0' }, BASE_FILES);
      const versions = store.listVersions('my-skill');
      expect(versions[0]).toBe('2.0.0');
    });
  });

  describe('search', () => {
    beforeEach(() => {
      store.publish(BASE_MANIFEST, BASE_FILES);
      store.publish(
        {
          ...BASE_MANIFEST,
          name: 'code-reviewer',
          description: 'Reviews pull requests',
          version: '1.0.0',
        },
        BASE_FILES,
      );
    });

    it('returns all tools for an empty query', () => {
      expect(store.search('')).toHaveLength(2);
    });

    it('filters tools by name', () => {
      const results = store.search('my-skill');
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('my-skill');
    });

    it('filters tools by description', () => {
      const results = store.search('pull requests');
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('code-reviewer');
    });

    it('returns an empty array when no tools match', () => {
      expect(store.search('zzz-no-match-xyz')).toHaveLength(0);
    });

    it('is case-insensitive', () => {
      expect(store.search('MY-SKILL')).toHaveLength(1);
    });
  });

  describe('buildTarball', () => {
    it('produces a JSON array of { path, content } entries', () => {
      store.publish(BASE_MANIFEST, BASE_FILES);
      const buf = store.buildTarball('my-skill', '1.0.0');
      const entries = JSON.parse(buf.toString('utf8')) as Array<{
        path: string;
        content: string;
      }>;
      expect(entries[0]?.path).toBe('skill.md');
      expect(entries[0]?.content).toBe(BASE_FILES['skill.md']);
    });

    it('throws for an unknown tool', () => {
      expect(() => store.buildTarball('ghost', '1.0.0')).toThrow('Not found');
    });
  });

  describe('integrity', () => {
    it('returns a sha256- prefixed string', () => {
      store.publish(BASE_MANIFEST, BASE_FILES);
      expect(store.integrity('my-skill', '1.0.0')).toMatch(/^sha256-/);
    });

    it('returns the same hash for the same content', () => {
      store.publish(BASE_MANIFEST, BASE_FILES);
      expect(store.integrity('my-skill', '1.0.0')).toBe(
        store.integrity('my-skill', '1.0.0'),
      );
    });
  });
});
