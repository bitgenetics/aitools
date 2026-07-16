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
import type { InstallScope } from '@bitgenetics/aitools-core';
import { ConfigManager } from '../utils/config-manager.js';
import { Installer } from '../utils/installer.js';

/**
 * aitools list
 *
 * Lists all tools recorded in the aitools-lock.json for the chosen scope.
 */
export function createListCommand(): Command {
  return new Command('list')
    .alias('ls')
    .description('List installed AITools packages')
    .option('-s, --scope <scope>', 'List scope: project (default) or user')
    .option('-g, --global', 'List user-scope installs (same as --scope user)')
    .option('--json', 'Output raw JSON')
    .action((options: { json?: boolean; scope?: InstallScope; global?: boolean }) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const installer = new Installer(configManager, cwd);

      if (options.global && options.scope && options.scope !== 'user') {
        console.error(chalk.red('Use either --global or --scope project, not both.'));
        process.exit(1);
      }

      const scope: InstallScope = options.global
        ? 'user'
        : (options.scope ?? 'project');

      const lock = installer.getLock(scope);
      const tools = Object.entries(lock.tools);

      if (options.json) {
        console.log(JSON.stringify(lock, null, 2));
        return;
      }

      if (tools.length === 0) {
        const hint =
          scope === 'user'
            ? 'No user-scope tools installed. Run: aitools install <name> -g'
            : 'No tools installed. Run: aitools install <name>';
        console.log(chalk.yellow(hint));
        return;
      }

      const title = scope === 'user' ? 'User-scope installed tools' : 'Installed tools';
      console.log(chalk.bold(`\n${title} (${tools.length})\n`));

      for (const [name, entry] of tools) {
        const method =
          entry.installMethod === 'cursor-plugin-local'
            ? '  [cursor-plugin]'
            : entry.installMethod === 'plugin-bundle'
              ? '  [plugin-bundle]'
              : '';
        console.log(`  ${chalk.green(name)}  ${chalk.dim(entry.version)}${chalk.dim(method)}`);
        console.log(`    ${chalk.dim(`installed: ${entry.installedAt.split('T')[0]}`)}`);
        console.log(`    ${chalk.dim(`files: ${entry.files.length}`)}`);
      }

      console.log();
    });
}
