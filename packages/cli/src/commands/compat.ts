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
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  PLATFORM_SPECS,
  isSpecStale,
  ToolManifestSchema,
  normalizeCategory,
} from '@bitgenetics/aitools-core';
import type { PlatformSpec, FieldSupport } from '@bitgenetics/aitools-core';
import type { TargetPlatform } from '@bitgenetics/aitools-core';
import { estimateCategoryConfidence } from '../transformers/index.js';
import type { TransformConfidence } from '../transformers/index.js';

const MANIFEST_FILE = 'aitools.manifest.json';

interface CompatOptions {
  platform?: string;
  manifest?: string;
  fix?: boolean;
}

// -- Minimal YAML frontmatter parser ---------------------------------------
// Supports scalar string and boolean values only � sufficient for SKILL.md.

export function parseSkillFrontmatter(content: string): Record<string, string | boolean> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const result: Record<string, string | boolean> = {};
  for (const line of (match[1]!).split('\n')) {
    if (/^\s/.test(line)) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const raw = line.slice(colonIdx + 1).trim();
    if (raw === 'true') result[key] = true;
    else if (raw === 'false') result[key] = false;
    else if (raw.startsWith('>-') || raw === '') continue; // multi-line � skip for now
    else result[key] = raw.replace(/^['"]|['"]$/g, '');
  }
  return result;
}

/**
 * Remove a set of frontmatter fields from a SKILL.md file content.
 * Returns the rewritten content string.
 */
export function rewriteSkillFrontmatter(content: string, fieldsToRemove: Set<string>): string {
  const sep = '---';
  const firstCloseIdx = content.indexOf('\n---', content.indexOf('---') + 3);
  if (firstCloseIdx === -1) return content;
  const fmBlock = content.slice(content.indexOf('\n') + 1, firstCloseIdx);
  const rest = content.slice(firstCloseIdx + 4);
  const filtered = fmBlock
    .split('\n')
    .filter((line) => {
      if (/^\s/.test(line)) return true;
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return true;
      const key = line.slice(0, colonIdx).trim();
      return !fieldsToRemove.has(key);
    })
    .join('\n');
  return sep + '\n' + filtered + '\n---' + rest;
}


// -- Compatibility analysis -------------------------------------------------

export interface FieldIssue {
  field: string;
  support: FieldSupport;
  note?: string;
}

export interface PlatformResult {
  spec: PlatformSpec;
  stale: boolean;
  categorySupported: boolean;
  fieldIssues: FieldIssue[];
  transformConfidence?: TransformConfidence;
}

export function analyzeCompat(
  skillFields: Record<string, string | boolean>,
  category: string,
  targetPlatforms: TargetPlatform[],
  nativeFor?: TargetPlatform,
): PlatformResult[] {
  const { category: normalized } = normalizeCategory(category as never);

  return targetPlatforms.map((platformId) => {
    const spec = PLATFORM_SPECS[platformId];
    const stale = isSpecStale(spec);
    const categorySupported =
      spec.supportedCategories.includes(category as never) ||
      spec.supportedCategories.includes(normalized as never);

    const fieldIssues: FieldIssue[] = [];
    if (categorySupported && (normalized === 'skill' || category === 'skill')) {
      for (const field of Object.keys(skillFields)) {
        const fieldSpec = spec.skillFrontmatter[field];
        if (!fieldSpec) {
          fieldIssues.push({ field, support: 'unknown', note: 'Not in platform spec data' });
        } else if (fieldSpec.support !== 'supported') {
          fieldIssues.push({ field, support: fieldSpec.support, note: fieldSpec.note });
        }
      }
    }

    const source = nativeFor ?? 'universal';
    const transformConfidence = estimateCategoryConfidence(normalized, source, platformId);

    return { spec, stale, categorySupported, fieldIssues, transformConfidence };
  });
}

// -- Output formatting ------------------------------------------------------

function supportIcon(support: FieldSupport): string {
  switch (support) {
    case 'supported':   return chalk.green('?');
    case 'ignored':     return chalk.yellow('?');
    case 'unsupported': return chalk.red('?');
    case 'unknown':     return chalk.dim('?');
  }
}

function overallIcon(result: PlatformResult): string {
  if (!result.categorySupported) return chalk.red('?');
  if (result.stale) return chalk.dim('?');
  if (result.fieldIssues.some((i) => i.support === 'unsupported')) return chalk.red('?');
  if (result.fieldIssues.some((i) => i.support === 'ignored' || i.support === 'unknown')) return chalk.yellow('?');
  return chalk.green('?');
}

function confidenceColor(c: TransformConfidence): (s: string) => string {
  switch (c) {
    case 'native':
    case 'high':
      return chalk.green;
    case 'medium':
      return chalk.yellow;
    case 'low':
      return chalk.yellow;
    case 'unsupported':
      return chalk.red;
    default:
      return chalk.dim;
  }
}

function overallLabel(result: PlatformResult): string {
  if (!result.categorySupported) return chalk.red('category not supported');
  if (result.stale) return chalk.dim(`spec data unverified (last checked ${result.spec.lastVerified})`);
  if (result.fieldIssues.length === 0 && result.transformConfidence) {
    const tc = result.transformConfidence;
    if (tc === 'native' || tc === 'high') return chalk.green('fully compatible');
    return confidenceColor(tc)(`transform: ${tc}`);
  }
  if (result.fieldIssues.length === 0) return chalk.green('fully compatible');
  const ignored = result.fieldIssues.filter((i) => i.support === 'ignored');
  const unknown = result.fieldIssues.filter((i) => i.support === 'unknown');
  const parts: string[] = [];
  if (ignored.length) parts.push(chalk.yellow(`${ignored.map((i) => i.field).join(', ')} ignored`));
  if (unknown.length) parts.push(chalk.dim(`${unknown.map((i) => i.field).join(', ')} unverified`));
  return parts.join('; ');
}

// -- Command ----------------------------------------------------------------

export function createCompatCommand(): Command {
  return new Command('compat')
    .description('Audit platform compatibility of a tool package')
    .option('-m, --manifest <path>', `Path to manifest file (default: ./${MANIFEST_FILE})`)
    .option('-p, --platform <platform>', 'Check a specific platform only')
    .option('--fix', 'Rewrite the skill file, stripping frontmatter fields unsupported on the target platform(s)')
    .action(async (options: CompatOptions) => {
      const cwd = process.cwd();
      const manifestPath = options.manifest
        ? path.resolve(options.manifest)
        : path.join(cwd, MANIFEST_FILE);

      if (!fs.existsSync(manifestPath)) {
        console.error(chalk.red(`No manifest found at ${manifestPath}`));
        process.exit(1);
      }

      let raw: unknown;
      try {
        raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        console.error(chalk.red(`Cannot parse ${manifestPath}: invalid JSON`));
        process.exit(1);
      }

      const parsed = ToolManifestSchema.safeParse(raw);
      if (!parsed.success) {
        console.error(chalk.red('Manifest validation failed � run `aitools manifest validate` first'));
        process.exit(1);
      }

      const manifest = parsed.data;
      const manifestDir = path.dirname(manifestPath);

      // Read SKILL.md frontmatter when category is skill
      let skillFields: Record<string, string | boolean> = {};
      if (manifest.category === 'skill') {
        const skillFile = manifest.files.find((f) => f.src.endsWith('SKILL.md'));
        if (skillFile) {
          const skillPath = path.resolve(manifestDir, skillFile.src);
          if (fs.existsSync(skillPath)) {
            const content = fs.readFileSync(skillPath, 'utf8');
            skillFields = parseSkillFrontmatter(content) ?? {};
          }
        }
      }

      const targetPlatforms = options.platform
        ? [options.platform as TargetPlatform]
        : (Object.keys(PLATFORM_SPECS) as TargetPlatform[]);

      // Validate platform option
      for (const p of targetPlatforms) {
        if (!PLATFORM_SPECS[p]) {
          console.error(chalk.red(`Unknown platform: ${p}`));
          console.error(`  Known platforms: ${Object.keys(PLATFORM_SPECS).join(', ')}`);
          process.exit(1);
        }
      }

      const results = analyzeCompat(skillFields, manifest.category, targetPlatforms, manifest.nativeFor);

      // -- Print results ----------------------------------------------------
      console.log(`\n  ${chalk.bold('Compatibility:')} ${chalk.cyan(manifest.name)}@${manifest.version}\n`);
      console.log(`  ${chalk.dim('category:')} ${manifest.category}`);
      if (manifest.nativeFor) {
        console.log(`  ${chalk.dim('nativeFor:')} ${manifest.nativeFor}`);
      }

      if (manifest.category === 'skill' && Object.keys(skillFields).length > 0) {
        console.log(`  ${chalk.dim('frontmatter fields:')} ${Object.keys(skillFields).join(', ')}`);
      }

      console.log('');

      for (const result of results) {
        const icon = overallIcon(result);
        const label = overallLabel(result);
        const namePad = result.spec.name.padEnd(30);
        console.log(`  ${icon} ${chalk.bold(namePad)} ${label}`);

        if (result.transformConfidence && manifest.nativeFor && manifest.nativeFor !== result.spec.id) {
          console.log(
            `      ${chalk.dim('transform')} ${confidenceColor(result.transformConfidence)(result.transformConfidence)}`,
          );
        }

        for (const issue of result.fieldIssues) {
          const fi = supportIcon(issue.support);
          const notePart = issue.note ? chalk.dim(` � ${issue.note}`) : '';
          console.log(`      ${fi} ${chalk.dim(issue.field)}${notePart}`);
        }

        if (result.stale) {
          console.log(
            `      ${chalk.dim('!')} ${chalk.dim(`Spec last verified ${result.spec.lastVerified} � re-verify at ${result.spec.docsUrl}`)}`,
          );
        }
      }

      console.log('');

      const hasIssues = results.some(
        (r) => !r.categorySupported || r.fieldIssues.some((i) => i.support !== 'supported'),
      );

      if (!hasIssues) {
        console.log(`  ${chalk.green('All platforms compatible.')}\n`);
      } else {
        console.log(
          `  ${chalk.yellow('?')} ${chalk.yellow('Compatibility issues found.')} ` +
          chalk.dim('Use --platform to check a specific platform.\n'),
        );
      }

      // -- fix: rewrite SKILL.md
      if (options.fix && manifest.category === 'skill') {
        const fixSkillFile = manifest.files.find((f) => f.src.endsWith('SKILL.md'));
        if (fixSkillFile) {
          const fixSkillPath = path.resolve(manifestDir, fixSkillFile.src);
          if (fs.existsSync(fixSkillPath)) {
            const fieldBadOnAllPlatforms = new Set<string>();
            for (const field of Object.keys(skillFields)) {
              const badOnAll = results.every((r) =>
                r.categorySupported &&
                r.fieldIssues.some((i) => i.field === field && (i.support === 'unsupported' || i.support === 'ignored')),
              );
              if (badOnAll) fieldBadOnAllPlatforms.add(field);
            }
            if (fieldBadOnAllPlatforms.size > 0) {
              const original = fs.readFileSync(fixSkillPath, 'utf8');
              const rewritten = rewriteSkillFrontmatter(original, fieldBadOnAllPlatforms);
              fs.writeFileSync(fixSkillPath, rewritten, 'utf8');
              console.log(chalk.green(`  Fixed: removed fields: ${[...fieldBadOnAllPlatforms].join(', ')}\n`));
            } else {
              console.log(chalk.dim('  --fix: no fields to remove.\n'));
            }
          }
        }
      }

      // -- fix: rewrite SKILL.md
      if (options.fix && manifest.category === 'skill') {
        const fixSkillFile = manifest.files.find((f) => f.src.endsWith('SKILL.md'));
        if (fixSkillFile) {
          const fixSkillPath = path.resolve(manifestDir, fixSkillFile.src);
          if (fs.existsSync(fixSkillPath)) {
            const fieldBadOnAllPlatforms = new Set<string>();
            for (const field of Object.keys(skillFields)) {
              const badOnAll = results.every((r) =>
                r.categorySupported &&
                r.fieldIssues.some((i) => i.field === field && (i.support === 'unsupported' || i.support === 'ignored')),
              );
              if (badOnAll) fieldBadOnAllPlatforms.add(field);
            }
            if (fieldBadOnAllPlatforms.size > 0) {
              const original = fs.readFileSync(fixSkillPath, 'utf8');
              const rewritten = rewriteSkillFrontmatter(original, fieldBadOnAllPlatforms);
              fs.writeFileSync(fixSkillPath, rewritten, 'utf8');
              console.log(chalk.green(`  Fixed: removed fields: ${[...fieldBadOnAllPlatforms].join(', ')}\n`));
            } else {
              console.log(chalk.dim('  --fix: no fields to remove.\n'));
            }
          }
        }
      }
    });
}