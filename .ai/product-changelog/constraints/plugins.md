# Constraints & Tradeoffs — plugins

> Plugin category, bundles, explode, anchor-skill portability grade. Part of [constraints/](./README.md).

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

### Plugin-bundle install is project-scope author layout only — 2026-07-16 `8c15b68` (updated `2026-07-28`)
**Constraint**: `--plugin-bundle` writes under cwd author roots only (project scope). It rejects user scope (`-g` / `--scope user`), `--cursor-plugin`, and packages with `category: reference` or `category: context-profile`. `category: plugin` **is allowed**: nested plugin members explode into the host author roots; the nested `.cursor-plugin/` tree is skipped (host descriptor wins). Nested plugins must grade **path-rewrite-free** (or missing-anchor-only); `unsupported` / `rewrite-required` fail before write. Path collisions with files not owned by the same package’s lock entry fail (no overwrite, no partial install); mid-install failures roll back. Install method is persisted on the lock (`plugin-bundle`). **Does** auto-mutate the host publish `files[]` on every `--plugin-bundle` install/uninstall (all categories).  
**Reason**: Author layout is always repo-relative; whole plugins are a common compose-with unit; publish-ready install/uninstall requires `files[]` sync; path-rewrite-free nests keep hub-skill relative links valid under host `skills/`.  
**Do not change**: Do not allow user-scope plugin-bundle installs or dual-write platform + author layout for one lock entry; do not overwrite the host `.cursor-plugin/plugin.json` when nesting a plugin; do not soft-merge or rename on collision.  
**Key files**: `packages/cli/src/commands/install.ts`, `packages/core/src/manifest/plugin-bundle-install.ts`, `packages/cli/src/utils/installer.ts`, `packages/e2e/src/cli.test.ts`

### User-scope tracking root — 2026-07-16 `ad7a20d`
**Constraint**: Project-scope installs track in `{cwd}/aitools.json` + `aitools-lock.json`. User-scope (`-g` / `--scope user`) tracks in `~/.aitools/aitools.json` + `~/.aitools/aitools-lock.json`. Payload files still go to platform vendor user dirs (e.g. `~/.cursor/skills/`). Settings remain in `~/aitools.config.json` / `~/.aitools.config.json`.  
**Reason**: User installs must not be coupled to whichever project directory happened to be cwd.  
**Do not change**: Do not write user-scope deps/lock back into the project; do not auto-migrate old project-lock `scope: user` entries.  
**Key files**: `packages/core/src/paths/tracking-root.ts`, `packages/cli/src/commands/install.ts`, `packages/e2e/src/config-layers.test.ts`

---

### Anchor-skill portability grade — advisory in validate/compat, gated at publish — 2026-07-21 `ffdfd65` (rename `92ec714`)
**Constraint**: `analyzePluginPortability` grades **shared-content path layout only** (`path-rewrite-free` | `rewrite-required` | `unsupported`). It does **not** claim installs skip all transforms — skill/rule/agent frontmatter and format still differ by vendor and are transformed when installing across platforms. The grade is **advisory** in `manifest validate` / `compat` (a `rewrite-required` grade or missing anchor prints warnings but does not fail those commands). It is **enforced at `aitools publish`**: orphan files (`unsupported`) always block (exit 1); `rewrite-required` / `missing-anchor` warnings prompt `Publish anyway? (y/N)` on an interactive TTY (decline = cancel, no upload), are blocked by `--strict`, are auto-continued by `-y`/`--yes`, and — when stdin is not a TTY (CI) — proceed with a printed notice rather than hanging. Orphans also remain fatal in `manifest validate` via `validatePluginStructure`. The anchor folder name is fixed to `sanitizePackageDirName(manifest.name)` — not user-configurable. A plugin may keep loose native members alongside the anchor (purity is not enforced).  
**Reason**: Publish is the natural quality gate, mirroring the existing skill-frontmatter `--strict` behaviour; but non-interactive publishes must not block on advisory warnings or hang waiting for input. Naming the best grade `path-rewrite-free` (not “transform-free”) keeps path-rewrite intent distinct from vendor frontmatter transforms.  
**Do not change**: Do not make `rewrite-required` / missing-anchor a *hard* failure outside `--strict`; do not prompt when `!process.stdin.isTTY` (it would hang CI); do not couple the anchor name to anything other than the sanitized package name. `compat --fix` / `manifest init` scaffolding of the anchor `SKILL.md` must never overwrite author prose outside the managed skill-map section. Do not describe `path-rewrite-free` as “no transforms” — frontmatter/format transforms remain in scope for cross-platform install.  
**Key files**: `packages/core/src/manifest/plugin-anchor.ts`, `packages/cli/src/commands/manifest.ts`, `packages/cli/src/commands/compat.ts`, `packages/cli/src/commands/publish.ts`, `packages/e2e/src/plugin-anchor.test.ts`
