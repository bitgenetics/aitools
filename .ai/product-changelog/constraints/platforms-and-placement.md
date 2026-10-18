# Constraints & Tradeoffs — platforms-and-placement

> Platform adapters, transforms, placementMode, install paths, user-scope roots. Part of [constraints/](./README.md).

### VS Code subagent install path is `.github/agents/`, not `.agents/agents/`
**Constraint**: VS Code detects custom workspace agents from `.github/agents/`. The ai-tools `VsCodeAdapter` previously used `.agents/agents/` — this was a bug, not an intentional tradeoff.  
**Reason**: Fixed 2026-04-27. VS Code docs: <https://code.visualstudio.com/docs/copilot/customization/custom-agents>. Files should be `.agent.md` (VS Code preferred) or plain `.md` — both are detected.  
**Do not change**: Do not revert to `.agents/agents/`. Users who installed subagents before this fix have stale entries under `.agents/agents/`; they should uninstall and reinstall.  
**Key files**: `packages/cli/src/adapters/vscode.ts`, `packages/core/src/platforms/vscode.ts`

---

### Platform auto-detection — `detectPlatformFromEnv`
**Constraint**: When no `platform` is set in any config file, `ConfigManager` calls `detectPlatformFromEnv(cwd)` to infer the platform from environment signals before falling back to `universal`. Detection order: `VSCODE_PID` env var → `TERM_PROGRAM=vscode` → `CURSOR_TRACE_ID` env var → `.vscode/` directory → `.cursor/` directory.  
**Reason**: Added 2026-04-27. Prevents subagents from landing in `.agents/agents/` when the user is clearly running inside VS Code but hasn't explicitly set `platform: "vscode"` in `aitools.config.json`. When detected, `ConfigManager.detectedPlatform` is non-undefined and the `install` command prints a dim tip to pin the platform permanently.  
**Do not change**: The priority order — env vars take precedence over filesystem signals, and VS Code beats Cursor in the env-var tier. Tests in `config-manager.test.ts` must spy on `ConfigCascade.resolveConfigFiles` to isolate from the user's real `~/aitools.config.json`.  
**Key files**: `packages/cli/src/utils/config-manager.ts`, `packages/cli/src/commands/install.ts`

---

### Cache uses universal `.agents/` layout internally
**Constraint**: `CacheManager` stores extracted tool files at `~/.aitools/cache/<name>/<version>/.agents/<dest>`. The `.agents/` directory always uses the universal path convention, regardless of the active platform.  
**Reason**: The cache is platform-agnostic. Platform adaptation happens at copy-time in `Installer.installFiles`, not at cache-time.  
**Do not change**: The cache directory structure. Changing it would invalidate all existing cached tools.  
**Key files**: `packages/cli/src/utils/cache-manager.ts`

---

### Cross-platform transforms are mechanical, not semantic — 2026-06-27 `6eba41d` (updated hook/markdown annotate)
**Constraint**: Install-time transforms produce best-effort skeletons. `low`/`unsupported` confidence may skip writes or emit advisories; full conversion requires the bundled `aitools-convert` skill or manual edit. HTTP/MCP hook types may be dropped when the target platform has no equivalent.  
**Markdown vs JSON**: `# aitools:` inline annotations are for **markdown** rule/command/agent skeletons only (lossy `medium`/`low`). Hook/MCP JSON is never annotated — empty portable or invalid hook content skips merge; invalid incoming soft-fails with stderr.  
**Reason**: Reliable regex/JSON rewriting cannot capture all platform semantics; confidence scoring sets user expectations. Annotated JSON breaks `JSON.parse` during install.  
**Do not change**: Skipping empty post-transform hook content; writing broken hooks/rules is worse than skipping with a clear message. Do not annotate JSON configs.  
**Key files**: `packages/cli/src/transformers/`, `packages/cli/src/utils/installer.ts`, `packages/cli/src/bundled/aitools-convert.ts`, `packages/e2e/src/plugin-install.test.ts`

---

### Placement is platform-area-relative by default; `verbatim` is the cwd/home escape hatch — 2026-07-21
**Constraint**: The default `placementMode` (`strict`, when omitted) places every member relative to the platform's install **area** for its category + scope: `resolveInstallPath(category, scope)` + path-within-category → project `{cwd}/.<platform>/…`, user (`-g`/`--scope user`) `~/.<platform>/…`. This is the only mode that is portable across scope *and* across platforms (category dirs diverge, e.g. VS Code `.github/agents` vs `~/.copilot/prompts`, so a single `.<platform>/` prefix does not generalize — always route per category). `placementMode: verbatim` is the escape hatch that honors `dest` 1:1 relative to the scope root (cwd/home). `transform` = strict placement + remap/content rewriting.  
**Reason**: A prior default (`strict` = 1:1 relative to cwd) made `aitools install <plugin> -g` write the plugin's author layout into whatever directory the command ran in instead of the platform user dirs, and `~/agents/…` is not a real platform location. `manifest init` emits members with `strict`, so this was the common case.  
**Do not change**: Do not resolve default/`strict` (or `transform`) member destinations against `this.cwd`; route them through `ConfigManager.resolveInstallPath(category, scope)`. Only `verbatim` anchors at `Installer.scopeRoot(scope)` (cwd/home) — never unconditionally `this.cwd`. `stopDir` reuses `scopeRoot`.  
**Key files**: `packages/cli/src/utils/installer.ts`, `packages/core/src/placement/placement-mode.ts`, `packages/core/src/manifest/plugin-explode.ts`, `packages/cli/src/utils/installer.test.ts`, `packages/e2e/src/plugin-install.test.ts`

---

### Platform user MCP paths — 2026-07-16 `ad7a20d`
**Constraint**: Claude user MCP merges into `~/.claude.json` (not `~/.claude/mcp.json`). VS Code user MCP uses the profile path via `resolveVsCodeUserMcpConfig()` (e.g. `%APPDATA%/Code/User/mcp.json` on Windows). VS Code user prompts remain `~/.copilot/prompts` (Copilot-aligned convention; not VS Code profile prompts).  
**Reason**: Align explode/user-scope MCP with official vendor locations.  
**Do not change**: Do not reintroduce `~/.claude/mcp.json` or `~/.vscode/mcp.json` as the Claude/VS Code *user* MCP target.  
**Key files**: `packages/core/src/platforms/claude.ts`, `packages/cli/src/adapters/vscode.ts`, `packages/cli/src/commands/mcp.ts`, `packages/e2e/src/plugin-install.test.ts`, `packages/e2e/src/test-env.ts` (pins `APPDATA` under `E2E_HOME`)
