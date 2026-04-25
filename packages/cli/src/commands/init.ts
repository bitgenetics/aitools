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
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { MANIFEST_FILENAME } from '@ai-tools/core';

/**
 * ai-tools init
 *
 * Creates an ai-tools.json in the current directory if one does not exist.
 * Also creates an ai-tools.config.json if requested.
 */
export function createInitCommand(): Command {
  return new Command('init')
    .description('Initialize ai-tools.json in the current project')
    .option('--force', 'Overwrite an existing ai-tools.json')
    .action((options: { force?: boolean }) => {
      const cwd = process.cwd();
      const manifestPath = path.join(cwd, MANIFEST_FILENAME);

      if (fs.existsSync(manifestPath) && !options.force) {
        console.log(chalk.yellow(`${MANIFEST_FILENAME} already exists. Use --force to overwrite.`));
        return;
      }

      const projectName = path.basename(cwd);
      const manifest = {
        name: projectName,
        tools: {},
        devTools: {},
      };

      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      console.log(chalk.green(`Created ${MANIFEST_FILENAME}`));
      console.log(chalk.dim('  Add tools with: ai-tools install <name>'));
    });
}
