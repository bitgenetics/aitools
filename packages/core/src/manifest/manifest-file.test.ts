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
import {
  readManifest,
  writeManifest,
  upsertDependency,
  removeDependency,
  MANIFEST_FILENAME,
} from '../manifest/manifest-file.js';
import type { AiToolsManifest } from '../types/config.js';

describe('readManifest', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-manifest-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true });
  });

  it('returns null when no manifest file exists', () => {
    expect(readManifest(tmp)).toBeNull();
  });

  it('throws when the manifest file contains malformed JSON', () => {
    fs.writeFileSync(path.join(tmp, MANIFEST_FILENAME), 'bad json', 'utf8');
    expect(() => readManifest(tmp)).toThrow('Failed to parse');
  });

  it('throws when the manifest fails schema validation', () => {
    fs.writeFileSync(
      path.join(tmp, MANIFEST_FILENAME),
      JSON.stringify({ dependencies: 'not-an-object' }),
      'utf8',
    );
    expect(() => readManifest(tmp)).toThrow('Invalid manifest');
  });

  it('round-trips a manifest through writeManifest', () => {
    const manifest: AiToolsManifest = {
      name: 'my-project',
      dependencies: { 'my-skill': '^1.0.0' },
    };
    writeManifest(tmp, manifest);
    expect(readManifest(tmp)).toEqual(manifest);
  });

  it('round-trips publish fields and dependencies together', () => {
    const manifest: AiToolsManifest = {
      name: '@team/pkg',
      version: '1.0.0',
      description: 'Pkg',
      category: 'skill',
      files: [{ src: 'SKILL.md', dest: 'SKILL.md' }],
      dependencies: { '@team/base': '^1.0.0' },
      devDependencies: { '@team/dev': '^1.0.0' },
    };
    writeManifest(tmp, manifest);
    expect(readManifest(tmp)).toEqual(manifest);
  });

  it('returns a manifest with only optional fields present', () => {
    const manifest: AiToolsManifest = {};
    writeManifest(tmp, manifest);
    expect(readManifest(tmp)).toEqual({});
  });
});

describe('upsertDependency', () => {
  it('adds a package to dependencies by default', () => {
    const updated = upsertDependency({ name: 'project' }, 'my-skill', '^1.0.0');
    expect(updated.dependencies?.['my-skill']).toBe('^1.0.0');
  });

  it('adds a package to devDependencies when dev is true', () => {
    const updated = upsertDependency({ name: 'project' }, 'my-skill', '^1.0.0', true);
    expect(updated.devDependencies?.['my-skill']).toBe('^1.0.0');
    expect(updated.dependencies?.['my-skill']).toBeUndefined();
  });

  it('overwrites an existing version range', () => {
    const base: AiToolsManifest = { dependencies: { 'my-skill': '^1.0.0' } };
    const updated = upsertDependency(base, 'my-skill', '^2.0.0');
    expect(updated.dependencies?.['my-skill']).toBe('^2.0.0');
  });

  it('removes the package from devDependencies when promoting to dependencies', () => {
    const base: AiToolsManifest = { devDependencies: { 'my-skill': '^1.0.0' } };
    const updated = upsertDependency(base, 'my-skill', '^1.0.0', false);
    expect(updated.dependencies?.['my-skill']).toBe('^1.0.0');
    expect(updated.devDependencies?.['my-skill']).toBeUndefined();
  });

  it('removes the package from dependencies when demoting to devDependencies', () => {
    const base: AiToolsManifest = { dependencies: { 'my-skill': '^1.0.0' } };
    const updated = upsertDependency(base, 'my-skill', '^1.0.0', true);
    expect(updated.devDependencies?.['my-skill']).toBe('^1.0.0');
    expect(updated.dependencies?.['my-skill']).toBeUndefined();
  });

  it('does not mutate the original manifest', () => {
    const original: AiToolsManifest = { name: 'project' };
    upsertDependency(original, 'my-skill', '^1.0.0');
    expect(original.dependencies).toBeUndefined();
  });

  it('preserves publish fields when upserting a dependency', () => {
    const base: AiToolsManifest = {
      name: '@team/pkg',
      version: '1.0.0',
      description: 'Pkg',
      category: 'skill',
      files: [{ src: 'SKILL.md', dest: 'SKILL.md' }],
    };
    const updated = upsertDependency(base, 'other-skill', '^1.0.0');
    expect(updated.version).toBe('1.0.0');
    expect(updated.category).toBe('skill');
  });
});

describe('removeDependency', () => {
  it('removes a package from dependencies', () => {
    const manifest: AiToolsManifest = {
      dependencies: { 'my-skill': '^1.0.0', other: '^2.0.0' },
    };
    const updated = removeDependency(manifest, 'my-skill');
    expect(updated.dependencies?.['my-skill']).toBeUndefined();
    expect(updated.dependencies?.['other']).toBe('^2.0.0');
  });

  it('removes a package from devDependencies', () => {
    const manifest: AiToolsManifest = { devDependencies: { 'my-skill': '^1.0.0' } };
    const updated = removeDependency(manifest, 'my-skill');
    expect(updated.devDependencies?.['my-skill']).toBeUndefined();
  });

  it('removes the package from both buckets if present in both', () => {
    const manifest: AiToolsManifest = {
      dependencies: { 'my-skill': '^1.0.0' },
      devDependencies: { 'my-skill': '^1.0.0' },
    };
    const updated = removeDependency(manifest, 'my-skill');
    expect(updated.dependencies?.['my-skill']).toBeUndefined();
    expect(updated.devDependencies?.['my-skill']).toBeUndefined();
  });

  it('does not mutate the original manifest', () => {
    const manifest: AiToolsManifest = { dependencies: { 'my-skill': '^1.0.0' } };
    removeDependency(manifest, 'my-skill');
    expect(manifest.dependencies?.['my-skill']).toBe('^1.0.0');
  });
});
