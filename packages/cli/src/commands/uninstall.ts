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
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { readManifest, writeManifest, removeToolDependency } from '@ai-tools/core';
import { ConfigManager } from '../utils/config-manager.js';
import { Installer } from '../utils/installer.js';

/**
 * ai-tools uninstall <name>
 * Aliases: remove, rm, un
 *
 * Removes all installed files for the named tool and removes it from ai-tools.json.
 */
export function createUninstallCommand(): Command {
  return new Command('uninstall')
    .alias('remove')
    .alias('rm')
    .alias('un')
    .description('Remove an installed ai-tool package')
    .argument('<package>', 'Package name to remove')
    .action((pkg: string) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const installer = new Installer(configManager, cwd);

      const spinner = ora(`Removing ${chalk.cyan(pkg)}...`).start();

      let removed: string[];
      try {
        removed = installer.uninstall(pkg);
        spinner.succeed(`Removed ${chalk.green(pkg)} (${removed.length} file(s))`);
        for (const f of removed) {
          console.log(chalk.dim(`  - ${f}`));
        }
      } catch (err) {
        spinner.fail(`Failed to remove: ${(err as Error).message}`);
        process.exit(1);
      }

      // Remove from ai-tools.json if present
      const manifest = readManifest(cwd);
      if (manifest) {
        const updated = removeToolDependency(manifest, pkg);
        writeManifest(cwd, updated);
        console.log(chalk.dim('  Removed from ai-tools.json'));
      }
    });
}
