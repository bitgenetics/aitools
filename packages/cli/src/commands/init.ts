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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  readLockFile,
  writeLockFile,
  upsertLockEntry,
  toLockEntry,
} from '@bitgenetics/aitools-core';
import { ConfigManager } from '../utils/config-manager.js';
import { AITOOLS_CONVERT_NAME, AITOOLS_CONVERT_SKILL_MD, AITOOLS_CONVERT_VERSION } from '../bundled/aitools-convert.js';

interface InitOptions {
  force?: boolean;
  withConvertSkill?: boolean;
}

function convertSkillDest(platform: string): string {
  switch (platform) {
    case 'cursor':
      return '.cursor/skills/aitools-convert/SKILL.md';
    case 'claude':
      return '.claude/skills/aitools-convert/SKILL.md';
    default:
      return '.agents/skills/aitools-convert/SKILL.md';
  }
}

function installConvertSkill(cwd: string, configManager: ConfigManager): void {
  const platform = configManager.getPlatform();
  const destRel = convertSkillDest(platform);
  const destPath = path.resolve(cwd, destRel);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, AITOOLS_CONVERT_SKILL_MD, 'utf8');

  const lock = readLockFile(cwd);
  const relPath = path.relative(cwd, destPath).replace(/\\/g, '/');
  const entry = toLockEntry(
    {
      name: AITOOLS_CONVERT_NAME,
      version: AITOOLS_CONVERT_VERSION,
      category: 'skill',
      scope: 'project',
      platform,
      installedAt: new Date().toISOString(),
      files: [relPath],
      registry: 'bundled',
      integrity: 'bundled',
    },
    'bundled',
  );
  writeLockFile(cwd, upsertLockEntry(lock, AITOOLS_CONVERT_NAME, entry));
}

/**
 * aitools init
 *
 * Creates an aitools.json in the current directory if one does not exist.
 */
export function createInitCommand(): Command {
  return new Command('init')
    .description('Initialize aitools.json in the current project')
    .option('--force', 'Overwrite an existing aitools.json')
    .option('--with-convert-skill', 'Install the bundled aitools-convert skill for AI-assisted transformations')
    .action((options: InitOptions) => {
      const cwd = process.cwd();
      const manifestPath = path.join(cwd, 'aitools.json');

      if (fs.existsSync(manifestPath) && !options.force) {
        console.log(chalk.yellow(`aitools.json already exists. Use --force to overwrite.`));
      } else {
        const projectName = path.basename(cwd);
        const manifest = {
          name: projectName,
          tools: {},
          devTools: {},
        };
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
        console.log(chalk.green('Created aitools.json'));
      }

      if (options.withConvertSkill) {
        const configManager = new ConfigManager(cwd);
        installConvertSkill(cwd, configManager);
        console.log(chalk.green('Installed aitools-convert skill'));
      }

      console.log(chalk.dim('  Add tools with: aitools install <name>'));
      console.log(chalk.dim('  Enable MCP access with: aitools mcp install'));
    });
}
