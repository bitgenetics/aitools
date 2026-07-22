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
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'node:fs';
import path from 'node:path';
import {
  acceptStayProposal,
  captureContext,
  discoverAiMech,
  getContextStatus,
  inventoryPath,
  readLockFile,
  readManifest,
  restoreContext,
  swapContextProfile,
  writeLockFile,
  writeManifest,
  type AitoolsJson,
  type SwapProfilePackage,
  type ToolManifest,
} from '@bitgenetics/aitools-core';
import { ConfigManager } from '../utils/config-manager.js';
import { createRegistryClient } from '../utils/registry-client.js';
import { CacheManager } from '../utils/cache-manager.js';

interface ForceOption {
  force?: boolean;
}

async function resolveContextPackage(
  configManager: ConfigManager,
  packageName: string,
): Promise<SwapProfilePackage> {
  const registries = configManager.getRegistries();
  if (registries.length === 0) {
    throw new Error('No registries configured. Add one with: aitools registry add <url>');
  }

  let manifest: ToolManifest | null = null;
  let client = null;
  for (const reg of registries) {
    try {
      const c = createRegistryClient(reg);
      manifest = await c.getManifest(packageName, 'latest');
      client = c;
      break;
    } catch {
      // try next
    }
  }
  if (!manifest || !client) {
    throw new Error(`Could not find ${packageName} in any configured registry.`);
  }
  if (manifest.category !== 'context-profile') {
    throw new Error(
      `Package ${packageName} has category "${manifest.category}"; expected "context-profile".`,
    );
  }

  const cache = new CacheManager();
  let agentsDir: string;
  let integrity: string;
  if (cache.has(manifest.name, manifest.version)) {
    agentsDir = cache.agentsDir(manifest.name, manifest.version);
    integrity = cache.getMetadata(manifest.name, manifest.version).integrity;
  } else {
    const { data, integrity: serverIntegrity } = await client.download(manifest.name, manifest.version);
    const entry = cache.store(manifest.name, manifest.version, data, manifest, serverIntegrity);
    agentsDir = entry.agentsDir;
    integrity = entry.integrity;
  }

  return {
    manifest,
    agentsDir,
    integrity,
    resolved: client.config.url,
  };
}

/**
 * aitools context — hot-swap project AI-mech trees via registry profiles.
 */
export function createContextCommand(): Command {
  const cmd = new Command('context')
    .description('Discover, swap, and restore project AI-mechanism context (role profiles)');

  cmd
    .command('discover')
    .description('Catalog AI-mech files (deterministic) → stdout and .aitools/context-inventory.json')
    .option('--json', 'Print inventory JSON only')
    .action((options: { json?: boolean }) => {
      const cwd = process.cwd();
      const manifest = (readManifest(cwd) ?? {}) as AitoolsJson;
      const inventory = discoverAiMech(cwd, { stay: manifest.context?.stay });
      const out = inventoryPath(cwd);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(inventory, null, 2) + '\n', 'utf8');
      if (options.json) {
        console.log(JSON.stringify(inventory, null, 2));
        return;
      }
      console.log(chalk.bold(`\nAI-mech inventory (${inventory.entries.length} file(s))\n`));
      for (const e of inventory.entries) {
        const stay = e.stay ? chalk.cyan(' [stay]') : '';
        console.log(`  ${e.path}${stay}  ${chalk.dim(e.kind)}`);
      }
      console.log(chalk.dim(`\nWrote ${out}\n`));
    });

  cmd
    .command('capture')
    .description('Record hashes (and optional file copies) of the current AI-mech tree')
    .option('--copy', 'Also copy files under .aitools/context-snapshots/<id>/')
    .action((options: { copy?: boolean }) => {
      const cwd = process.cwd();
      const manifest = (readManifest(cwd) ?? {}) as AitoolsJson;
      const inventory = discoverAiMech(cwd, { stay: manifest.context?.stay });
      const snapshot = captureContext(cwd, inventory, { copyFiles: options.copy === true });
      const lock = readLockFile(cwd);
      writeLockFile(cwd, {
        ...lock,
        context: {
          ...(lock.context ?? { activeProfile: null }),
          activeProfile: lock.context?.activeProfile ?? null,
          snapshotId: snapshot.id,
          fileHashes: snapshot.fileHashes,
          baselinePackage: lock.context?.baselinePackage ?? manifest.context?.baseline?.package,
        },
      });
      console.log(chalk.green(`Captured snapshot ${snapshot.id} (${Object.keys(snapshot.fileHashes).length} file(s))`));
    });

  cmd
    .command('status')
    .description('Show active profile, stay count, quarantine id, and dirty-vs-snapshot hints')
    .option('--json', 'Print status JSON')
    .action((options: { json?: boolean }) => {
      const cwd = process.cwd();
      const status = getContextStatus(cwd);
      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }
      console.log(chalk.bold('\nContext status\n'));
      console.log(`  active profile:  ${status.activeProfile ?? chalk.dim('(baseline)')}`);
      console.log(`  stay count:      ${status.stayCount}`);
      console.log(
        `  quarantine:      ${status.quarantineId ?? chalk.dim('(none)')}` +
          (status.quarantineId
            ? status.quarantinePresent
              ? chalk.green(' (present)')
              : chalk.yellow(' (missing)')
            : ''),
      );
      console.log(`  baseline pkg:    ${status.baselinePackage ?? chalk.dim('(none)')}`);
      console.log(`  snapshot:        ${status.snapshotId ?? chalk.dim('(none)')}`);
      if (status.profilePackage) {
        console.log(`  profile package: ${status.profilePackage} (${status.profileFiles ?? 0} files)`);
      }
      console.log();
    });

  cmd
    .command('accept-stay')
    .description('Merge .aitools/context-stay-proposal.json into authored context.stay')
    .action(() => {
      const cwd = process.cwd();
      try {
        const stay = acceptStayProposal(cwd);
        console.log(chalk.green(`Pinned ${stay.length} stay path(s) into aitools.json`));
        for (const p of stay) console.log(chalk.dim(`  ${p}`));
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  cmd
    .command('swap')
    .description('Quarantine swappable AI-mech files, then install a named context profile')
    .argument('<profile>', 'Profile name from aitools.json context.profiles')
    .option('--force', 'Allow swap when tracked AI-mech paths are dirty')
    .action(async (profileName: string, options: ForceOption) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const spinner = ora(`Swapping to profile ${chalk.cyan(profileName)}...`).start();
      try {
        const result = await swapContextProfile(cwd, profileName, {
          force: options.force === true,
          resolveProfile: (pkg) => resolveContextPackage(configManager, pkg),
        });
        spinner.succeed(
          `Swapped to ${chalk.green(result.profileName)} (${result.mode}); ` +
            `quarantined ${result.quarantine.moves.length} file(s); ` +
            `installed ${result.installed.files.length} profile file(s)`,
        );
        console.log(chalk.dim(`  quarantine id: ${result.quarantine.id}`));
      } catch (err) {
        spinner.fail((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('restore')
    .description('Remove profile overlay and restore from local quarantine (or baseline fallback)')
    .option('--force', 'Allow restore when tracked AI-mech paths are dirty')
    .action(async (options: ForceOption) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const spinner = ora('Restoring AI-mech context...').start();
      try {
        const result = await restoreContext(cwd, {
          force: options.force === true,
          resolveBaseline: (pkg) => resolveContextPackage(configManager, pkg),
        });
        spinner.succeed(`Restored from ${chalk.green(result.restoredFrom)}`);
        if (result.quarantineId) console.log(chalk.dim(`  quarantine id: ${result.quarantineId}`));
        if (result.baselinePackage && result.restoredFrom === 'baseline') {
          console.log(chalk.dim(`  baseline: ${result.baselinePackage}`));
        }
      } catch (err) {
        spinner.fail((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('publish-baseline')
    .description('Pack current AI-mech tree as a context-profile and publish to the registry')
    .option('--name <name>', 'Package name (default: <project>-baseline)')
    .option('--version <version>', 'Package version', '1.0.0')
    .option('--dry-run', 'Build package payload without publishing')
    .action(async (options: { name?: string; version?: string; dryRun?: boolean }) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const project = (readManifest(cwd) ?? {}) as AitoolsJson;
      const inventory = discoverAiMech(cwd, { stay: project.context?.stay });
      if (inventory.entries.length === 0) {
        console.error(chalk.red('No AI-mech files to publish as baseline.'));
        process.exit(1);
      }

      const pkgName =
        options.name ??
        (project.name ? `${project.name.replace(/^@/, '').replace(/\//g, '-')}-baseline` : 'project-baseline');
      const version = options.version ?? '1.0.0';

      const files: Record<string, string> = {};
      const fileEntries: ToolManifest['files'] = [];
      for (const entry of inventory.entries) {
        const abs = path.join(cwd, ...entry.path.split('/'));
        if (!fs.existsSync(abs)) continue;
        files[entry.path] = fs.readFileSync(abs, 'utf8');
        fileEntries.push({ src: entry.path, dest: entry.path, placementMode: 'verbatim' });
      }

      const manifest: ToolManifest = {
        name: pkgName,
        version,
        description: `AI-mech baseline context for ${project.name ?? path.basename(cwd)}`,
        category: 'context-profile',
        files: fileEntries,
      };

      if (options.dryRun) {
        console.log(JSON.stringify({ manifest, fileCount: Object.keys(files).length }, null, 2));
        return;
      }

      const registries = configManager.getRegistries();
      if (registries.length === 0) {
        console.error(chalk.red('No registries configured. Add one with: aitools registry add <url>'));
        process.exit(1);
      }

      const spinner = ora(`Publishing baseline ${chalk.cyan(pkgName)}@${version}...`).start();
      try {
        const client = createRegistryClient(registries[0]!);
        const result = await client.publish(manifest, files);
        spinner.succeed(`Published ${chalk.green(result.name)}@${version}`);

        const next: AitoolsJson = {
          ...project,
          context: {
            ...project.context,
            baseline: {
              ...project.context?.baseline,
              package: pkgName,
            },
          },
        };
        writeManifest(cwd, next);
        console.log(chalk.dim('  Updated aitools.json context.baseline.package'));
      } catch (err) {
        spinner.fail((err as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
