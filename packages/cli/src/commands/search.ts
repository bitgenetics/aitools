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
import { ConfigManager } from '../utils/config-manager.js';
import { createRegistryClient } from '../utils/registry-client.js';
import type { SearchResult } from '../utils/registry-client.js';

/**
 * aitools search <query>
 *
 * Searches all configured registries and prints matching tools.
 */
export function createSearchCommand(): Command {
  return new Command('search')
    .alias('s')
    .description('Search the registry for AITools packages')
    .argument('<query>', 'Search terms')
    .option('--json', 'Output raw JSON')
    .option('--registry <url>', 'Search a specific registry URL (overrides config)')
    .action(async (query: string, options: { json?: boolean; registry?: string }) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const registries = options.registry
        ? [{ name: options.registry, url: options.registry }]
        : configManager.getRegistries();

      if (registries.length === 0) {
        console.error(chalk.red('No registries configured. Add one with: aitools registry add <url>'));
        process.exit(1);
      }

      const spinner = ora(`Searching for "${query}"...`).start();
      const allResults: SearchResult[] = [];

      for (const regConfig of registries) {
        try {
          const client = createRegistryClient(regConfig);
          const results = await client.search(query);
          allResults.push(...results);
        } catch {
          // Registry unavailable � continue to next
        }
      }

      spinner.stop();

      if (allResults.length === 0) {
        console.log(chalk.yellow(`No results found for "${query}".`));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(allResults, null, 2));
        return;
      }

      printResults(allResults);
    });
}

/**
 * aitools find <description>
 *
 * Smart-find: sends a natural language description to each registry's
 * /smart-search endpoint for AI-powered discovery.
 */
export function createFindCommand(): Command {
  return new Command('find')
    .description('Smart-find: describe what you need and let the registry suggest tools')
    .argument('<description>', 'Natural language description of the tool you need')
    .option('--json', 'Output raw JSON')
    .action(async (description: string, options: { json?: boolean }) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const registries = configManager.getRegistries();

      if (registries.length === 0) {
        console.error(chalk.red('No registries configured.'));
        process.exit(1);
      }

      const spinner = ora(`Finding tools for: "${description}"...`).start();
      const allResults: SearchResult[] = [];

      for (const regConfig of registries) {
        try {
          const client = createRegistryClient(regConfig);
          // smart-search uses the same SearchResult shape
          const results = await client.search(`__smart__:${description}`);
          allResults.push(...results);
        } catch {
          // Registry unavailable or does not support smart-search
        }
      }

      spinner.stop();

      if (allResults.length === 0) {
        console.log(chalk.yellow('No matching tools found.'));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(allResults, null, 2));
        return;
      }

      printResults(allResults);
    });
}

function printResults(results: SearchResult[]): void {
  const categoryColor: Record<string, (s: string) => string> = {
    skill: chalk.blue,
    subagent: chalk.magenta,
    prompt: chalk.cyan,
    'mcp-tool': chalk.yellow,
  };

  for (const r of results) {
    const cat = categoryColor[r.category] ?? chalk.white;
    console.log(`${chalk.bold(r.name)}  ${chalk.dim(r.version)}  ${cat(`[${r.category}]`)}`);
    console.log(`  ${r.description}`);
    if (r.keywords?.length) {
      console.log(chalk.dim(`  keywords: ${r.keywords.join(', ')}`));
    }
    console.log(chalk.dim(`  registry: ${r.registry}`));
    console.log();
  }
}

