# AITools — Project Analysis

**Date:** 2026-04-25 (fresh review)  
**Scope:** Full codebase — purpose, architecture, implementation, verification, gaps

---

## TL;DR

`AITools` is a well-conceived package manager for AI tool artefacts. The architecture is clean, the core library is solid, and the Docker-based E2E suite is genuinely useful. Several earlier bugs (version sorting, MCP schema validation, registry write auth, and mcp.json error handling) have been fixed. The primary remaining weaknesses are: the "smart find" feature is still a placeholder, three manifest fields are dead code (templates, dependencies, binary tarballs), and CLI command unit test coverage is critically low at 47% statements / 34% branch — meaning most command logic is only verified through the Docker E2E suite.

---

## 1. Purpose

`AITools` is `npm` applied to the AI tooling ecosystem: it discovers, installs, updates, and publishes **skills**, **subagents**, **prompts**, and **MCP servers** across projects and IDE environments.

The model is coherent and well-scoped:

- A **CLI** installs/removes/updates tools at project or user scope
- A **registry server** (Fastify) stores and serves manifests and "tarballs"
- A **core library** owns the shared type system, Zod schemas, config cascade, lock file, and platform specs
- **Platform adapters** translate the universal tool model into platform-specific paths (VS Code, Claude Code, Cursor, Windsurf, universal `.agents/`)
- The **`compat` command** audits a tool's SKILL.md frontmatter against each platform's known field support — a genuinely novel feature

**Verdict: the purpose is clear, well-scoped, and meaningfully differentiated.** The project eats its own dog food: the `.agents/skills/` directory contains skills authored using the system it builds.

---

## 2. Architecture

### 2.1 Monorepo layout

```
packages/
  core/    @bitgenetics/aitools-core   — types, schemas, config, lock, platform specs
  cli/     @bitgenetics/aitools-cli    — aitools binary (Commander)
  server/  @bitgenetics/aitools-server — Fastify registry HTTP API
  e2e/     @bitgenetics/aitools-e2e   — Docker-based end-to-end tests
tools/
  create-ai-tool/            — published skill; dogfoods the system
.agents/skills/              — project-scoped skills for AI coding agents
docs/design/                 — architecture, data-model, flows, platform-adapter docs
```

### 2.2 Dependency graph

`core` has no runtime deps on `cli` or `server`. `cli` and `server` each depend only on `core`. This is correct and enables `core` to be published independently. No circular coupling exists.

### 2.3 TypeScript configuration

All strict options are on (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`). TypeScript project references are correctly wired: the root `tsconfig.json` declares all three packages as references, and both `cli` and `server` tsconfigs reference `core`. `core` has `"composite": true`. This enables `tsc --build` for incremental compilation.

### 2.4 Module system inconsistency (not yet resolved)

`@bitgenetics/aitools-cli` declares `"type": "module"` (ESM). `@bitgenetics/aitools-core` and `@bitgenetics/aitools-server` do not, making them implicitly CommonJS.

Consequences that persist:
- The CLI Jest config overrides `module` to `"CommonJS"` for ts-jest
- `chalk` and `ora` (pure ESM) require manual CJS stubs in `__mocks__/`
- The `moduleNameMapper` `.js → no-extension` rewrite in Jest configs is load-bearing for all three packages

This creates hidden complexity but does not cause runtime bugs. Aligning all packages on ESM would eliminate the stubs and the `module: CommonJS` override.

---

## 3. What It Does Well

### 3.1 Validation at every boundary

Zod schemas guard every external boundary:
- `ToolManifestSchema` — on `POST /tools` and on `publish`
- `AiToolsConfigSchema` — on every config file read
- `AiToolsLockSchema` — on every lock file read
- `AiToolsManifestSchema` — on every `aitools.json` read

Validation failures produce clear error messages. Bad data never propagates silently.

### 3.2 MCP schema correctly discriminated

`ToolManifestSchema` uses `.superRefine()` to enforce `mcpServer` presence for `mcp-tool` and `files.length > 0` for all other categories. MCP tools with empty file arrays now publish correctly.

### 3.3 Semver-correct version resolution

`ToolStore.listVersions()` sorts with `semver.rcompare`. Both `installAll` and `update` use `semver.maxSatisfying(versions, range)` to honour the semver range stored in `aitools.json`. The lock-file skip check uses `semver.satisfies`. The full semver contract is correct end-to-end.

### 3.4 Atomic lock file writes

`writeLockFile` writes to a `.tmp` file then atomically renames. A process crash during write cannot corrupt the lock file.

### 3.5 MCP install with error-safe mcp.json parsing

`installMcp` wraps `JSON.parse` of the existing `mcp.json` in a try/catch and throws a user-facing error with remediation instructions if the file is malformed.

### 3.6 Registry chaining with optional write auth

Multiple registries are queried by `priority`. The server's `POST /tools` endpoint accepts an optional `publishToken`; when configured, it validates `Authorization: Bearer <token>`. Development deployments can run without a token; production deployments should configure one.

### 3.7 Cache with SHA-256 integrity

Downloaded tarballs are stored at `~/.aitools/cache/<name>/<version>/` with a SHA-256 hash. Cache hits skip re-download and the hash is recorded in the lock file for future verification.

### 3.8 Platform specs and `compat` command

`PlatformSpec` records each platform's supported categories and SKILL.md frontmatter field behaviour (`supported` / `ignored` / `unknown`), plus `lastVerified`. The `compat` command warns when specs are stale (> 90 days). This has no npm equivalent and is a genuine differentiator.

### 3.9 E2E test suite

The Docker Compose E2E suite exercises the full install/update/uninstall/publish/search/registry/config lifecycle against a live registry. `--exit-code-from e2e` makes it a reliable CI gate. Fixture data is correctly scoped under `packages/e2e/fixtures/`.

### 3.10 JSONC support in config

`ConfigCascade.stripComments()` handles `//` and `/* */` comments including quote-aware skipping. Developers can annotate their config without a separate parser.

### 3.11 Documentation quality

`docs/design/` contains up-to-date architecture, data-model, flow, and platform-adapter docs as Mermaid markdown. `MAINTAINING.md` covers build, test, and release. `AGENTS.md` defines testing conventions for AI agents. This is unusually thorough for a project at this stage.

---

## 4. Gaps and Remaining Issues

### 4.1 Critical — unimplemented advertised features

#### Smart-find is a stub

`find` sends `__smart__:${description}` to the search endpoint. The server detects the prefix and runs the same text search as a normal query. No AI inference, no semantic matching, no ranking. This is the most prominently advertised feature in the README and it is not implemented beyond the prefix convention.

**Impact:** Users who choose this tool for AI-powered discovery will find `find` is an alias for `search`.

#### Template file processing is dead code

`ToolFileSchema` has `template?: boolean` documented as "processed as a Handlebars template before writing." The installer never checks `file.template`. The field is defined, validated, stored, and silently ignored.

#### Dependency resolution is dead code

`ToolManifest.dependencies: Record<string, string>` exists in the type and schema but is never read by the installer. A tool declaring dependencies installs without them.

### 4.2 Structural — tarball format limits utility

The "tarball" is `JSON.stringify([{ path, content }])` where `content` is a UTF-8 string. Binary assets (images, WASM modules) cannot be included. The name "tarball" is misleading and the format will fail silently or corrupt any binary content.

### 4.3 Structural — no lock file migration path

`lockfileVersion: 1` is a literal in the schema. There is no version detection or migration if the schema evolves. Tooling to detect and upgrade mismatched lock files does not exist.

### 4.4 Low-risk latent bugs

#### `writeConfigFile` shallow merge replaces arrays

`{ ...existing, ...patch }` replaces arrays rather than merging them. Two separate calls each targeting `registries` will leave only the second set. Currently harmless since commands write scalar keys, but latent.

#### `cleanEmptyDirs` stop boundary for user-scope

The stop boundary is `cwd` (the project directory). For user-scope tools under `~/.aitools/tools/`, the loop terminates immediately and leaves stale empty directories accumulating in `~/.aitools/tools/`. Not harmful but a maintenance annoyance.

#### Write auth defaults to disabled

When `publishToken` is not configured, `POST /tools` is open to anyone who can reach the server. The JSDoc says "development only" but nothing enforces this at runtime. A startup warning when no token is set would prevent silent open-write production deployments.

### 4.5 Security — proxy/search upstream URL not validated

`registry.ts` encodes the user-supplied query value correctly, but the upstream base URL `u.url` comes from server configuration and is passed directly to a raw `http.get`/`https.get` call without validation at startup. A misconfigured or injected URL could be used for server-side request forgery. Validating upstream URLs at server startup (parse them, reject non-HTTP/HTTPS) eliminates this risk.

---

## 5. Test Coverage

| Package | Statements | Branch | Functions |
|---|---|---|---|
| `@bitgenetics/aitools-core` | 81.5% | 66.7% | 75% |
| `@bitgenetics/aitools-cli` | 47.4% | 33.5% | 38.2% |
| `@bitgenetics/aitools-server` | 94.0% | 62.0% | 97.2% |

### 5.1 Core — gaps

`cascade.ts` is 63.6% statements / 46.7% branch. `ConfigCascade.load()` — the production entry point — is not directly tested. Only sub-functions `readFile` and `merge` are covered. The `resolveConfigFiles()` ancestor walk and home-directory deduplication logic are uncovered.

### 5.2 CLI — critical gaps

| File | Stmts | Branch | What's missing |
|---|---|---|---|
| `registry-client.ts` | 4.7% | 0% | All HTTP methods, retry, auth headers, error propagation |
| `commands/install.ts` | 15.9% | 9.4% | `installSingle` and `installAll` action functions |
| `commands/compat.ts` | 31.3% | 29.6% | Command action and output formatting |
| `commands/update.ts` | 0% | 0% | No test file |
| `commands/uninstall.ts` | 0% | 0% | No test file |
| `commands/search.ts` | 0% | 0% | No test file |
| `commands/list.ts` | 0% | 0% | No test file |
| `commands/registry.ts` | 0% | 0% | No test file |
| `commands/config.ts` | 0% | 0% | No test file |
| `commands/publish.ts` | 0% | 0% | No test file |
| `commands/manifest.ts` | 0% | 0% | No test file |
| `adapters/claude.ts` | 50% | 0% | `resolveDir`, `resolveMcpConfig` untested |
| `adapters/cursor.ts` | 50% | 0% | Same |
| `adapters/windsurf.ts` | 50% | 0% | Same |
| `adapters/universal.ts` | 50% | 0% | Same |

`registry-client.ts` is the most serious gap. It manages all HTTP interactions with registries and has 4.7% coverage. Errors in auth header construction, response parsing, and error propagation are invisible.

### 5.3 E2E as a coverage crutch

The E2E suite covers CLI command actions end-to-end but only the happy paths and basic error cases. Any Docker failure blocks all command-level verification. Adding unit tests for command logic — using `jest.fn()` to mock the registry client — would decouple command verification from Docker availability and run in under two seconds.

---

## 6. Feature Completeness vs. Documentation

| Feature | Documented | Implemented | Unit tested |
|---|---|---|---|
| Install / uninstall / update | ✅ | ✅ | Helpers only |
| Semver range resolution | ✅ | ✅ | Implicit |
| Config cascade | ✅ | ✅ | Partial |
| Lock file | ✅ | ✅ | Full |
| Registry chaining | ✅ | ✅ | E2E |
| Platform adapters | ✅ | ✅ | VSCode only |
| MCP tool install | ✅ | ✅ | Unit |
| Cache with integrity | ✅ | ✅ | Unit |
| `compat` command | ✅ | ✅ | Pure functions only |
| Registry write auth | ✅ | ✅ (opt-in) | Unit |
| Smart-find / AI search | ✅ | ❌ stub | — |
| Template processing | ✅ | ❌ dead code | — |
| Dependency resolution | ✅ | ❌ dead code | — |
| Binary tarball support | implied | ❌ text-only | — |
| Lock file migration | implied | ❌ | — |

---

## 7. Summary Scorecard

| Dimension | Rating | Key reason |
|---|---|---|
| Purpose clarity | ✅ Strong | Clear problem, good scope, well documented |
| Architecture | ✅ Strong | Clean layers, no circular deps, TS references wired |
| Core library | ✅ Strong | Atomic writes, full validation, 81% coverage |
| Server implementation | ✅ Strong | Routes solid, auth conditional, 94% coverage |
| CLI implementation | ⚠ Partial | Logic sound; command actions rely on E2E only |
| Semver correctness | ✅ Fixed | `rcompare`, `maxSatisfying` used correctly |
| Schema correctness | ✅ Fixed | MCP `superRefine` discriminates correctly |
| Unit test coverage — CLI | ❌ Gap | 47% stmts, 34% branch; most commands at 0% |
| Unit test coverage — HTTP client | ❌ Critical | 4.7% |
| E2E coverage | ✅ Strong | Docker-based, full lifecycle |
| Feature completeness | ⚠ Partial | Smart-find, templates, dependencies unimplemented |
| Security | ⚠ Conditional | Auth opt-in; SSRF risk in proxy route |
| Documentation | ✅ Strong | Design docs, MAINTAINING.md, AGENTS.md current |

---

## 8. Prioritised Recommendations

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | Unit-test `registry-client.ts` (mock `http`/`https`) | Medium | Eliminates largest invisible risk |
| 2 | Unit-test CLI command action functions | Medium | Decouples command verification from Docker |
| 3 | Warn at server startup when no `publishToken` is set | Trivial | Prevents silent open-write production deployments |
| 4 | Validate upstream URLs at server startup | Low | Eliminates SSRF risk |
| 5 | Mark `template` and `dependencies` as `@experimental` or remove | Trivial | Eliminates false promises in the schema |
| 6 | Add `ConfigCascade.load()` integration test | Low | Covers the production config entry point |
| 7 | Implement or document-away smart-find | High | Resolves the biggest documentation gap |
| 8 | Align monorepo on ESM | High | Removes CJS/ESM workarounds and stubs |
