// Copyright (C) 2026 Nucleic Logic Studios, LLC
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
import type { TransformConfidence } from './types.js';
import { mergeConfidence } from './types.js';

export type PluginPathMap = Record<string, string>;

export interface PathRewriteResult {
  content: string;
  warnings: string[];
  confidence: TransformConfidence;
}

function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function looksAbsoluteOrRemote(ref: string): boolean {
  if (/^(https?:|file:|npm:|npx:)/i.test(ref)) return true;
  if (/^[a-zA-Z]:[\\/]/.test(ref)) return true;
  if (ref.startsWith('/') || ref.startsWith('~/')) return true;
  if (ref.includes('${') || ref.startsWith('$')) return true;
  return false;
}

/**
 * Resolve a relative reference against the path map.
 * Tries exact keys and normalised `./`-stripped variants.
 */
export function resolveMappedPath(ref: string, pathMap: PluginPathMap): string | undefined {
  if (looksAbsoluteOrRemote(ref)) return undefined;
  const candidates = [ref, norm(ref), `./${norm(ref)}`];
  for (const c of candidates) {
    if (pathMap[c]) return pathMap[c];
  }
  // Match map keys by suffix (e.g. ref scripts/x.sh vs key scripts/x.sh)
  const n = norm(ref);
  for (const [bundleRel, finalRel] of Object.entries(pathMap)) {
    if (norm(bundleRel) === n || norm(bundleRel).endsWith(`/${n}`) || n.endsWith(norm(bundleRel))) {
      return finalRel;
    }
  }
  return undefined;
}

/**
 * Rewrite relative path references in content using a bundle→final path map.
 * Used when exploding plugins so hooks/skills/MCP still point at relocated files.
 * Layout relocate applies even when source and target platforms are the same.
 */
export function rewriteRelativePaths(content: string, pathMap: PluginPathMap): PathRewriteResult {
  if (Object.keys(pathMap).length === 0) {
    return { content, warnings: [], confidence: 'native' };
  }

  const warnings: string[] = [];
  let confidence: TransformConfidence = 'native';
  let result = content;

  // Quoted relative refs: "./scripts/x.sh", 'scripts/x.sh', "./assets/a.svg"
  const quotedRel =
    /(["'])(\.\/)?((?:scripts|assets|skills|rules|agents|commands|hooks)\/[^"'\\]+)\1/g;

  result = result.replace(quotedRel, (full, quote: string, _dot: string | undefined, body: string) => {
    const mapped = resolveMappedPath(body, pathMap) ?? resolveMappedPath(`./${body}`, pathMap);
    if (mapped) {
      confidence = mergeConfidence(confidence, 'high');
      return `${quote}${mapped}${quote}`;
    }
    warnings.push(`unresolved relative path: ${body}`);
    confidence = mergeConfidence(confidence, 'medium');
    return full;
  });

  // Unquoted JSON-ish command values sometimes appear without quotes in markdown; skip those.

  // Markdown links / images pointing at relative assets: ](./assets/x) or ](assets/x)
  const mdLink = /(\]\()(\.\/)?((?:scripts|assets|skills)\/[^)\s]+)(\))/g;
  result = result.replace(mdLink, (full, open: string, _dot: string | undefined, body: string, close: string) => {
    const mapped = resolveMappedPath(body, pathMap) ?? resolveMappedPath(`./${body}`, pathMap);
    if (mapped) {
      confidence = mergeConfidence(confidence, 'high');
      return `${open}${mapped}${close}`;
    }
    warnings.push(`unresolved relative path: ${body}`);
    confidence = mergeConfidence(confidence, 'medium');
    return full;
  });

  return { content: result, warnings, confidence };
}

/**
 * Build a path map from classified explode destinations.
 * Keys are package-relative bundle paths; values are final cwd-relative install paths.
 */
export function buildPluginPathMap(
  entries: Array<{ src: string; finalRel: string }>,
): PluginPathMap {
  const map: PluginPathMap = {};
  for (const { src, finalRel } of entries) {
    const n = norm(src);
    map[n] = finalRel;
    map[`./${n}`] = finalRel;
  }
  return map;
}
