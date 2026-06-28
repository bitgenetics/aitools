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

## Workflow

Run these steps **in order**. Do not skip the version bump unless the user
explicitly says not to bump.

```bash
npm run version:patch
git add .
git commit -m "chore: bump"
git push origin main
```

Use `version:minor` or `version:major` instead of `version:patch` only when
the user asks for a minor or major bump.

## What `version:patch` does

Root script `npm run version:patch` runs:

```bash
npm version patch --workspaces --no-git-tag-version
```

That bumps `@bitgenetics/aitools-cli`, `@bitgenetics/aitools-core`,
`@bitgenetics/aitools-server`, and `@bitgenetics/aitools-e2e` together and
updates `package-lock.json`. It does **not** create a git tag.

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
