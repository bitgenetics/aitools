import sys

path = 'k:/f-drive/workspace/ai-tools/packages/cli/src/utils/config-manager.ts'
with open(path, 'rb') as f:
    content = f.read().decode('utf-8').replace('\r\r\n', '\n').replace('\r\n', '\n')

old = (
    "export class ConfigManager {\n"
    "  private config: AiToolsConfig;\n"
    "  private cwd: string;\n"
    "  private adapter: PlatformAdapter;\n"
    "\n"
    "  constructor(cwd: string = process.cwd()) {\n"
    "    this.cwd = cwd;\n"
    "    this.config = ConfigCascade.load(cwd);\n"
    "    this.adapter = getAdapter(this.config.platform);\n"
    "  }"
)

new = (
    "// -- Platform auto-detection --------------------------------------------------\n"
    "\n"
    "/**\n"
    " * Detect the current platform from environment variables and filesystem\n"
    " * signals. Used as a fallback when no platform is set in any config file.\n"
    " *\n"
    " * Priority:\n"
    " *   1. VSCODE_PID / TERM_PROGRAM=vscode -> vscode\n"
    " *   2. CURSOR_TRACE_ID                  -> cursor\n"
    " *   3. .vscode/ directory in cwd        -> vscode\n"
    " *   4. .cursor/ directory in cwd        -> cursor\n"
    " */\n"
    "export function detectPlatformFromEnv(cwd: string): TargetPlatform | undefined {\n"
    "  if (process.env['VSCODE_PID'] || process.env['TERM_PROGRAM'] === 'vscode') {\n"
    "    return 'vscode';\n"
    "  }\n"
    "  if (process.env['CURSOR_TRACE_ID']) {\n"
    "    return 'cursor';\n"
    "  }\n"
    "  if (fs.existsSync(path.join(cwd, '.vscode'))) {\n"
    "    return 'vscode';\n"
    "  }\n"
    "  if (fs.existsSync(path.join(cwd, '.cursor'))) {\n"
    "    return 'cursor';\n"
    "  }\n"
    "  return undefined;\n"
    "}\n"
    "\n"
    "export class ConfigManager {\n"
    "  private config: AiToolsConfig;\n"
    "  private cwd: string;\n"
    "  private adapter: PlatformAdapter;\n"
    "  /**\n"
    "   * Non-undefined when the platform was inferred from environment/filesystem\n"
    "   * rather than an explicit config entry. The install command uses this to\n"
    "   * suggest pinning the platform with `ai-tools config set platform <p>`.\n"
    "   */\n"
    "  readonly detectedPlatform: TargetPlatform | undefined;\n"
    "\n"
    "  constructor(cwd: string = process.cwd()) {\n"
    "    this.cwd = cwd;\n"
    "    this.config = ConfigCascade.load(cwd);\n"
    "    if (!this.config.platform) {\n"
    "      this.detectedPlatform = detectPlatformFromEnv(cwd);\n"
    "      if (this.detectedPlatform) {\n"
    "        this.config = { ...this.config, platform: this.detectedPlatform };\n"
    "      }\n"
    "    }\n"
    "    this.adapter = getAdapter(this.config.platform);\n"
    "  }"
)

if old not in content:
    print("ERROR: anchor not found")
    idx = content.find("export class ConfigManager")
    print("Class starts at:", idx)
    print(repr(content[idx:idx+300]))
    sys.exit(1)

content = content.replace(old, new, 1)
with open(path, 'w', newline='\n') as f:
    f.write(content)
print("OK - config-manager.ts patched")
