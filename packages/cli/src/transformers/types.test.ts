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
import {
  annotate,
  buildSkillPrompt,
  mergeConfidence,
  nativeResult,
  passthrough,
  unsupportedCategory,
  withSkillPrompt,
} from './types.js';

describe('transformer types helpers', () => {
  it('buildSkillPrompt formats the convert invocation', () => {
    expect(buildSkillPrompt('file.md', 'review hooks')).toContain('/aitools-convert');
    expect(buildSkillPrompt('file.md', 'review hooks')).toContain('file.md');
  });

  it('annotate prefixes content with an aitools marker', () => {
    expect(annotate('body', 'lossy section')).toBe('# aitools: lossy section\nbody');
  });

  it('mergeConfidence returns the lower confidence level', () => {
    expect(mergeConfidence('high', 'low')).toBe('low');
    expect(mergeConfidence('native', 'medium')).toBe('medium');
    expect(mergeConfidence('unsupported', 'high')).toBe('unsupported');
  });

  it('withSkillPrompt leaves high confidence results unchanged', () => {
    const result = passthrough('x');
    expect(withSkillPrompt(result, 'dest', 'summary').skillPrompt).toBeUndefined();
  });

  it('withSkillPrompt adds skillPrompt for medium confidence', () => {
    const result = { content: 'x', confidence: 'medium' as const, warnings: ['w'] };
    const updated = withSkillPrompt(result, 'dest.md', 'needs review');
    expect(updated.skillPrompt).toContain('/aitools-convert');
  });

  it('nativeResult includes optional destExtension', () => {
    expect(nativeResult('x', '.md').destExtension).toBe('.md');
  });

  it('unsupportedCategory includes category and platform in warnings', () => {
    const result = unsupportedCategory('agent', 'windsurf');
    expect(result.confidence).toBe('unsupported');
    expect(result.warnings[0]).toContain('windsurf');
  });
});
