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
