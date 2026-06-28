import sys

path = 'k:/f-drive/workspace/ai-tools/packages/cli/src/utils/config-manager.test.ts'
with open(path, 'rb') as f:
    content = f.read().decode('utf-8').replace('\r\r\n', '\n').replace('\r\n', '\n')

old = """describe('ConfigManager.detectedPlatform', () => {
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
  });"""

new = """describe('ConfigManager.detectedPlatform', () => {
  let tmp: string;
  const savedEnv: Record<string, string | undefined> = {};
  let resolveConfigSpy: jest.SpyInstance;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-dp-'));
    for (const key of ['VSCODE_PID', 'TERM_PROGRAM', 'CURSOR_TRACE_ID']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    // Isolate from ancestor/user configs so platform is never set by cascade
    resolveConfigSpy = jest.spyOn(ConfigCascade, 'resolveConfigFiles')
      .mockImplementation((cwd: string) => [path.join(cwd, 'ai-tools.config.json')]);
  });

  afterEach(() => {
    resolveConfigSpy.mockRestore();
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    fs.rmSync(tmp, { recursive: true });
  });"""

if old not in content:
    print("ERROR: anchor not found")
    idx = content.find("describe('ConfigManager.detectedPlatform'")
    print(repr(content[idx:idx+400]))
    sys.exit(1)

content = content.replace(old, new, 1)
with open(path, 'w', newline='\n') as f:
    f.write(content)
print("OK - test isolation added")
