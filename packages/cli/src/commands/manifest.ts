// Copyright (C) 2026 Michael Benjamin (turbofoxwave@gmail.com)
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
import { ToolManifestSchema } from '@aitools/core';

const PUBLISH_MANIFEST_FILE = 'aitools.manifest.json';

type Category = 'skill' | 'subagent' | 'prompt' | 'mcp-tool';

const CATEGORY_EXT: Record<Category, string[]> = {
  skill: ['.md'],
  subagent: ['.md'],
  prompt: ['.md'],
  'mcp-tool': ['.ts', '.js', '.json'],
};

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
  'aitools.manifest.json',
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
      exts.includes(path.extname(entry).toLowerCase()) &&
      !SKIP_FILES.has(entry)
    ) {
      results.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  }
  return results.sort();
}

/**
 * Returns the set of top-level "skill folders" � directories that directly
 * contain at least one file matching the given extensions.  Each entry holds
 * the folder path (relative to root) and all files within it (recursive).
 */
function detectSkillFolders(
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

function parseFileEntry(entry: string): { src: string; dest: string } {
  const sep = entry.indexOf(':');
  if (sep === -1) return { src: entry, dest: path.basename(entry) };
  return { src: entry.slice(0, sep), dest: entry.slice(sep + 1) };
}

// -- Shared manifest write + print ---------------------------------------------

type ManifestInput = {
  name: string;
  version: string;
  description: string;
  category: string;
  files: Array<{ src: string; dest: string }>;
  author?: string;
  repository?: string;
  keywords?: string[];
  tags?: string[];
  platforms?: string[];
};

function writeAndPrintManifest(outPath: string, manifest: ManifestInput): void {
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

  fs.writeFileSync(outPath, JSON.stringify(parsed.data, null, 2) + '\n', 'utf8');
  console.log(chalk.green(`\n  ? Created ${PUBLISH_MANIFEST_FILE}`));
  console.log(`  name:     ${chalk.cyan(parsed.data.name)}`);
  console.log(`  version:  ${chalk.cyan(parsed.data.version)}`);
  console.log(`  category: ${chalk.cyan(parsed.data.category)}`);
  console.log(`  files (${parsed.data.files.length}):`);
  for (const f of parsed.data.files) {
    console.log(`    ${chalk.dim(f.src)} ? ${f.dest}`);
  }
  if (parsed.data.keywords?.length) {
    console.log(`  keywords: ${chalk.dim(parsed.data.keywords.join(', '))}`);
  }
  if (parsed.data.tags?.length) {
    console.log(`  tags:     ${chalk.dim(parsed.data.tags.join(', '))}`);
  }
  console.log(chalk.dim(`\n  Edit ${PUBLISH_MANIFEST_FILE} if needed, then run: aitools publish`));
}

// -- manifest init -------------------------------------------------------------

interface ManifestInitOptions {
  name?: string;
  version?: string;
  description?: string;
  category?: string;
  author?: string;
  keywords?: string;
  tags?: string;
  repository?: string;
  file?: string[];
  yes?: boolean;
  force?: boolean;
}

function createManifestInitCommand(): Command {
  return new Command('init')
    .description('Create an aitools.manifest.json for publishing to a registry')
    .option('--name <name>', 'Package name')
    .option('--version <version>', 'Package version')
    .option('--description <text>', 'Short description of the tool')
    .option('--category <category>', 'Tool category: skill | subagent | prompt | mcp-tool')
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
    .option('--force', 'Overwrite an existing manifest file')
    .action(async (options: ManifestInitOptions) => {
      const cwd = process.cwd();
      const outPath = path.join(cwd, PUBLISH_MANIFEST_FILE);

      if (fs.existsSync(outPath) && !options.force) {
        console.log(
          chalk.yellow(`${PUBLISH_MANIFEST_FILE} already exists.`),
          chalk.dim('Use --force to overwrite.'),
        );
        return;
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
  outPath: string,
  defaultName: string,
): Promise<void> {
  const category = (options.category ?? 'skill') as Category;
  const name = options.name ?? defaultName;

  let files: Array<{ src: string; dest: string }>;
  if (options.file && options.file.length > 0) {
    files = options.file.map(parseFileEntry);
  } else {
    const detected = detectFiles(cwd, CATEGORY_EXT[category] ?? ['.md']);
    if (detected.length > 0) {
      files = detected.map((f) => ({ src: f, dest: f }));
    } else {
      files = [{ src: `${name}.md`, dest: `${name}.md` }];
      console.log(chalk.dim('  Note: no matching files found � using placeholder filename'));
    }
  }

  writeAndPrintManifest(outPath, {
    name,
    version: options.version ?? '1.0.0',
    description: options.description ?? `A ${category} tool`,
    category,
    files,
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
  outPath: string,
  defaultName: string,
): Promise<void> {
  const rl = createInterface({ input, output, terminal: true });

  /** Prompt with an optional default shown in parentheses. Empty answer ? default. */
  const ask = async (question: string, def?: string): Promise<string> => {
    const hint = def !== undefined ? chalk.dim(` (${def || 'none'})`) : '';
    const ans = (await rl.question(`  ${question}${hint}: `)).trim();
    return ans || def || '';
  };

  console.log(chalk.bold(`\nCreating ${PUBLISH_MANIFEST_FILE}`));
  console.log(chalk.dim('  Press Enter to accept each default.\n'));

  try {
    const name = await ask('name', options.name ?? defaultName);
    const version = await ask('version', options.version ?? '1.0.0');
    const description = await ask('description', options.description ?? '');
    const categoryRaw = await ask(
      'category (skill|subagent|prompt|mcp-tool)',
      options.category ?? 'skill',
    );
    const category = (categoryRaw || 'skill') as Category;
    const author = await ask('author', options.author ?? '');
    const repository = await ask('repository (URL)', options.repository ?? '');
    const keywordsRaw = await ask('keywords, comma-separated', options.keywords ?? '');
    const tagsRaw = await ask('tags, comma-separated', options.tags ?? '');

    // -- File resolution ----------------------------------------------------
    let files: Array<{ src: string; dest: string }>;

    if (options.file && options.file.length > 0) {
      files = options.file.map(parseFileEntry);
    } else {
      const exts = CATEGORY_EXT[category] ?? ['.md'];
      const skillFolders = detectSkillFolders(cwd, exts);

      if (skillFolders.length > 0) {
        console.log(chalk.bold(`\n  Detected ${skillFolders.length} ${category} folder(s). Select which to include:\n`));
        const included: Array<{ src: string; dest: string }> = [];
        for (const { folder, files: folderFiles } of skillFolders) {
          const ans = (await rl.question(`  Include ${chalk.cyan(folder)}? (Y/n): `)).trim();
          if (ans === '' || ans.toLowerCase().startsWith('y')) {
            for (const f of folderFiles) {
              included.push({ src: f, dest: f });
            }
          }
        }
        if (included.length > 0) {
          files = included;
        } else {
          console.log(chalk.dim(`\n  No folders selected. Using placeholder.`));
          const placeholder = `${name}.md`;
          files = [{ src: placeholder, dest: placeholder }];
        }
      } else {
        const placeholder = `${name}.md`;
        console.log(chalk.dim(`\n  No matching ${category} folders found. Using placeholder: ${placeholder}`));
        files = [{ src: placeholder, dest: placeholder }];
      }
    }

    rl.close();

    writeAndPrintManifest(outPath, {
      name,
      version,
      description: description || `A ${category} tool`,
      category,
      files,
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

// -- manifest validate ---------------------------------------------------------

function createManifestValidateCommand(): Command {
  return new Command('validate')
    .description('Validate an existing aitools.manifest.json against the schema')
    .action(() => {
      const cwd = process.cwd();
      const manifestPath = path.join(cwd, PUBLISH_MANIFEST_FILE);

      if (!fs.existsSync(manifestPath)) {
        console.error(chalk.red(`No ${PUBLISH_MANIFEST_FILE} found.`));
        console.error(chalk.dim('Run: aitools manifest init'));
        process.exit(1);
      }

      let raw: unknown;
      try {
        raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        console.error(chalk.red('Failed to parse JSON � check for syntax errors.'));
        process.exit(1);
      }

      console.log(chalk.bold(`\nValidating ${PUBLISH_MANIFEST_FILE}\n`));

      const parsed = ToolManifestSchema.safeParse(raw);

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

      // Check that declared src files actually exist on disk
      let missingCount = 0;
      console.log(`\n  files (${parsed.data.files.length}):`);
      for (const file of parsed.data.files) {
        const exists = fs.existsSync(path.join(cwd, file.src));
        if (exists) {
          console.log(`    ${chalk.green('?')} ${file.src}`);
        } else {
          console.log(`    ${chalk.red('?')} ${file.src} ${chalk.red('� not found on disk')}`);
          missingCount++;
        }
      }

      if (missingCount > 0) {
        console.error(
          chalk.yellow(`\n  ${missingCount} source file(s) declared in manifest but missing from disk.`),
        );
        process.exit(1);
      }

      console.log(chalk.dim('\n  All checks passed. Ready to publish.'));
    });
}

// -- manifest bump -------------------------------------------------------------

type BumpType = 'major' | 'minor' | 'patch';

function createManifestBumpCommand(): Command {
  return new Command('bump')
    .description('Increment the version in aitools.manifest.json')
    .argument('<release>', 'Release type: patch | minor | major, or an explicit version like 1.2.3')
    .action((release: string) => {
      const cwd = process.cwd();
      const manifestPath = path.join(cwd, PUBLISH_MANIFEST_FILE);

      if (!fs.existsSync(manifestPath)) {
        console.error(chalk.red(`No ${PUBLISH_MANIFEST_FILE} found.`));
        console.error(chalk.dim('Run: aitools manifest init'));
        process.exit(1);
      }

      let manifest: Record<string, unknown>;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
      } catch {
        console.error(chalk.red(`Failed to parse ${PUBLISH_MANIFEST_FILE}`));
        process.exit(1);
      }

      const current = typeof manifest['version'] === 'string' ? manifest['version'] : '';
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

      manifest['version'] = next;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
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
    .description('Update fields in an existing aitools.manifest.json interactively')
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
      const manifestPath = path.join(cwd, PUBLISH_MANIFEST_FILE);

      if (!fs.existsSync(manifestPath)) {
        console.error(chalk.red(`No ${PUBLISH_MANIFEST_FILE} found.`));
        console.error(chalk.dim('Run: aitools manifest init'));
        process.exit(1);
      }

      let existing: Record<string, unknown>;
      try {
        existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
      } catch {
        console.error(chalk.red(`Failed to parse ${PUBLISH_MANIFEST_FILE} \u2014 check for syntax errors.`));
        process.exit(1);
      }

      if (options.yes) {
        await updateNonInteractive(options, manifestPath, existing);
      } else {
        await updateInteractive(options, manifestPath, existing);
      }
    });
}

async function updateNonInteractive(
  options: ManifestUpdateOptions,
  manifestPath: string,
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

  writeAndPrintManifest(manifestPath, updated as ManifestInput);
  console.log(chalk.dim(`\n  Tip: run aitools manifest validate to verify all declared files exist.`));
}

async function updateInteractive(
  options: ManifestUpdateOptions,
  manifestPath: string,
  existing: Record<string, unknown>,
): Promise<void> {
  const rl = createInterface({ input, output, terminal: true });

  const ask = async (question: string, def?: string): Promise<string> => {
    const hint = def !== undefined ? chalk.dim(` (${def || 'none'})`) : '';
    const raw = (await rl.question(`  ${question}${hint}: `)).trim();
    if (raw === '-') return '';  // explicit clear sentinel
    return raw || def || '';
  };

  console.log(chalk.bold(`\nUpdating ${PUBLISH_MANIFEST_FILE}\n`));
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

    writeAndPrintManifest(manifestPath, updated as ManifestInput);
    console.log(chalk.dim(`\n  Tip: run aitools manifest validate to verify all declared files exist.`));
  } catch (err) {
    rl.close();
    throw err;
  }
}

// -- Command export ------------------------------------------------------------

export function createManifestCommand(): Command {
  const cmd = new Command('manifest').description(
    'Manage the tool publish manifest (aitools.manifest.json)',
  );
  cmd.addCommand(createManifestInitCommand());
  cmd.addCommand(createManifestValidateCommand());
  cmd.addCommand(createManifestBumpCommand());
  cmd.addCommand(createManifestUpdateCommand());
  return cmd;
}
