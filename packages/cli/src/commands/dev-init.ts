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
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import {
  readLockFile,
  writeLockFile,
  upsertLockEntry,
  readManifest,
  writeManifest,
  upsertToolDependency,
} from '@ai-tools/core';
import { ConfigManager } from '../utils/config-manager.js';
import { SKILL_MD, MANIFEST_REFERENCE_MD, PLATFORM_PATHS_MD } from '../bundled/create-ai-tool.js';

/**
 * Bundled file list for create-ai-tool.
 * Each entry maps a dest path (relative to the skill install base) to its content.
 */
export const BUNDLED_VERSION = '1.1.1';
export const BUNDLED_NAME = 'create-ai-tool';
const BUNDLED_FILES: Array<{ dest: string; content: string }> = [
  { dest: 'create-ai-tool/SKILL.md', content: SKILL_MD },
  { dest: 'create-ai-tool/references/manifest-reference.md', content: MANIFEST_REFERENCE_MD },
  { dest: 'create-ai-tool/references/platform-paths.md', content: PLATFORM_PATHS_MD },
];

interface DevInitOptions {
  force?: boolean;
  scope?: string;
}

/**
 * ai-tools dev-init
 *
 * Installs the bundled create-ai-tool skill directly from the CLI package,
 * without requiring a registry. This gives AI agents in the project the
 * instructions they need to create and publish their own ai-tools packages.
 */
export function createDevInitCommand(): Command {
  return new Command('dev-init')
    .description('Install the bundled create-ai-tool skill without a registry')
    .option('--force', 'Overwrite if already installed')
    .option('--scope <scope>', 'Install scope: project or user (default: project)')
    .action((options: DevInitOptions) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const scope = (options.scope ?? 'project') as 'project' | 'user';

      if (scope !== 'project' && scope !== 'user') {
        console.error(chalk.red('--scope must be "project" or "user"'));
        process.exit(1);
      }

      // Check if already installed
      const lock = readLockFile(cwd);
      if (lock.tools[BUNDLED_NAME] && !options.force) {
        console.log(
          chalk.yellow(`${BUNDLED_NAME} is already installed.`) +
            chalk.dim(' Use --force to reinstall.'),
        );
        return;
      }

      // Resolve platform skill install path
      const installBase = configManager.resolveInstallPath('skill', scope);
      fs.mkdirSync(installBase, { recursive: true });

      // Write each bundled file
      const writtenFiles: string[] = [];
      for (const file of BUNDLED_FILES) {
        const destPath = path.resolve(installBase, file.dest);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, file.content, 'utf8');
        writtenFiles.push(destPath);
      }

      // Record in lock file
      const lockEntry = {
        version: BUNDLED_VERSION,
        resolved: `bundled:${BUNDLED_NAME}`,
        integrity: '',
        files: writtenFiles,
        installedAt: new Date().toISOString(),
      };
      const updatedLock = upsertLockEntry(lock, BUNDLED_NAME, lockEntry);
      writeLockFile(cwd, updatedLock);

      // Update ai-tools.json (devTools)
      const manifest = readManifest(cwd) ?? {};
      const updatedManifest = upsertToolDependency(
        manifest,
        BUNDLED_NAME,
        BUNDLED_VERSION,
        true, // devDependency
      );
      writeManifest(cwd, updatedManifest);

      console.log(chalk.green(`✔ Installed ${BUNDLED_NAME}@${BUNDLED_VERSION} (${writtenFiles.length} file(s))`));
      for (const f of writtenFiles) {
        console.log(chalk.dim(`  -> ${f}`));
      }

      if (configManager.getPlatform() === 'universal') {
        console.log(
          chalk.yellow('\n  Tip: no platform configured — files were installed to .agents/') +
            chalk.dim('\n  Run: ai-tools config set platform vscode  (or claude|cursor|windsurf)'),
        );
      }
    });
}
