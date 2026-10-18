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
import {
  ActiveSnapshotError,
  ContextStore,
  DirtyWorkingTreeError,
  MergeConflictError,
  OutsideCatalogError,
  assertCatalogPath,
  buildCatalog,
  classify,
  clearContext,
  contextStatus,
  importSnapshotFromPackage,
  matchGlob,
  mergeContext,
  popContext,
  saveContext,
  snapshotExists,
  stashContext,
  switchContext,
  type ToolManifest,
} from '../index.js';

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
}

function readRel(root: string, rel: string): string | null {
  const abs = path.join(root, ...rel.split('/'));
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
}

const BASE_TREE = {
  'AGENTS.md': '# base agents\n',
  '.cursor/rules/base.mdc': 'base-rule\n',
  '.cursor/skills/base/SKILL.md': 'base-skill\n',
};

function makeStore(ignore: string[] = []): { store: ContextStore; project: string; user: string } {
  const project = tmpDir('aitools-ctx-project-');
  const user = tmpDir('aitools-ctx-user-');
  writeTree(project, BASE_TREE);
  return { store: new ContextStore({ projectRoot: project, userRoot: user, ignore }), project, user };
}

describe('matchGlob', () => {
  it('matches exact paths', () => {
    expect(matchGlob('AGENTS.md', 'AGENTS.md')).toBe(true);
  });

  it('matches dir/** prefixes', () => {
    expect(matchGlob('.cursor/rules/**', '.cursor/rules/a/b.mdc')).toBe(true);
  });

  it('does not let * cross a slash', () => {
    expect(matchGlob('.cursor/*.json', '.cursor/x/y.json')).toBe(false);
  });
});

describe('classify', () => {
  it('classifies instruction files at any depth', () => {
    expect(classify('packages/a/b/AGENTS.md')).toBe('instructions');
  });

  it('classifies vendor-specific instruction files', () => {
    expect(classify('.github/copilot-instructions.md')).toBe('instructions');
  });

  it('classifies claude settings separately from the vendor tree', () => {
    expect(classify('.claude/settings.local.json')).toBe('settings');
  });

  it('returns null for ordinary project files', () => {
    expect(classify('src/index.ts')).toBeNull();
  });
});

describe('buildCatalog', () => {
  it('finds nested instruction files but skips node_modules and unknown dot-dirs', () => {
    const root = tmpDir('aitools-ctx-catalog-');
    writeTree(root, {
      'packages/a/AGENTS.md': 'x',
      'node_modules/pkg/AGENTS.md': 'x',
      '.vscode/AGENTS.md': 'x',
      '.cursorrules': 'x',
      '.cursor/hooks.json': '{}',
    });
    const paths = buildCatalog(root).entries.map((e) => e.path);
    expect(paths).toEqual(['.cursor/hooks.json', '.cursorrules', 'packages/a/AGENTS.md']);
  });

  it('moves ignored paths out of entries and into ignored', () => {
    const root = tmpDir('aitools-ctx-catalog-');
    writeTree(root, BASE_TREE);
    const catalog = buildCatalog(root, ['AGENTS.md']);
    expect(catalog.ignored).toEqual(['AGENTS.md']);
  });
});

describe('assertCatalogPath', () => {
  it('rejects paths that escape the root', () => {
    expect(() => assertCatalogPath('/proj', '../AGENTS.md')).toThrow(OutsideCatalogError);
  });

  it('rejects paths that are not AI mechanisms', () => {
    expect(() => assertCatalogPath('/proj', 'src/index.ts')).toThrow(OutsideCatalogError);
  });
});

describe('save / switch', () => {
  it('switching between two saved labels restores exact bytes', () => {
    const { store, project } = makeStore();
    saveContext(store, 'base', 'project');
    writeTree(project, { '.cursor/rules/base.mdc': 'audit-rule\n', '.cursor/rules/extra.mdc': 'extra\n' });
    saveContext(store, 'audit', 'project');

    switchContext(store, 'base');
    expect(readRel(project, '.cursor/rules/base.mdc')).toBe('base-rule\n');
    expect(readRel(project, '.cursor/rules/extra.mdc')).toBeNull();

    switchContext(store, 'audit');
    expect(readRel(project, '.cursor/rules/extra.mdc')).toBe('extra\n');
  });

  it('save makes the label active and the tree clean', () => {
    const { store } = makeStore();
    saveContext(store, 'base', 'user');
    const s = contextStatus(store);
    expect([s.active, s.scope, s.dirty]).toEqual(['base', 'user', []]);
  });

  it('refuses to switch when the working tree has unsaved changes', () => {
    const { store, project } = makeStore();
    saveContext(store, 'base', 'project');
    writeTree(project, { 'AGENTS.md': 'edited\n' });
    expect(() => switchContext(store, 'base')).toThrow(DirtyWorkingTreeError);
  });

  it('refuses to switch before anything was ever saved', () => {
    const { store } = makeStore();
    saveContext(store, 'base', 'user');
    const fresh = new ContextStore({ projectRoot: tmpDir('aitools-ctx-fresh-'), userRoot: store.userRoot, ignore: [] });
    writeTree(fresh.projectRoot, { 'CLAUDE.md': 'unsaved\n' });
    expect(() => switchContext(fresh, 'base')).toThrow(DirtyWorkingTreeError);
  });

  it('--discard overwrites unsaved changes', () => {
    const { store, project } = makeStore();
    saveContext(store, 'base', 'project');
    writeTree(project, { 'AGENTS.md': 'edited\n' });
    switchContext(store, 'base', { discard: true });
    expect(readRel(project, 'AGENTS.md')).toBe('# base agents\n');
  });

  it('dry run reports the plan without touching disk', () => {
    const { store, project } = makeStore();
    saveContext(store, 'base', 'project');
    writeTree(project, { '.cursor/rules/base.mdc': 'other\n' });
    saveContext(store, 'other', 'project');
    const plan = switchContext(store, 'base', { dryRun: true });
    expect([plan.dryRun, readRel(project, '.cursor/rules/base.mdc')]).toEqual([true, 'other\n']);
  });

  it('never touches ignored paths and reports skipped snapshot files', () => {
    const { store, project } = makeStore();
    saveContext(store, 'with-agents', 'project');
    const ignoring = new ContextStore({ projectRoot: project, userRoot: store.userRoot, ignore: ['AGENTS.md'] });
    writeTree(project, { 'AGENTS.md': 'local-only\n' });
    const result = switchContext(ignoring, 'with-agents', { discard: true });
    expect([result.skipped, readRel(project, 'AGENTS.md')]).toEqual([['AGENTS.md'], 'local-only\n']);
  });

  it('a crash after the state write is repaired by switching again with --discard', () => {
    const { store, project } = makeStore();
    saveContext(store, 'base', 'project');
    // Simulate: state says "base" but the tree was never rewritten.
    writeTree(project, { 'AGENTS.md': 'half-applied\n' });
    expect(contextStatus(store).dirty).toEqual(['AGENTS.md']);
    switchContext(store, 'base', { discard: true });
    expect(contextStatus(store).dirty).toEqual([]);
  });
});

describe('scope resolution', () => {
  it('saves to user scope under the user root', () => {
    const { store, user } = makeStore();
    const saved = saveContext(store, 'role', 'user');
    expect(saved.ref.dir.startsWith(user)).toBe(true);
  });

  it('a project label shadows a user label of the same name', () => {
    const { store, project } = makeStore();
    saveContext(store, 'role', 'user');
    writeTree(project, { 'AGENTS.md': '# project version\n' });
    saveContext(store, 'role', 'project');
    expect(store.resolve('role')?.scope).toBe('project');
  });

  it('writes a gitignore for stash and state in the project store', () => {
    const { store, project } = makeStore();
    saveContext(store, 'role', 'project');
    expect(readRel(project, '.aitools/context/.gitignore')).toBe('stash/\nstate.json\n');
  });
});

describe('stash / clear / pop', () => {
  it('stash → clear → pop round-trips the working tree', () => {
    const { store, project } = makeStore();
    stashContext(store);
    clearContext(store);
    expect(readRel(project, '.cursor/rules/base.mdc')).toBeNull();
    popContext(store);
    expect(readRel(project, '.cursor/rules/base.mdc')).toBe('base-rule\n');
  });

  it('pop drops the entry only after a successful apply', () => {
    const { store } = makeStore();
    stashContext(store);
    popContext(store, { dryRun: true });
    expect(contextStatus(store).stashDepth).toBe(1);
  });

  it('clear leaves no active snapshot', () => {
    const { store } = makeStore();
    stashContext(store);
    clearContext(store);
    expect(contextStatus(store).active).toBeNull();
  });
});

describe('merge', () => {
  it('aborts on conflicting files and lists them', () => {
    const { store, project } = makeStore();
    saveContext(store, 'base', 'project');
    writeTree(project, { '.cursor/rules/base.mdc': 'changed\n' });
    saveContext(store, 'changed', 'project');
    switchContext(store, 'base');
    expect(() => mergeContext(store, 'changed')).toThrow(MergeConflictError);
  });

  it('--overwrite applies conflicts and leaves active unchanged', () => {
    const { store, project } = makeStore();
    saveContext(store, 'base', 'project');
    writeTree(project, { '.cursor/rules/base.mdc': 'changed\n', '.cursor/rules/new.mdc': 'new\n' });
    saveContext(store, 'changed', 'project');
    switchContext(store, 'base');
    const result = mergeContext(store, 'changed', { overwrite: true });
    const s = contextStatus(store);
    expect([result.conflicts, s.active, s.dirty.sort()]).toEqual([
      ['.cursor/rules/base.mdc'],
      'base',
      ['.cursor/rules/base.mdc', '.cursor/rules/new.mdc'],
    ]);
  });
});

describe('store maintenance', () => {
  it('refuses to drop the active snapshot without force', () => {
    const { store } = makeStore();
    saveContext(store, 'base', 'project');
    expect(() => store.drop('base')).toThrow(ActiveSnapshotError);
  });

  it('rename keeps the active pointer in step', () => {
    const { store } = makeStore();
    saveContext(store, 'base', 'project');
    store.rename('base', 'baseline');
    expect([store.readState().active, store.resolve('base')]).toEqual(['baseline', null]);
  });
});

describe('importSnapshotFromPackage', () => {
  function packageDir(files: Record<string, string>): { agentsDir: string; manifest: ToolManifest } {
    const agentsDir = tmpDir('aitools-ctx-pkg-');
    const manifestFiles: ToolManifest['files'] = [];
    for (const [dest, body] of Object.entries(files)) {
      const src = dest.replace(/[/.]/g, '_');
      fs.writeFileSync(path.join(agentsDir, src), body);
      manifestFiles.push({ src, dest });
    }
    return {
      agentsDir,
      manifest: {
        name: '@org/auditor',
        version: '1.0.0',
        description: 'test profile',
        category: 'context-profile',
        files: manifestFiles,
      },
    };
  }

  it('imports a context-profile as a user snapshot named after the package', () => {
    const { store } = makeStore();
    const pkg = packageDir({ '.cursor/rules/audit.mdc': 'audit\n' });
    const imported = importSnapshotFromPackage(store, { ...pkg, registry: 'http://r', scope: 'user' });
    expect([imported.ref.label, snapshotExists(imported.ref.dir)]).toEqual(['auditor', true]);
  });

  it('rejects a package with an escaping dest before writing anything', () => {
    const { store } = makeStore();
    const pkg = packageDir({ '.cursor/rules/ok.mdc': 'ok\n', '../escape.md': 'bad\n' });
    expect(() => importSnapshotFromPackage(store, { ...pkg, registry: 'http://r', scope: 'user' })).toThrow(
      OutsideCatalogError,
    );
    expect(store.list()).toEqual([]);
  });
});
