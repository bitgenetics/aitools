# Feature Completions — platforms-and-placement

> Platform adapters, transforms, placementMode, install paths, user-scope roots. Part of [features/](./README.md).

### Windsurf hooks verified; adapters and frontmatter reads have one source each — 2026-10-19
**What**:
1. **Windsurf hooks match the vendor docs.** The file is `.devin/hooks.json` (user scope `~/.codeium/windsurf/hooks.json`) with a top-level `hooks` key; events are per tool kind (`pre_run_command`, `post_write_code`, `pre_user_prompt`, …); handlers are `{ command, powershell?, show_output?, working_directory? }`. Conversion to Windsurf keeps `command` only and drops matchers with a warning; conversion from Windsurf drops powershell-only handlers. The old flat `pre_tool_use` output and the "unverified" warning are gone.
2. **Cursor's tool-specific events are portable to Windsurf.** `beforeShellExecution`/`afterShellExecution`, `beforeMCPExecution`/`afterMCPExecution`, `beforeReadFile`, `afterFileEdit`, `beforeSubmitPrompt` and `afterAgentResponse` now have neutral names in the shared event table. Claude and VS Code have none of them, so those pairs still drop them; the generic `PreToolUse`/`PostToolUse` family has no Windsurf equivalent.
3. **The hook confidence estimate** used by `compat` fixtures one command handler on every shared event the source vendor has, so a pair that drops most events reads `low`.
4. **Adapters resolve every path from the core `PlatformSpec`** (`SpecAdapter`); the per-adapter directory tables are deleted. The universal spec's user paths were corrected to `~/.aitools/tools/*` and its MCP config added, matching what install already did.
5. **`compat` and `publish` read SKILL.md frontmatter with the core YAML parser**; a folded multi-line `description` now counts as a field. The scalar-only parser is deleted.  
**Why**: The 2026-10-19 review left Windsurf's hook format marked unverified; checking the docs showed the shape and event names were wrong. Adapter tables duplicated the spec (one entry had drifted), and the compat parser silently skipped multi-line values.  
**Impact**: Hook packages targeting Windsurf now land where Windsurf reads them. Cursor-native hook packages convert their shell, MCP and file hooks for Windsurf instead of dropping them.  
**Key files**: `packages/core/src/formats/hooks.ts`, `packages/core/src/platforms/windsurf.ts`, `packages/core/src/platforms/universal.ts`, `packages/cli/src/adapters/spec-adapter.ts`, `packages/cli/src/transformers/estimate.ts`, `packages/cli/src/commands/compat.ts`

---

### Vendor file formats are one core model; transforms convert through it — 2026-10-19
**What**: Rule, command, agent and hook conversion between `cursor`, `vscode`, `claude` and `windsurf` now goes through `packages/core/src/formats/`: each category has a vendor-neutral model, a per-vendor field table and a YAML frontmatter parser/serializer (the `yaml` package). The CLI transformers are thin wrappers that map the core result onto `confidence`.
1. **Hook packages install a hook on every hook-capable platform.** A `nativeFor: claude` hook package installed on `cursor` or `vscode` is converted (Claude matcher groups flatten, event names rename) and merged into the platform's own hooks file (`.cursor/hooks.json` with `{ version: 1, hooks }`, `.github/hooks/hooks.json` with `{ hooks }`). The "Cursor/Copilot read `.claude/settings.json` natively" shortcut and its `recommendNativePath` advisory are gone.
2. **Packages without `nativeFor` must not carry vendor frontmatter.** `publish` warns and `publish --strict` exits 1 when a rule/command/agent file uses a vendor-only key (`alwaysApply`, `applyTo`, `excludeAgent`, `trigger`, `readonly`, `is_background`, …) without declaring the vendor.
3. **The target vendor's extension always applies** (`.mdc`, `.instructions.md`, `.prompt.md`, `.agent.md`), whatever the file's `placementMode`; compound suffixes are replaced as a whole.
4. **Scoping maps across vendors**: Cursor `alwaysApply` ↔ VS Code `applyTo: "**"` ↔ Claude "no `paths`" ↔ Windsurf `trigger: always_on`; globs ↔ `applyTo` ↔ `paths` ↔ `trigger: glob`. Claude agents keep `tools` for VS Code (with a review warning); `background` ↔ `is_background`. No `$1`/`$ARGUMENTS` rewriting.
5. **`instructions` category** (AGENTS.md-style files) installs at the project root on every platform, project scope only. Windsurf no longer lists `agent`; installing an unsupported category on a platform skips every file with an advisory instead of throwing.
6. **One confidence authority**: `estimateCategoryConfidence` runs the real transformer on per-vendor fixtures, so `compat`/MCP estimates cannot drift from install results.  
**Why**: Review 2026-10-18 found hand-written regexes that misread YAML lists, dropped vendor extensions in `strict` mode, skipped hook writes without placing anything, and an estimate table that disagreed with the transformer.  
**Impact**: Cursor hooks files written by aitools now use the versioned shape (flat legacy files are read and migrated on merge). Lossless conversions report `high` with no annotation; dropped fields report `medium` with an inline `# aitools:` note.  
**Key files**: `packages/core/src/formats/`, `packages/core/src/platforms/`, `packages/cli/src/transformers/`, `packages/cli/src/utils/installer.ts`, `packages/cli/src/commands/publish.ts`, `packages/e2e/src/plugin-install.test.ts` (*claude-native hooks on cursor*), `packages/e2e/src/cli.test.ts` (*publish --strict blocks vendor frontmatter without nativeFor*)

---

### File placementMode (strict / verbatim / transform) — 2026-07-17 `31b7508` (redefined `2026-07-21`)
**What**: Each `files[]` entry may set `placementMode`: `strict` (default when omitted), `verbatim`, or `transform`.
- **strict** (default): place relative to the platform's install **area** for the file's category + scope — `resolveInstallPath(category, scope)` + path-within-category. Portable across project/user **and** across platforms (routes per category via the adapter, so it works even where category dirs diverge, e.g. VS Code `.github/agents` vs `~/.copilot/prompts`). No content/extension rewriting.
- **verbatim**: honor `dest` 1:1, relative to the **scope root** (project cwd or user home). Escape hatch for an exact custom path (e.g. an asset placed as a sibling of the platform category dirs, `.cursor/assets/x`).
- **transform**: same category-area placement as strict, **plus** remap (plugin `assets/`/`scripts/` → synthetic skill package) and cross-platform content/`destExtension` rewriting.

`manifest init`/`files` still emit `placementMode: "strict"` on new entries (now the portable default). MCP/hooks merge behaviour is unchanged.  
**Why (redefinition 2026-07-21)**: The prior default (`strict` = 1:1 relative to cwd/home) meant `-g`/user installs of author-layout members wrote into whatever directory the command ran in, and `~/agents/…` was never a real platform location. Making the default place relative to the platform area fixes user-scope installs and removes the need for per-kind special-casing in the installer. The old cwd-literal behaviour moved to the opt-in `verbatim`.  
**Impact**: Manifests that explicitly set `strict` now route by category area instead of cwd-literal; authors who need an exact path must set `verbatim`. Assets with omitted `placementMode` now land under the synthetic skills package (category area), not their literal `dest`. See constraints → *Plugin native members explode by scope, not cwd*.  
**Why**: Authors need predictable dest→disk mapping; opt into transform only when remapping is desired.  
**Impact**: Packages that omit `placementMode` now use strict (breaking vs prior always-remap for plugin assets). E2e asserts strict asset dest (`.cursor/assets/…`) and transform remapping fixtures; manifest init emits `placementMode: "strict"`.  
**Key files**: `packages/core/src/placement/placement-mode.ts`, `packages/core/src/types/tool.ts`, `packages/core/src/schema/tool-schema.ts`, `packages/cli/src/utils/installer.ts`, `packages/cli/src/commands/manifest.ts`, `packages/cli/src/utils/installer.test.ts`, `packages/e2e/src/plugin-install.test.ts`, `packages/e2e/src/cli.test.ts`

---

### Shared references (core model) — 2026-07-15 `a556dd4` (adapter typing `43b5c50`)
**What**: Core types and helpers for package `references` — parse ranges, vendor-path layout, install-target resolution, and reference lock provenance. Design: registry DRY + per-consumer vendored copies at install (CLI installer integration still pending per design doc). Platform adapters treat `reference` like `plugin`/`mcp-tool`/`hook`: not a regular file-dir category (`AdapterFileCategory` / `toAdapterFileCategory`).  
**Why**: Reuse markdown/resources across skills without a global shared mutable store.  
**Impact**: Schema/types land in core; do not route `reference` through `resolveDir`; do not assume installer already vendors references until CLI wiring ships.  
**Key files**: `packages/core/src/references/`, `packages/core/src/types/reference.ts`, `packages/cli/src/adapters/types.ts`, `docs/design/shared-references.md`

---

### Cross-platform install transforms — 2026-06-27 `6eba41d`
**What**: When `nativeFor` on the manifest differs from the configured platform, `Installer` mechanically transforms rule/command/agent/hook files at install time. Hooks merge into platform `hooks.json` / Claude `settings.json`. Unsupported or empty transforms are skipped with stderr guidance; low confidence suggests running `/aitools-convert`.  
**Key APIs**: `transform(content, category, from, to, ctx)`, `mergeHookConfigs`, `estimateCategoryConfidence`  
**Key files**: `packages/cli/src/transformers/`, `packages/cli/src/utils/installer.ts`, `packages/cli/src/bundled/aitools-convert.ts`
