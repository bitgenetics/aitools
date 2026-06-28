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
import { ConfigManager } from '../utils/config-manager.js';
import { Installer } from '../utils/installer.js';

/**
 * aitools list
 *
 * Lists all tools recorded in the aitools-lock.json.
 */
export function createListCommand(): Command {
  return new Command('list')
    .alias('ls')
    .description('List installed AITools packages')
    .option('--json', 'Output raw JSON')
    .action((options: { json?: boolean }) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const installer = new Installer(configManager, cwd);
      const lock = installer.getLock();

      const tools = Object.entries(lock.tools);

      if (options.json) {
        console.log(JSON.stringify(lock, null, 2));
        return;
      }

      if (tools.length === 0) {
        console.log(chalk.yellow('No tools installed. Run: aitools install <name>'));
        return;
      }

      console.log(chalk.bold(`\nInstalled tools (${tools.length})\n`));

      for (const [name, entry] of tools) {
        console.log(`  ${chalk.green(name)}  ${chalk.dim(entry.version)}`);
        console.log(`    ${chalk.dim(`installed: ${entry.installedAt.split('T')[0]}`)}`);
        console.log(`    ${chalk.dim(`files: ${entry.files.length}`)}`);
      }

      console.log();
    });
}
