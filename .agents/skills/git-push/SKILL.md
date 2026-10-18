---
name: git-push
description: >-
  Ship work on the aitools repo: Conventional Commit messages, CHANGELOG.md
  [Unreleased] notes, PR flow and the automatic release pipeline. Use when the
  user asks to commit, push, open a PR, publish to npm, ship a release, or run
  version:patch.
metadata:
  project: aitools
---

How work lands and gets released on `bitgenetics/aitools`.

## The one rule

**Commit subjects decide the version; `CHANGELOG.md` describes it.** Every commit
follows Conventional Commits: `<type>(<scope>)!: <description>`. The pipeline takes
the strongest level among the commits since the last tag (merge commits ignored):

| Commit | Release |
|---|---|
| `!` after the type/scope, or a `BREAKING CHANGE: …` footer | major |
| `feat` | minor |
| `fix`, `perf`, `revert` | patch |
| `build`, `chore`, `ci`, `docs`, `refactor`, `style`, `test` | none |

Label commits by what they do to users of the published packages, not by effort:
a new flag is `feat`, a behaviour change users must adapt to is `feat!` or `fix!`
with a `BREAKING CHANGE:` footer, a bug fix is `fix`, everything else is a
non-releasing type. Unknown types fail the PR gate.

Whenever a commit is `feat`, `fix` or breaking, also add **one bullet** under
`## [Unreleased]` in `CHANGELOG.md` (`Added`, `Changed`, `Deprecated`, `Removed`,
`Fixed` or `Security`) in user language — command, flag and file names, not
internals. Prefix `**Breaking:**` for breaking changes. A release without notes
ships with a placeholder line, and the gate warns about it.

## Normal workflow (PR)

`main` is protected: changes arrive by PR, and the PR needs `Test`, `E2E Tests`
and `Release gate` green.

1. Branch, commit (conventional subjects), push the branch, open the PR with a
   conventional title (`gh pr create`); the title becomes the commit on a squash
   merge, so it must carry the `!` if the PR is breaking.
2. The `Release gate` job summary shows the version that merging would produce —
   read it; a forgotten `!` shows up there as a minor.
3. Once `Test`, `E2E Tests` and `Release gate` pass, `PR review` (`pr-review.yml`)
   has a read-only Cursor agent review the PR against
   `.github/pr-review/INSTRUCTIONS.md`. Approve → merge commit + branch deleted.
   Changes requested → read the review's findings, fix, push; the next green CI
   run reviews again. The user can still merge by hand (never squash: the `!`
   on a breaking commit must survive).
4. After the merge, CI on `main`: `Cut release` (bump, promote, signed
   `chore(release): vX.Y.Z` commit + tag via the release App) → release
   commit's run → `Ship release` (GHCR image, npm core → cursor → cli, GitHub
   Release). Two CI runs per release.

Before pushing, run `npm run verify` (typecheck + unit tests + release-script
tests) locally. `node scripts/release/plan.cjs` prints what the branch would release.

## Manual release (admin only)

Only when the user explicitly asks to release from the machine:

```bash
npm run version:patch   # or version:minor / version:major
```

`scripts/release.cjs` needs a clean tree at the tip of `main`, runs `verify`,
then bumps and promotes exactly as CI would and pushes branch + tag atomically.
The level may raise but never lower what the commits imply. CI still ships it.

## Git safety

- Only commit, push, open PRs or release when the user explicitly asks.
- Never change git config. Never force-push. Never push a bare `v*` tag.
- Do not commit `.env`, credentials, or other secret files.

## Recovery

See `MAINTAINING.md` → *Release workflow* → *Recovery* (re-run the failed `ship`
jobs; create a missing tag with `gh api`).
