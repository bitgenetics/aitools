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
import ora from 'ora';
import chalk from 'chalk';
import {
  MANIFEST_FILENAME,
  resolvePublishSource,
  toPublishManifest,
  resolveStoredPath,
  analyzePluginPortability,
  parseCursorPluginJson,
} from '@bitgenetics/aitools-core';
import type { ToolManifest, CursorPluginJsonPaths } from '@bitgenetics/aitools-core';
import { ConfigManager } from '../utils/config-manager.js';
import { createRegistryClient } from '../utils/registry-client.js';
import { parseSkillFrontmatter, analyzeCompat, printPortabilityGrade } from './compat.js';
import { PLATFORM_SPECS } from '@bitgenetics/aitools-core';
import type { TargetPlatform } from '@bitgenetics/aitools-core';

interface PublishOptions {
  manifest?: string;
  registry?: string;
  dryRun?: boolean;
  strict?: boolean;
  yes?: boolean;
}

/**
 * Run the plugin portability check at publish time.
 * - 'ok': proceed with publish.
 * - 'error': hard failure (files with no install home, or warnings under --strict) — exit 1.
 * - 'cancel': the user declined the warning prompt — stop without publishing.
 * Advisory warnings (rewrite-required / missing-anchor) block only under --strict, prompt on
 * an interactive TTY, and otherwise proceed with a printed notice.
 */
async function checkPluginPortability(
  manifest: ToolManifest,
  manifestDir: string,
  options: PublishOptions,
): Promise<'ok' | 'error' | 'cancel'> {
  if (manifest.category !== 'plugin') return 'ok';

  let pluginJson: CursorPluginJsonPaths | null = null;
  const descriptorPath = path.join(manifestDir, '.cursor-plugin', 'plugin.json');
  if (fs.existsSync(descriptorPath)) {
    pluginJson = parseCursorPluginJson(fs.readFileSync(descriptorPath, 'utf8'));
  }

  const portability = analyzePluginPortability({
    packageName: manifest.name,
    sources: manifest.files.map((f) => f.src),
    pluginJson,
  });
  printPortabilityGrade(portability);

  const errors = portability.findings.filter((f) => f.kind === 'orphan');
  if (errors.length > 0) {
    console.error(
      chalk.red('\n  Publish blocked: plugin has files with no install home. Fix these before publishing.'),
    );
    return 'error';
  }

  const warnings = portability.findings.filter((f) => f.kind !== 'ok' && f.kind !== 'orphan');
  if (warnings.length === 0) return 'ok';

  if (options.strict) {
    console.error(chalk.red('\n  Publish blocked by --strict. Fix the warnings above or remove --strict.'));
    return 'error';
  }

  if (options.yes) {
    console.warn(chalk.yellow('\n  Proceeding despite portability warnings (--yes).'));
    return 'ok';
  }

  if (!input.isTTY) {
    console.warn(
      chalk.yellow('\n  Proceeding despite portability warnings (non-interactive). Use --strict to block.'),
    );
    return 'ok';
  }

  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question(chalk.yellow('\n  Publish anyway despite warnings? (y/N): '))).trim();
    if (!answer.toLowerCase().startsWith('y')) {
      console.log(chalk.dim('  Publish cancelled.'));
      return 'cancel';
    }
    return 'ok';
  } finally {
    rl.close();
  }
}

function resolveToolManifest(
  cwd: string,
  explicitPath?: string,
): { manifest: ToolManifest; manifestDir: string } | null {
  let source;
  try {
    source = resolvePublishSource(cwd, explicitPath, (message: string) => console.warn(chalk.yellow(message)));
  } catch (err) {
    console.error(chalk.red((err as Error).message));
    return null;
  }
  if (!source) return null;

  try {
    return { manifest: toPublishManifest(source.unified), manifestDir: source.manifestDir };
  } catch (err) {
    console.error(chalk.red((err as Error).message));
    return null;
  }
}

/**
 * aitools publish [options]
 *
 * Reads aitools.json, extracts the publish subset, reads declared source
 * files, and publishes to the configured registry.
 */
export function createPublishCommand(): Command {
  return new Command('publish')
    .description('Publish a tool package to the registry')
    .option(
      '-m, --manifest <path>',
      `Path to the manifest file (default: ./${MANIFEST_FILENAME})`,
    )
    .option(
      '-r, --registry <url>',
      'Registry URL to publish to (overrides config)',
    )
    .option('--dry-run', 'Validate and show what would be published without uploading')
    .option('--strict', 'Block publish on skill compat issues or plugin portability warnings')
    .option('-y, --yes', 'Skip the plugin portability warning prompt and continue publishing')
    .action(async (options: PublishOptions, cmd: Command) => {
      if (cmd.args[0] === 'help') {
        cmd.help();
      }
      const cwd = process.cwd();

      const resolved = resolveToolManifest(cwd, options.manifest);
      if (!resolved) {
        console.error(chalk.red(`No publish manifest found.`));
        process.exit(1);
      }

      const { manifest, manifestDir } = resolved;

      const files: Record<string, string> = {};
      const missing: string[] = [];

      for (const entry of manifest.files) {
        const srcPath = resolveStoredPath(manifestDir, entry.src);
        if (!fs.existsSync(srcPath)) {
          missing.push(entry.src);
        } else {
          files[entry.src] = fs.readFileSync(srcPath, 'utf8');
        }
      }

      if (missing.length > 0) {
        console.error(chalk.red('Missing source file(s):'));
        for (const f of missing) console.error(`  ${chalk.dim(f)}`);
        process.exit(1);
      }

      if (manifest.category === 'skill') {
        const skillFile = manifest.files.find((f) => f.src.endsWith('SKILL.md'));
        if (skillFile) {
          const skillPath = resolveStoredPath(manifestDir, skillFile.src);
          if (fs.existsSync(skillPath)) {
            const skillFields = parseSkillFrontmatter(fs.readFileSync(skillPath, 'utf8')) ?? {};
            const allPlatforms = Object.keys(PLATFORM_SPECS) as TargetPlatform[];
            const compatResults = analyzeCompat(skillFields, 'skill', allPlatforms);
            const compatIssues = compatResults.filter((r) =>
              r.fieldIssues.some((i) => i.support === 'unsupported' || i.support === 'ignored'),
            );
            if (compatIssues.length > 0) {
              console.warn(chalk.yellow('\n  Warning: Compatibility issues found:'));
              for (const r of compatIssues) {
                for (const fi of r.fieldIssues.filter((i) => i.support !== 'supported' && i.support !== 'unknown')) {
                  console.warn(`    ${r.spec.name}: ${fi.field} - ${fi.support}`);
                }
              }
              if (options.strict) {
                console.error(chalk.red('\n  Publish blocked by --strict. Fix compatibility issues or remove --strict.'));
                process.exit(1);
              }
              console.warn('');
            }
          }
        }
      }

      const portabilityResult = await checkPluginPortability(manifest, manifestDir, options);
      if (portabilityResult === 'error') {
        process.exit(1);
      }
      if (portabilityResult === 'cancel') {
        return;
      }

      if (options.dryRun) {
        console.log(chalk.bold(`Would publish ${manifest.name}@${manifest.version}`));
        console.log(`  category: ${chalk.cyan(manifest.category)}`);
        console.log(`  files:`);
        for (const entry of manifest.files) {
          console.log(`    ${chalk.dim(entry.src)} -> ${chalk.dim(entry.dest)}`);
        }
        return;
      }

      const configManager = new ConfigManager(cwd);
      const config = configManager.get();

      const sorted = [...(config.registries ?? [])].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
      let registryConfig = sorted[0];

      if (options.registry) {
        registryConfig = { name: 'cli', url: options.registry };
      }

      if (!registryConfig) {
        console.error(
          chalk.red('No registry configured.'),
          `\n  Add one with: ${chalk.cyan('aitools registry add <name> <url>')}`,
          `\n  Or pass:      ${chalk.cyan('aitools publish --registry <url>')}`,
        );
        process.exit(1);
      }

      const spinner = ora(
        `Publishing ${chalk.bold(manifest.name)}@${manifest.version} to ${chalk.dim(registryConfig.url)}`,
      ).start();

      try {
        const client = createRegistryClient(registryConfig);
        const result = await client.publish(manifest, files);
        spinner.succeed(
          `Published ${chalk.bold(result.name)}@${chalk.green(result.version)}`,
        );
        console.log(`  integrity: ${chalk.dim(result.integrity)}`);
        console.log(`  registry:  ${chalk.dim(registryConfig.url)}`);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        let message: string;
        if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
          message = `Registry server not reachable at ${registryConfig.url}\n  Check the server is running or update the URL with: ${chalk.cyan('aitools config list')}`;
        } else {
          message = err instanceof Error
            ? (err.message || err.constructor.name || String(err))
            : String(err);
        }
        spinner.fail(chalk.red(message));
        process.exit(1);
      }
    });
}
