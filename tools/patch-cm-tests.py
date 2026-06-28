import sys

path = 'k:/f-drive/workspace/ai-tools/packages/cli/src/utils/config-manager.test.ts'
with open(path, 'rb') as f:
    content = f.read().decode('utf-8').replace('\r\r\n', '\n').replace('\r\n', '\n')

# Add the import for detectPlatformFromEnv
old_import = "import { ConfigManager } from '../utils/config-manager.js';"
new_import = "import { ConfigManager, detectPlatformFromEnv } from '../utils/config-manager.js';"

if old_import not in content:
    print("ERROR: import line not found")
    sys.exit(1)

content = content.replace(old_import, new_import, 1)

# Append test suite at end
tests = """
describe('detectPlatformFromEnv', () => {
  let tmp: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-detect-'));
    for (const key of ['VSCODE_PID', 'TERM_PROGRAM', 'CURSOR_TRACE_ID']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    fs.rmSync(tmp, { recursive: true });
  });

  it('returns "vscode" when VSCODE_PID is set', () => {
    process.env['VSCODE_PID'] = '12345';
    expect(detectPlatformFromEnv(tmp)).toBe('vscode');
  });

  it('returns "vscode" when TERM_PROGRAM is "vscode"', () => {
    process.env['TERM_PROGRAM'] = 'vscode';
    expect(detectPlatformFromEnv(tmp)).toBe('vscode');
  });

  it('returns "cursor" when CURSOR_TRACE_ID is set', () => {
    process.env['CURSOR_TRACE_ID'] = 'some-trace-id';
    expect(detectPlatformFromEnv(tmp)).toBe('cursor');
  });

  it('returns "vscode" when .vscode/ directory exists and no env vars are set', () => {
    fs.mkdirSync(path.join(tmp, '.vscode'));
    expect(detectPlatformFromEnv(tmp)).toBe('vscode');
  });

  it('returns "cursor" when .cursor/ directory exists and no env vars are set', () => {
    fs.mkdirSync(path.join(tmp, '.cursor'));
    expect(detectPlatformFromEnv(tmp)).toBe('cursor');
  });

  it('returns undefined when no signals are present', () => {
    expect(detectPlatformFromEnv(tmp)).toBeUndefined();
  });

  it('prefers VSCODE_PID over .cursor/ directory', () => {
    process.env['VSCODE_PID'] = '1';
    fs.mkdirSync(path.join(tmp, '.cursor'));
    expect(detectPlatformFromEnv(tmp)).toBe('vscode');
  });
});

describe('ConfigManager.detectedPlatform', () => {
  let tmp: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-dp-'));
    for (const key of ['VSCODE_PID', 'TERM_PROGRAM', 'CURSOR_TRACE_ID']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    fs.rmSync(tmp, { recursive: true });
  });

  it('is undefined when platform is explicitly configured', () => {
    fs.writeFileSync(
      path.join(tmp, 'ai-tools.config.json'),
      JSON.stringify({ platform: 'vscode' }),
      'utf8',
    );
    process.env['VSCODE_PID'] = '1';
    expect(new ConfigManager(tmp).detectedPlatform).toBeUndefined();
  });

  it('is set and routes to the correct adapter when auto-detected via VSCODE_PID', () => {
    process.env['VSCODE_PID'] = '1';
    const cm = new ConfigManager(tmp);
    expect(cm.detectedPlatform).toBe('vscode');
    expect(cm.getPlatform()).toBe('vscode');
    // subagents should go to .github/agents/ not .agents/agents/
    const subagentPath = cm.resolveInstallPath('subagent', 'project');
    expect(subagentPath).toContain('.github');
  });

  it('is undefined and falls back to universal when no signals exist', () => {
    const cm = new ConfigManager(tmp);
    expect(cm.detectedPlatform).toBeUndefined();
    expect(cm.getPlatform()).toBe('universal');
  });
});
"""

content = content.rstrip() + "\n" + tests

with open(path, 'w', newline='\n') as f:
    f.write(content)
print("OK - config-manager.test.ts patched")
