import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config-manager.js';
import { Installer } from '../utils/installer.js';

/**
 * ai-tools list
 *
 * Lists all tools recorded in the ai-tools-lock.json.
 */
export function createListCommand(): Command {
  return new Command('list')
    .alias('ls')
    .description('List installed ai-tool packages')
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
        console.log(chalk.yellow('No tools installed. Run: ai-tools install <name>'));
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
