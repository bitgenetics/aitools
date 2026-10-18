# Changelog

All notable user-facing changes to the published `@bitgenetics/aitools-core`,
`@bitgenetics/aitools-cursor` and `@bitgenetics/aitools-cli` packages are recorded
here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow [Semantic Versioning](https://semver.org/).

Releases are cut automatically on `main`. The version comes from the
[Conventional Commits](https://www.conventionalcommits.org/) since the previous
release (`feat` → minor, `fix` → patch, `!` or `BREAKING CHANGE:` → major); this file
holds the release notes, with breaking changes prefixed `**Breaking:**`. Releases
before 3.4.0 are recorded only as git tags.

## [Unreleased]

## [4.0.0] - 2026-10-18

### Added
- `aitools context` snapshots: `save`, `switch`, `stash`, `pop`, `clear`, `merge`, `drop`, `rename`, `pull` and `push` treat a project's AI-mechanism files (`AGENTS.md`, `.cursor/rules`, `.claude/**`, MCP and hook configs) as named git-style snapshots. Snapshots are stored at user scope by default; `--project` writes a committable `./.aitools/context/`.
- `context.ignore` glob list in `aitools.json` removes paths from the context catalog.

### Changed
- **Breaking:** the quarantine-based `aitools context` swap commands shipped in 3.4–3.6 are replaced by the snapshot commands above; `aitools install <context-profile>` is rejected with a pointer to `aitools context pull <package>`.

### Removed
- `lock.context` in `aitools-lock.json`; snapshot state is project-local under `.aitools/context/` and no longer recorded in the lock.

### Fixed
- Subcommand `--version` options (`install --version`, `context push --version`) are no longer swallowed by the root `aitools --version` flag.

## [3.6.5] - 2026-08-13

### Changed
- No user-facing changes (internal documentation).

## [3.6.4] - 2026-08-12

### Changed
- `aitools cursor load` / `aitools cursor worker` help: workspace-first usage line, aitools-only options labelled, examples for forwarding agent and worker arguments.

## [3.6.3] - 2026-08-12

### Fixed
- `.code-workspace` and other JSONC files parse with trailing commas and a BOM (cursor `load` / `worker` and the config cascade).

## [3.6.2] - 2026-08-09

### Changed
- Package READMEs carry the experimental-software notice and a License section (shown on npm).

## [3.6.1] - 2026-08-09

### Fixed
- Package READMEs and metadata render correctly on npmjs.com.

## [3.6.0] - 2026-08-09

### Added
- `aitools version [patch|minor|major|x.y.z]` shows or bumps the version in `aitools.json`.

## [3.5.0] - 2026-07-28

### Added
- `aitools install --plugin-bundle` nests a plugin's members into the host author layout (`skills/`, `rules/`, …) instead of exploding them.

## [3.4.2] - 2026-07-27

### Changed
- `create-ai-tool` documentation clarifies hub skill vs install homes for plugins.

## [3.4.1] - 2026-07-26

### Changed
- No user-facing changes (server test stability).

## [3.4.0] - 2026-07-26

### Added
- `aitools cursor worker` maps `.code-workspace` folders to `agent worker --worker-dir` for multi-root self-hosted workers.


[Unreleased]: https://github.com/bitgenetics/aitools/compare/v4.0.0...HEAD
[4.0.0]: https://github.com/bitgenetics/aitools/compare/v3.6.5...v4.0.0
[3.6.5]: https://github.com/bitgenetics/aitools/compare/v3.6.4...v3.6.5
[3.6.4]: https://github.com/bitgenetics/aitools/compare/v3.6.3...v3.6.4
[3.6.3]: https://github.com/bitgenetics/aitools/compare/v3.6.2...v3.6.3
[3.6.2]: https://github.com/bitgenetics/aitools/compare/v3.6.1...v3.6.2
[3.6.1]: https://github.com/bitgenetics/aitools/compare/v3.6.0...v3.6.1
[3.6.0]: https://github.com/bitgenetics/aitools/compare/v3.5.0...v3.6.0
[3.5.0]: https://github.com/bitgenetics/aitools/compare/v3.4.2...v3.5.0
[3.4.2]: https://github.com/bitgenetics/aitools/compare/v3.4.1...v3.4.2
[3.4.1]: https://github.com/bitgenetics/aitools/compare/v3.4.0...v3.4.1
[3.4.0]: https://github.com/bitgenetics/aitools/compare/v3.3.3...v3.4.0
