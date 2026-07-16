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
import { readManifest, trackingRoot } from '@bitgenetics/aitools-core';
import { ConfigManager } from '../utils/config-manager.js';
import { createRegistryClient } from '../utils/registry-client.js';
import { Installer } from '../utils/installer.js';
import type { InstallScope } from '@bitgenetics/aitools-core';
import { PLATFORM_OPTION_DESCRIPTION, resolvePlatformOption } from '../utils/platform-option.js';

/**
 * aitools update [name]
 *
 * With a name: update that specific tool to the latest version satisfying its range.
 * Without a name: update all tools listed in aitools.json for the chosen scope.
 */
export function createUpdateCommand(): Command {
  return new Command('update')
    .alias('up')
    .description('Update installed AITools package(s) to the latest matching version')
    .argument('[package]', 'Package name to update (omit to update all)')
    .option('-s, --scope <scope>', 'Update scope: project (default) or user')
    .option('-g, --global', 'Update user-scope installs (same as --scope user)')
    .option('-p, --platform <platform>', PLATFORM_OPTION_DESCRIPTION)
    .action(async (pkg: string | undefined, options: {
      scope?: string;
      global?: boolean;
      platform?: string;
    }) => {
      const cwd = process.cwd();
      const platformOverride = resolvePlatformOption(options.platform);
      const configManager = new ConfigManager(cwd, { platform: platformOverride });
      const installer = new Installer(configManager, cwd);

      if (options.global && options.scope && options.scope !== 'user') {
        console.error(chalk.red('Use either --global or --scope project, not both.'));
        process.exit(1);
      }

      const listScope: InstallScope = options.global
        ? 'user'
        : ((options.scope as InstallScope | undefined) ?? 'project');

      const trackDir = trackingRoot(listScope, cwd);
      const manifest = readManifest(trackDir);
      if (!manifest) {
        const hint =
          listScope === 'user'
            ? 'No ~/.aitools/aitools.json found.'
            : 'No aitools.json found. Run: aitools init';
        console.error(chalk.red(hint));
        process.exit(1);
      }

      const allTools: Record<string, string> = {
        ...(manifest.dependencies ?? {}),
        ...(manifest.devDependencies ?? {}),
      };

      const targets = pkg ? [pkg] : Object.keys(allTools);
      if (targets.length === 0) {
        console.log(chalk.yellow('No tools to update.'));
        return;
      }

      const registries = configManager.getRegistries();
      let updated = 0;

      for (const name of targets) {
        if (!allTools[name]) {
          console.log(chalk.yellow(`  ${name} is not in aitools.json — skipping`));
          continue;
        }

        const range = allTools[name] ?? '*';
        const spinner = ora(`Updating ${chalk.cyan(name)}...`).start();
        let success = false;

        const lock = installer.getLock(listScope);
        const locked = lock.tools[name];
        const lockedScope = locked?.scope;
        const scope: InstallScope =
          (options.scope as InstallScope | undefined) ??
          (options.global ? 'user' : undefined) ??
          lockedScope ??
          listScope;

        for (const regConfig of registries) {
          try {
            const client = createRegistryClient(regConfig);
            const versions = await client.listVersions(name);
            const resolvedVersion = semver.maxSatisfying(versions, range) ?? 'latest';
            const toolManifest = await client.getManifest(name, resolvedVersion);
            const cursorPlugin = locked?.installMethod === 'cursor-plugin-local';
            const pluginBundle = locked?.installMethod === 'plugin-bundle';
            await installer.install(client, toolManifest, scope, { cursorPlugin, pluginBundle });
            spinner.succeed(`${chalk.green(name)}@${toolManifest.version}`);
            success = true;
            updated++;
            break;
          } catch {
            // Try next registry
          }
        }

        if (!success) {
          spinner.fail(`Could not update ${chalk.red(name)}`);
        }
      }

      console.log(`\n${chalk.bold(updated)} tool(s) updated.`);
    });
}
