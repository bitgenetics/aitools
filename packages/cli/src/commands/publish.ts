import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config-manager.js';
import { createRegistryClient } from '../utils/registry-client.js';
import type { ToolManifest } from '@ai-tools/core';
import { ToolManifestSchema } from '@ai-tools/core';

const MANIFEST_FILE = 'ai-tools.manifest.json';

interface PublishOptions {
  manifest?: string;
  registry?: string;
  dryRun?: boolean;
}

/**
 * ai-tools publish [options]
 *
 * Reads ai-tools.manifest.json (or the file given by --manifest), reads all
 * declared source files from disk, and publishes the package to the primary
 * configured registry (or the one given by --registry).
 *
 * File layout expected on disk (relative to the manifest file):
 *   ai-tools.manifest.json
 *   skill.md           ← manifest.files[0].src
 *   assets/icon.png    ← manifest.files[1].src
 */
export function createPublishCommand(): Command {
  return new Command('publish')
    .description('Publish a tool package to the registry')
    .option(
      '-m, --manifest <path>',
      `Path to the manifest file (default: ./${MANIFEST_FILE})`,
    )
    .option(
      '-r, --registry <url>',
      'Registry URL to publish to (overrides config)',
    )
    .option('--dry-run', 'Validate and show what would be published without uploading')
    .action(async (options: PublishOptions) => {
      const cwd = process.cwd();
      const manifestPath = options.manifest
        ? path.resolve(options.manifest)
        : path.join(cwd, MANIFEST_FILE);
      const manifestDir = path.dirname(manifestPath);

      // ── Read & validate manifest ───────────────────────────────────────────
      if (!fs.existsSync(manifestPath)) {
        console.error(
          chalk.red(`No manifest found at ${manifestPath}`),
          `\n  Run ${chalk.cyan('ai-tools publish --manifest <path>')} to specify a different file.`,
        );
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
        console.error(chalk.red('Manifest validation failed:'));
        for (const issue of parsed.error.issues) {
          console.error(`  ${chalk.dim(issue.path.join('.'))} ${issue.message}`);
        }
        process.exit(1);
      }

      const manifest: ToolManifest = parsed.data;

      // ── Read source files ──────────────────────────────────────────────────
      const files: Record<string, string> = {};
      const missing: string[] = [];

      for (const entry of manifest.files) {
        const srcPath = path.resolve(manifestDir, entry.src);
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

      // ── Dry-run output ─────────────────────────────────────────────────────
      if (options.dryRun) {
        console.log(chalk.bold(`Would publish ${manifest.name}@${manifest.version}`));
        console.log(`  category: ${chalk.cyan(manifest.category)}`);
        console.log(`  files:`);
        for (const entry of manifest.files) {
          console.log(`    ${chalk.dim(entry.src)} → ${chalk.dim(entry.dest)}`);
        }
        return;
      }

      // ── Resolve registry ───────────────────────────────────────────────────
      const configManager = new ConfigManager(cwd);
      const config = configManager.get();

      // Pick registry with the lowest priority number (highest priority), falling back to first entry.
      const sorted = [...(config.registries ?? [])].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
      let registryConfig = sorted[0];

      if (options.registry) {
        registryConfig = { name: 'cli', url: options.registry };
      }

      if (!registryConfig) {
        console.error(
          chalk.red('No registry configured.'),
          `\n  Add one with: ${chalk.cyan('ai-tools registry add <name> <url>')}`,
          `\n  Or pass:      ${chalk.cyan('ai-tools publish --registry <url>')}`,
        );
        process.exit(1);
      }

      // ── Publish ────────────────────────────────────────────────────────────
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
        spinner.fail(chalk.red((err as Error).message));
        process.exit(1);
      }
    });
}
