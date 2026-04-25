import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { readManifest } from '@ai-tools/core';
import { ConfigManager } from '../utils/config-manager.js';
import { createRegistryClient } from '../utils/registry-client.js';
import { Installer } from '../utils/installer.js';
import type { InstallScope } from '@ai-tools/core';

/**
 * ai-tools update [name]
 *
 * With a name: update that specific tool to the latest version satisfying its range.
 * Without a name: update all tools listed in ai-tools.json.
 */
export function createUpdateCommand(): Command {
  return new Command('update')
    .alias('up')
    .description('Update installed ai-tool package(s) to the latest matching version')
    .argument('[package]', 'Package name to update (omit to update all)')
    .option('-s, --scope <scope>', 'Install scope: project or user', 'project')
    .action(async (pkg: string | undefined, options: { scope?: string }) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const installer = new Installer(configManager, cwd);
      const scope = (options.scope as InstallScope | undefined) ?? configManager.getDefaultScope();

      const manifest = readManifest(cwd);
      if (!manifest) {
        console.error(chalk.red('No ai-tools.json found. Run: ai-tools init'));
        process.exit(1);
      }

      const allTools: Record<string, string> = {
        ...(manifest.tools ?? {}),
        ...(manifest.devTools ?? {}),
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
          console.log(chalk.yellow(`  ${name} is not in ai-tools.json — skipping`));
          continue;
        }

        const spinner = ora(`Updating ${chalk.cyan(name)}...`).start();
        let success = false;

        for (const regConfig of registries) {
          try {
            const client = createRegistryClient(regConfig);
            const toolManifest = await client.getManifest(name, 'latest');
            await installer.install(client, toolManifest, scope);
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
