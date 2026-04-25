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
import chalk from 'chalk';
import { ConfigManager } from '../utils/config-manager.js';
import type { RegistryConfig } from '@ai-tools/core';

/**
 * ai-tools registry
 *
 * Subcommands: list, add, remove
 */
export function createRegistryCommand(): Command {
  const registry = new Command('registry').description('Manage configured registries');

  registry
    .command('list')
    .alias('ls')
    .description('List configured registries')
    .action(() => {
      const configManager = new ConfigManager();
      const registries = configManager.getRegistries();

      if (registries.length === 0) {
        console.log(chalk.yellow('No registries configured.'));
        console.log(chalk.dim('  Add one with: ai-tools registry add <url>'));
        return;
      }

      console.log(chalk.bold('\nConfigured registries\n'));
      for (const reg of registries) {
        console.log(`  ${chalk.green(reg.name)}  ${chalk.dim(reg.url)}`);
        if (reg.priority !== undefined) {
          console.log(chalk.dim(`    priority: ${reg.priority}`));
        }
        if (reg.auth) {
          console.log(chalk.dim(`    auth: ${reg.auth.type}`));
        }
      }
      console.log();
    });

  registry
    .command('add <url>')
    .description('Add a registry to the project or user config')
    .option('-n, --name <name>', 'Registry name (defaults to hostname)')
    .option('-p, --priority <priority>', 'Priority (lower = higher priority)', '100')
    .option('--token <token>', 'Bearer token for authentication')
    .option('-g, --global', 'Write to user-level config (~/.ai-tools.config.json)')
    .action((url: string, options: { name?: string; priority?: string; token?: string; global?: boolean }) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);

      let registryName = options.name;
      if (!registryName) {
        try {
          registryName = new URL(url).hostname;
        } catch {
          console.error(chalk.red(`Invalid URL: ${url}`));
          process.exit(1);
        }
      }

      const newRegistry: RegistryConfig = {
        name: registryName,
        url,
        priority: parseInt(options.priority ?? '100', 10),
        ...(options.token ? { auth: { type: 'bearer', token: options.token } } : {}),
      };

      const existing = configManager.get();
      const registries = [...(existing.registries ?? [])];

      const idx = registries.findIndex((r) => r.name === registryName);
      if (idx >= 0) {
        registries[idx] = newRegistry;
        console.log(chalk.green(`Updated registry: ${registryName}`));
      } else {
        registries.push(newRegistry);
        console.log(chalk.green(`Added registry: ${registryName} → ${url}`));
      }

      if (options.global) {
        configManager.writeUserConfig({ registries });
        console.log(chalk.dim(`  saved to ~/ai-tools.config.json`));
      } else {
        configManager.writeProjectConfig({ registries });
        console.log(chalk.dim(`  saved to ./ai-tools.config.json`));
      }
    });

  registry
    .command('remove <name>')
    .alias('rm')
    .description('Remove a registry from the project or user config')
    .option('-g, --global', 'Remove from user-level config (~/.ai-tools.config.json)')
    .action((name: string, options: { global?: boolean }) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const existing = configManager.get();
      const registries = (existing.registries ?? []).filter((r) => r.name !== name);

      if (registries.length === (existing.registries ?? []).length) {
        console.log(chalk.yellow(`Registry "${name}" not found in config.`));
        return;
      }

      if (options.global) {
        configManager.writeUserConfig({ registries });
      } else {
        configManager.writeProjectConfig({ registries });
      }
      console.log(chalk.green(`Removed registry: ${name}`));
    });

  return registry;
}