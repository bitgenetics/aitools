# Constraints & Tradeoffs

> Accepted limitations. Before "fixing" something here, check whether it was intentional.

---

### AI-mech context swap — coordinator not loader; quarantine primary — 2026-07-22 `304ed2d`
**Constraint**: AITools coordinates **on-disk** AI-mech trees only; Cursor/Claude/etc. remain the prompt loaders. Overlay stay-set must be **authored** in `aitools.json` (`context.stay`) before swap applies it — inferred stay proposals never auto-apply. Every swap writes a local quarantine under `.aitools/context-quarantine/` which is the **primary** restore source; registry baseline is fallback when quarantine is absent. Keep `lockfileVersion: 1` with optional `context` (do not bump). Quarantine is gitignored; refuse swap/restore on dirty tracked AI-mech paths unless `--force`. Older CLIs that strip unknown lock keys leave active swaps unmanaged — `status`/`restore` require a CLI that understands `lock.context`.  
**Reason**: Matches vendor filesystem-driven loaders; preserves exact pre-swap bytes for undo; avoids breaking older clients that require lockfileVersion 1.  
**Do not change**: Do not inject into vendor system prompts; do not auto-pin inferred stay; do not treat registry re-download as the default undo path when quarantine exists.  
**Key files**: `packages/core/src/context/`, `packages/cli/src/commands/context.ts`, `packages/e2e/src/context-swap.test.ts`

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
**Scope note (2026-07-21)**: The strip prefix is derived from the **project-relative** category dir (scope-independent), so a project-relative `dest` re-homes onto the user install base at user scope (`~/.cursor/skills/x`) instead of double-nesting under it (`~/.cursor/skills/.cursor/skills/x`).  
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
**Reason**: Added 2026-04-27. Prevents subagents from landing in `.agents/agents/` when the user is clearly running inside VS Code but hasn't explicitly set `platform: "vscode"` in `aitools.config.json`. When detected, `ConfigManager.detectedPlatform` is non-undefined and the `install` command prints a dim tip to pin the platform permanently.  
**Do not change**: The priority order — env vars take precedence over filesystem signals, and VS Code beats Cursor in the env-var tier. Tests in `config-manager.test.ts` must spy on `ConfigCascade.resolveConfigFiles` to isolate from the user's real `~/aitools.config.json`.  
**Key files**: `packages/cli/src/utils/config-manager.ts`, `packages/cli/src/commands/install.ts`
---

### Registry publish endpoint is unauthenticated by default
**Constraint**: When `publishToken` is not set in `ServerOptions`, the `POST /tools` endpoint accepts any publish request without authentication.  
**Reason**: Simplifies local dev and first-run experience. Production deployments should always set `AITOOLS_PUBLISH_TOKEN`.  
**Do not change**: The unauthenticated default — it is intentional for development. Always set the token in production. The server logs a warning at startup if `logger: true` and no token is set.  
**Key files**: `packages/server/src/app.ts`, `packages/server/src/routes/tools.ts`

---

### Cache uses universal `.agents/` layout internally
**Constraint**: `CacheManager` stores extracted tool files at `~/.aitools/cache/<name>/<version>/.agents/<dest>`. The `.agents/` directory always uses the universal path convention, regardless of the active platform.  
**Reason**: The cache is platform-agnostic. Platform adaptation happens at copy-time in `Installer.installFiles`, not at cache-time.  
**Do not change**: The cache directory structure. Changing it would invalidate all existing cached tools.  
**Key files**: `packages/cli/src/utils/cache-manager.ts`

---

### CLI shebang must be the first line — 2026-06-15 `907cce7`
**Constraint**: `packages/cli/src/cli.ts` must start with `#!/usr/bin/env node` on line 1. The AGPL copyright block follows on line 2+.  
**Reason**: TypeScript rejects a shebang after comments (`TS18026: '#!' can only be used at the start of a file`).  
**Do not change**: Do not move the shebang below the copyright header.  
**Key files**: `packages/cli/src/cli.ts`

---

### Git registry — no AI-assisted find, local search only — 2026-06-26 `d7f8fa0`
**Constraint**: Git registries implement substring search over cloned manifests locally. `aitools find` (natural-language / AI-assisted search) is an HTTP registry feature only.  
**Reason**: No server endpoint exists in git-backed mode; the registry is just files in a repo.  
**Do not change**: Do not add HTTP fallbacks silently — document the limitation and keep search behaviour explicit per registry type.  
**Key files**: `packages/cli/src/utils/git-registry-client.ts`, `readme.md` (#registry-types)

---

### E2E config isolation via `AITOOLS_CONFIG_ROOT` — 2026-06-26 `d7f8fa0`
**Constraint**: E2e tests set a temp `HOME`/`USERPROFILE` and `AITOOLS_CONFIG_ROOT` so config cascade does not walk into the developer's real `~/aitools.config.json` (especially on Windows).  
**Reason**: Leaked user `platform` or registry config caused flaky e2e failures.  
**Do not change**: Any new e2e suite helpers should use `packages/e2e/src/test-env.ts` rather than assuming a clean real home directory.  
**Key files**: `packages/e2e/src/test-env.ts`, `packages/core/src/config/cascade.ts`

---

### Gitea web install wizard unsuitable for automation — 2026-06-26 `d7f8fa0`
**Constraint**: Do not bootstrap Gitea in CI/e2e via POST to the install page — use `gitea migrate` + `gitea admin user create` with `INSTALL_LOCK=true` instead.  
**Reason**: Install POST triggers a fatal `MustInstalled()` race when `GITEA__security__INSTALL_LOCK=false` env vars are present; API never becomes available.  
**Do not change**: Keep `gitea-init` as a one-shot CLI bootstrap sharing the `gitea-data` volume with the `gitea` service.  
**Key files**: `packages/e2e/gitea/bootstrap.sh`, `docker-compose.e2e.yml`

---

### Cross-platform transforms are mechanical, not semantic — 2026-06-27 `6eba41d` (updated hook/markdown annotate)
**Constraint**: Install-time transforms produce best-effort skeletons. `low`/`unsupported` confidence may skip writes or emit advisories; full conversion requires the bundled `aitools-convert` skill or manual edit. HTTP/MCP hook types may be dropped when the target platform has no equivalent.  
**Markdown vs JSON**: `# aitools:` inline annotations are for **markdown** rule/command/agent skeletons only (lossy `medium`/`low`). Hook/MCP JSON is never annotated — empty portable or invalid hook content skips merge; invalid incoming soft-fails with stderr.  
**Reason**: Reliable regex/JSON rewriting cannot capture all platform semantics; confidence scoring sets user expectations. Annotated JSON breaks `JSON.parse` during install.  
**Do not change**: Skipping empty post-transform hook content; writing broken hooks/rules is worse than skipping with a clear message. Do not annotate JSON configs.  
**Key files**: `packages/cli/src/transformers/`, `packages/cli/src/utils/installer.ts`, `packages/cli/src/bundled/aitools-convert.ts`, `packages/e2e/src/plugin-install.test.ts`

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

---

### Legacy `aitools.manifest.json` publish source removed — 2026-07-14 `a708c41`
**Constraint**: `resolvePublishSource` only accepts unified `aitools.json`. Passing or discovering `aitools.manifest.json` throws and directs users to `aitools manifest migrate`.  
**Reason**: Dual publish-manifest formats increased bugs and test surface; unified doc is the single authoring path.  
**Do not change**: Do not reintroduce silent fallback to the legacy filename.  
**Key files**: `packages/core/src/manifest/manifest-file.ts`, `packages/cli/src/commands/publish.ts`, `packages/e2e/src/cli.test.ts`

---

### Plugin explode — no dirty-file detection — 2026-07-14 `8a80e17`
**Constraint**: Plugin uninstall deletes every locked file path and unmerges recorded MCP keys / hook handlers regardless of user edits after install.  
**Reason**: Tracking dirty state is out of scope; users who edit installed files accept loss on uninstall/reinstall.  
**Do not change**: Do not add content-hash dirty checks before remove.  
**Key files**: `packages/cli/src/utils/installer.ts`

---

### Plugin install does not use Cursor marketplace dirs by default — 2026-07-14 `8a80e17` (updated `ad7a20d`)
**Constraint**: Default explode install writes element paths (e.g. `.cursor/skills/`), never whole packages under `.cursor/plugins/local/`. Opaque `.agents/plugins/` trees are retired. `resolvePluginInstallDir` remains only for legacy helpers/tests.  
**Opt-in**: `aitools install <pkg> --cursor-plugin` copies an opaque tree to `~/.cursor/plugins/local/<name>/` and tracks it under `~/.aitools/` (user scope only).  
**Reason**: Two distribution channels must not be conflated by default; the flag is the explicit bridge to Cursor’s plugin loader.  
**Do not change**: Dual-writing explode + local without an explicit product decision.  
**Key files**: `packages/core/src/manifest/plugin-explode.ts`, `packages/cli/src/utils/installer.ts`, `packages/e2e/src/plugin-install.test.ts`, `docs/design/plugin-marketplaces-comparison.md`

---

### Plugin-bundle install is project-scope author layout only — 2026-07-16 `8c15b68`
**Constraint**: `--plugin-bundle` writes under cwd author roots only (project scope). It rejects user scope (`-g` / `--scope user`), `--cursor-plugin`, and packages with `category: plugin` or `category: reference`. Install method is persisted on the lock (`plugin-bundle`), not as rich dependency objects in `aitools.json` (v1). Does not auto-mutate the plugin package’s publish `files[]`.  
**Reason**: Author layout is always repo-relative; nesting whole plugins or reference vendoring are separate workflows; surprising publish-set edits are out of scope for the installer.  
**Do not change**: Do not allow user-scope plugin-bundle installs or dual-write platform + author layout for one lock entry.  
**Key files**: `packages/cli/src/commands/install.ts`, `packages/core/src/manifest/plugin-bundle-install.ts`, `packages/e2e/src/cli.test.ts`

### User-scope tracking root — 2026-07-16 `ad7a20d`
**Constraint**: Project-scope installs track in `{cwd}/aitools.json` + `aitools-lock.json`. User-scope (`-g` / `--scope user`) tracks in `~/.aitools/aitools.json` + `~/.aitools/aitools-lock.json`. Payload files still go to platform vendor user dirs (e.g. `~/.cursor/skills/`). Settings remain in `~/aitools.config.json` / `~/.aitools.config.json`.  
**Reason**: User installs must not be coupled to whichever project directory happened to be cwd.  
**Do not change**: Do not write user-scope deps/lock back into the project; do not auto-migrate old project-lock `scope: user` entries.  
**Key files**: `packages/core/src/paths/tracking-root.ts`, `packages/cli/src/commands/install.ts`, `packages/e2e/src/config-layers.test.ts`

---

### Placement is platform-area-relative by default; `verbatim` is the cwd/home escape hatch — 2026-07-21
**Constraint**: The default `placementMode` (`strict`, when omitted) places every member relative to the platform's install **area** for its category + scope: `resolveInstallPath(category, scope)` + path-within-category → project `{cwd}/.<platform>/…`, user (`-g`/`--scope user`) `~/.<platform>/…`. This is the only mode that is portable across scope *and* across platforms (category dirs diverge, e.g. VS Code `.github/agents` vs `~/.copilot/prompts`, so a single `.<platform>/` prefix does not generalize — always route per category). `placementMode: verbatim` is the escape hatch that honors `dest` 1:1 relative to the scope root (cwd/home). `transform` = strict placement + remap/content rewriting.  
**Reason**: A prior default (`strict` = 1:1 relative to cwd) made `aitools install <plugin> -g` write the plugin's author layout into whatever directory the command ran in instead of the platform user dirs, and `~/agents/…` is not a real platform location. `manifest init` emits members with `strict`, so this was the common case.  
**Do not change**: Do not resolve default/`strict` (or `transform`) member destinations against `this.cwd`; route them through `ConfigManager.resolveInstallPath(category, scope)`. Only `verbatim` anchors at `Installer.scopeRoot(scope)` (cwd/home) — never unconditionally `this.cwd`. `stopDir` reuses `scopeRoot`.  
**Key files**: `packages/cli/src/utils/installer.ts`, `packages/core/src/placement/placement-mode.ts`, `packages/core/src/manifest/plugin-explode.ts`, `packages/cli/src/utils/installer.test.ts`, `packages/e2e/src/plugin-install.test.ts`

---

### Anchor-skill portability grade — advisory in validate/compat, gated at publish — 2026-07-21 `ffdfd65` (rename `92ec714`)
**Constraint**: `analyzePluginPortability` grades **shared-content path layout only** (`path-rewrite-free` | `rewrite-required` | `unsupported`). It does **not** claim installs skip all transforms — skill/rule/agent frontmatter and format still differ by vendor and are transformed when installing across platforms. The grade is **advisory** in `manifest validate` / `compat` (a `rewrite-required` grade or missing anchor prints warnings but does not fail those commands). It is **enforced at `aitools publish`**: orphan files (`unsupported`) always block (exit 1); `rewrite-required` / `missing-anchor` warnings prompt `Publish anyway? (y/N)` on an interactive TTY (decline = cancel, no upload), are blocked by `--strict`, are auto-continued by `-y`/`--yes`, and — when stdin is not a TTY (CI) — proceed with a printed notice rather than hanging. Orphans also remain fatal in `manifest validate` via `validatePluginStructure`. The anchor folder name is fixed to `sanitizePackageDirName(manifest.name)` — not user-configurable. A plugin may keep loose native members alongside the anchor (purity is not enforced).  
**Reason**: Publish is the natural quality gate, mirroring the existing skill-frontmatter `--strict` behaviour; but non-interactive publishes must not block on advisory warnings or hang waiting for input. Naming the best grade `path-rewrite-free` (not “transform-free”) keeps path-rewrite intent distinct from vendor frontmatter transforms.  
**Do not change**: Do not make `rewrite-required` / missing-anchor a *hard* failure outside `--strict`; do not prompt when `!process.stdin.isTTY` (it would hang CI); do not couple the anchor name to anything other than the sanitized package name. `compat --fix` / `manifest init` scaffolding of the anchor `SKILL.md` must never overwrite author prose outside the managed skill-map section. Do not describe `path-rewrite-free` as “no transforms” — frontmatter/format transforms remain in scope for cross-platform install.  
**Key files**: `packages/core/src/manifest/plugin-anchor.ts`, `packages/cli/src/commands/manifest.ts`, `packages/cli/src/commands/compat.ts`, `packages/cli/src/commands/publish.ts`, `packages/e2e/src/plugin-anchor.test.ts`

---

### Platform user MCP paths — 2026-07-16 `ad7a20d`
**Constraint**: Claude user MCP merges into `~/.claude.json` (not `~/.claude/mcp.json`). VS Code user MCP uses the profile path via `resolveVsCodeUserMcpConfig()` (e.g. `%APPDATA%/Code/User/mcp.json` on Windows). VS Code user prompts remain `~/.copilot/prompts` (Copilot-aligned convention; not VS Code profile prompts).  
**Reason**: Align explode/user-scope MCP with official vendor locations.  
**Do not change**: Do not reintroduce `~/.claude/mcp.json` or `~/.vscode/mcp.json` as the Claude/VS Code *user* MCP target.  
**Key files**: `packages/core/src/platforms/claude.ts`, `packages/cli/src/adapters/vscode.ts`, `packages/cli/src/commands/mcp.ts`, `packages/e2e/src/plugin-install.test.ts`, `packages/e2e/src/test-env.ts` (pins `APPDATA` under `E2E_HOME`)
