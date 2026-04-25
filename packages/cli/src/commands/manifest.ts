import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import semver from 'semver';
import { ToolManifestSchema } from '@ai-tools/core';

const PUBLISH_MANIFEST_FILE = 'ai-tools.manifest.json';

type Category = 'skill' | 'subagent' | 'prompt' | 'mcp-tool';

const CATEGORY_EXT: Record<Category, string[]> = {
  skill: ['.md'],
  subagent: ['.md'],
  prompt: ['.md'],
  'mcp-tool': ['.ts', '.js', '.json'],
};

/** Return the first file in cwd matching the given extensions, or undefined. */
function detectPrimaryFile(cwd: string, exts: string[]): string | undefined {
  try {
    return fs.readdirSync(cwd).find((f) => exts.includes(path.extname(f).toLowerCase()));
  } catch {
    return undefined;
  }
}

interface ManifestInitOptions {
  name?: string;
  version?: string;
  description?: string;
  category?: string;
  author?: string;
  file?: string[];
  force?: boolean;
}

function createManifestInitCommand(): Command {
  return new Command('init')
    .description('Create an ai-tools.manifest.json for publishing to a registry')
    .option('--name <name>', 'Package name (default: current directory name)')
    .option('--version <version>', 'Package version (default: 1.0.0)', '1.0.0')
    .option('--description <text>', 'Short description of the tool')
    .option(
      '--category <category>',
      'Tool category: skill | subagent | prompt | mcp-tool',
    )
    .option('--author <author>', 'Author name or email')
    .option(
      '--file <src:dest>',
      'File entry in src:dest format (repeatable; auto-detected if omitted)',
      (val: string, prev: string[]) => [...prev, val],
      [] as string[],
    )
    .option('--force', 'Overwrite an existing manifest file')
    .action((options: ManifestInitOptions) => {
      const cwd = process.cwd();
      const outPath = path.join(cwd, PUBLISH_MANIFEST_FILE);

      if (fs.existsSync(outPath) && !options.force) {
        console.log(
          chalk.yellow(`${PUBLISH_MANIFEST_FILE} already exists.`),
          chalk.dim('Use --force to overwrite.'),
        );
        return;
      }

      // ── Resolve fields ─────────────────────────────────────────────────────
      const name = options.name ?? path.basename(cwd).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const version = options.version ?? '1.0.0';
      const description = options.description ?? `A ${options.category ?? 'skill'} tool`;
      const category = (options.category ?? 'skill') as Category;

      // ── Resolve files ──────────────────────────────────────────────────────
      let files: Array<{ src: string; dest: string }>;

      if (options.file && options.file.length > 0) {
        files = options.file.map((entry) => {
          const sep = entry.indexOf(':');
          if (sep === -1) {
            // bare filename — use same name for dest
            return { src: entry, dest: path.basename(entry) };
          }
          return { src: entry.slice(0, sep), dest: entry.slice(sep + 1) };
        });
      } else {
        // Auto-detect
        const detected = detectPrimaryFile(cwd, CATEGORY_EXT[category] ?? ['.md']);
        if (detected) {
          files = [{ src: detected, dest: path.basename(detected) }];
        } else {
          // Fallback placeholder
          files = [{ src: `${name}.md`, dest: `${name}.md` }];
          console.log(
            chalk.dim(
              `  Note: no ${(CATEGORY_EXT[category] ?? []).join('/')} file found — using placeholder filename`,
            ),
          );
        }
      }

      // ── Build and validate manifest ────────────────────────────────────────
      const manifest = {
        name,
        version,
        description,
        category,
        files,
        ...(options.author ? { author: options.author } : {}),
      };

      const parsed = ToolManifestSchema.safeParse(manifest);
      if (!parsed.success) {
        console.error(chalk.red('Generated manifest failed validation:'));
        for (const issue of parsed.error.issues) {
          console.error(`  ${chalk.dim(issue.path.join('.'))} ${issue.message}`);
        }
        console.error(chalk.dim('  Fix the options above and try again.'));
        process.exit(1);
      }

      // ── Write ──────────────────────────────────────────────────────────────
      fs.writeFileSync(outPath, JSON.stringify(parsed.data, null, 2) + '\n', 'utf8');
      console.log(chalk.green(`Created ${PUBLISH_MANIFEST_FILE}`));
      console.log(`  name:     ${chalk.cyan(manifest.name)}`);
      console.log(`  version:  ${chalk.cyan(manifest.version)}`);
      console.log(`  category: ${chalk.cyan(manifest.category)}`);
      console.log(`  files:`);
      for (const f of files) {
        console.log(`    ${chalk.dim(f.src)} -> ${chalk.dim(f.dest)}`);
      }
      console.log(chalk.dim(`\n  Edit ${PUBLISH_MANIFEST_FILE} then run: ai-tools publish`));
    });
}

type BumpType = 'major' | 'minor' | 'patch';

function createManifestBumpCommand(): Command {
  return new Command('bump')
    .description('Increment the version in ai-tools.manifest.json')
    .argument('<release>', 'Release type: patch | minor | major, or an explicit version like 1.2.3')
    .action((release: string) => {
      const cwd = process.cwd();
      const manifestPath = path.join(cwd, PUBLISH_MANIFEST_FILE);

      if (!fs.existsSync(manifestPath)) {
        console.error(
          chalk.red(`No ${PUBLISH_MANIFEST_FILE} found.`),
          chalk.dim('Run: ai-tools manifest init'),
        );
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
        // Explicit version string provided
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
      console.log(`${chalk.dim(current)} -> ${chalk.green(next)}`);
    });
}

export function createManifestCommand(): Command {
  const cmd = new Command('manifest').description(
    'Manage the tool publish manifest (ai-tools.manifest.json)',
  );
  cmd.addCommand(createManifestInitCommand());
  cmd.addCommand(createManifestBumpCommand());
  return cmd;
}
