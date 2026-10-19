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
import { parseFrontmatter, serializeFrontmatter, stringListField } from './frontmatter.js';
import { replaceVendorExtension } from './extensions.js';
import { detectVendorFrontmatter } from './detect.js';

describe('parseFrontmatter', () => {
  it('parses scalar and list fields', () => {
    const doc = parseFrontmatter('---\ndescription: Style\nglobs:\n  - "*.ts"\nalwaysApply: true\n---\nBody');
    expect(doc.fields).toEqual({ description: 'Style', globs: ['*.ts'], alwaysApply: true });
  });

  it('returns the body after the closing marker', () => {
    expect(parseFrontmatter('---\na: 1\n---\n# Body\n').body).toBe('# Body\n');
  });

  it('reports no frontmatter for plain content', () => {
    const doc = parseFrontmatter('# Body');
    expect(doc).toEqual({ fields: {}, body: '# Body', hasFrontmatter: false });
  });

  it('reports an error for a block that is not a mapping', () => {
    expect(parseFrontmatter('---\n- a\n- b\n---\nBody').error).toBeDefined();
  });

  it('reports an error for invalid YAML', () => {
    expect(parseFrontmatter('---\nglobs: [unclosed\n---\nBody').error).toBeDefined();
  });

  it('accepts CRLF line endings', () => {
    expect(parseFrontmatter('---\r\nname: x\r\n---\r\nBody').fields).toEqual({ name: 'x' });
  });
});

describe('serializeFrontmatter', () => {
  it('round-trips through parseFrontmatter', () => {
    const fields = { description: 'Style guide', globs: ['*.ts'], alwaysApply: true };
    expect(parseFrontmatter(serializeFrontmatter(fields, 'Body')).fields).toEqual(fields);
  });

  it('skips undefined fields', () => {
    expect(serializeFrontmatter({ a: undefined, b: 'x' }, 'Body')).toBe('---\nb: x\n---\nBody');
  });

  it('returns the body alone when no field is set', () => {
    expect(serializeFrontmatter({ a: undefined }, 'Body')).toBe('Body');
  });
});

describe('stringListField', () => {
  it('splits a comma-separated string', () => {
    expect(stringListField('a, b,c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps a YAML list', () => {
    expect(stringListField(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('returns undefined for an empty or non-string value', () => {
    expect([stringListField(''), stringListField(3), stringListField([])]).toEqual([undefined, undefined, undefined]);
  });
});

describe('replaceVendorExtension', () => {
  it('replaces a compound vendor suffix as a whole', () => {
    expect(replaceVendorExtension('style.instructions.md', '.mdc')).toBe('style.mdc');
  });

  it('replaces a plain extension', () => {
    expect(replaceVendorExtension('dir.v1/cmd.md', '.prompt.md')).toBe('dir.v1/cmd.prompt.md');
  });

  it('appends when the filename has no extension', () => {
    expect(replaceVendorExtension('dir.v1/README', '.md')).toBe('dir.v1/README.md');
  });
});

describe('detectVendorFrontmatter', () => {
  it('attributes alwaysApply to cursor', () => {
    expect(detectVendorFrontmatter('---\ndescription: x\nalwaysApply: true\n---\nBody', 'rule')).toEqual([
      { field: 'alwaysApply', vendor: 'cursor' },
    ]);
  });

  it('reports nothing for common fields', () => {
    expect(detectVendorFrontmatter('---\nname: a\ndescription: b\nmodel: c\n---\nBody', 'agent')).toEqual([]);
  });

  it('attributes readonly to cursor for agents', () => {
    expect(detectVendorFrontmatter('---\nname: a\nreadonly: true\n---\nBody', 'agent')).toEqual([
      { field: 'readonly', vendor: 'cursor' },
    ]);
  });

  it('attributes argument-hint to a vendor for commands', () => {
    const found = detectVendorFrontmatter('---\nargument-hint: file\n---\nBody', 'command');
    expect(found.map((f) => f.field)).toEqual(['argument-hint']);
  });

  it('reports nothing when there is no frontmatter', () => {
    expect(detectVendorFrontmatter('Body', 'rule')).toEqual([]);
  });
});
