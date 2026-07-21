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
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Command } from 'commander';
import chalk from 'chalk';
import semver from 'semver';
import { ToolManifestSchema, MANIFEST_FILENAME, LEGACY_PUBLISH_MANIFEST_FILENAME, readManifest, writeManifest, isPublishable, AitoolsJsonSchema, validatePluginStructure, parseCursorPluginJson, getPluginBundleScanPlan, resolvePluginBundleSources, analyzePluginPortability, scaffoldAnchorSkill, resolvePluginBundleInstallBase } from '@bitgenetics/aitools-core';
import type { AiToolsManifest, ToolFile, PluginPortabilityResult } from '@bitgenetics/aitools-core';

type Category = 'skill' | 'subagent' | 'prompt' | 'mcp-tool' | 'plugin';
type ContentCategory = Exclude<Category, 'plugin'>;

interface ContentInitProfile {
  exts: string[];
  placeholder: (name: string) => string;
  unitLabel: string;
}

/**
 * Folder name used under the platform category install dir (e.g. `.cursor/skills/<folder>/`).
 * Unscopes npm-style names (`@org/pkg` → `pkg`).
 */
function packageInstallFolder(packageName: string): string {
  const trimmed = packageName.trim();
  if (!trimmed) return 'tool';
  const unscoped = trimmed.includes('/')
    ? trimmed.slice(trimmed.lastIndexOf('/') + 1)
    : trimmed;
  return unscoped || 'tool';
}

/**
 * Default `files[].dest` for content packages: nest under the package install folder
 * unless `src` is already under that folder. MCP tools and plugins keep author paths.
 */
function defaultInstallDest(src: string, packageName: string): string {
  const normalized = src.replace(/\\/g, '/').replace(/^\.\//, '');
  const folder = packageInstallFolder(packageName);
  if (normalized === folder || normalized.startsWith(`${folder}/`)) {
    return normalized;
  }
  return `${folder}/${normalized}`;
}

/** Build a files[] entry with default strict placement. */
function fileEntry(src: string, dest: string): ToolFile {
  return { src, dest, placementMode: 'strict' };
}

function mapSrcToInstallFiles(
  srcs: string[],
  packageName: string,
): ToolFile[] {
  return srcs.map((src) => fileEntry(src, defaultInstallDest(src, packageName)));
}

const CONTENT_INIT_PROFILE: Record<ContentCategory, ContentInitProfile> = {
  skill: {
    exts: ['.md'],
    placeholder: (name) => `${packageInstallFolder(name)}/SKILL.md`,
    unitLabel: 'skill',
  },
  subagent: {
    exts: ['.md'],
    placeholder: (name) => `${packageInstallFolder(name)}/agent.md`,
    unitLabel: 'subagent',
  },
  prompt: {
    exts: ['.md'],
    placeholder: (name) => `${packageInstallFolder(name)}/prompt.md`,
    unitLabel: 'prompt',
  },
  'mcp-tool': {
    exts: ['.ts', '.js'],
    placeholder: () => 'server.js',
    unitLabel: 'MCP server',
  },
};

const CATEGORY_EXT: Record<Category, string[]> = {
  skill: CONTENT_INIT_PROFILE.skill.exts,
  subagent: CONTENT_INIT_PROFILE.subagent.exts,
  prompt: CONTENT_INIT_PROFILE.prompt.exts,
  'mcp-tool': CONTENT_INIT_PROFILE['mcp-tool'].exts,
  plugin: ['.md', '.mdc', '.json', '.ts', '.js', '.yaml', '.yml', '.toml', '.sh'],
};

function isContentCategory(category: Category): category is ContentCategory {
  return category !== 'plugin';
}

/**
 * Well-known project metadata files that should not be packaged as tool content.
 * Auto-detection skips these.
 */
const SKIP_FILES = new Set([
  'CHANGELOG.md', 'changelog.md',
  'LICENSE', 'LICENSE.md', 'license.md',
  'CONTRIBUTING.md', 'contributing.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'NOTICE', 'NOTICE.md',
  'aitools.json',
  'aitools.manifest.json',
  'aitools-lock.json',
  'aitools.config.json',
  'README.md', 'readme.md',
]);

/**
 * Directories that should never be traversed during auto-detection.
 * We use an explicit blocklist (not a blanket 'starts with .' rule) so that
 * directories like .github, .agents, .claude, and .cursor are traversed �
 * they are valid locations for tool content files.
 */
const SKIP_DIRS = new Set([
  // Version control
  '.git', '.svn', '.hg',
  // Dependencies & build output
  'node_modules', 'vendor', 'dist', 'build', 'out', 'coverage',
  // Framework/tooling caches
  '.cache', '.next', '.nuxt', '.turbo', '.parcel-cache', '.tsbuildinfo',
  // IDE config (not content)
  '.vscode', '.idea',
]);

/**
 * Recursively detect content files under `dir` matching `exts`, returning
 * paths relative to `root`. Hidden directories are traversed unless they
 * appear in SKIP_DIRS, so .github, .agents, .claude, .cursor, etc. are
 * all searched.
 *
 * When `exts` is empty, all non-skipped files are collected (used for assets/scripts).
 */
function detectFiles(root: string, exts: string[], dir: string = root): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry);
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) {
        results.push(...detectFiles(root, exts, abs));
      }
    } else if (
      stat.isFile() &&
      !SKIP_FILES.has(entry) &&
      (exts.length === 0 || exts.includes(path.extname(entry).toLowerCase()))
    ) {
      results.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  }
  return results.sort();
}

/**
 * Read `.cursor-plugin/plugin.json` when present.
 */
function readCursorPluginJson(cwd: string) {
  const pluginJsonPath = path.join(cwd, '.cursor-plugin', 'plugin.json');
  if (!fs.existsSync(pluginJsonPath)) return null;
  try {
    return parseCursorPluginJson(fs.readFileSync(pluginJsonPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Collect plugin bundle files from author layout roots only (`skills/`, `rules/`, …).
 * Excludes platform install dirs (`.cursor/skills/`, `.agents/`, …) and other orphans.
 */
function collectPluginInitFiles(
  cwd: string,
  packageName: string,
): { files: ToolFile[]; warnings: string[] } {
  const pluginJson = readCursorPluginJson(cwd);
  const plan = getPluginBundleScanPlan(pluginJson);
  const exts = CATEGORY_EXT.plugin;
  const candidates: string[] = [];

  for (const dir of plan.directories) {
    const abs = path.join(cwd, ...dir.replace(/\/$/, '').split('/'));
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      const dirExts =
        dir === 'assets/' || dir === 'scripts/' ? [] : exts;
      candidates.push(...detectFiles(cwd, dirExts, abs));
    }
  }

  for (const file of plan.files) {
    const abs = path.join(cwd, ...file.split('/'));
    if (
      fs.existsSync(abs) &&
      fs.statSync(abs).isFile() &&
      exts.includes(path.extname(file).toLowerCase()) &&
      !SKIP_FILES.has(path.basename(file))
    ) {
      candidates.push(file);
    }
  }

  const unique = [...new Set(candidates)].sort();
  const { sources, errors } = resolvePluginBundleSources(unique, {
    packageName,
    sources: unique,
    pluginJson,
  });

  const files = sources.map((src: string) => fileEntry(src, src));
  return { files, warnings: errors };
}

/**
 * Ensure a plugin bundle has an anchor (hub) skill named after the package.
 * When absent, scaffolds `skills/<anchor>/SKILL.md` (respecting plugin.json skill root
 * overrides), seeds the managed skill-map from the other member skills, and adds the
 * file to `files[]`. No-op when an anchor skill already exists.
 */
function ensureAnchorSkillScaffold(
  cwd: string,
  packageName: string,
  files: ToolFile[],
): ToolFile[] {
  const pluginJson = readCursorPluginJson(cwd);
  const portability = analyzePluginPortability({
    packageName,
    sources: files.map((f) => f.src),
    pluginJson,
  });
  if (portability.hasAnchor) return files;

  const anchor = portability.anchor;
  const skillsBase = resolvePluginBundleInstallBase('skill', cwd, pluginJson);
  const abs = path.join(skillsBase, anchor, 'SKILL.md');
  const rel = path.relative(cwd, abs).split(path.sep).join('/');

  if (!fs.existsSync(abs)) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, scaffoldAnchorSkill(anchor, portability.memberSkills), 'utf8');
    console.log(chalk.dim(`  Scaffolded anchor skill: ${rel}`));
  }

  if (!files.some((f) => f.src.replace(/\\/g, '/') === rel)) {
    return [...files, fileEntry(rel, rel)].sort((a, b) => a.src.localeCompare(b.src));
  }
  return files;
}

/**
 * Files sitting directly in `dir` (not nested) that match `exts`, returned
 * relative to `root`.
 */
function detectDirectContentFiles(
  dir: string,
  root: string,
  exts: string[],
): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const results: string[] = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry);
    try {
      if (
        fs.statSync(abs).isFile() &&
        !SKIP_FILES.has(entry) &&
        exts.includes(path.extname(entry).toLowerCase())
      ) {
        results.push(path.relative(root, abs).split(path.sep).join('/'));
      }
    } catch {
      // ignore unreadable entries
    }
  }
  return results.sort();
}

/**
 * Returns the set of top-level "skill folders" � directories that directly
 * contain at least one file matching the given extensions.  Each entry holds
 * the folder path (relative to root) and all files within it (recursive).
 */
function detectContentFolders(
  root: string,
  exts: string[],
): Array<{ folder: string; files: string[] }> {
  const results: Array<{ folder: string; files: string[] }> = [];

  function scan(dir: string): void {
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }

    // Check whether this directory directly contains matching files.
    const hasDirectFiles = entries.some((e) => {
      try {
        return (
          fs.statSync(path.join(dir, e)).isFile() &&
          exts.includes(path.extname(e).toLowerCase()) &&
          !SKIP_FILES.has(e)
        );
      } catch {
        return false;
      }
    });

    if (dir !== root && hasDirectFiles) {
      // This is a skill folder � collect all its files recursively and stop descending.
      const files = detectFiles(root, exts, dir);
      if (files.length > 0) {
        results.push({ folder: path.relative(root, dir).replace(/\\/g, '/'), files });
      }
      return;
    }

    // No direct files here � descend into subdirectories.
    for (const entry of entries) {
      const abs = path.join(dir, entry);
      try {
        if (fs.statSync(abs).isDirectory() && !SKIP_DIRS.has(entry)) {
          scan(abs);
        }
      } catch {
        // ignore unreadable entries
      }
    }
  }

  scan(root);
  return results;
}

function collectDetectedContent(
  cwd: string,
  category: ContentCategory,
): { rootFiles: string[]; contentFolders: Array<{ folder: string; files: string[] }> } {
  const { exts } = CONTENT_INIT_PROFILE[category];
  return {
    rootFiles: detectDirectContentFiles(cwd, cwd, exts),
    contentFolders: detectContentFolders(cwd, exts),
  };
}

function contentPlaceholder(category: ContentCategory, name: string): string {
  return CONTENT_INIT_PROFILE[category].placeholder(name);
}

function collectAllContentFiles(
  cwd: string,
  category: ContentCategory,
): string[] {
  const { rootFiles, contentFolders } = collectDetectedContent(cwd, category);
  return [...new Set([...rootFiles, ...contentFolders.flatMap((f) => f.files)])].sort();
}

const MCP_SERVER_ENTRY_NAMES = ['server.js', 'server.ts', 'index.js', 'index.ts'];

function buildMcpServerForFile(
  primary: string,
): { command: string; args: string[]; type: 'stdio' } {
  if (primary.endsWith('.ts')) {
    return {
      command: 'npx',
      args: ['tsx', `\${installDir}/${primary}`],
      type: 'stdio',
    };
  }
  return {
    command: 'node',
    args: [`\${installDir}/${primary}`],
    type: 'stdio',
  };
}

function defaultMcpServerForInit(
  files: Array<{ src: string }>,
): { command: string; args: string[]; type: 'stdio' } {
  const candidates = files.filter(
    (f) => f.src.endsWith('.js') || f.src.endsWith('.ts'),
  );

  for (const entryName of MCP_SERVER_ENTRY_NAMES) {
    const match = candidates
      .filter((f) => f.src === entryName || f.src.endsWith(`/${entryName}`))
      .sort((a, b) => a.src.length - b.src.length)[0];
    if (match) {
      return buildMcpServerForFile(match.src);
    }
  }

  const rootLevel = candidates
    .filter((f) => !f.src.includes('/'))
    .sort((a, b) => a.src.localeCompare(b.src));
  if (rootLevel.length > 0) {
    return buildMcpServerForFile(rootLevel[0]!.src);
  }

  const primary =
    candidates.sort((a, b) => a.src.localeCompare(b.src))[0]?.src ?? 'server.js';
  return buildMcpServerForFile(primary);
}

type ReadlineLike = { question: (query: string) => Promise<string> };

async function promptForContentFiles(
  rl: ReadlineLike,
  category: ContentCategory,
  cwd: string,
  name: string,
): Promise<ToolFile[]> {
  const { unitLabel } = CONTENT_INIT_PROFILE[category];
  const { rootFiles, contentFolders } = collectDetectedContent(cwd, category);

  if (rootFiles.length > 0 || contentFolders.length > 0) {
    const parts: string[] = [];
    if (rootFiles.length > 0) {
      parts.push(
        rootFiles.length === 1
          ? '1 root-level file'
          : `${rootFiles.length} root-level files`,
      );
    }
    if (contentFolders.length > 0) {
      parts.push(
        contentFolders.length === 1
          ? '1 folder'
          : `${contentFolders.length} folders`,
      );
    }
    console.log(
      chalk.bold(`\n  Detected ${parts.join(' and ')}. Select which to include:\n`),
    );

    const included: ToolFile[] = [];
    const toDest = (src: string) =>
      category === 'mcp-tool' ? src : defaultInstallDest(src, name);

    if (rootFiles.length > 0) {
      const rootLabel =
        rootFiles.length === 1
          ? rootFiles[0]
          : `root-level files (${rootFiles.join(', ')})`;
      const ans = (await rl.question(`  Include ${chalk.cyan(rootLabel)}? (Y/n): `)).trim();
      if (ans === '' || ans.toLowerCase().startsWith('y')) {
        for (const f of rootFiles) {
          included.push(fileEntry(f, toDest(f)));
        }
      }
    }

    for (const { folder, files: folderFiles } of contentFolders) {
      const ans = (await rl.question(`  Include ${chalk.cyan(folder)}? (Y/n): `)).trim();
      if (ans === '' || ans.toLowerCase().startsWith('y')) {
        for (const f of folderFiles) {
          included.push(fileEntry(f, toDest(f)));
        }
      }
    }

    if (included.length > 0) {
      return included;
    }

    if (category === 'mcp-tool') {
      console.log(chalk.dim(`\n  No ${unitLabel} files selected.`));
      return [];
    }

    // Had folder/root candidates but user excluded all — caller may offer per-file picker.
    console.log(chalk.dim(`\n  No folders or root files selected.`));
    return [];
  }

  const detected = collectAllContentFiles(cwd, category);
  if (detected.length > 0) {
    console.log(chalk.dim(`\n  Auto-detected ${detected.length} matching file(s).`));
    if (category === 'mcp-tool') {
      return detected.map((f) => fileEntry(f, f));
    }
    return mapSrcToInstallFiles(detected, name);
  }

  if (category === 'mcp-tool') {
    console.log(
      chalk.dim(`\n  No matching ${unitLabel} files found. Scaffolding mcpServer with placeholder server.js.`),
    );
    return [];
  }

  const placeholder = contentPlaceholder(category, name);
  console.log(
    chalk.dim(`\n  No matching ${unitLabel} files found. Using placeholder: ${placeholder}`),
  );
  return [fileEntry(placeholder, placeholder)];
}

function resolveContentInitFilesNonInteractive(
  cwd: string,
  category: ContentCategory,
  name: string,
): ToolFile[] {
  const detected = collectAllContentFiles(cwd, category);
  if (detected.length > 0) {
    if (category === 'mcp-tool') {
      return detected.map((f) => fileEntry(f, f));
    }
    return mapSrcToInstallFiles(detected, name);
  }
  if (category === 'mcp-tool') {
    return [];
  }
  const placeholder = contentPlaceholder(category, name);
  console.log(chalk.dim('  Note: no matching files found — using placeholder filename'));
  return [fileEntry(placeholder, placeholder)];
}

function collectManifestFileCandidates(
  cwd: string,
  category: Category,
  name: string,
): string[] {
  if (category === 'plugin') {
    return collectPluginInitFiles(cwd, name).files.map((f) => f.src);
  }
  if (isContentCategory(category)) {
    return collectAllContentFiles(cwd, category);
  }
  return detectFiles(cwd, CATEGORY_EXT[category] ?? ['.md']);
}

function mergeFileSelections(
  existing: ToolFile[],
  candidates: string[],
  selected: ToolFile[],
  force: boolean,
): ToolFile[] {
  if (force) {
    return selected;
  }
  const candidateSet = new Set(candidates);
  const kept = existing.filter((f) => !candidateSet.has(f.src));
  return [...kept, ...selected].sort((a, b) => a.src.localeCompare(b.src));
}

function resolveManifestFilesNonInteractive(
  candidates: string[],
  category: Category,
  name: string,
): ToolFile[] {
  if (category === 'plugin' || category === 'mcp-tool') {
    return candidates.map((src) => fileEntry(src, src));
  }
  return mapSrcToInstallFiles(candidates, name);
}

async function promptForManifestFiles(
  rl: ReadlineLike,
  cwd: string,
  category: Category,
  name: string,
  existingFiles: ToolFile[] = [],
): Promise<ToolFile[]> {
  const candidates = collectManifestFileCandidates(cwd, category, name);
  if (candidates.length === 0) {
    console.log(chalk.dim('\n  No matching files found on disk.'));
    return [];
  }

  const existingBySrc = new Map(existingFiles.map((f) => [f.src, f]));
  console.log(
    chalk.bold(`\n  Found ${candidates.length} file(s). Mark include and dest for each:\n`),
  );

  const selected: ToolFile[] = [];
  for (const src of candidates) {
    const existing = existingBySrc.get(src);
    const defaultInclude = existing !== undefined ? 'Y' : 'Y';
    console.log(`  ${chalk.cyan(src)}`);
    const includeAns = (
      await rl.question(`    Include? (${defaultInclude}/n): `)
    ).trim();
    const include =
      includeAns === ''
        ? defaultInclude.toLowerCase().startsWith('y')
        : includeAns.toLowerCase().startsWith('y');
    if (!include) {
      continue;
    }

    const defaultDest = existing?.dest ?? (
      category === 'plugin' || category === 'mcp-tool'
        ? src
        : defaultInstallDest(src, name)
    );
    const destAns = (await rl.question(`    dest (${defaultDest}): `)).trim();
    const dest =
      destAns === '' ? defaultDest : destAns === '-' ? src : destAns;
    selected.push({
      src,
      dest,
      placementMode: existing?.placementMode ?? 'strict',
    });
  }
  return selected;
}

function mcpServerNeedsRefresh(
  mcpServer: { args?: string[] } | undefined,
  files: Array<{ src: string }>,
): boolean {
  if (!mcpServer) {
    return true;
  }
  const primary = defaultMcpServerForInit(files);
  const currentPath = mcpServer.args?.find((a) => a.includes('${installDir}'));
  const expectedPath = primary.args.find((a) => a.includes('${installDir}'));
  return currentPath !== expectedPath;
}

function parseFileEntry(
  entry: string,
  category: Category,
  packageName: string,
): ToolFile {
  const sep = entry.indexOf(':');
  if (sep !== -1) {
    return fileEntry(entry.slice(0, sep), entry.slice(sep + 1));
  }
  const src = entry;
  if (category === 'plugin' || category === 'mcp-tool') {
    return fileEntry(src, path.basename(src));
  }
  return fileEntry(src, defaultInstallDest(src, packageName));
}

// -- Shared manifest write + print ---------------------------------------------

type ManifestInput = {
  name: string;
  version: string;
  description: string;
  category: string;
  nativeFor?: string;
  files: ToolFile[];
  mcpServer?: { command: string; args: string[]; type: 'stdio' };
  author?: string;
  repository?: string;
  keywords?: string[];
  tags?: string[];
  platforms?: string[];
};

function writeAndPrintManifest(cwd: string, manifest: ManifestInput): void {
  const parsed = ToolManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    console.error(chalk.red('Manifest validation failed:'));
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || 'root';
      console.error(`  ${chalk.red('?')} ${chalk.bold(field)}: ${issue.message}`);
    }
    console.error(chalk.dim('  Fix the issues above and try again.'));
    process.exit(1);
  }

  const existing = readManifest(cwd) ?? {};
  const merged: AiToolsManifest = { ...existing, ...parsed.data };
  writeManifest(cwd, merged);
  console.log(chalk.green(`\n  ? Updated ${MANIFEST_FILENAME}`));
  console.log(`  name:     ${chalk.cyan(parsed.data.name)}`);
  console.log(`  version:  ${chalk.cyan(parsed.data.version)}`);
  console.log(`  category: ${chalk.cyan(parsed.data.category)}`);
  console.log(`  files (${parsed.data.files.length}):`);
  for (const f of parsed.data.files) {
    console.log(`    ${chalk.dim(f.src)} ? ${f.dest}`);
  }
  if (parsed.data.mcpServer) {
    console.log(`  mcpServer: ${chalk.dim('command' in parsed.data.mcpServer ? parsed.data.mcpServer.command : 'configured')}`);
  }
  if (parsed.data.keywords?.length) {
    console.log(`  keywords: ${chalk.dim(parsed.data.keywords.join(', '))}`);
  }
  if (parsed.data.tags?.length) {
    console.log(`  tags:     ${chalk.dim(parsed.data.tags.join(', '))}`);
  }
  console.log(chalk.dim(`\n  Edit ${MANIFEST_FILENAME} if needed, then run: aitools publish`));
}

// -- manifest init -------------------------------------------------------------

interface ManifestInitOptions {
  name?: string;
  version?: string;
  description?: string;
  category?: string;
  nativeFor?: string;
  author?: string;
  keywords?: string;
  tags?: string;
  repository?: string;
  file?: string[];
  yes?: boolean;
  force?: boolean;
  pickFiles?: boolean;
}

function createManifestInitCommand(): Command {
  return new Command('init')
    .description(`Create or extend ${MANIFEST_FILENAME} with publish fields`)
    .option('--name <name>', 'Package name')
    .option('--version <version>', 'Package version')
    .option('--description <text>', 'Short description of the tool')
    .option('--category <category>', 'Tool category: skill | subagent | prompt | mcp-tool | plugin')
    .option('--nativeFor <platform>', 'Source layout family (required for plugin): cursor | vscode | claude | windsurf | universal')
    .option('--author <author>', 'Author name or email')
    .option('--keywords <list>', 'Comma-separated list of keywords')
    .option('--tags <list>', 'Comma-separated tags for AI discovery')
    .option('--repository <url>', 'Repository URL')
    .option(
      '--file <src:dest>',
      'File entry in src:dest format (repeatable; auto-detected if omitted)',
      (val: string, prev: string[]) => [...prev, val],
      [] as string[],
    )
    .option('-y, --yes', 'Skip prompts and accept defaults for all fields')
    .option('--pick-files', 'Pick files individually (include + dest) instead of folder prompts')
    .option('--force', 'Overwrite an existing manifest file')
    .action(async (options: ManifestInitOptions) => {
      const cwd = process.cwd();
      const outPath = path.join(cwd, MANIFEST_FILENAME);

      if (fs.existsSync(outPath) && !options.force) {
        const existing = readManifest(cwd);
        if (existing && isPublishable(existing)) {
          console.log(
            chalk.yellow(`${MANIFEST_FILENAME} already has publish fields.`),
            chalk.dim('Use --force to overwrite them.'),
          );
          return;
        }
      }

      const defaultName = path.basename(cwd).toLowerCase().replace(/[^a-z0-9-]/g, '-');

      if (options.yes) {
        await initNonInteractive(options, cwd, outPath, defaultName);
      } else {
        await initInteractive(options, cwd, outPath, defaultName);
      }
    });
}

async function initNonInteractive(
  options: ManifestInitOptions,
  cwd: string,
  _outPath: string,
  defaultName: string,
): Promise<void> {
  const category = (options.category ?? 'skill') as Category;
  const name = options.name ?? defaultName;

  let files: ToolFile[];
  if (options.file && options.file.length > 0) {
    files = options.file.map((entry) => parseFileEntry(entry, category, name));
  } else if (category === 'plugin') {
    const { files: pluginFiles, warnings } = collectPluginInitFiles(cwd, name);
    if (pluginFiles.length > 0) {
      files = pluginFiles;
    } else {
      files = [fileEntry('.cursor-plugin/plugin.json', '.cursor-plugin/plugin.json')];
      console.log(chalk.dim('  Note: no matching files found — using placeholder plugin.json'));
    }
    for (const warning of warnings) {
      console.log(chalk.yellow(`  Skipped: ${warning}`));
    }
    files = ensureAnchorSkillScaffold(cwd, name, files);
  } else if (isContentCategory(category)) {
    if (options.pickFiles) {
      files = resolveManifestFilesNonInteractive(
        collectManifestFileCandidates(cwd, category, name),
        category,
        name,
      );
    } else {
      files = resolveContentInitFilesNonInteractive(cwd, category, name);
    }
  } else {
    const detected = detectFiles(cwd, CATEGORY_EXT[category] ?? ['.md']);
    if (detected.length > 0) {
      files = mapSrcToInstallFiles(detected, name);
    } else {
      files = [fileEntry(`${name}.md`, defaultInstallDest(`${name}.md`, name))];
      console.log(chalk.dim('  Note: no matching files found — using placeholder filename'));
    }
  }

  writeAndPrintManifest(cwd, {
    name,
    version: options.version ?? '1.0.0',
    description: options.description ?? `A ${category} tool`,
    category,
    files,
    ...(category === 'mcp-tool' ? { mcpServer: defaultMcpServerForInit(files) } : {}),
    ...(category === 'plugin'
      ? { nativeFor: options.nativeFor ?? 'cursor' }
      : {}),
    ...(options.author ? { author: options.author } : {}),
    ...(options.repository ? { repository: options.repository } : {}),
    ...(options.keywords
      ? { keywords: options.keywords.split(',').map((k) => k.trim()).filter(Boolean) }
      : {}),
    ...(options.tags
      ? { tags: options.tags.split(',').map((t) => t.trim()).filter(Boolean) }
      : {}),
  });
}

async function initInteractive(
  options: ManifestInitOptions,
  cwd: string,
  _outPath: string,
  defaultName: string,
): Promise<void> {
  const rl = createInterface({ input, output, terminal: true });

  /** Prompt with an optional default shown in parentheses. Empty answer ? default. */
  const ask = async (question: string, def?: string): Promise<string> => {
    const hint = def !== undefined ? chalk.dim(` (${def || 'none'})`) : '';
    const ans = (await rl.question(`  ${question}${hint}: `)).trim();
    return ans || def || '';
  };

  console.log(chalk.bold(`\nCreating publish fields in ${MANIFEST_FILENAME}`));
  console.log(chalk.dim('  Press Enter to accept each default.\n'));

  try {
    const name = await ask('name', options.name ?? defaultName);
    const version = await ask('version', options.version ?? '1.0.0');
    const description = await ask('description', options.description ?? '');
    const categoryRaw = await ask(
      'category (skill|subagent|prompt|mcp-tool|plugin)',
      options.category ?? 'skill',
    );
    const category = (categoryRaw || 'skill') as Category;
    let nativeFor: string | undefined;
    if (category === 'plugin') {
      nativeFor = await ask(
        'nativeFor (cursor|vscode|claude|windsurf|universal)',
        options.nativeFor ?? 'cursor',
      ) || options.nativeFor || 'cursor';
    }
    const author = await ask('author', options.author ?? '');
    const repository = await ask('repository (URL)', options.repository ?? '');
    const keywordsRaw = await ask('keywords, comma-separated', options.keywords ?? '');
    const tagsRaw = await ask('tags, comma-separated', options.tags ?? '');

    // -- File resolution ----------------------------------------------------
    let files: ToolFile[] = [];

    if (options.file && options.file.length > 0) {
      files = options.file.map((entry) => parseFileEntry(entry, category, name));
    } else if (category === 'plugin') {
      const { files: pluginFiles, warnings } = collectPluginInitFiles(cwd, name);
      if (pluginFiles.length > 0) {
        files = pluginFiles;
      } else {
        files = [
          fileEntry('.cursor-plugin/plugin.json', '.cursor-plugin/plugin.json'),
        ];
        console.log(chalk.dim('  Note: no matching files found — using placeholder plugin.json'));
      }
      if (warnings.length > 0) {
        console.log(chalk.yellow('\n  Skipped paths outside plugin bundle layout:\n'));
        for (const warning of warnings) {
          console.log(chalk.yellow(`    ${warning}`));
        }
      }
      files = ensureAnchorSkillScaffold(cwd, name, files);
    } else if (isContentCategory(category)) {
      if (options.pickFiles) {
        files = await promptForManifestFiles(rl, cwd, category, name);
      } else {
        files = await promptForContentFiles(rl, category, cwd, name);
        if (files.length === 0) {
          const pickAns = (
            await rl.question('  Pick files individually? (Y/n): ')
          ).trim();
          if (pickAns === '' || pickAns.toLowerCase().startsWith('y')) {
            files = await promptForManifestFiles(rl, cwd, category, name);
          }
          if (files.length === 0 && category !== 'mcp-tool') {
            const placeholder = contentPlaceholder(category, name);
            console.log(chalk.dim(`  Using placeholder: ${placeholder}`));
            files = [fileEntry(placeholder, placeholder)];
          }
        }
      }
    }

    rl.close();

    writeAndPrintManifest(cwd, {
      name,
      version,
      description: description || `A ${category} tool`,
      category,
      files,
      ...(category === 'mcp-tool' ? { mcpServer: defaultMcpServerForInit(files) } : {}),
      ...(nativeFor ? { nativeFor } : {}),
      ...(author ? { author } : {}),
      ...(repository ? { repository } : {}),
      ...(keywordsRaw
        ? { keywords: keywordsRaw.split(',').map((k) => k.trim()).filter(Boolean) }
        : {}),
      ...(tagsRaw
        ? { tags: tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) }
        : {}),
    });
  } catch (err) {
    rl.close();
    throw err;
  }
}

// -- manifest files -------------------------------------------------------------

interface ManifestFilesOptions {
  category?: string;
  yes?: boolean;
  force?: boolean;
}

function createManifestFilesCommand(): Command {
  return new Command('files')
    .description(`Select publish files and install destinations in ${MANIFEST_FILENAME}`)
    .option('--category <category>', 'Tool category when no manifest exists yet')
    .option('-y, --yes', 'Include all detected files with default dest (no prompts)')
    .option('--force', 'Replace files[] entirely instead of merging with existing entries')
    .action(async (options: ManifestFilesOptions) => {
      const cwd = process.cwd();
      const existing = readManifest(cwd);
      const defaultName = path.basename(cwd).toLowerCase().replace(/[^a-z0-9-]/g, '-');

      let category: Category;
      let name: string;
      let existingFiles: ToolFile[] = [];

      if (existing && isPublishable(existing)) {
        category = existing.category as Category;
        name = existing.name ?? defaultName;
        existingFiles = (existing.files ?? []).map((f: ToolFile) => ({
          ...f,
          placementMode: f.placementMode ?? 'strict',
        }));
      } else if (options.category) {
        category = options.category as Category;
        name = defaultName;
      } else {
        console.error(chalk.red(`No publishable ${MANIFEST_FILENAME} found.`));
        console.error(chalk.dim('Run: aitools manifest init, or pass --category'));
        process.exit(1);
      }

      const candidates = collectManifestFileCandidates(cwd, category, name);
      let selected: ToolFile[];

      if (options.yes) {
        selected = resolveManifestFilesNonInteractive(candidates, category, name);
      } else {
        const rl = createInterface({ input, output, terminal: true });
        try {
          selected = await promptForManifestFiles(rl, cwd, category, name, existingFiles);
        } finally {
          rl.close();
        }
      }

      const files = mergeFileSelections(existingFiles, candidates, selected, options.force ?? false);

      if (files.length === 0 && category !== 'mcp-tool') {
        console.error(chalk.red('No files selected.'));
        process.exit(1);
      }

      const updated: Record<string, unknown> = {
        ...(existing ?? {}),
        name: existing?.name ?? name,
        version: existing?.version ?? '1.0.0',
        description: existing?.description ?? `A ${category} tool`,
        category,
        files,
      };

      if (category === 'mcp-tool') {
        const currentMcp = existing?.mcpServer as { args?: string[] } | undefined;
        if (mcpServerNeedsRefresh(currentMcp, files)) {
          updated['mcpServer'] = defaultMcpServerForInit(files);
        }
      }

      if (category === 'plugin' && !updated['nativeFor']) {
        updated['nativeFor'] = 'cursor';
      }

      writeUpdatedPublishDoc(cwd, updated);
      console.log(chalk.green(`\n  Updated files (${files.length}) in ${MANIFEST_FILENAME}`));
      for (const f of files) {
        console.log(`    ${chalk.dim(f.src)} → ${f.dest}`);
      }
      console.log(chalk.dim('\n  Run: aitools manifest validate'));
    });
}

// -- manifest validate ---------------------------------------------------------

function loadPublishDoc(cwd: string): AiToolsManifest {
  const unifiedPath = path.join(cwd, MANIFEST_FILENAME);
  const legacyPath = path.join(cwd, LEGACY_PUBLISH_MANIFEST_FILENAME);

  if (fs.existsSync(unifiedPath)) {
    let doc: AiToolsManifest | null;
    try {
      doc = readManifest(cwd);
    } catch {
      console.error(chalk.red(`Failed to parse ${MANIFEST_FILENAME}`));
      process.exit(1);
    }
    if (!doc || !isPublishable(doc)) {
      console.error(chalk.red(`${MANIFEST_FILENAME} has no publish fields.`));
      console.error(chalk.dim('Run: aitools manifest init'));
      process.exit(1);
    }
    return doc;
  }

  if (fs.existsSync(legacyPath)) {
    console.error(
      chalk.red(`${LEGACY_PUBLISH_MANIFEST_FILENAME} is no longer supported.`),
    );
    console.error(chalk.dim('Run: aitools manifest migrate'));
    process.exit(1);
  }

  console.error(chalk.red(`No ${MANIFEST_FILENAME} found.`));
  console.error(chalk.dim('Run: aitools manifest init'));
  process.exit(1);
}

/**
 * Print an advisory plugin portability grade + findings.
 * Never exits the process — the grade guides authors but does not gate publish.
 */
export function printPortabilityGrade(result: PluginPortabilityResult): void {
  const gradeColor =
    result.grade === 'transform-free'
      ? chalk.green
      : result.grade === 'rewrite-required'
        ? chalk.yellow
        : chalk.red;
  console.log(`  ${gradeColor('?')} Portability: ${gradeColor(result.grade)}`);
  for (const finding of result.findings) {
    if (finding.kind === 'ok') continue;
    const icon = finding.kind === 'orphan' ? chalk.red('?') : chalk.yellow('?');
    console.log(`      ${icon} ${chalk.dim(finding.message)}`);
  }
}

function createManifestValidateCommand(): Command {
  return new Command('validate')
    .description(`Validate publish fields in ${MANIFEST_FILENAME}`)
    .action(() => {
      const cwd = process.cwd();
      const doc = loadPublishDoc(cwd);
      const parsed = ToolManifestSchema.safeParse(doc);

      console.log(chalk.bold(`\nValidating ${MANIFEST_FILENAME}\n`));

      if (!parsed.success) {
        console.error(chalk.red('  ? Schema validation failed:\n'));
        for (const issue of parsed.error.issues) {
          const field = issue.path.join('.') || 'root';
          console.error(`    ${chalk.red('?')} ${chalk.bold(field)}: ${issue.message}`);
        }
        process.exit(1);
      }

      console.log(`  ${chalk.green('?')} Schema valid`);
      console.log(`  ${chalk.green('?')} name:     ${chalk.cyan(parsed.data.name)}`);
      console.log(`  ${chalk.green('?')} version:  ${chalk.cyan(parsed.data.version)}`);
      console.log(`  ${chalk.green('?')} category: ${chalk.cyan(parsed.data.category)}`);

      let missingCount = 0;
      console.log(`\n  files (${parsed.data.files.length}):`);
      for (const file of parsed.data.files) {
        const exists = fs.existsSync(path.join(cwd, file.src));
        if (exists) {
          console.log(`    ${chalk.green('?')} ${file.src}`);
        } else {
          console.log(`    ${chalk.red('?')} ${file.src} ${chalk.red('— not found on disk')}`);
          missingCount++;
        }
      }

      if (missingCount > 0) {
        console.error(
          chalk.yellow(`\n  ${missingCount} source file(s) declared in manifest but missing from disk.`),
        );
        process.exit(1);
      }

      if (parsed.data.category === 'plugin') {
        let pluginJson = null;
        const descriptor = parsed.data.files.find(
          (f) => f.src.replace(/\\/g, '/') === '.cursor-plugin/plugin.json',
        );
        if (descriptor) {
          const raw = fs.readFileSync(path.join(cwd, descriptor.src), 'utf8');
          pluginJson = parseCursorPluginJson(raw);
        }
        const structure = validatePluginStructure({
          packageName: parsed.data.name,
          sources: parsed.data.files.map((f) => f.src),
          pluginJson,
        });
        if (!structure.ok) {
          console.error(chalk.red('\n  Plugin structure validation failed:\n'));
          for (const err of structure.errors) {
            console.error(`    ${chalk.red('?')} ${err}`);
          }
          process.exit(1);
        }
        console.log(`  ${chalk.green('?')} Plugin structure: every file has an install home`);

        const portability = analyzePluginPortability({
          packageName: parsed.data.name,
          sources: parsed.data.files.map((f) => f.src),
          pluginJson,
        });
        printPortabilityGrade(portability);
      }

      console.log(chalk.dim('\n  All checks passed. Ready to publish.'));
    });
}

// -- manifest bump -------------------------------------------------------------

type BumpType = 'major' | 'minor' | 'patch';

function createManifestBumpCommand(): Command {
  return new Command('bump')
    .description(`Increment the version in ${MANIFEST_FILENAME}`)
    .argument('<release>', 'Release type: patch | minor | major, or an explicit version like 1.2.3')
    .action((release: string) => {
      const cwd = process.cwd();
      const doc = loadPublishDoc(cwd);
      const current = doc.version ?? '';

      if (!semver.valid(current)) {
        console.error(chalk.red(`Current version "${current}" is not a valid semver string.`));
        process.exit(1);
      }

      let next: string | null;
      const BUMP_TYPES: BumpType[] = ['major', 'minor', 'patch'];
      if ((BUMP_TYPES as string[]).includes(release)) {
        next = semver.inc(current, release as BumpType);
      } else if (semver.valid(release)) {
        if (semver.lte(release, current)) {
          console.error(
            chalk.red(`New version "${release}" must be greater than current "${current}".`),
          );
          process.exit(1);
        }
        next = semver.clean(release);
      } else {
        console.error(
          chalk.red(`Invalid release argument "${release}".`),
          chalk.dim('Use: patch | minor | major | <x.y.z>'),
        );
        process.exit(1);
      }

      if (!next) {
        console.error(chalk.red('Could not compute next version.'));
        process.exit(1);
      }

      writeManifest(cwd, { ...doc, version: next });
      console.log(`${chalk.dim(current)} ? ${chalk.green(next)}`);
    });
}


// -- manifest update --------------------------------------------------

interface ManifestUpdateOptions {
  name?: string;
  description?: string;
  category?: string;
  author?: string;
  keywords?: string;
  tags?: string;
  repository?: string;
  platforms?: string;
  yes?: boolean;
}

function createManifestUpdateCommand(): Command {
  return new Command('update')
    .description(`Update publish fields in ${MANIFEST_FILENAME}`)
    .option('--name <name>', 'New package name')
    .option('--description <text>', 'New description')
    .option('--category <category>', 'New category: skill | subagent | prompt | mcp-tool')
    .option('--author <author>', 'Author name or email')
    .option('--keywords <list>', 'Comma-separated keywords (replaces existing)')
    .option('--tags <list>', 'Comma-separated tags for AI discovery (replaces existing)')
    .option('--repository <url>', 'Repository URL')
    .option(
      '--platforms <list>',
      'Comma-separated supported platforms: vscode, claude, cursor, windsurf, universal. Leave empty to support all.',
    )
    .option('-y, --yes', 'Non-interactive: apply only the supplied flags, keep everything else unchanged')
    .action(async (options: ManifestUpdateOptions) => {
      const cwd = process.cwd();
      const existing = loadPublishDoc(cwd) as Record<string, unknown>;

      if (options.yes) {
        await updateNonInteractive(options, cwd, existing);
      } else {
        await updateInteractive(options, cwd, existing);
      }
    });
}

async function updateNonInteractive(
  options: ManifestUpdateOptions,
  cwd: string,
  existing: Record<string, unknown>,
): Promise<void> {
  const updated: Record<string, unknown> = { ...existing };

  if (options.name !== undefined) updated['name'] = options.name;
  if (options.description !== undefined) updated['description'] = options.description;
  if (options.category !== undefined) updated['category'] = options.category;
  if (options.author !== undefined) {
    if (options.author) updated['author'] = options.author;
    else delete updated['author'];
  }
  if (options.repository !== undefined) {
    if (options.repository) updated['repository'] = options.repository;
    else delete updated['repository'];
  }
  if (options.keywords !== undefined) {
    const list = options.keywords.split(',').map((k) => k.trim()).filter(Boolean);
    if (list.length > 0) updated['keywords'] = list;
    else delete updated['keywords'];
  }
  if (options.tags !== undefined) {
    const list = options.tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (list.length > 0) updated['tags'] = list;
    else delete updated['tags'];
  }
  if (options.platforms !== undefined) {
    const list = options.platforms.split(',').map((p) => p.trim()).filter(Boolean);
    if (list.length > 0) updated['platforms'] = list;
    else delete updated['platforms'];
  }

  writeUpdatedPublishDoc(cwd, updated);
  console.log(chalk.dim(`\n  Tip: run aitools manifest validate to verify all declared files exist.`));
}

function writeUpdatedPublishDoc(cwd: string, updated: Record<string, unknown>): void {
  const parsed = ToolManifestSchema.safeParse(updated);
  if (!parsed.success) {
    console.error(chalk.red('Manifest validation failed:'));
    for (const issue of parsed.error.issues) {
      const field = issue.path.join('.') || 'root';
      console.error(`  ${chalk.red('?')} ${chalk.bold(field)}: ${issue.message}`);
    }
    process.exit(1);
  }

  const existing = readManifest(cwd) ?? {};
  const merged: AiToolsManifest = {
    dependencies: existing.dependencies,
    devDependencies: existing.devDependencies,
    registries: existing.registries,
    ...parsed.data,
  };
  writeManifest(cwd, merged);
  console.log(chalk.green(`\n  ? Updated ${MANIFEST_FILENAME}`));
  console.log(`  name:     ${chalk.cyan(parsed.data.name)}`);
  console.log(`  version:  ${chalk.cyan(parsed.data.version)}`);
  console.log(`  category: ${chalk.cyan(parsed.data.category)}`);
}

async function updateInteractive(
  options: ManifestUpdateOptions,
  cwd: string,
  existing: Record<string, unknown>,
): Promise<void> {
  const rl = createInterface({ input, output, terminal: true });

  const ask = async (question: string, def?: string): Promise<string> => {
    const hint = def !== undefined ? chalk.dim(` (${def || 'none'})`) : '';
    const raw = (await rl.question(`  ${question}${hint}: `)).trim();
    if (raw === '-') return '';  // explicit clear sentinel
    return raw || def || '';
  };

  console.log(chalk.bold(`\nUpdating ${MANIFEST_FILENAME}\n`));
  console.log(chalk.dim('  Press Enter to keep the current value.\n'));

  try {
    const currentKeywords = Array.isArray(existing['keywords'])
      ? (existing['keywords'] as string[]).join(', ')
      : '';
    const currentTags = Array.isArray(existing['tags'])
      ? (existing['tags'] as string[]).join(', ')
      : '';
    const currentPlatforms = Array.isArray(existing['platforms'])
      ? (existing['platforms'] as string[]).join(', ')
      : '';

    const name = await ask('name', options.name ?? String(existing['name'] ?? ''));
    const version = await ask('version', String(existing['version'] ?? '1.0.0'));
    const description = await ask('description', options.description ?? String(existing['description'] ?? ''));
    const categoryRaw = await ask(
      'category (skill|subagent|prompt|mcp-tool)',
      options.category ?? String(existing['category'] ?? 'skill'),
    );
    const author = await ask('author', options.author ?? String(existing['author'] ?? ''));
    const repository = await ask('repository (URL)', options.repository ?? String(existing['repository'] ?? ''));
    const keywordsRaw = await ask('keywords, comma-separated', options.keywords ?? currentKeywords);
    const tagsRaw = await ask('tags, comma-separated', options.tags ?? currentTags);
    const platformsRaw = await ask(
      'platforms, comma-separated (blank = all platforms)',
      options.platforms ?? currentPlatforms,
    );

    rl.close();

    const updated: Record<string, unknown> = {
      ...existing,
      name,
      version,
      description: description || `A ${categoryRaw || 'skill'} tool`,
      category: categoryRaw || 'skill',
    };

    if (author) updated['author'] = author; else delete updated['author'];
    if (repository) updated['repository'] = repository; else delete updated['repository'];

    const keywords = keywordsRaw.split(',').map((k) => k.trim()).filter(Boolean);
    if (keywords.length > 0) updated['keywords'] = keywords; else delete updated['keywords'];

    const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length > 0) updated['tags'] = tags; else delete updated['tags'];

    const platforms = platformsRaw.split(',').map((p) => p.trim()).filter(Boolean);
    if (platforms.length > 0) updated['platforms'] = platforms; else delete updated['platforms'];

    writeUpdatedPublishDoc(cwd, updated);
    console.log(chalk.dim(`\n  Tip: run aitools manifest validate to verify all declared files exist.`));
  } catch (err) {
    rl.close();
    throw err;
  }
}

// -- manifest migrate ----------------------------------------------------------

function createManifestMigrateCommand(): Command {
  return new Command('migrate')
    .description(`Merge ${LEGACY_PUBLISH_MANIFEST_FILENAME} into ${MANIFEST_FILENAME}`)
    .option('--force', 'Overwrite conflicting publish fields in aitools.json')
    .action((options: { force?: boolean }) => {
      const cwd = process.cwd();
      const legacyPath = path.join(cwd, LEGACY_PUBLISH_MANIFEST_FILENAME);
      const unifiedPath = path.join(cwd, MANIFEST_FILENAME);

      if (!fs.existsSync(legacyPath)) {
        console.error(chalk.red(`No ${LEGACY_PUBLISH_MANIFEST_FILENAME} found to migrate.`));
        process.exit(1);
      }

      let legacyRaw: unknown;
      try {
        legacyRaw = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
      } catch {
        console.error(chalk.red(`Failed to parse ${LEGACY_PUBLISH_MANIFEST_FILENAME}`));
        process.exit(1);
      }

      const legacyParsed = ToolManifestSchema.safeParse(legacyRaw);
      if (!legacyParsed.success) {
        console.error(chalk.red('Legacy manifest failed schema validation.'));
        process.exit(1);
      }

      let unified: AiToolsManifest = {};
      if (fs.existsSync(unifiedPath)) {
        let rawUnified: unknown;
        try {
          rawUnified = JSON.parse(fs.readFileSync(unifiedPath, 'utf8'));
        } catch {
          console.error(chalk.red(`Failed to parse ${MANIFEST_FILENAME}`));
          process.exit(1);
        }
        const parsedUnified = AitoolsJsonSchema.safeParse(rawUnified);
        if (!parsedUnified.success) {
          console.error(chalk.red(`Invalid ${MANIFEST_FILENAME}: ${parsedUnified.error.message}`));
          process.exit(1);
        }
        unified = parsedUnified.data;
      }

      if (
        unified.name &&
        legacyParsed.data.name &&
        unified.name !== legacyParsed.data.name &&
        !options.force
      ) {
        console.error(
          chalk.red(
            `Name conflict: ${MANIFEST_FILENAME} has "${unified.name}" but legacy manifest has "${legacyParsed.data.name}".`,
          ),
        );
        console.error(chalk.dim('Resolve manually or re-run with --force.'));
        process.exit(1);
      }

      const merged: AiToolsManifest = { ...unified, ...legacyParsed.data };
      writeManifest(cwd, merged);
      console.log(chalk.green(`Merged publish fields into ${MANIFEST_FILENAME}`));
      console.warn(
        chalk.yellow(
          `[aitools] Remove ${LEGACY_PUBLISH_MANIFEST_FILENAME} when you are satisfied with the migration.`,
        ),
      );
    });
}

// -- Command export ------------------------------------------------------------

export function createManifestCommand(): Command {
  const cmd = new Command('manifest').description(
    `Manage the unified publish manifest (${MANIFEST_FILENAME})`,
  );
  cmd.addCommand(createManifestInitCommand());
  cmd.addCommand(createManifestFilesCommand());
  cmd.addCommand(createManifestValidateCommand());
  cmd.addCommand(createManifestBumpCommand());
  cmd.addCommand(createManifestUpdateCommand());
  cmd.addCommand(createManifestMigrateCommand());
  return cmd;
}
