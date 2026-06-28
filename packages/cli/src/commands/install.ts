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
import ora from 'ora';
import chalk from 'chalk';
import semver from 'semver';
import {
  readManifest,
  writeManifest,
  upsertToolDependency,
} from '@bitgenetics/aitools-core';
import type { InstallScope } from '@bitgenetics/aitools-core';
import { ConfigManager } from '../utils/config-manager.js';
import { createRegistryClient } from '../utils/registry-client.js';
import { Installer } from '../utils/installer.js';

interface InstallOptions {
  scope?: InstallScope;
  dev?: boolean;
  version?: string;
}

/**
 * aitools install [name[@version]] [options]
 *
 * With a name: resolves the tool from the registry, installs it, and saves to aitools.json.
 * Without a name: installs all tools listed in aitools.json (like `npm install`).
 */
export function createInstallCommand(): Command {
  return new Command('install')
    .alias('i')
    .description('Install an AITools package or all packages listed in aitools.json')
    .argument('[package]', 'Package name with optional version, e.g. my-skill or my-skill@1.2.0')
    .option('-s, --scope <scope>', 'Install scope: project or user', 'project')
    .option('-D, --dev', 'Save as a devTool dependency')
    .option('-v, --version <version>', 'Specific version to install (overrides @version in name)')
    .action(async (pkg: string | undefined, options: InstallOptions) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const installer = new Installer(configManager, cwd);
      const scope = (options.scope as InstallScope | undefined) ?? configManager.getDefaultScope();

      if (pkg) {
        await installSingle(pkg, options, scope, configManager, installer, cwd);
      } else {
        await installAll(scope, configManager, installer, cwd);
      }
    });
}

async function installSingle(
  pkg: string,
  options: InstallOptions,
  scope: InstallScope,
  configManager: ConfigManager,
  installer: Installer,
  cwd: string,
): Promise<void> {
  const { name, version } = parsePackageArg(pkg, options.version);
  const registries = configManager.getRegistries();

  if (registries.length === 0) {
    console.error(chalk.red('No registries configured. Add one with: aitools registry add <url>'));
    process.exit(1);
  }

  const spinner = ora(`Resolving ${chalk.cyan(name)}...`).start();

  let manifest = null;
  let client = null;

  for (const regConfig of registries) {
    try {
      const c = createRegistryClient(regConfig);
      manifest = await c.getManifest(name, version ?? 'latest');
      client = c;
      break;
    } catch {
      // Try next registry
    }
  }

  if (!manifest || !client) {
    spinner.fail(`Could not find ${chalk.cyan(name)} in any configured registry.`);
    process.exit(1);
  }

  spinner.text = `Installing ${chalk.cyan(name)}@${manifest.version}...`;

  let installed;
  try {
    installed = await installer.install(client, manifest, scope);
    spinner.succeed(
      `Installed ${chalk.green(installed.name)}@${installed.version} (${installed.files.length} file(s))`,
    );
    for (const f of installed.files) {
      console.log(chalk.dim(`  -> ${f}`));
    }
  } catch (err) {
    spinner.fail(`Installation failed: ${(err as Error).message}`);
    process.exit(1);
  }

  if (configManager.getPlatform() === 'universal') {
    console.log(
      chalk.yellow('\n  Tip: no platform configured -- files were installed to .agents/') +
      chalk.dim('\n  Run: aitools config set platform vscode  (or claude|cursor|windsurf)'),
    );
  } else if (configManager.detectedPlatform) {
    console.log(
      chalk.dim(`\n  Auto-detected platform: ${configManager.detectedPlatform}`) +
      chalk.dim(`\n  Pin it permanently: aitools config set platform ${configManager.detectedPlatform}`),
    );
  }

  // Update aitools.json
  const existing = readManifest(cwd) ?? {};
  const versionRange = `^${manifest.version}`;
  const updated = upsertToolDependency(existing, name, versionRange, options.dev ?? false);
  writeManifest(cwd, updated);
  console.log(chalk.dim(`  Saved to aitools.json`));
}

async function installAll(
  scope: InstallScope,
  configManager: ConfigManager,
  installer: Installer,
  cwd: string,
): Promise<void> {
  const manifest = readManifest(cwd);
  if (!manifest) {
    console.error(chalk.red('No aitools.json found. Run: aitools init'));
    process.exit(1);
  }

  const allTools: Record<string, string> = {
    ...(manifest.tools ?? {}),
    ...(manifest.devTools ?? {}),
  };

  const toolNames = Object.keys(allTools);
  if (toolNames.length === 0) {
    console.log(chalk.yellow('No tools listed in aitools.json.'));
    return;
  }

  const registries = configManager.getRegistries();
  const lock = installer.getLock();
  let installed = 0;

  for (const name of toolNames) {
    const range = allTools[name] ?? 'latest';
    const locked = lock.tools[name];

    // Skip if already installed at a satisfying version
    if (locked && semver.satisfies(locked.version, range)) {
      console.log(chalk.dim(`  ${name}@${locked.version} ? already satisfied`));
      continue;
    }

    const spinner = ora(`Installing ${chalk.cyan(name)}...`).start();
    let success = false;

    for (const regConfig of registries) {
      try {
        const client = createRegistryClient(regConfig);
        const versions = await client.listVersions(name);
        const resolvedVersion = semver.maxSatisfying(versions, range) ?? 'latest';
        const toolManifest = await client.getManifest(name, resolvedVersion);
        await installer.install(client, toolManifest, scope);
        spinner.succeed(`${chalk.green(name)}@${toolManifest.version}`);
        success = true;
        installed++;
        break;
      } catch {
        // Try next registry
      }
    }

    if (!success) {
      spinner.fail(`Could not install ${chalk.red(name)}`);
    }
  }

  console.log(`\n${chalk.bold(installed)} tool(s) installed.`);
}

/** Parse "name@version" or just "name" into parts. */
export function parsePackageArg(pkg: string, versionOverride?: string): { name: string; version?: string } {
  const atIndex = pkg.lastIndexOf('@');
  if (atIndex > 0) {
    return { name: pkg.slice(0, atIndex), version: versionOverride ?? pkg.slice(atIndex + 1) };
  }
  return { name: pkg, version: versionOverride };
}
