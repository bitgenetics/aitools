import sys

path = 'k:/f-drive/workspace/ai-tools/packages/cli/src/commands/install.ts'
with open(path, 'rb') as f:
    content = f.read().decode('utf-8').replace('\r\r\n', '\n').replace('\r\n', '\n')

old = (
    "  if (configManager.getPlatform() === 'universal') {\n"
    "    console.log(\n"
    "      chalk.yellow('\\n  Tip: no platform configured -- files were installed to .agents/') +\n"
    "      chalk.dim('\\n  Run: ai-tools config set platform vscode  (or claude|cursor|windsurf)'),\n"
    "    );\n"
    "  }"
)

new = (
    "  if (configManager.getPlatform() === 'universal') {\n"
    "    console.log(\n"
    "      chalk.yellow('\\n  Tip: no platform configured -- files were installed to .agents/') +\n"
    "      chalk.dim('\\n  Run: ai-tools config set platform vscode  (or claude|cursor|windsurf)'),\n"
    "    );\n"
    "  } else if (configManager.detectedPlatform) {\n"
    "    console.log(\n"
    "      chalk.dim(`\\n  Auto-detected platform: ${configManager.detectedPlatform}`) +\n"
    "      chalk.dim(`\\n  Pin it permanently: ai-tools config set platform ${configManager.detectedPlatform}`),\n"
    "    );\n"
    "  }"
)

if old not in content:
    print("ERROR: anchor not found")
    idx = content.find("configManager.getPlatform() === 'universal'")
    print("Found at:", idx)
    print(repr(content[idx:idx+300]))
    sys.exit(1)

content = content.replace(old, new, 1)
with open(path, 'w', newline='\n') as f:
    f.write(content)
print("OK - install.ts patched")
