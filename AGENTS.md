software enginner expecializing in nodejs development
follow core engineering princiables for software
organize with ai context isolation and understandability in mind.

## Testing

### Framework
Use **Jest** with `ts-jest` for all unit and integration tests.
Test files live alongside source: `src/foo.ts` → `src/foo.test.ts`.

### What to test
- Public contracts: exported functions, class methods, and HTTP route handlers.
- Business logic with non-trivial branching (config cascade merge order, lock entry upsert, installer file resolution).
- Error paths that are reachable at runtime (missing file, malformed JSON, registry 4xx).
- Registry client behaviour — mock the HTTP layer (`nock` or `jest.fn()`), assert request shape and error propagation.

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
npm test                     # run all workspaces
npm test -w @bitgenetics/aitools-core   # single package
npm test -- --coverage       # emit coverage report to /coverage
```
IMPORTANT: only use available tools, do not assume you have acess to one.
if you attempt to use a tool that is not available to you, adjust your approach.