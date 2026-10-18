# Constraints & Tradeoffs — cli-and-dev

> CLI command baselines, repo/test conventions, tooling limitations. Part of [constraints/](./README.md).

### Root CLI options must precede the subcommand — 2026-10-18 (uncommitted)
**Constraint**: `aitools --version` / `-V` print the CLI version only when they come before a subcommand name. After the subcommand, `--version` belongs to that subcommand (`install --version <v>`, `context push --version <v>`). Commander `enablePositionalOptions()` on the root program in `packages/cli/src/cli.ts`.  
**Reason**: Without it the root flag swallowed every subcommand `--version`, so `install foo --version 1.2.3` and `context push … --version` silently printed the CLI version and exited 0 without doing anything.  
**Do not change**: Do not rename the root flag to dodge the collision (users and `packages/e2e/src/cli.test.ts` rely on `aitools --version`); do not give a subcommand a different spelling for "package version" to work around it.  
**Key files**: `packages/cli/src/cli.ts`, `packages/e2e/src/context-snapshots.test.ts` (push → pull)

---

### `.js` extensions on all local imports
**Constraint**: Every local TypeScript import must use a `.js` extension (e.g. `import { foo } from './utils/foo.js'`), even though the source file is `.ts`.  
**Reason**: Node16 module resolution with ESM requires the emitted file extension. TypeScript does not rewrite extensions, so you must write the target extension at the source.  
**Do not change**: Do not remove `.js` from imports or switch to `bundler` module resolution without updating the entire import graph and verifying runtime behaviour.

---

### `packages/cli/src/` and `packages/core/src/` are Copilot-ignored
**Constraint**: VS Code Copilot cannot `read_file` or `replace_string_in_file` any file under those paths. All edits must go through terminal (PowerShell `Get-Content`, Python file-surgery scripts).  
**Reason**: Set in the repo's Copilot ignore configuration. Not intentional as a development constraint — just a tooling limitation of this environment.  
**Do not change**: Do not attempt to use `read_file` on those paths. Use the PowerShell + Python script pattern documented in `patterns/cli-and-dev.md`.

---

### `manifest.ts` has corrupt `\r\r\n` line endings
**Constraint**: `packages/cli/src/commands/manifest.ts` was written with `\r\r\n` (double-CR + LF) line endings. Python's text-mode file reading splits on `\r\r` incorrectly, returning empty strings.  
**Reason**: Artifact of how the file was originally created/edited across tools.  
**Do not change**: When editing `manifest.ts` with Python, always use `open(path, 'rb')` + `.decode('utf-8')` + manual `.replace('\r\r\n', '\n')`. Write back with `newline='\n'` to normalise. After any edit the file will have clean `\n` endings.

---

### CLI shebang must be the first line — 2026-06-15 `907cce7`
**Constraint**: `packages/cli/src/cli.ts` must start with `#!/usr/bin/env node` on line 1. The AGPL copyright block follows on line 2+.  
**Reason**: TypeScript rejects a shebang after comments (`TS18026: '#!' can only be used at the start of a file`).  
**Do not change**: Do not move the shebang below the copyright header.  
**Key files**: `packages/cli/src/cli.ts`

---

### E2E config isolation via `AITOOLS_CONFIG_ROOT` — 2026-06-26 `d7f8fa0`
**Constraint**: E2e tests set a temp `HOME`/`USERPROFILE` and `AITOOLS_CONFIG_ROOT` so config cascade does not walk into the developer's real `~/aitools.config.json` (especially on Windows).  
**Reason**: Leaked user `platform` or registry config caused flaky e2e failures.  
**Do not change**: Any new e2e suite helpers should use `packages/e2e/src/test-env.ts` rather than assuming a clean real home directory.  
**Key files**: `packages/e2e/src/test-env.ts`, `packages/core/src/config/cascade.ts`

---

### CLI unit tests must isolate user home config — 2026-06-27 `6eba41d` (updated `e0a753f`)
**Constraint**: Tests that construct `ConfigManager` or run install/config/registry commands must mock `os.homedir()` to a temp dir and set `AITOOLS_CONFIG_ROOT` where cascade walk must stop. Clear platform env vars (`VSCODE_PID`, `TERM_PROGRAM`, `CURSOR_TRACE_ID`) where auto-detection affects assertions.  
**Reason**: Developer machines with real `~/aitools.config.json`, repo-root project config, or Cursor/VS Code env leaked platform/scope into tests.  
**Do not change**: Rely on a "clean" real home directory in `@bitgenetics/aitools-cli` unit tests.  
**Key files**: `packages/cli/src/commands/install.test.ts`, `packages/cli/src/utils/config-manager.test.ts`, `packages/e2e/src/test-env.ts`

---

### Coverage reports are gitignored — 2026-06-28 `e0a753f`
**Constraint**: `.gitignore` lists `coverage` (matches `packages/*/coverage/` at any depth). Do not commit Jest HTML/lcov output. Config and lock files (`aitools.config.json`, `aitools-lock.json`) are **not** ignored — they are intentional project/user artifacts.  
**Reason**: Coverage dirs were accidentally tracked and bloated diffs; config files belong in repos or user home by design.  
**Do not change**: Do not add `aitools.config.json` to `.gitignore` without an ADR — project settings overrides are meant to be versioned.  
**Key files**: `.gitignore`, `package.json` (`test:coverage`)

---

### Experimental software — no warranty — 2026-06-15 `21e553f`
**Constraint**: `readme.md` states the project is experimental, APIs may change without notice, and there are no warranties — use at your own risk.  
**Reason**: Pre-release project; sets expectations for adopters and employers evaluating internal use.  
**Do not change**: Keep the disclaimer visible near the top of `readme.md` until a stable release is declared.  
**Key files**: `readme.md`
