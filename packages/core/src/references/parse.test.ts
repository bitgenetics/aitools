// Copyright (C) 2026 Nucleic Logic Studios, LLC

import {
  mergeReferenceBindings,
  parseReferenceBinding,
  parseReferenceDeclarations,
  resolveReferenceLayout,
} from './parse.js';

describe('parseReferenceDeclarations', () => {
  it('parses semver shorthand into binding objects', () => {
    expect(parseReferenceDeclarations({ sharedref: '^2.0.0' })).toEqual({
      sharedref: { range: '^2.0.0' },
    });
  });

  it('preserves object form with into and layout', () => {
    expect(
      parseReferenceDeclarations({
        sharedref: {
          range: '^2.0.0',
          into: ['skills/review', 'skills/audit'],
          layout: 'flat',
        },
      }),
    ).toEqual({
      sharedref: {
        range: '^2.0.0',
        into: ['skills/review', 'skills/audit'],
        layout: 'flat',
      },
    });
  });
});

describe('mergeReferenceBindings', () => {
  it('applies consumer referenceBindings override onto manifest declarations', () => {
    const manifest = parseReferenceDeclarations({
      sharedref: { range: '^2.0.0', into: 'skills/review' },
    });
    const merged = mergeReferenceBindings(manifest, {
      sharedref: { into: ['skills/review', 'skills/audit'] },
    });
    expect(merged.sharedref.into).toEqual(['skills/review', 'skills/audit']);
    expect(merged.sharedref.range).toBe('^2.0.0');
  });
});

describe('resolveReferenceLayout', () => {
  it('defaults to named layout', () => {
    expect(resolveReferenceLayout({ range: '^1.0.0' })).toBe('named');
  });

  it('returns flat when specified', () => {
    expect(resolveReferenceLayout({ range: '^1.0.0', layout: 'flat' })).toBe('flat');
  });
});

describe('parseReferenceBinding', () => {
  it('normalizes string input', () => {
    expect(parseReferenceBinding('^1.2.3')).toEqual({ range: '^1.2.3' });
  });
});
