---
name: e2e-product-coverage
description: >-
  Reviews product behaviours in .ai/product-changelog/ and engineers e2e tests
  under packages/e2e/ so suites validate those behaviours. Use when auditing
  e2e coverage, closing gaps against features.md/constraints.md, mapping
  changelog entries to tests, writing or extending e2e after a changelog
  update, or when asked to "review e2e coverage", "align e2e with product",
  "changelog vs e2e", or "engineer e2e for behaviours".
argument-hint: "audit | close-gaps | map <feature> | suite <file>"
---

# E2E Product Coverage

Maps **product expectations** (changelog) → **e2e validation** (`packages/e2e/`). Changelog is the contract; e2e implements it.

**Depends on:** `project-changelog` (read/update `.ai/product-changelog/`). Pattern: *Changelog-first e2e contracts* in `patterns.md`.

```
.ai/product-changelog/features.md (+ constraints.md, Impact lines)
        ↓ contract
packages/e2e/src/*.test.ts  (via test-env.ts helpers)
```

## When to Use

- Audit whether e2e covers documented product behaviours
- Add or extend e2e after a changelog feature/constraint update
- Plan work: ensure “update changelog” precedes “add e2e”
- User asks to align e2e with product features/behaviours

## Modes

| Mode | Action |
|------|--------|
| `audit` (default) | Build coverage matrix; report gaps; **do not** write tests unless asked |
| `close-gaps` | Audit, then add/update e2e and sync **Key files** in changelog |
| `map <feature>` | Deep-dive one changelog heading → suite/`it` list + gaps |
| `suite <file>` | Reverse: which changelog entries does this e2e file claim to cover? |

If the user says “engineer”, “close gaps”, “add coverage”, or “make e2e match”, use `close-gaps`.

---

## Workflow

Copy and track:

```
Coverage progress:
- [ ] 1. Load contracts
- [ ] 2. Inventory e2e
- [ ] 3. Build matrix
- [ ] 4. Classify gaps
- [ ] 5. (close-gaps) Changelog-first gate
- [ ] 6. (close-gaps) Implement e2e
- [ ] 7. Verify + sync Key files
- [ ] 8. Report
```

### 1. Load contracts

Read in order:

1. `.ai/product-changelog/index.md` (section map)
2. `features.md` — extract each `###` entry: **What**, **Impact** (e2e-relevant), **Key files** listing `packages/e2e/...`
3. `constraints.md` — entries with user-visible or install/config behavioural limits
4. Skip pure docs (e.g. README-only) unless they claim runtime behaviour

Treat **Impact** / **What** bullets that mention locks, scopes, paths, flags, or reject cases as **e2e-worthy behaviours**.

### 2. Inventory e2e

List `packages/e2e/src/*.test.ts` (exclude helpers). For each file note:

- Top-of-file contract comment (what it claims to cover)
- `describe` / `it` names (behaviour sentences)
- Helpers used from `test-env.ts` (`E2E_HOME`, `run`, `publishFixture`, etc.)

Current suites (update if the tree changes):

| Suite | Typical contract area |
|-------|------------------------|
| `config-layers.test.ts` | Config write targets; install project vs user tracking |
| `plugin-install.test.ts` | Plugin explode vs `--cursor-plugin` |
| `cli.test.ts` | CLI flows; git registry round-trip |
| `api.test.ts` | Registry HTTP API |
| `platform-install.test.ts` | Platform install paths |

### 3. Build matrix

For each e2e-worthy behaviour, assign status:

| Status | Meaning |
|--------|---------|
| `covered` | Asserted by ≥1 `it` that would fail if the behaviour regressed |
| `partial` | Related test exists but misses a distinct Impact/What clause |
| `missing` | No e2e asserts this behaviour |
| `unit-only` | Validated in unit tests only; e2e optional unless Impact requires docker/CLI |
| `n/a` | Not an e2e concern (docs, internal ADR with no user-facing path) |

Output format: see [coverage-matrix.md](coverage-matrix.md).

### 4. Classify gaps

Prioritize:

1. **P0** — Scope/lock/path/safety: wrong tracking root, wrong install tree, rejected flags
2. **P1** — Primary happy path for a shipped feature with **Key files** pointing at e2e
3. **P2** — Secondary flags, edge rejects, polish
4. **Defer** — unit-covered internals; no CLI/user observable surface

### 5. Changelog-first gate (`close-gaps` only)

If a desired test encodes behaviour **not** in the changelog:

1. Stop and update `features.md` / `constraints.md` via `project-changelog` **first**
2. Name the target suite under **Key files**
3. Then write e2e against that text

Never invent product rules only inside test files.

### 6. Implement e2e (`close-gaps` only)

- Prefer extending an existing suite over new files
- New suite only when the contract area is distinct (new command family / subsystem)
- Follow `AGENTS.md` test quality: one behaviour per `it`, sentence names
- Use `test-env.ts`: assert against `E2E_HOME` / helpers, not the developer’s real `HOME`
- File header comment must state the changelog contract (feature headings) covered
- Assert observable outcomes: exit code, lock/deps paths, installed file locations, reject messages — not private helpers

### 7. Verify + sync Key files

```
npm test -w @bitgenetics/aitools-e2e   # local, registry up
# or CI parity:
npm run test:e2e
```

Update changelog **Key files** to include the e2e path(s). Do not change **What**/**Impact** unless product behaviour actually changed.

### 8. Report

Return a short summary:

1. Coverage matrix (or link to table in chat)
2. Gaps closed vs remaining (with P0–P2)
3. Files touched
4. Whether `test:e2e` / local e2e was run

---

## Anti-patterns

- Writing e2e before the changelog contract exists
- Treating e2e `it` names as the product spec
- Asserting developer machine paths (`process.env.HOME` when `E2E_HOME` is the fixture root)
- Duplicating unit-level branch coverage in e2e without a user-visible contract
- One mega-`it` that asserts many unrelated behaviours

## Additional resources

- Matrix template: [coverage-matrix.md](coverage-matrix.md)
- Product contracts: `.ai/product-changelog/`
- Changelog skill: `.agents/skills/project-changelog/SKILL.md`
- E2e helpers: `packages/e2e/src/test-env.ts`
