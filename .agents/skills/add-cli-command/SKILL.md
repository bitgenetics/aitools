---
name: add-cli-command
description: >-
  Use this skill when adding a new top-level command or subcommand to the
  ai-tools CLI. Use when asked to add a command, create a CLI feature, or
  expose new functionality via the ai-tools binary.
metadata:
  project: ai-tools
---

Every CLI command is a single file in `packages/cli/src/commands/` that exports
one factory function, then registered in `cli.ts`. All imports use `.js` extensions
(Node16 ESM — the extension is on the import path, not the filename on disk).

## Steps

### 1. Create the command file

Create `packages/cli/src/commands/<name>.ts`.

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../utils/config-manager.js';
import { createRegistryClient } from '../utils/registry-client.js';

interface <Name>Options {
  // typed options from .option() calls
}

export function create<Name>Command(): Command {
  return new Command('<name>')
    .description('...')
    .argument('[arg]', 'description')
    .option('--flag', 'description')
    .action(async (arg: string | undefined, options: <Name>Options) => {
      const cwd = process.cwd();
      const configManager = new ConfigManager(cwd);
      // ...
    });
}
```

### 2. Register in `cli.ts`

Edit `packages/cli/src/cli.ts`. Add the import and `addCommand` call alongside the existing commands:

```typescript
import { create<Name>Command } from './commands/<name>.js';
// ...
program.addCommand(create<Name>Command());
```

Keep commands grouped by function (install/uninstall/update, then discovery, then publishing, then config).

### 3. Write the test file

Create `packages/cli/src/commands/<name>.test.ts`.

Test the handler logic directly — do not test that the command was registered in `cli.ts`. Mock the HTTP layer with `jest.fn()` or `nock`; mock the filesystem with `os.tmpdir()`. See `AGENTS.md` for full testing rules.

### 4. Build and smoke-test

```bash
npm run build -w @ai-tools/cli
ai-tools <name> --help
```

The CLI is globally linked (`npm link`) — rebuilding is sufficient to update it.

## Reuse these utilities — don't reinvent them

| Utility | Import | Purpose |
|---|---|---|
| `ConfigManager` | `../utils/config-manager.js` | Reads config cascade (project → user → defaults). Use `.get()`, `.getPlatform()`, `getDefaultScope()`. |
| `createRegistryClient` | `../utils/registry-client.js` | Returns a typed registry HTTP client from config. Pass the registry config object from `configManager.get().registries`. |
| `Installer` | `../utils/installer.js` | Handles download + file writing for `skill`/`subagent`/`prompt`/`mcp-tool`. |
| `CacheManager` | `../utils/cache-manager.js` | Reads/writes the local package cache at `~/.ai-tools/cache/`. |

## Gotchas

- **`.js` extensions on every local import** — `'./config-manager.js'` not `'./config-manager'`. This is Node16 ESM. Omitting it causes a runtime `ERR_MODULE_NOT_FOUND`.
- **commander v12 action signature** — `action(async (arg, options) => {...})`. The `options` object is typed; match the interface to `.option()` calls exactly.
- **Use `this.error(message)` inside action for user-facing errors** — it prints cleanly and exits with code 1 without a stack trace.
- **`process.cwd()` for the working directory** — always capture at action entry, not at module load time.
- **Do not read config manually** — `ConfigManager` handles project vs. global config cascade. Reading `ai-tools.config.json` directly bypasses merging.

## File checklist

- [ ] `packages/cli/src/commands/<name>.ts` created, exports `create<Name>Command()`
- [ ] `packages/cli/src/cli.ts` updated — import + `program.addCommand(...)` added
- [ ] `packages/cli/src/commands/<name>.test.ts` created
- [ ] `npm run build -w @ai-tools/cli` succeeds
- [ ] `ai-tools <name> --help` shows correct usage
