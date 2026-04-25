# ai-tools — Test Coverage Gap Report

**Date:** 2026-04-25  
**Scope:** Unit and integration test gaps across all packages

---

## Overview

| Package | Stmts | Branch | Funcs | Target (≥80%) |
|---|---|---|---|---|
| `@ai-tools/core` | 81.5% | 66.7% | 75% | ⚠ branch/funcs below |
| `@ai-tools/cli` | 47.4% | 33.5% | 38.2% | ❌ all below |
| `@ai-tools/server` | 94.0% | 62.0% | 97.2% | ⚠ branch below |

The E2E suite (`packages/e2e/`) covers the CLI command lifecycle against a live Docker registry. It is not counted in the figures above.

---

## 1. `@ai-tools/core`

### 1.1 `config/cascade.ts` — 63.6% statements / 46.7% branch

**Uncovered lines:** 22–50 (the `load()` method body), 94–95, 99–102

`load()` is the entry point called by every CLI command but has no direct test. Only sub-functions `readFile` and `merge` are covered.

**What to add:**

```typescript
// cascade.test.ts additions
describe('ConfigCascade.load()', () => {
  it('returns an empty config when no config files exist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cascade-'));
    const result = ConfigCascade.load(tmpDir);
    expect(result).toEqual({});
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('merges project config over home config', () => {
    // Write home config, write project config, assert project wins
  });

  it('resolveConfigFiles() includes the home directory path', () => {
    const files = ConfigCascade.resolveConfigFiles('/tmp/myproject');
    expect(files.some((f) => f.includes(os.homedir()))).toBe(true);
  });

  it('resolveConfigFiles() does not duplicate the home directory', () => {
    // If cwd IS the home directory, home should not appear twice
    const files = ConfigCascade.resolveConfigFiles(os.homedir());
    const homeConfig = path.join(os.homedir(), 'ai-tools.config.json');
    expect(files.filter((f) => f === homeConfig).length).toBe(1);
  });
});
```

**Branch gaps:** The `if (!paths.includes(homePath))` guard and the while-loop break condition are the main uncovered branches.

---

### 1.2 `types/lock.ts` — 75% statements

Line 31 (`toLockEntry`) is a trivial factory function; coverage is only 75% due to an unused branch in the calling context. Not a meaningful gap.

---

## 2. `@ai-tools/cli`

### 2.1 `utils/registry-client.ts` — 4.7% statements / 0% branch ❌ Critical

This file handles all HTTP registry traffic. Zero branch coverage means every error path, auth header, retry, and response-code handler is untested.

**Approach:** mock the `http`/`https` modules or extract the HTTP logic behind an interface that can be replaced in tests.

**Minimal test surface to add:**

```typescript
describe('RegistryClient', () => {
  describe('getManifest()', () => {
    it('returns parsed manifest on 200', async () => { /* mock http GET */ });
    it('throws on 404', async () => { /* mock 404 response */ });
    it('throws on network error', async () => { /* mock connection error */ });
  });

  describe('publish()', () => {
    it('sends Authorization header when auth token is configured', async () => {});
    it('throws on 401', async () => {});
    it('throws on 409 conflict', async () => {});
  });

  describe('search()', () => {
    it('returns results array on 200', async () => {});
    it('returns empty array on 404', async () => {});
  });

  describe('listVersions()', () => {
    it('returns sorted versions array', async () => {});
  });

  describe('download()', () => {
    it('returns buffer on 200', async () => {});
    it('throws on non-200 status', async () => {});
  });
});
```

**Note:** The client uses raw `node:http`/`node:https`. Consider switching to `fetch` (available in Node 20+) to simplify testing — `fetch` can be mocked with `jest.spyOn(global, 'fetch')` without additional libraries.

---

### 2.2 `commands/install.ts` — 15.9% statements / 9.4% branch

Only `parsePackageArg` (the pure utility function) is tested. The `installSingle` and `installAll` action functions, which contain registry fallback logic, spinner lifecycle, and manifest-file updates, are uncovered.

**Approach:** export `installSingle` and `installAll` as named functions (they already are `async function` declarations). Mock the dependencies:

```typescript
describe('installSingle()', () => {
  const mockClient = { getManifest: jest.fn(), download: jest.fn(), config: { url: 'http://reg' } };
  const mockInstaller = { install: jest.fn(), getLock: jest.fn() };
  const mockConfigManager = { getRegistries: jest.fn(), getDefaultScope: jest.fn(), getPlatform: jest.fn() };

  beforeEach(() => {
    mockClient.getManifest.mockResolvedValue({ name: 'my-skill', version: '1.0.0', files: [] });
    mockInstaller.install.mockResolvedValue({ name: 'my-skill', version: '1.0.0', files: ['/some/path'] });
    mockConfigManager.getRegistries.mockReturnValue([{ name: 'r', url: 'http://reg' }]);
  });

  it('exits 1 when no registries are configured', async () => {
    mockConfigManager.getRegistries.mockReturnValue([]);
    await expect(installSingle('my-skill', {}, 'project', mockConfigManager, mockInstaller, '/tmp')).rejects.toThrow();
  });

  it('exits 1 when tool is not found in any registry', async () => {
    mockClient.getManifest.mockRejectedValue(new Error('Not found'));
    // ...
  });
});
```

**Key branches missing:** no-registry exit, not-found-in-any-registry exit, install error exit, MCP platform tip, manifest update.

---

### 2.3 `commands/compat.ts` — 31.3% statements / 29.6% branch

The pure functions `parseSkillFrontmatter` and `analyzeCompat` are tested. The command action (file I/O, manifest read, output formatting) is uncovered.

**What to add:**

```typescript
describe('compat command action', () => {
  it('exits 1 when no manifest file exists', () => { /* tempdir without manifest */ });
  it('exits 1 when manifest JSON is invalid', () => { /* write malformed JSON */ });
  it('exits 1 when manifest fails schema validation', () => { /* write invalid manifest */ });
  it('prints compat results for a valid skill manifest', () => { /* write valid manifest + SKILL.md */ });
  it('respects --platform flag to filter to one platform', () => { });
  it('exits 1 for an unrecognised --platform value', () => { });
});
```

---

### 2.4 Commands with 0% coverage

All of the following command files have no test file at all. They are exercised only by the Docker E2E suite.

| Command file | Key logic to unit-test |
|---|---|
| `commands/update.ts` | `semver.maxSatisfying` range resolution, not-in-manifest skip, registry fallback |
| `commands/uninstall.ts` | Installer delegation, manifest update, not-found error |
| `commands/search.ts` | Multi-registry aggregation, `--json` flag, empty result path |
| `commands/list.ts` | Lock file read, `--json` flag, empty-lock path |
| `commands/publish.ts` | Missing manifest exit, schema validation exit, missing src-file exit, dry-run output, registry selection |
| `commands/manifest.ts` | `bump` semver increment, `validate` file-existence check, `init` non-interactive mode |
| `commands/registry.ts` | Add/remove/list config mutations |
| `commands/config.ts` | Get/set/unset/list config |
| `commands/init.ts` | Manifest file creation, idempotency |

**Recommended approach for command tests:** test the action function directly, not via `program.parse`. Mock `ConfigManager`, `Installer`, and `createRegistryClient` with `jest.fn()`. Assert exit codes by spying on `process.exit`.

---

### 2.5 `adapters/` non-VSCode — 50% statements / 0% branch

`claude.ts`, `cursor.ts`, `windsurf.ts`, and `universal.ts` each export `resolveDir` and `resolveMcpConfig`. The functions are instantiated (covered by the `index.ts` factory call) but their return values are not asserted.

**What to add:**

```typescript
describe('ClaudeAdapter', () => {
  describe('resolveDir()', () => {
    it('returns project-scope path under .claude/skills/', () => { /* assert path */ });
    it('returns user-scope path under home directory', () => { });
  });

  describe('resolveMcpConfig()', () => {
    it('returns project-scope claude_desktop_config.json path', () => { });
    it('returns user-scope path', () => { });
  });
});
```

Same pattern for Cursor, Windsurf, and Universal adapters. These tests catch path-resolution bugs that would only surface at install time on a real machine.

---

### 2.6 `utils/config-manager.ts` — 65.7% statements / 52.9% branch

`writeProjectConfig`, `writeUserConfig`, and `writeConfigFile` are tested minimally. The shallow-merge behaviour when writing `registries` arrays is not tested.

**Key test to add:**

```typescript
it('replaces arrays rather than merging when writing config (known limitation)', () => {
  manager.writeProjectConfig({ registries: [{ name: 'a', url: 'http://a' }] });
  manager.writeProjectConfig({ registries: [{ name: 'b', url: 'http://b' }] });
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  // Document the current (shallow) behaviour
  expect(cfg.registries).toHaveLength(1);
  expect(cfg.registries[0].name).toBe('b');
});
```

---

## 3. `@ai-tools/server`

### 3.1 `routes/registry.ts` — 96.4% statements / 71.4% branch

Line 65 is the branch where `Promise.allSettled` results that are `rejected` are skipped. Add a test where one upstream times out:

```typescript
it('skips failed upstream responses and returns successful ones', async () => {
  // Start app with two upstreams; mock one to error
  // Assert merged results contain only the successful upstream's tools
});
```

### 3.2 `routes/tools.ts` — 93.8% statements / 54.5% branch

Lines 89–91 are the error path inside `buildTarball`. The 404 catch-branch is uncovered:

```typescript
it('returns 404 when tarball is requested for a non-existent tool', async () => {
  const res = await app.inject({ method: 'GET', url: '/tools/ghost/1.0.0/tarball' });
  expect(res.statusCode).toBe(404);
});
```

### 3.3 `app.ts` — 83.3% statements / 33.3% branch

Lines 51–56 are inside `startServer()` (the `app.listen` call). Tests correctly use `buildApp()` directly. These lines are intentionally excluded — no action needed.

---

## 4. E2E Coverage Assessment

The E2E suite (`packages/e2e/src/cli.test.ts` and `api.test.ts`) covers:

✅ `--version` output  
✅ `search` keyword search  
✅ `install` single tool, version pinning  
✅ `install` all from `ai-tools.json`  
✅ `update` within semver range  
✅ `uninstall`  
✅ `list`  
✅ `publish --dry-run`  
✅ `publish` (real)  
✅ `registry add/list/remove`  
✅ `config set/get/unset`  
✅ `manifest bump`  
✅ `init`  
✅ Server API: GET tools, POST publish, GET search, GET tarball  

Not covered by E2E:

❌ `find` (smart search) — stub, no meaningful test  
❌ `compat` — no E2E test  
❌ `manifest init` interactive mode  
❌ `manifest validate` failure paths  
❌ Auth-protected publish (`publishToken`)  
❌ Registry proxy / upstream chaining  
❌ User-scope installs  

---

## 5. Priority Order

| # | Test to add | File | Effort | Risk if missing |
|---|---|---|---|---|
| 1 | `registry-client.ts` — HTTP methods, auth, error paths | new file | Medium | High — silent failures |
| 2 | `commands/install.ts` action — registry fallback, not-found exit | install.test.ts | Medium | High — Docker-only |
| 3 | Non-VSCode adapter path resolution | adapters/*.test.ts | Low | Medium — path bugs |
| 4 | `cascade.ts` `load()` and `resolveConfigFiles()` | cascade.test.ts | Low | Medium — config bugs |
| 5 | `commands/update.ts` | update.test.ts | Low | Medium — Docker-only |
| 6 | `commands/publish.ts` | publish.test.ts | Low | Medium — Docker-only |
| 7 | `commands/compat.ts` action and formatting | compat.test.ts | Low | Low — pure fns tested |
| 8 | Server tarball 404 path | tools.test.ts | Trivial | Low |
| 9 | Server upstream rejection path | registry.test.ts | Trivial | Low |
