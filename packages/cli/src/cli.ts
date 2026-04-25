#!/usr/bin/env node
import { Command } from 'commander';
import { createInstallCommand } from './commands/install.js';
import { createUninstallCommand } from './commands/uninstall.js';
import { createUpdateCommand } from './commands/update.js';
import { createSearchCommand, createFindCommand } from './commands/search.js';
import { createListCommand } from './commands/list.js';
import { createInitCommand } from './commands/init.js';
import { createRegistryCommand } from './commands/registry.js';
import { createPublishCommand } from './commands/publish.js';
import { createManifestCommand } from './commands/manifest.js';
import { createConfigCommand } from './commands/config.js';

const program = new Command();

program
  .name('ai-tools')
  .description('Package manager for ai-tools: skills, subagents, prompts, and MCP tools')
  .version('0.1.0');

program.addCommand(createInitCommand());
program.addCommand(createInstallCommand());
program.addCommand(createUninstallCommand());
program.addCommand(createUpdateCommand());
program.addCommand(createSearchCommand());
program.addCommand(createFindCommand());
program.addCommand(createListCommand());
program.addCommand(createRegistryCommand());
program.addCommand(createPublishCommand());
program.addCommand(createManifestCommand());
program.addCommand(createConfigCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error((err as Error).message);
  process.exit(1);
});
