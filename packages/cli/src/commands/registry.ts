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
import { RegistryConfigSchema } from '@aitools/core';
import type { RegistryConfig, GitRegistryConfig, HttpRegistryConfig } from '@aitools/core';

function defaultRegistryName(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    const sshMatch = url.match(/^git@([^:]+):/);
    if (sshMatch) return sshMatch[1]!;
    return url.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 32) || 'registry';
  }
}

/**
 * aitools registry
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
        console.log(chalk.dim('  Add one with: aitools registry add <url>'));
        return;
      }

      console.log(chalk.bold('\nConfigured registries\n'));
      for (const reg of registries) {
        const typeLabel = reg.type === 'git' ? chalk.cyan('git') : chalk.blue('http');
        console.log(`  ${chalk.green(reg.name)}  ${typeLabel}  ${chalk.dim(reg.url)}`);
        if (reg.priority !== undefined) {
          console.log(chalk.dim(`    priority: ${reg.priority}`));
        }
        if (reg.type === 'git') {
          const gitReg = reg as GitRegistryConfig;
          console.log(chalk.dim(`    read branch: ${gitReg.readBranch ?? 'main'}`));
          console.log(chalk.dim(`    publish branch: ${gitReg.publishBranch ?? gitReg.readBranch ?? 'main'}`));
          if (gitReg.path) {
            console.log(chalk.dim(`    path: ${gitReg.path}`));
          }
        } else if ('auth' in reg && reg.auth) {
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
    .option('-t, --type <type>', 'Registry type: http or git', 'http')
    .option('--read-branch <branch>', 'Git registry read branch (default: main)')
    .option('--publish-branch <branch>', 'Git registry publish branch (default: read branch)')
    .option('--path <path>', 'Path inside git repo where tools are stored (default: registry/)')
    .option('--token <token>', 'Bearer token for HTTP registry authentication')
    .option('-g, --global', 'Write to user-level config (~/.aitools.config.json)')
    .action((
      url: string,
      options: {
        name?: string;
        priority?: string;
        type?: string;
        readBranch?: string;
        publishBranch?: string;
        path?: string;
        token?: string;
        global?: boolean;
      },
    ) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);

      const registryType = (options.type ?? 'http').toLowerCase();
      if (registryType !== 'http' && registryType !== 'git') {
        console.error(chalk.red(`Invalid registry type: ${options.type}. Use "http" or "git".`));
        process.exit(1);
      }

      const registryName = options.name ?? defaultRegistryName(url);

      let newRegistry: RegistryConfig;
      if (registryType === 'git') {
        if (options.token) {
          console.error(chalk.red('Git registries use system git credentials; --token is not supported.'));
          process.exit(1);
        }
        newRegistry = {
          type: 'git',
          name: registryName,
          url,
          priority: parseInt(options.priority ?? '100', 10),
          ...(options.readBranch ? { readBranch: options.readBranch } : {}),
          ...(options.publishBranch ? { publishBranch: options.publishBranch } : {}),
          ...(options.path ? { path: options.path } : {}),
        } satisfies GitRegistryConfig;
      } else {
        newRegistry = {
          type: 'http',
          name: registryName,
          url,
          priority: parseInt(options.priority ?? '100', 10),
          ...(options.token ? { auth: { type: 'bearer' as const, token: options.token } } : {}),
        } satisfies HttpRegistryConfig;
      }

      const parsed = RegistryConfigSchema.safeParse(newRegistry);
      if (!parsed.success) {
        console.error(chalk.red(`Invalid registry config: ${parsed.error.message}`));
        process.exit(1);
      }
      newRegistry = parsed.data;

      const existing = configManager.get();
      const registries = [...(existing.registries ?? [])];

      const idx = registries.findIndex((r) => r.name === registryName);
      if (idx >= 0) {
        registries[idx] = newRegistry;
        console.log(chalk.green(`Updated registry: ${registryName}`));
      } else {
        registries.push(newRegistry);
        console.log(chalk.green(`Added registry: ${registryName} ? ${url}`));
      }

      if (options.global) {
        configManager.writeUserConfig({ registries });
        console.log(chalk.dim(`  saved to ~/aitools.config.json`));
      } else {
        configManager.writeProjectConfig({ registries });
        console.log(chalk.dim(`  saved to ./aitools.config.json`));
      }
    });

  registry
    .command('remove <name>')
    .alias('rm')
    .description('Remove a registry from the project or user config')
    .option('-g, --global', 'Remove from user-level config (~/.aitools.config.json)')
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