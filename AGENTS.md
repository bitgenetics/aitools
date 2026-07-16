software enginner expecializing in nodejs development
follow core engineering princiables for software
organize with ai context isolation and understandability in mind.

## Testing

### Product expectations vs e2e
- **Source of truth for product behaviour** is `.ai/product-changelog/` (especially `features.md` / `constraints.md`), maintained via the `project-changelog` skill.
- E2e suites under `packages/e2e/` **implement** those expectations; they are not a substitute for the changelog.
- When writing or generating an **implementation plan** that changes product behaviour: include an early todo **Update product changelog** (skill: `project-changelog`) **before** any “add/extend e2e” todo. Record the intended behaviour and name the e2e suite under **Key files**, then write e2e against that entry.
- See `.ai/product-changelog/patterns.md` → *Changelog-first e2e contracts*.

### Framework
Use **Jest** with `ts-jest` for all unit and integration tests.
Test files live alongside source: `src/foo.ts` → `src/foo.test.ts`.

### What to test
- Public contracts: exported functions, class methods, and HTTP route handlers.
- Business logic with non-trivial branching (config cascade merge order, lock entry upsert, installer file resolution).
- Error paths that are reachable at runtime (missing file, malformed JSON, registry 4xx).
- Registry client behaviour — mock the HTTP layer (`nock` or `jest.fn()`), assert request shape and error propagation.
- **Config layer model** (required for any change to settings vs install scope):
  - Settings (`config`, `registry`) default writes to user config; `--project` writes project config; reads merge with project overriding user.
  - Installs default to project scope; `-g` / `--global` uses user scope (tracking under `~/.aitools/`).
  - Unit: `config-write-target.test.ts`, `config.test.ts`, `registry.test.ts`, `config-manager.test.ts`, `install.test.ts`.
  - E2E: `packages/e2e/src/config-layers.test.ts` (must pass in CI via `npm run test:e2e`).

### What NOT to test
- Implementation details: private helpers, internal variable state, exact call counts on internal methods.
- Trivial pass-throughs: functions that only forward arguments without logic.
- Framework wiring: do not test that Fastify routes are registered — test the handler logic directly.
- Type correctness: TypeScript covers this at compile time.
- Third-party libraries: do not test `zod`, `semver`, `commander` internals.

### Test quality rules
- Each test asserts one behaviour. One `expect` per `it` is a good default; add more only when they describe the same behaviour.
- Test names are sentences: `"returns null when config file is missing"`, not `"test1"`.
- Avoid `any` casts and `// @ts-ignore` inside tests — if the types are wrong, fix the source.
- Do not use `setTimeout` or real filesystem paths in unit tests; use `jest.useFakeTimers()` and `os.tmpdir()` / `memfs` respectively.
- Prefer `describe` blocks that mirror the module structure so failures are self-locating.

### Coverage targets
- **Statements / branches / functions**: aim for ≥ 80% on `@bitgenetics/aitools-core` and `@bitgenetics/aitools-cli`.
- The `@bitgenetics/aitools-server` route handlers are integration-tested via `buildApp()` using Fastify's `inject()` method — no real HTTP port needed.
- Coverage is a floor, not a goal. A file at 60% with meaningful tests is better than 100% achieved by testing getters.

### Running tests
```
npm test                     # run all unit-test projects (core, cli, server)
npm run typecheck            # full-project tsc via workspace references (catches CI build errors)
npm run verify               # typecheck + unit tests — same gate as version:* (before bump)
npm run test:core            # single project via jest multi-project runner
npm run test:cli             # includes config layer unit tests
npm run test:server
npm test -w @bitgenetics/aitools-core   # same, from package workspace
npm test -w @bitgenetics/aitools-e2e     # local e2e (registry must be running)
npm run test:e2e             # full docker e2e (CI parity)
npm run test:coverage         # unit tests + coverage in packages/*/coverage/
```

`npm test` alone does not typecheck the full project. CI runs `tsc` before tests.
`npm run version:*` runs `verify` before `npm version` bumps workspace package.json files.
IMPORTANT: only use available tools, do not assume you have acess to one.
if you attempt to use a tool that is not available to you, adjust your approach.