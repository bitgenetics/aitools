# Coverage matrix template

Use this table in audit / close-gaps reports. One row per e2e-worthy behaviour (prefer atomic clauses from **What** / **Impact**, not whole features).

```markdown
## E2E coverage matrix — <date> (HEAD `<sha>`)

| Behaviour (changelog) | Source | Suite | `it` / evidence | Status | Priority |
|----------------------|--------|-------|-----------------|--------|----------|
| User install tracking under ~/.aitools | features.md → install/uninstall | config-layers.test.ts | writes lock under E2E_HOME/.aitools | covered | — |
| --cursor-plugin rejects --scope project | features.md → plugin category | plugin-install.test.ts | — | missing | P0 |

### Gaps to close
1. **P0** …
2. **P1** …

### Deferred / n/a
- …
```

## How to name behaviours

- Quote or paraphrase a single observable rule: flag, path, lock location, merge order, reject.
- Cite source as `features.md → <heading>` or `constraints.md → <heading>`.
- Evidence: `it` title, or a one-line assertion summary if titles are vague.

## Status quick guide

- **covered**: regression would fail CI e2e
- **partial**: suite exists; named clause untested
- **missing**: no e2e
- **unit-only**: OK if no CLI/docker surface; note unit file
- **n/a**: docs / non-runtime
