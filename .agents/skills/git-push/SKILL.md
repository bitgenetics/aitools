---
name: git-push
description: >-
  Bump workspace versions, commit, tag, and push on the aitools repo. Use when
  the user asks to push to main, publish to npm, ship a release, run version:patch,
  or run the standard release workflow.
metadata:
  project: aitools
---

Standard workflow for publishing local work on `bitgenetics/aitools`.

## Choosing the bump level

All three scripts bump **every workspace package** together (`aitools-cli`,
`aitools-core`, `aitools-server`, `aitools-e2e`) and update `package-lock.json`.
Pick the level from **what changed**, using [semver](https://semver.org/) intent:

| Command | Version change | Use when |
|---------|----------------|----------|
| `npm run version:patch` | `2.0.2` → `2.0.3` | Bug fixes, CI/test fixes, refactors with no user-visible behavior change, docs-only changes, dependency updates that do not alter the public CLI/API contract |
| `npm run version:minor` | `2.0.2` → `2.1.0` | New CLI commands or flags, new registry/platform behavior, new optional config fields — **backward compatible** additions users can adopt without breaking existing projects |
| `npm run version:major` | `2.0.2` → `3.0.0` | **Breaking** changes: removed or renamed CLI commands/flags, changed default install paths, incompatible config or lockfile format, removed registry APIs, renamed npm packages |

**Decision rules**

1. If the user says “patch”, “minor”, or “major” (or “breaking release”), use that
   command — do not second-guess.
2. If the user only says “push” / “bump” / “ship it” and does not specify:
   - default to **`version:patch`** for fixes, chores, and internal work;
   - use **`version:minor`** when the diff adds user-facing capability without
     breaking existing usage;
   - use **`version:major`** only when existing `aitools` workflows or config
     would fail or need migration without user action.
3. If multiple levels could apply, prefer the **lowest** compatible bump unless
   the user explicitly wants a major release.
4. When unsure and the change might affect CLI consumers or npm publish, **ask**
   which bump level to use before running the script.

## Workflow

Run **one** command (do not run separate git steps unless the script failed
partway through):

```bash
npm run version:patch   # or version:minor / version:major
```

`scripts/version-release.cjs` performs, in order:

1. `npm version <level> --workspaces --no-git-tag-version`
2. `git add .`
3. `git commit -m "chore: bump"`
4. `git tag v<version>` — version from `packages/core/package.json`
5. `git push origin <current-branch> --tags`

Commit any non-version work **before** running the script, or leave it unstaged —
`git add .` stages everything, so the bump commit may include other pending changes.

## What gets triggered

| Push | CI |
|------|-----|
| Branch push | E2E (`.github/workflows/e2e.yml`) |
| `v*` tag | npm publish + Docker/GHCR (tag workflows) |

Published to npm: `@bitgenetics/aitools-core`, `@bitgenetics/aitools-cli` only.

## Git safety

- Only run when the user explicitly asks to release, commit, and/or push.
- Never change git config.
- Never force-push.
- Do not commit `.env`, credentials, or other secret files.
- Script refuses to create a tag that already exists locally.
- Requires a named branch (not detached HEAD).

## Manual fallback

If the script fails after the version bump but before push:

```bash
git add .
git commit -m "chore: bump"
git tag vX.Y.Z    # match packages/core/package.json
git push origin <branch> --tags
```
