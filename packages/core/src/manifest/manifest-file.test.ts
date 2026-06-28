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
  upsertToolDependency,
  removeToolDependency,
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
      JSON.stringify({ tools: 'not-an-object' }),
      'utf8',
    );
    expect(() => readManifest(tmp)).toThrow('Invalid manifest');
  });

  it('round-trips a manifest through writeManifest', () => {
    const manifest: AiToolsManifest = {
      name: 'my-project',
      tools: { 'my-skill': '^1.0.0' },
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

describe('upsertToolDependency', () => {
  it('adds a tool to the tools record', () => {
    const updated = upsertToolDependency({ name: 'project' }, 'my-skill', '^1.0.0');
    expect(updated.tools?.['my-skill']).toBe('^1.0.0');
  });

  it('adds a tool to devTools when dev is true', () => {
    const updated = upsertToolDependency({ name: 'project' }, 'my-skill', '^1.0.0', true);
    expect(updated.devTools?.['my-skill']).toBe('^1.0.0');
    expect(updated.tools?.['my-skill']).toBeUndefined();
  });

  it('overwrites an existing version range', () => {
    const base: AiToolsManifest = { tools: { 'my-skill': '^1.0.0' } };
    const updated = upsertToolDependency(base, 'my-skill', '^2.0.0');
    expect(updated.tools?.['my-skill']).toBe('^2.0.0');
  });

  it('removes the tool from devTools when promoting it to tools', () => {
    const base: AiToolsManifest = { devTools: { 'my-skill': '^1.0.0' } };
    const updated = upsertToolDependency(base, 'my-skill', '^1.0.0', false);
    expect(updated.tools?.['my-skill']).toBe('^1.0.0');
    expect(updated.devTools?.['my-skill']).toBeUndefined();
  });

  it('removes the tool from tools when demoting it to devTools', () => {
    const base: AiToolsManifest = { tools: { 'my-skill': '^1.0.0' } };
    const updated = upsertToolDependency(base, 'my-skill', '^1.0.0', true);
    expect(updated.devTools?.['my-skill']).toBe('^1.0.0');
    expect(updated.tools?.['my-skill']).toBeUndefined();
  });

  it('does not mutate the original manifest', () => {
    const original: AiToolsManifest = { name: 'project' };
    upsertToolDependency(original, 'my-skill', '^1.0.0');
    expect(original.tools).toBeUndefined();
  });
});

describe('removeToolDependency', () => {
  it('removes a tool from the tools record', () => {
    const manifest: AiToolsManifest = {
      tools: { 'my-skill': '^1.0.0', other: '^2.0.0' },
    };
    const updated = removeToolDependency(manifest, 'my-skill');
    expect(updated.tools?.['my-skill']).toBeUndefined();
    expect(updated.tools?.['other']).toBe('^2.0.0');
  });

  it('removes a tool from the devTools record', () => {
    const manifest: AiToolsManifest = { devTools: { 'my-skill': '^1.0.0' } };
    const updated = removeToolDependency(manifest, 'my-skill');
    expect(updated.devTools?.['my-skill']).toBeUndefined();
  });

  it('removes the tool from both tools and devTools if present in both', () => {
    const manifest: AiToolsManifest = {
      tools: { 'my-skill': '^1.0.0' },
      devTools: { 'my-skill': '^1.0.0' },
    };
    const updated = removeToolDependency(manifest, 'my-skill');
    expect(updated.tools?.['my-skill']).toBeUndefined();
    expect(updated.devTools?.['my-skill']).toBeUndefined();
  });

  it('does not mutate the original manifest', () => {
    const manifest: AiToolsManifest = { tools: { 'my-skill': '^1.0.0' } };
    removeToolDependency(manifest, 'my-skill');
    expect(manifest.tools?.['my-skill']).toBe('^1.0.0');
  });
});
