---
name: git-push
description: >-
  Ship work on the aitools repo: PR flow, CHANGELOG.md [Unreleased] bullets, and
  the automatic release pipeline. Use when the user asks to push, open a PR,
  publish to npm, ship a release, or run version:patch.
metadata:
  project: aitools
---

How work lands and gets released on `bitgenetics/aitools`.

## The one rule

**Releases are automatic and driven by `CHANGELOG.md`.** You never choose a bump
level; you describe the change under `## [Unreleased]` and the pipeline derives it:

| `[Unreleased]` contains | Release |
|---|---|
| a bullet starting `**Breaking:**` (any subsection) | major |
| a bullet under `### Added` | minor |
| any other bullet | patch |
| no bullets | none (docs-only merges release nothing) |

Write bullets in user language (command, flag, file names — not internals) under
one of `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. Prefix
`**Breaking:**` when existing usage would fail without user action.

## Normal workflow (PR)

`main` is protected: changes arrive by PR, and the PR needs `Test`, `E2E Tests`
and `Changelog` green.

1. Branch, commit, push the branch, open the PR (`gh pr create`).
2. If the PR touches `packages/{core,cursor,cli}/src` (tests excluded), it must
   also add to `[Unreleased]`, or the `Changelog` check fails. Apply the
   `no-changelog` label only for changes with no user-visible effect.
3. The `Changelog` job summary shows the version that merging would produce —
   read it; a forgotten `**Breaking:**` shows up there as a minor.
4. The user merges. CI then: merge run → `Cut release` (bump, promote,
   signed `chore(release): vX.Y.Z` commit + tag via the release App) → release
   commit's run → `Ship release` (GHCR image, npm core → cursor → cli, GitHub
   Release). Two CI runs per release.

Before pushing, run `npm run verify` (typecheck + unit tests + release-script
tests) locally.

## Manual release (admin only)

Only when the user explicitly asks to release from the machine:

```bash
npm run version:patch   # or version:minor / version:major
```

`scripts/release.cjs` needs a clean tree at the tip of `main`, runs `verify`,
then bumps and promotes exactly as CI would and pushes branch + tag atomically.
The level may raise but never lower what `[Unreleased]` implies. CI still ships it.

## Git safety

- Only commit, push, open PRs or release when the user explicitly asks.
- Never change git config. Never force-push. Never push a bare `v*` tag.
- Do not commit `.env`, credentials, or other secret files.

## Recovery

See `MAINTAINING.md` → *Release workflow* → *Recovery* (re-run the failed `ship`
jobs; create a missing tag with `gh api`).
