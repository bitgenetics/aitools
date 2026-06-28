#!/usr/bin/env node
// Copyright (C) 2026 Nucleic Logic Studios, LLC
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
import { createCompatCommand } from './commands/compat.js';
import { createDevInitCommand } from './commands/dev-init.js';
import { createMcpCommand } from './commands/mcp.js';
import { CLI_VERSION } from './version.js';

const program = new Command();

program
  .name('aitools')
  .description('AITools — package manager for AI skills, rules, commands, agents, hooks, and MCP tools')
  .version(CLI_VERSION);

program.addCommand(createInitCommand());
program.addCommand(createDevInitCommand());
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
program.addCommand(createCompatCommand());
program.addCommand(createMcpCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error((err as Error).message);
  process.exit(1);
});

