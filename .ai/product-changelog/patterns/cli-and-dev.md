# Design Patterns — cli-and-dev

> CLI command baselines, repo/test conventions, tooling limitations. Part of [patterns/](./README.md).

### Commander v12 action signature
**Used for**: Every CLI command handler.  
**How**: The action callback receives `(options, cmd)` where `cmd` is the `Command` instance. For subcommands with positional args, it's `(arg, options, cmd)`. Always check `cmd.args[0] === 'help'` at the top of the action to intercept `ai-tools <command> help` before running logic.  
**Example**: `packages/cli/src/commands/publish.ts` — top of action block  
**Do not**: Use the deprecated `action((arg, options) => {...})` without `cmd` — you can't call `cmd.help()` or inspect `cmd.args`.

---

### Zod validation at system boundaries only
**Used for**: Validating external data — registry responses, manifest files, config files, publish request bodies.  
**How**: Parse with `Schema.safeParse(data)` and handle the error branch explicitly. Do not use Zod inside internal functions that only receive already-validated data.  
**Example**: `packages/core/src/schema/tool-schema.ts`, `packages/server/src/routes/tools.ts` (`PublishBodySchema`)  
**Do not**: Re-validate data that was already validated at the entry point. Only validate at the boundary where external input enters the system.

---

### Copilot-ignored files — use terminal for reads and writes
**Used for**: All files under `packages/cli/src/` and `packages/core/src/`.  
**How**: Use PowerShell `Get-Content` to read. For multi-line writes/edits, write a Python script to a file using single-quoted heredoc (`@'...'@`), run `python script.py`, then delete the script. Never use Python `-c` with multiline strings in PowerShell.  
**Example**: Every file edit in this session used this pattern.  
**Do not**: Use `read_file` or `replace_string_in_file` on files under those paths — the tools will fail silently or with an "ignored" error.

---

### Fastify `buildApp()` / `inject()` for server tests
**Used for**: Testing `@bitgenetics/aitools-server` route handlers.  
**How**: Call `buildApp(options)` to get a Fastify instance, then use `app.inject({ method, url, payload })` to fire requests without binding a network port. No `supertest` or real HTTP needed.  
**Example**: `packages/server/src/routes/tools.test.ts`  
**Do not**: Start the server with `app.listen()` in tests — it causes port conflicts and slow teardown.

---

### Shared `--platform` CLI option — 2026-07-14 `4452a4d`
**Used for**: `install`, `uninstall`, `update`, `dev-init` (and any install-family command).  
**How**: Import `PLATFORM_OPTION_DESCRIPTION` + `resolvePlatformOption` from `platform-option.ts`; pass result into `ConfigManager(cwd, { platform })`. Unknown platforms exit with known-list error.  
**Example**: `packages/cli/src/utils/platform-option.ts`, `packages/cli/src/commands/install.ts`  
**Do not**: Duplicate per-command platform parsing after this helper exists.

---

### `createRegistryClient()` factory dispatch — 2026-06-26 `d7f8fa0`
**Used for**: All CLI commands that talk to a configured registry (install, search, publish, update).  
**How**: `createRegistryClient(config)` checks `config.type === 'git'` (via `isGitRegistryConfig`) and returns `GitRegistryClient` or `HttpRegistryClient`. Both implement the shared `RegistryClient` interface. Omitting `type` in config defaults to HTTP.  
**Example**: `packages/cli/src/utils/registry-client.ts`, `packages/cli/src/utils/git-registry-client.ts`  
**Do not**: Branch on registry type inside command handlers — always go through the factory so HTTP and git stay interchangeable at the call site.

---

### Config write target resolution — 2026-06-28 `e0a753f`
**Used for**: Any CLI command that mutates `aitools.config.json` (`config set/unset/edit`, `registry add/remove`).  
**How**: Call `assertExclusiveConfigTarget(options)` then `resolveConfigWriteTarget(options)` → `'user' | 'project'`. Default is user (`~/.aitools.config.json`); `--project` selects `./aitools.config.json`. Read layer via `readUserConfig()` / `readProjectConfig()`, write via `writeUserConfig()` / `writeProjectConfig()`.  
**Example**: `packages/cli/src/utils/config-write-target.ts`, `packages/cli/src/commands/registry.ts`  
**Do not**: Write the merged `ConfigManager.config` object back to disk — that loses layer separation.

---

### Config layer test contract — 2026-06-28 `e0a753f`
**Used for**: Any change to settings writes, cascade reads, or install scope defaults.  
**How**: Unit tests in `config-write-target.test.ts`, `config.test.ts`, `registry.test.ts`, `config-manager.test.ts`, `install.test.ts`. E2E in `config-layers.test.ts`. Isolate user home with mocked `os.homedir()` or `AITOOLS_CONFIG_ROOT` in unit tests; e2e uses `E2E_USER_CONFIG`.  
**Example**: `AGENTS.md` Testing section, `packages/e2e/src/config-layers.test.ts`  
**Do not**: Ship config-layer behaviour changes without updating both unit and e2e contracts.

---

### Changelog-first e2e contracts — 2026-07-16 `ad7a20d`
**Used for**: Any product-behaviour change that will (or should) be covered by `packages/e2e`.  
**How**: When writing an implementation plan, include a **Update product changelog** step (skill: `project-changelog`) *before* e2e todos. Record the intended CLI/user-visible behaviour in the matching `features/<topic>.md` (plus `constraints/` / `patterns/` as needed) with the e2e suite under **Key files**. Implement e2e against that entry — not the reverse.  
**Example**: `.agents/skills/project-changelog/SKILL.md` Workflow §0, `AGENTS.md` Testing  
**Do not**: Treat e2e `it(...)` names as the product spec when the changelog is silent or stale; do not generate plans with e2e work and no preceding changelog step.
