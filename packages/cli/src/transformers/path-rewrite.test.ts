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
import { buildPluginPathMap, rewriteRelativePaths, resolveMappedPath } from './path-rewrite.js';

describe('buildPluginPathMap', () => {
  it('maps bundle paths to final destinations for cursor and claude roots', () => {
    const cursorMap = buildPluginPathMap([
      { src: 'scripts/format.sh', finalRel: '.cursor/skills/@team__p/scripts/format.sh' },
    ]);
    const claudeMap = buildPluginPathMap([
      { src: 'scripts/format.sh', finalRel: '.claude/skills/@team__p/scripts/format.sh' },
    ]);
    expect(cursorMap['scripts/format.sh']).toBe('.cursor/skills/@team__p/scripts/format.sh');
    expect(claudeMap['scripts/format.sh']).toBe('.claude/skills/@team__p/scripts/format.sh');
  });
});

describe('rewriteRelativePaths', () => {
  const pathMap = buildPluginPathMap([
    { src: 'scripts/format.sh', finalRel: '.cursor/skills/my-plugin/scripts/format.sh' },
    { src: 'assets/logo.svg', finalRel: '.cursor/skills/my-plugin/assets/logo.svg' },
  ]);

  it('rewrites quoted hook command paths', () => {
    const input = JSON.stringify({
      afterFileEdit: [{ command: './scripts/format.sh' }],
    });
    const result = rewriteRelativePaths(input, pathMap);
    expect(result.content).toContain('.cursor/skills/my-plugin/scripts/format.sh');
    expect(result.confidence).toBe('high');
  });

  it('rewrites markdown asset links', () => {
    const result = rewriteRelativePaths('See ![logo](./assets/logo.svg)', pathMap);
    expect(result.content).toContain('.cursor/skills/my-plugin/assets/logo.svg');
  });

  it('leaves http and env refs untouched', () => {
    const input = '{"url":"https://example.com","cmd":"${HOME}/bin/x"}';
    const result = rewriteRelativePaths(input, pathMap);
    expect(result.content).toBe(input);
    expect(result.warnings).toEqual([]);
  });

  it('warns on unresolved relative refs', () => {
    const result = rewriteRelativePaths('{"command":"./scripts/missing.sh"}', pathMap);
    expect(result.warnings.some((w) => w.includes('scripts/missing.sh'))).toBe(true);
    expect(result.confidence).toBe('medium');
  });

  it('rewrites layout paths even when platforms match (explode relocate)', () => {
    const result = rewriteRelativePaths('{"command":"scripts/format.sh"}', pathMap);
    expect(result.content).toContain('.cursor/skills/my-plugin/scripts/format.sh');
  });
});

describe('resolveMappedPath', () => {
  it('resolves ./ prefixed refs', () => {
    const map = buildPluginPathMap([{ src: 'scripts/x.sh', finalRel: 'out/x.sh' }]);
    expect(resolveMappedPath('./scripts/x.sh', map)).toBe('out/x.sh');
  });
});
