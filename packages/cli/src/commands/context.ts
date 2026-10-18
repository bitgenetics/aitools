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
import chalk from 'chalk';
import {
  CONTEXT_PROFILE_CATEGORY,
  ContextStore,
  clearContext,
  contextStatus,
  diffFiles,
  hashWorkingTree,
  importSnapshotFromPackage,
  mergeContext,
  popContext,
  readSnapshotManifest,
  saveContext,
  snapshotToPublishPayload,
  stashContext,
  switchContext,
  type ApplyResult,
  type ContextScope,
  type ToolManifest,
} from '@bitgenetics/aitools-core';
import { ConfigManager } from '../utils/config-manager.js';
import { createRegistryClient, type RegistryClient } from '../utils/registry-client.js';
import { CacheManager } from '../utils/cache-manager.js';

interface JsonOption {
  json?: boolean;
}

interface ScopeOption {
  project?: boolean;
}

interface OverwriteFlags {
  discard?: boolean;
  dryRun?: boolean;
}

const DEFAULT_PUSH_VERSION = '1.0.0';

function scopeOf(options: ScopeOption): ContextScope {
  return options.project ? 'project' : 'user';
}

function openStore(): ContextStore {
  return new ContextStore({ projectRoot: process.cwd() });
}

function fail(err: unknown): never {
  console.error(chalk.red((err as Error).message));
  process.exit(1);
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function printApplyResult(verb: string, result: ApplyResult): void {
  const prefix = result.dryRun ? chalk.yellow('[dry-run] ') : '';
  const target = result.active ? chalk.green(result.active) : chalk.dim('(none)');
  console.log(
    `${prefix}${verb} → ${target}: removed ${result.removed.length}, wrote ${result.written.length}` +
      (result.skipped.length ? chalk.dim(`, skipped ${result.skipped.length} ignored`) : ''),
  );
}

interface ResolvedContextPackage {
  manifest: ToolManifest;
  agentsDir: string;
  registry: string;
}

async function findManifest(
  configManager: ConfigManager,
  packageName: string,
): Promise<{ client: RegistryClient; manifest: ToolManifest }> {
  const registries = configManager.getRegistries();
  if (registries.length === 0) {
    throw new Error('No registries configured. Add one with: aitools registry add <url>');
  }
  for (const reg of registries) {
    try {
      const client = createRegistryClient(reg);
      const manifest = await client.getManifest(packageName, 'latest');
      return { client, manifest };
    } catch {
      // try next registry
    }
  }
  throw new Error(`Could not find ${packageName} in any configured registry.`);
}

async function resolveContextPackage(configManager: ConfigManager, packageName: string): Promise<ResolvedContextPackage> {
  const { client, manifest } = await findManifest(configManager, packageName);
  if (manifest.category !== CONTEXT_PROFILE_CATEGORY) {
    throw new Error(`Package ${packageName} has category "${manifest.category}"; expected "${CONTEXT_PROFILE_CATEGORY}".`);
  }
  const cache = new CacheManager();
  if (!cache.has(manifest.name, manifest.version)) {
    const { data, integrity } = await client.download(manifest.name, manifest.version);
    cache.store(manifest.name, manifest.version, data, manifest, integrity);
  }
  return { manifest, agentsDir: cache.agentsDir(manifest.name, manifest.version), registry: client.config.url };
}

function addReadCommands(cmd: Command): void {
  cmd
    .command('ls')
    .description('List managed AI-mech paths in this project (the catalog)')
    .option('--json', 'Print JSON')
    .action((options: JsonOption) => {
      const catalog = openStore().catalog();
      if (options.json) return printJson(catalog);
      console.log(chalk.bold(`\nAI context catalog (${catalog.entries.length} file(s))\n`));
      for (const e of catalog.entries) console.log(`  ${e.path}  ${chalk.dim(e.kind)}`);
      if (catalog.ignored.length) console.log(chalk.dim(`\n  ${catalog.ignored.length} path(s) excluded by context.ignore`));
      console.log();
    });

  cmd
    .command('status')
    .description('Show active snapshot, unsaved changes, and stash depth')
    .option('--json', 'Print JSON')
    .action((options: JsonOption) => {
      const status = contextStatus(openStore());
      if (options.json) return printJson(status);
      console.log(chalk.bold('\nAI context status\n'));
      console.log(`  active:   ${status.active ? `${chalk.green(status.active)} ${chalk.dim(`[${status.scope}]`)}` : chalk.dim('(none)')}`);
      console.log(`  catalog:  ${status.catalogCount} file(s)` + (status.ignoredCount ? chalk.dim(`, ${status.ignoredCount} ignored`) : ''));
      console.log(`  stash:    ${status.stashDepth} entr${status.stashDepth === 1 ? 'y' : 'ies'}`);
      if (status.dirty.length === 0) {
        console.log(`  changes:  ${chalk.green('none')}`);
      } else {
        console.log(`  changes:  ${chalk.yellow(`${status.dirty.length} unsaved`)}`);
        for (const p of status.dirty) console.log(chalk.dim(`    ${p}`));
      }
      console.log();
    });

  cmd
    .command('list')
    .description('List saved snapshots in project and user scope')
    .option('--json', 'Print JSON')
    .action((options: JsonOption) => {
      const store = openStore();
      const items = store.list();
      const active = store.readState().active;
      if (options.json) return printJson(items.map((i) => ({ ...i.ref, active: i.ref.label === active, files: i.manifest.files.length, origin: i.manifest.origin })));
      if (items.length === 0) return console.log(chalk.dim('No snapshots. Save one with: aitools context save <label>'));
      for (const i of items) {
        const mark = i.ref.label === active ? chalk.green('* ') : '  ';
        const origin = i.manifest.origin ? chalk.dim(`  ← ${i.manifest.origin.package}@${i.manifest.origin.version}`) : '';
        console.log(`${mark}${i.ref.label}  ${chalk.dim(`[${i.ref.scope}] ${i.manifest.files.length} file(s)`)}${origin}`);
      }
    });

  cmd
    .command('show')
    .description('Show a snapshot and how it differs from the working tree')
    .argument('<label>')
    .option('--json', 'Print JSON')
    .action((label: string, options: JsonOption) => {
      try {
        const store = openStore();
        const ref = store.require(label);
        const manifest = readSnapshotManifest(ref.dir);
        const diff = diffFiles(manifest.files, hashWorkingTree(store.catalog()));
        if (options.json) return printJson({ ...ref, manifest, diff });
        console.log(chalk.bold(`\n${ref.label} ${chalk.dim(`[${ref.scope}]`)} — ${manifest.files.length} file(s)\n`));
        for (const f of manifest.files) console.log(`  ${f.path}`);
        console.log(chalk.bold('\nWorking tree vs snapshot'));
        console.log(`  changed: ${diff.changed.length}  only in working: ${diff.added.length}  only in snapshot: ${diff.removed.length}\n`);
      } catch (err) {
        fail(err);
      }
    });
}

function addWriteCommands(cmd: Command): void {
  cmd
    .command('save')
    .description('Snapshot the working tree under a label (becomes active)')
    .argument('<label>')
    .option('--project', 'Save under ./.aitools/context (committable) instead of ~/.aitools/context')
    .action((label: string, options: ScopeOption) => {
      try {
        const saved = saveContext(openStore(), label, scopeOf(options));
        console.log(chalk.green(`Saved ${saved.ref.label}`) + chalk.dim(` [${saved.ref.scope}] ${saved.manifest.files.length} file(s)`));
      } catch (err) {
        fail(err);
      }
    });

  cmd
    .command('switch')
    .description('Replace the working tree with a snapshot')
    .argument('<label>')
    .option('--discard', 'Proceed even if there are unsaved changes')
    .option('--dry-run', 'Show what would change without writing')
    .action((label: string, options: OverwriteFlags) => {
      try {
        printApplyResult('switch', switchContext(openStore(), label, options));
      } catch (err) {
        fail(err);
      }
    });

  cmd
    .command('stash')
    .description('Push the working tree onto the stash (files stay in place)')
    .action(() => {
      try {
        const entry = stashContext(openStore());
        console.log(chalk.green(`Stashed ${entry.manifest.files.length} file(s)`));
      } catch (err) {
        fail(err);
      }
    });

  cmd
    .command('pop')
    .description('Replace the working tree with the top stash entry and drop it')
    .option('--discard', 'Proceed even if there are unsaved changes')
    .option('--dry-run', 'Show what would change without writing')
    .action((options: OverwriteFlags) => {
      try {
        printApplyResult('pop', popContext(openStore(), options));
      } catch (err) {
        fail(err);
      }
    });

  cmd
    .command('clear')
    .description('Remove every cataloged AI-mech file')
    .option('--discard', 'Proceed even if there are unsaved changes')
    .option('--dry-run', 'Show what would change without writing')
    .action((options: OverwriteFlags) => {
      try {
        printApplyResult('clear', clearContext(openStore(), options));
      } catch (err) {
        fail(err);
      }
    });

  cmd
    .command('merge')
    .description("Copy a snapshot's files over the working tree (active snapshot unchanged)")
    .argument('<label>')
    .option('--overwrite', "Take the snapshot's version of conflicting files")
    .option('--dry-run', 'Show what would change without writing')
    .action((label: string, options: { overwrite?: boolean; dryRun?: boolean }) => {
      try {
        const r = mergeContext(openStore(), label, options);
        const prefix = r.dryRun ? chalk.yellow('[dry-run] ') : '';
        console.log(`${prefix}merge ${chalk.green(r.label)}: wrote ${r.written.length}, unchanged ${r.unchanged.length}, overwrote ${r.conflicts.length}`);
      } catch (err) {
        fail(err);
      }
    });

  cmd
    .command('drop')
    .description('Delete a snapshot')
    .argument('<label>')
    .option('--force', 'Allow dropping the active snapshot')
    .action((label: string, options: { force?: boolean }) => {
      try {
        const ref = openStore().drop(label, options);
        console.log(chalk.green(`Dropped ${ref.label}`) + chalk.dim(` [${ref.scope}]`));
      } catch (err) {
        fail(err);
      }
    });

  cmd
    .command('rename')
    .description('Rename a snapshot')
    .argument('<old>')
    .argument('<new>')
    .action((from: string, to: string) => {
      try {
        const ref = openStore().rename(from, to);
        console.log(chalk.green(`Renamed to ${ref.label}`) + chalk.dim(` [${ref.scope}]`));
      } catch (err) {
        fail(err);
      }
    });
}

function addRegistryCommands(cmd: Command): void {
  cmd
    .command('pull')
    .description('Import a registry context-profile as a local snapshot (does not switch)')
    .argument('<package>')
    .option('--as <label>', 'Snapshot label (default: package name without scope)')
    .option('--project', 'Save under ./.aitools/context instead of ~/.aitools/context')
    .action(async (packageName: string, options: ScopeOption & { as?: string }) => {
      try {
        const store = openStore();
        const pkg = await resolveContextPackage(new ConfigManager(store.projectRoot), packageName);
        const imported = importSnapshotFromPackage(store, { ...pkg, label: options.as, scope: scopeOf(options) });
        console.log(
          chalk.green(`Pulled ${pkg.manifest.name}@${pkg.manifest.version} → ${imported.ref.label}`) +
            chalk.dim(` [${imported.ref.scope}] ${imported.manifest.files.length} file(s)`),
        );
      } catch (err) {
        fail(err);
      }
    });

  cmd
    .command('push')
    .description('Publish a snapshot to the registry as a context-profile package')
    .argument('<label>')
    .argument('<package>')
    .option('--version <version>', 'Package version', DEFAULT_PUSH_VERSION)
    .option('--dry-run', 'Print the package payload without publishing')
    .action(async (label: string, packageName: string, options: { version: string; dryRun?: boolean }) => {
      try {
        const store = openStore();
        const payload = snapshotToPublishPayload(store, label, { name: packageName, version: options.version });
        if (options.dryRun) return printJson({ manifest: payload.manifest, fileCount: Object.keys(payload.files).length });
        const registries = new ConfigManager(store.projectRoot).getRegistries();
        if (registries.length === 0) throw new Error('No registries configured. Add one with: aitools registry add <url>');
        const result = await createRegistryClient(registries[0]!).publish(payload.manifest, payload.files);
        console.log(chalk.green(`Pushed ${label} → ${result.name}@${options.version}`));
      } catch (err) {
        fail(err);
      }
    });
}

/** `aitools context` — git-style save / switch / stash of on-disk AI-mech files. */
export function createContextCommand(): Command {
  const cmd = new Command('context').description('Save, switch, stash, and merge snapshots of project AI-mechanism files');
  addReadCommands(cmd);
  addWriteCommands(cmd);
  addRegistryCommands(cmd);
  return cmd;
}
