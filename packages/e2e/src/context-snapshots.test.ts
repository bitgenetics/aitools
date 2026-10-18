/**
 * E2E: AI context snapshots (save → switch → stash/pop → merge → pull/push).
 * Product contract: .ai/product-changelog/features.md + constraints.md — AI context snapshots.
 * Projects here are plain directories with no git repo: the tool must not depend on git.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  E2E_HOME,
  E2E_USER_CONFIG,
  REGISTRY_URL,
  clearE2eUserConfig,
  makeE2eProjectDir,
  rmTmpDir,
  run,
} from './test-env.js';

const PROFILE = 'e2e-context-auditor';
const PROFILE_VERSION = '1.0.0';
const ESCAPING = 'e2e-context-escaping';
const PUSHED = 'e2e-context-pushed';
const WITH_IGNORED = 'e2e-context-with-ignored';
const IGNORED_PATH = '.cursor/mcp.json';
const IGNORED_ORIGINAL = '{"mcpServers":{}}\n';
const IGNORED_EDITED = '{"mcpServers":{"local":{}}}\n';

async function publishContextPackage(name: string, version: string, files: Record<string, string>): Promise<void> {
  const manifest = {
    name,
    version,
    description: `E2E context-profile ${name}`,
    category: 'context-profile',
    files: Object.keys(files).map((src) => ({ src: src.replace(/[/.]/g, '_'), dest: src, placementMode: 'verbatim' })),
  };
  const packed = Object.fromEntries(Object.entries(files).map(([dest, body]) => [dest.replace(/[/.]/g, '_'), body]));
  const res = await fetch(`${REGISTRY_URL}/api/tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest, files: packed }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to publish ${name}: ${res.status} ${await res.text()}`);
  }
}

function writeFile(root: string, rel: string, content: string): void {
  const abs = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

function readFile(root: string, rel: string): string | null {
  const abs = path.join(root, ...rel.split('/'));
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
}

function expectRunFails(args: string, cwd: string, pattern: RegExp): void {
  try {
    run(args, cwd);
    throw new Error(`expected command to fail: aitools ${args}`);
  } catch (err) {
    const e = err as { message?: string; stderr?: string; stdout?: string };
    expect(`${e.message ?? ''}\n${e.stderr ?? ''}\n${e.stdout ?? ''}`).toMatch(pattern);
  }
}

interface StatusJson {
  active: string | null;
  scope: string | null;
  dirty: string[];
  stashDepth: number;
}

function status(cwd: string): StatusJson {
  return JSON.parse(run('context status --json', cwd)) as StatusJson;
}

describe('context snapshots', () => {
  let projectDir: string;

  beforeAll(async () => {
    await publishContextPackage(PROFILE, PROFILE_VERSION, {
      '.cursor/rules/audit.mdc': '# audit rule\n',
      'AGENTS.md': '# auditor agents\n',
    });
    await publishContextPackage(ESCAPING, '1.0.0', {
      '.cursor/rules/ok.mdc': 'ok\n',
      '../escape.md': 'escaped\n',
    });
    await publishContextPackage(WITH_IGNORED, '1.0.0', {
      '.cursor/rules/shared.mdc': 'shared\n',
      [IGNORED_PATH]: '{"mcpServers":{"fromPackage":{}}}\n',
    });
  });

  beforeEach(() => {
    projectDir = makeE2eProjectDir('aitools-context-snap-');
    clearE2eUserConfig();
    fs.writeFileSync(E2E_USER_CONFIG, JSON.stringify({ registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }] }));
    fs.rmSync(path.join(E2E_HOME, '.aitools', 'context'), { recursive: true, force: true });

    writeFile(projectDir, 'aitools.json', JSON.stringify({ name: 'e2e-context-project', context: { ignore: [IGNORED_PATH] } }) + '\n');
    writeFile(projectDir, 'AGENTS.md', '# dev agents\n');
    writeFile(projectDir, '.cursor/rules/dev.mdc', 'dev-rule\n');
    writeFile(projectDir, IGNORED_PATH, IGNORED_ORIGINAL);
  });

  afterEach(() => {
    rmTmpDir(projectDir);
    clearE2eUserConfig();
  });

  it('ls prints the catalog and honours context.ignore', () => {
    const catalog = JSON.parse(run('context ls --json', projectDir)) as { entries: Array<{ path: string }>; ignored: string[] };
    expect([catalog.entries.map((e) => e.path), catalog.ignored]).toEqual([['.cursor/rules/dev.mdc', 'AGENTS.md'], [IGNORED_PATH]]);
  });

  it('context.ignore paths are never captured by save nor deleted or restored by clear and switch', () => {
    run('context save dev', projectDir);
    const shown = JSON.parse(run('context show dev --json', projectDir)) as { manifest: { files: Array<{ path: string }> } };
    expect(shown.manifest.files.map((f) => f.path)).not.toContain(IGNORED_PATH);

    writeFile(projectDir, IGNORED_PATH, IGNORED_EDITED);
    run('context clear', projectDir);
    expect([readFile(projectDir, '.cursor/rules/dev.mdc'), readFile(projectDir, IGNORED_PATH)]).toEqual([null, IGNORED_EDITED]);

    run('context switch dev', projectDir);
    expect([readFile(projectDir, '.cursor/rules/dev.mdc'), readFile(projectDir, IGNORED_PATH)]).toEqual(['dev-rule\n', IGNORED_EDITED]);
  });

  it('switch skips snapshot files matched by context.ignore and reports them', () => {
    run('context save dev', projectDir);
    run(`context pull ${WITH_IGNORED}`, projectDir);
    const out = run(`context switch ${WITH_IGNORED}`, projectDir);
    expect(out).toMatch(/skipped 1 ignored/);
    expect([readFile(projectDir, '.cursor/rules/shared.mdc'), readFile(projectDir, IGNORED_PATH)]).toEqual(['shared\n', IGNORED_ORIGINAL]);
  });

  it('save → edit → save → switch restores exact bytes both ways', () => {
    run('context save dev', projectDir);
    writeFile(projectDir, '.cursor/rules/dev.mdc', 'review-rule\n');
    writeFile(projectDir, '.cursor/rules/extra.mdc', 'extra\n');
    run('context save review', projectDir);

    run('context switch dev', projectDir);
    expect([readFile(projectDir, '.cursor/rules/dev.mdc'), readFile(projectDir, '.cursor/rules/extra.mdc')]).toEqual(['dev-rule\n', null]);

    run('context switch review', projectDir);
    expect(readFile(projectDir, '.cursor/rules/extra.mdc')).toBe('extra\n');
  });

  it('switch refuses unsaved changes, names save/stash, and proceeds with --discard', () => {
    run('context save dev', projectDir);
    writeFile(projectDir, 'AGENTS.md', '# edited\n');
    expectRunFails('context switch dev', projectDir, /context save|context stash|--discard/);
    run('context switch dev --discard', projectDir);
    expect(readFile(projectDir, 'AGENTS.md')).toBe('# dev agents\n');
  });

  it('stash → clear → pop round-trips and status shows depth', () => {
    run('context stash', projectDir);
    expect(status(projectDir).stashDepth).toBe(1);
    run('context clear', projectDir);
    expect(readFile(projectDir, '.cursor/rules/dev.mdc')).toBeNull();
    run('context pop', projectDir);
    expect([readFile(projectDir, '.cursor/rules/dev.mdc'), status(projectDir).stashDepth]).toEqual(['dev-rule\n', 0]);
  });

  it('merge aborts on conflicts; --overwrite applies and leaves active unchanged', () => {
    run('context save dev', projectDir);
    writeFile(projectDir, '.cursor/rules/dev.mdc', 'review-rule\n');
    run('context save review', projectDir);
    run('context switch dev', projectDir);

    expectRunFails('context merge review', projectDir, /--overwrite/);
    run('context merge review --overwrite', projectDir);
    const s = status(projectDir);
    expect([readFile(projectDir, '.cursor/rules/dev.mdc'), s.active, s.dirty]).toEqual(['review-rule\n', 'dev', ['.cursor/rules/dev.mdc']]);
  });

  it('save defaults to user scope; --project writes under the repo and shadows the user label', () => {
    run('context save role', projectDir);
    expect(fs.existsSync(path.join(E2E_HOME, '.aitools', 'context', 'role', 'manifest.json'))).toBe(true);

    writeFile(projectDir, 'AGENTS.md', '# project role\n');
    run('context save role --project', projectDir);
    expect(fs.existsSync(path.join(projectDir, '.aitools', 'context', 'role', 'manifest.json'))).toBe(true);

    const listed = JSON.parse(run('context list --json', projectDir)) as Array<{ label: string; scope: string }>;
    expect(listed.filter((l) => l.label === 'role').map((l) => l.scope)).toEqual(['project', 'user']);
    expect(status(projectDir).scope).toBe('project');
  });

  it('pull imports a context-profile without switching; install rejects it', () => {
    run('context save dev', projectDir);
    run(`context pull ${PROFILE}`, projectDir);
    expect([status(projectDir).active, readFile(projectDir, '.cursor/rules/audit.mdc')]).toEqual(['dev', null]);

    run(`context switch ${PROFILE}`, projectDir);
    expect(readFile(projectDir, '.cursor/rules/audit.mdc')).toBe('# audit rule\n');

    expectRunFails(`install ${PROFILE}@${PROFILE_VERSION}`, projectDir, /context pull/);
  });

  it('push publishes a snapshot that can be pulled back', () => {
    run('context save dev', projectDir);
    run(`context push dev ${PUSHED} --version 1.0.${Date.now() % 100000}`, projectDir);
    run(`context pull ${PUSHED} --as pulled-dev`, projectDir);
    const listed = JSON.parse(run('context list --json', projectDir)) as Array<{ label: string }>;
    expect(listed.map((l) => l.label)).toContain('pulled-dev');
  });

  it('rejects a package whose dest escapes the project before writing anything', () => {
    expectRunFails(`context pull ${ESCAPING}`, projectDir, /outside|not project-relative|AI-mech/);
    const listed = JSON.parse(run('context list --json', projectDir)) as unknown[];
    expect(listed).toEqual([]);
  });
});
