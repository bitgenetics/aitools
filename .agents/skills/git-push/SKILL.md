---
name: git-push
description: >-
  Bump workspace versions, commit all changes, and push to main on the aitools
  repo. Use when the user asks to push to main, publish changes, ship a bump,
  or run the standard release commit workflow before push.
metadata:
  project: aitools
---

Standard workflow for publishing local work to `main` on `bitgenetics/aitools`.

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

Replace `version:patch` in the workflow below with `version:minor` or
`version:major` when the table above calls for it.

## Workflow

Run these steps **in order**. Do not skip the version bump unless the user
explicitly says not to bump.

```bash
npm run version:patch   # or version:minor / version:major — see above
git add .
git commit -m "chore: bump"
git push origin main
```

## What the version scripts do

Root scripts run `npm version <level> --workspaces --no-git-tag-version`:

```bash
npm run version:patch   # npm version patch --workspaces --no-git-tag-version
npm run version:minor   # npm version minor --workspaces --no-git-tag-version
npm run version:major   # npm version major --workspaces --no-git-tag-version
```

That bumps `@bitgenetics/aitools-cli`, `@bitgenetics/aitools-core`,
`@bitgenetics/aitools-server`, and `@bitgenetics/aitools-e2e` together.
It does **not** create a git tag. npm publish (on `v*` tags) is separate from
this `chore: bump` push.

## Git safety

- Only run when the user explicitly asks to commit and/or push.
- Never change git config.
- Never force-push to `main`.
- Do not commit `.env`, credentials, or other secret files.
- Temp/debug artifacts (`.ci-log.zip`, `.docker-e2e.log`) belong in
  `.gitignore`, not in the commit.

## After push

- CI runs E2E on push to `main` (`.github/workflows/e2e.yml`).
- npm packages publish on version tags, not on every `chore: bump` push.
