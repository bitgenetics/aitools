# Constraints & Tradeoffs

> Accepted limitations. Before "fixing" something here, check whether it was intentional.

---

### `.js` extensions on all local imports
**Constraint**: Every local TypeScript import must use a `.js` extension (e.g. `import { foo } from './utils/foo.js'`), even though the source file is `.ts`.  
**Reason**: Node16 module resolution with ESM requires the emitted file extension. TypeScript does not rewrite extensions, so you must write the target extension at the source.  
**Do not change**: Do not remove `.js` from imports or switch to `bundler` module resolution without updating the entire import graph and verifying runtime behaviour.

---

### `packages/cli/src/` and `packages/core/src/` are Copilot-ignored
**Constraint**: VS Code Copilot cannot `read_file` or `replace_string_in_file` any file under those paths. All edits must go through terminal (PowerShell `Get-Content`, Python file-surgery scripts).  
**Reason**: Set in the repo's Copilot ignore configuration. Not intentional as a development constraint — just a tooling limitation of this environment.  
**Do not change**: Do not attempt to use `read_file` on those paths. Use the PowerShell + Python script pattern documented in `patterns.md`.

---

### `manifest.ts` has corrupt `\r\r\n` line endings
**Constraint**: `packages/cli/src/commands/manifest.ts` was written with `\r\r\n` (double-CR + LF) line endings. Python's text-mode file reading splits on `\r\r` incorrectly, returning empty strings.  
**Reason**: Artifact of how the file was originally created/edited across tools.  
**Do not change**: When editing `manifest.ts` with Python, always use `open(path, 'rb')` + `.decode('utf-8')` + manual `.replace('\r\r\n', '\n')`. Write back with `newline='\n'` to normalise. After any edit the file will have clean `\n` endings.

---

### Double-nested install path was a bug (now fixed)
**Constraint**: The `Installer.installFiles` method now strips the install-base prefix from `file.dest` before resolving the destination path. This was a bug where manifests using project-relative paths (e.g. `.agents/skills/create-ai-tool/SKILL.md` as `dest`) would install to `.agents/skills/.agents/skills/create-ai-tool/SKILL.md`.  
**Reason**: Fix applied 2026-04-26. Manifests with `dest` already relative to the install base work correctly. Manifests with absolute or project-relative `dest` paths are normalised by stripping the install base prefix.  
**Do not change**: The stripping logic in `installFiles`. Tool authors should use install-base-relative paths in `dest` (e.g. `create-ai-tool/SKILL.md`, not `.agents/skills/create-ai-tool/SKILL.md`).  
**Key files**: `packages/cli/src/utils/installer.ts`

---

### VS Code subagent install path is `.github/agents/`, not `.agents/agents/`
**Constraint**: VS Code detects custom workspace agents from `.github/agents/`. The ai-tools `VsCodeAdapter` previously used `.agents/agents/` — this was a bug, not an intentional tradeoff.  
**Reason**: Fixed 2026-04-27. VS Code docs: <https://code.visualstudio.com/docs/copilot/customization/custom-agents>. Files should be `.agent.md` (VS Code preferred) or plain `.md` — both are detected.  
**Do not change**: Do not revert to `.agents/agents/`. Users who installed subagents before this fix have stale entries under `.agents/agents/`; they should uninstall and reinstall.  
**Key files**: `packages/cli/src/adapters/vscode.ts`, `packages/core/src/platforms/vscode.ts`
---

### Platform auto-detection — `detectPlatformFromEnv`
**Constraint**: When no `platform` is set in any config file, `ConfigManager` calls `detectPlatformFromEnv(cwd)` to infer the platform from environment signals before falling back to `universal`. Detection order: `VSCODE_PID` env var → `TERM_PROGRAM=vscode` → `CURSOR_TRACE_ID` env var → `.vscode/` directory → `.cursor/` directory.  
**Reason**: Added 2026-04-27. Prevents subagents from landing in `.agents/agents/` when the user is clearly running inside VS Code but hasn't explicitly set `platform: "vscode"` in `ai-tools.config.json`. When detected, `ConfigManager.detectedPlatform` is non-undefined and the `install` command prints a dim tip to pin the platform permanently.  
**Do not change**: The priority order — env vars take precedence over filesystem signals, and VS Code beats Cursor in the env-var tier. Tests in `config-manager.test.ts` must spy on `ConfigCascade.resolveConfigFiles` to isolate from the user's real `~/ai-tools.config.json`.  
**Key files**: `packages/cli/src/utils/config-manager.ts`, `packages/cli/src/commands/install.ts`
---

### Registry publish endpoint is unauthenticated by default
**Constraint**: When `publishToken` is not set in `ServerOptions`, the `POST /tools` endpoint accepts any publish request without authentication.  
**Reason**: Simplifies local dev and first-run experience. Production deployments should always set `AI_TOOLS_PUBLISH_TOKEN`.  
**Do not change**: The unauthenticated default — it is intentional for development. Always set the token in production. The server logs a warning at startup if `logger: true` and no token is set.  
**Key files**: `packages/server/src/app.ts`, `packages/server/src/routes/tools.ts`

---

### Cache uses universal `.agents/` layout internally
**Constraint**: `CacheManager` stores extracted tool files at `~/.ai-tools/cache/<name>/<version>/.agents/<dest>`. The `.agents/` directory always uses the universal path convention, regardless of the active platform.  
**Reason**: The cache is platform-agnostic. Platform adaptation happens at copy-time in `Installer.installFiles`, not at cache-time.  
**Do not change**: The cache directory structure. Changing it would invalidate all existing cached tools.  
**Key files**: `packages/cli/src/utils/cache-manager.ts`
