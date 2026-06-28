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
import { spawnSync } from 'node:child_process';
import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigCascade } from '@bitgenetics/aitools-core';
import type { AiToolsConfig } from '@bitgenetics/aitools-core';
import { ConfigManager } from '../utils/config-manager.js';
import {
  assertExclusiveConfigTarget,
  configFilePath,
  resolveConfigWriteTarget,
} from '../utils/config-write-target.js';

const CONFIG_FILE = 'aitools.config.json';

// Keys the user can get/set via the CLI (registries are managed by `registry` subcommand)
const SCALAR_KEYS = ['defaultScope', 'platform'] as const;
type ScalarKey = (typeof SCALAR_KEYS)[number];

const VALID_VALUES: Partial<Record<ScalarKey, string[]>> = {
  defaultScope: ['project', 'user'],
  platform: ['vscode', 'claude', 'cursor', 'windsurf'],
};

function isInstallPathsKey(key: string): boolean {
  return key.startsWith('installPaths.');
}

function parseKey(key: string): { type: 'scalar'; field: ScalarKey } | { type: 'installPath'; subkey: string } | null {
  if ((SCALAR_KEYS as readonly string[]).includes(key)) {
    return { type: 'scalar', field: key as ScalarKey };
  }
  if (isInstallPathsKey(key)) {
    const subkey = key.slice('installPaths.'.length);
    if (subkey.length === 0) return null;
    return { type: 'installPath', subkey };
  }
  return null;
}


const CONFIG_TEMPLATE = `{
  // Target platform � controls install directory layout.
  // Allowed: vscode | claude | cursor | windsurf
  // "platform": "vscode",

  // Default install scope when --scope flag is omitted.
  // Allowed: project | user
  // "defaultScope": "project",

  // Registry endpoints. Lower priority number = queried first.
  // "registries": [
  //   {
  //     "name": "my-registry",
  //     "url": "http://localhost:4873",
  //     "priority": 1
  //   }
  // ],

  // Override install directories for specific category + scope combinations.
  // Key format: "<scope>.<category>"
  // "installPaths": {
  //   "project.skill": "~/.vscode/prompts/skills",
  //   "user.prompt": "~/.vscode/prompts"
  // }
}
`;

export function createConfigCommand(): Command {
  const cmd = new Command('config').description('Read and write aitools configuration');

  // -- config list ------------------------------------------------------------
  cmd
    .command('list')
    .alias('ls')
    .description('Show the effective merged configuration (all cascade layers)')
    .option('-g, --global', 'Show only the user-level config (~/' + CONFIG_FILE + ')')
    .action((options: { global?: boolean }) => {
      if (options.global) {
        const userFile = path.join(os.homedir(), CONFIG_FILE);
        const cfg = ConfigCascade.readFile(userFile) as AiToolsConfig | null;
        if (!cfg) {
          console.log(chalk.dim(`No user config found at ${userFile}`));
          return;
        }
        console.log(chalk.bold(`\nUser config  ${chalk.dim(userFile)}\n`));
        printConfig(cfg);
        return;
      }

      const cwd = process.cwd();
      const files = ConfigCascade.resolveConfigFiles(cwd);
      let anyFound = false;

      for (const file of files) {
        const cfg = ConfigCascade.readFile(file) as AiToolsConfig | null;
        if (!cfg) continue;
        anyFound = true;
        const label = file.startsWith(os.homedir()) ? chalk.dim('(user)') : chalk.dim('(project)');
        console.log(chalk.bold(`\n${label}  ${chalk.dim(file)}`));
        printConfig(cfg);
      }

      if (!anyFound) {
        console.log(chalk.dim('No config files found.'));
        console.log(chalk.dim(`  Create one with: aitools config set <key> <value>`));
      }
    });

  // -- config get -------------------------------------------------------------
  cmd
    .command('get <key>')
    .description(
      `Get a config value from the merged cascade.\n  Keys: ${SCALAR_KEYS.join(', ')}, installPaths.<scope.category>`,
    )
    .action((key: string) => {
      const cwd = process.cwd();
      const cfg = ConfigCascade.load(cwd);
      const parsed = parseKey(key);

      if (!parsed) {
        console.error(chalk.red(`Unknown key: ${key}`));
        printKeyHelp();
        process.exit(1);
      }

      let value: string | undefined;
      if (parsed.type === 'scalar') {
        value = cfg[parsed.field] as string | undefined;
      } else {
        value = cfg.installPaths?.[parsed.subkey];
      }

      if (value === undefined) {
        console.log(chalk.dim(`(not set)`));
      } else {
        console.log(value);
      }
    });

  // -- config set -------------------------------------------------------------
  cmd
    .command('set <key> <value>')
    .description(
      `Set a config value (user config by default; project overrides when present).\n  Keys: ${SCALAR_KEYS.join(', ')}, installPaths.<scope.category>`,
    )
    .option('-g, --global', 'Write to user-level config (~/' + CONFIG_FILE + ') [default]')
    .option('--project', 'Write to project config (./' + CONFIG_FILE + ')')
    .action((key: string, value: string, options: { global?: boolean; project?: boolean }) => {
      try {
        assertExclusiveConfigTarget(options);
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }

      const parsed = parseKey(key);

      if (!parsed) {
        console.error(chalk.red(`Unknown key: ${key}`));
        printKeyHelp();
        process.exit(1);
      }

      // Validate enum values
      if (parsed.type === 'scalar') {
        const allowed = VALID_VALUES[parsed.field];
        if (allowed && !allowed.includes(value)) {
          console.error(chalk.red(`Invalid value for ${key}: "${value}"`));
          console.error(chalk.dim(`  Allowed: ${allowed.join(' | ')}`));
          process.exit(1);
        }
      }

      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      const target = resolveConfigWriteTarget(options);
      const layerConfig =
        target === 'project'
          ? configManager.readProjectConfig()
          : configManager.readUserConfig();

      let patch: Record<string, unknown>;
      if (parsed.type === 'scalar') {
        patch = { [parsed.field]: value };
      } else {
        patch = {
          installPaths: { ...(layerConfig.installPaths ?? {}), [parsed.subkey]: value },
        };
      }

      if (target === 'project') {
        configManager.writeProjectConfig(patch as Parameters<typeof configManager.writeProjectConfig>[0]);
        console.log(chalk.green(`Set ${key} = ${value}`), chalk.dim('(project config)'));
      } else {
        configManager.writeUserConfig(patch as Parameters<typeof configManager.writeUserConfig>[0]);
        console.log(chalk.green(`Set ${key} = ${value}`), chalk.dim('(user config)'));
      }
    });

  // -- config unset -----------------------------------------------------------
  cmd
    .command('unset <key>')
    .description('Remove a config key (user config by default)')
    .option('-g, --global', 'Remove from user-level config (~/' + CONFIG_FILE + ') [default]')
    .option('--project', 'Remove from project config (./' + CONFIG_FILE + ')')
    .action((key: string, options: { global?: boolean; project?: boolean }) => {
      try {
        assertExclusiveConfigTarget(options);
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }

      const parsed = parseKey(key);

      if (!parsed) {
        console.error(chalk.red(`Unknown key: ${key}`));
        printKeyHelp();
        process.exit(1);
      }

      const cwd = process.cwd();
      const target = resolveConfigWriteTarget(options);
      const filePath = configFilePath(cwd, target);

      if (!fs.existsSync(filePath)) {
        console.log(chalk.dim(`No config file at ${filePath} � nothing to unset.`));
        return;
      }

      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;

      if (parsed.type === 'scalar') {
        delete raw[parsed.field];
      } else {
        const paths = raw['installPaths'] as Record<string, string> | undefined;
        if (paths) {
          delete paths[parsed.subkey];
          if (Object.keys(paths).length === 0) delete raw['installPaths'];
        }
      }

      fs.writeFileSync(filePath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
      console.log(
        chalk.green(`Unset ${key}`),
        chalk.dim(target === 'project' ? '(project config)' : '(user config)'),
      );
    });


  // -- config edit ------------------------------------------------------------
  cmd
    .command('edit')
    .description('Open the config file in your editor ($VISUAL, $EDITOR, or code)')
    .option('-g, --global', 'Open user-level config (~/' + CONFIG_FILE + ') [default]')
    .option('--project', 'Open project config (./' + CONFIG_FILE + ')')
    .action((options: { global?: boolean; project?: boolean }) => {
      try {
        assertExclusiveConfigTarget(options);
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }

      const cwd = process.cwd();
      const target = resolveConfigWriteTarget(options);
      const filePath = configFilePath(cwd, target);

      // Create a commented template if the file does not exist yet
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, CONFIG_TEMPLATE, 'utf8');
        console.log(chalk.dim(`Created ${filePath}`));
      }

      const editor = resolveEditor();
      if (!editor) {
        console.error(chalk.red('No editor found.'));
        console.error(
          chalk.dim(
            '  Set $VISUAL or $EDITOR, or install VS Code and ensure "code" is in your PATH.',
          ),
        );
        process.exit(1);
      }

      console.log(chalk.dim(`Opening ${filePath} with ${editor.cmd}...`));
      const result = spawnSync(editor.cmd, [...editor.args, filePath], { stdio: 'inherit', shell: false });
      if (result.error) {
        console.error(chalk.red(`Failed to open editor: ${result.error.message}`));
        process.exit(1);
      }
    });
  return cmd;
}

interface EditorCommand {
  cmd: string;
  args: string[];
}

/**
 * Resolve the editor to open a file with. Priority:
 *   $VISUAL ? $EDITOR ? code (VS Code) ? platform fallback
 */
function resolveEditor(): EditorCommand | null {
  // Honour $VISUAL / $EDITOR
  for (const envVar of ['VISUAL', 'EDITOR']) {
    const val = process.env[envVar];
    if (val) {
      const parts = val.trim().split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      if (cmd) return { cmd, args };
    }
  }

  // Try VS Code (with --wait so spawnSync blocks until the tab is closed)
  const codeResult = spawnSync('code', ['--version'], { shell: false, encoding: 'utf8' });
  if (codeResult.status === 0) {
    return { cmd: 'code', args: ['--wait'] };
  }

  // Platform fallback: open file with default associated app (no blocking)
  const platform = process.platform;
  if (platform === 'win32') return { cmd: 'start', args: ['""'] };
  if (platform === 'darwin') return { cmd: 'open', args: [] };
  return { cmd: 'xdg-open', args: [] };
}
function printConfig(cfg: AiToolsConfig): void {
  for (const [k, v] of Object.entries(cfg as Record<string, unknown>)) {
    if (k === 'registries') {
      console.log(`  ${chalk.cyan('registries')}:`);
      for (const r of v as Array<{ name: string; url: string; priority?: number }>) {
        console.log(`    ${chalk.green(r.name)} ? ${r.url}${r.priority !== undefined ? chalk.dim(` (priority ${r.priority})`) : ''}`);
      }
    } else if (k === 'installPaths') {
      console.log(`  ${chalk.cyan('installPaths')}:`);
      for (const [subk, subv] of Object.entries(v as Record<string, string>)) {
        console.log(`    ${chalk.dim(subk)} = ${subv}`);
      }
    } else {
      console.log(`  ${chalk.cyan(k)} = ${chalk.white(String(v))}`);
    }
  }
}

function printKeyHelp(): void {
  console.error(chalk.dim(`  Settable keys:`));
  for (const k of SCALAR_KEYS) {
    const allowed = VALID_VALUES[k];
    console.error(chalk.dim(`    ${k}${allowed ? `  (${allowed.join(' | ')})` : ''}`));
  }
  console.error(chalk.dim(`    installPaths.<scope.category>  (e.g. installPaths.project.skill)`));
}
