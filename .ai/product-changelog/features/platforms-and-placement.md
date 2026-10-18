# Feature Completions — platforms-and-placement

> Platform adapters, transforms, placementMode, install paths, user-scope roots. Part of [features/](./README.md).

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
