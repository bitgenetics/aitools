import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { readManifest, writeManifest, removeToolDependency } from '@ai-tools/core';
import { ConfigManager } from '../utils/config-manager.js';
import { Installer } from '../utils/installer.js';

/**
 * ai-tools uninstall <name>
 *
 * Removes all installed files for the named tool and removes it from ai-tools.json.
 */
export function createUninstallCommand(): Command {
  return new Command('uninstall')
    .alias('un')
    .description('Uninstall an ai-tool package')
    .argument('<package>', 'Package name to uninstall')
    .action((pkg: string) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const installer = new Installer(configManager, cwd);

      const spinner = ora(`Uninstalling ${chalk.cyan(pkg)}...`).start();

      try {
        const removed = installer.uninstall(pkg);
        spinner.succeed(
          `Uninstalled ${chalk.green(pkg)} — removed ${removed.length} file(s)`,
        );
      } catch (err) {
        spinner.fail(`Failed to uninstall: ${(err as Error).message}`);
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
