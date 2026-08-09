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
  resolveNextVersion,
  bumpManifestVersion,
  loadPublishManifest,
} from './bump-version.js';

const VALID_MANIFEST = {
  name: 'bump-pkg',
  version: '1.0.0',
  description: 'test',
  category: 'skill',
  files: [{ src: 'index.md', dest: 'index.md' }],
};

describe('resolveNextVersion', () => {
  it('increments patch', () => {
    expect(resolveNextVersion('1.0.0', 'patch')).toEqual({ ok: true, next: '1.0.1' });
  });

  it('increments minor', () => {
    expect(resolveNextVersion('1.0.0', 'minor')).toEqual({ ok: true, next: '1.1.0' });
  });

  it('increments major', () => {
    expect(resolveNextVersion('1.0.0', 'major')).toEqual({ ok: true, next: '2.0.0' });
  });

  it('accepts an explicit greater version', () => {
    expect(resolveNextVersion('1.0.0', '3.2.1')).toEqual({ ok: true, next: '3.2.1' });
  });

  it('rejects an explicit version that is not greater', () => {
    expect(resolveNextVersion('1.0.0', '0.9.0').ok).toBe(false);
  });

  it('rejects an invalid current version', () => {
    expect(resolveNextVersion('nope', 'patch').ok).toBe(false);
  });

  it('rejects an invalid release argument', () => {
    expect(resolveNextVersion('1.0.0', 'not-a-version').ok).toBe(false);
  });
});

describe('bumpManifestVersion', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitools-bump-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('writes the bumped version to aitools.json', () => {
    fs.writeFileSync(path.join(tmp, 'aitools.json'), JSON.stringify(VALID_MANIFEST), 'utf8');
    const result = bumpManifestVersion(tmp, 'patch');
    expect(result).toEqual({ ok: true, previous: '1.0.0', next: '1.0.1' });
    const updated = JSON.parse(fs.readFileSync(path.join(tmp, 'aitools.json'), 'utf8')) as {
      version: string;
    };
    expect(updated.version).toBe('1.0.1');
  });

  it('returns an error when no manifest exists', () => {
    expect(bumpManifestVersion(tmp, 'patch').ok).toBe(false);
  });

  it('returns an error when publish fields are missing', () => {
    fs.writeFileSync(
      path.join(tmp, 'aitools.json'),
      JSON.stringify({ name: 'deps-only', dependencies: {} }),
      'utf8',
    );
    expect(loadPublishManifest(tmp).ok).toBe(false);
  });
});
