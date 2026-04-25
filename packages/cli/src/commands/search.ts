import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config-manager.js';
import { createRegistryClient } from '../utils/registry-client.js';
import type { SearchResult } from '../utils/registry-client.js';

/**
 * ai-tools search <query>
 *
 * Searches all configured registries and prints matching tools.
 */
export function createSearchCommand(): Command {
  return new Command('search')
    .alias('s')
    .description('Search the registry for ai-tool packages')
    .argument('<query>', 'Search terms')
    .option('--json', 'Output raw JSON')
    .action(async (query: string, options: { json?: boolean }) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const registries = configManager.getRegistries();

      if (registries.length === 0) {
        console.error(chalk.red('No registries configured. Add one with: ai-tools registry add <url>'));
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
          // Registry unavailable — continue to next
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
 * ai-tools find <description>
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

