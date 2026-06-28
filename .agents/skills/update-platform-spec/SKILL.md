---
name: update-platform-spec
description: >-
  Use this skill when updating platform spec awareness for an existing platform —
  adding or changing frontmatter field support, updating install paths, re-verifying
  a stale spec, or recording newly discovered platform behaviour. Use when asked to
  "update the spec for X", "X now supports Y field", "X changed its install path",
  or "the compat command is warning about stale spec data".
metadata:
  project: aitools
---

Platform spec data lives in `packages/core/src/platforms/`. Each platform has one
file that records install paths, supported frontmatter fields, and a `lastVerified`
date. The `aitools compat` command reads this data — keep it accurate.

## Spec files

| Platform | File | Docs URL |
|---|---|---|
| universal | `packages/core/src/platforms/universal.ts` | https://agentskills.io/specification |
| vscode | `packages/core/src/platforms/vscode.ts` | https://code.visualstudio.com/docs/copilot/customization/agent-skills |
| cursor | `packages/core/src/platforms/cursor.ts` | https://cursor.com/docs/skills |
| claude | `packages/core/src/platforms/claude.ts` | https://docs.anthropic.com/en/docs/claude-code/skills |
| windsurf | `packages/core/src/platforms/windsurf.ts` | https://docs.windsurf.com/windsurf/skills |

Always read the current file before editing — do not assume it matches what you remember.

---

## Task A — Add or change a frontmatter field

A platform started supporting (or stopped supporting) a SKILL.md frontmatter field.

### 1. Edit the platform spec file

In `skillFrontmatter`, add a new entry or update the existing one:

```typescript
'new-field': {
  required: false,
  support: 'supported',        // supported | ignored | unsupported | unknown
  platformExtension: true,     // true if NOT in the agentskills.io base spec
  note: 'What this field does on this platform',
},
```

**`support` values:**

| Value | Meaning |
|---|---|
| `supported` | Platform reads and acts on the field |
| `ignored` | Platform loads the skill but silently ignores the field |
| `unsupported` | Field causes a load failure or category not supported |
| `unknown` | Behaviour has not been verified — use this when uncertain |

**`platformExtension`:** Set `true` for any field not listed in the agentskills.io base spec
(`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`).

When a field is ignored on a platform, also check the other platform files and set `support: 'ignored'`
there if they share the same gap — don't leave it as `'unknown'` if you know the answer.

### 2. Update `lastVerified`

Always update `lastVerified` to today's ISO-8601 date whenever you edit a spec file:

```typescript
lastVerified: '2026-04-25',   // replace with today
```

### 3. Build and verify

```bash
npm run build -w @bitgenetics/aitools-core
cd tools/create-ai-tool
aitools compat
```

The compat output should reflect the change. If the field was previously `unknown` and is now
`supported`, the `?` marker should disappear.

---

## Task B — Update install paths

A platform changed its skill/agent/prompt directory conventions, or you discovered the current
paths are wrong.

### 1. Update the adapter (CLI)

The adapter is the source of truth for runtime installs. Edit
`packages/cli/src/adapters/<platform>.ts` — update the `DIRS` object:

```typescript
private readonly DIRS = {
  project: {
    skill:    path.join('.newpath', 'skills'),
    subagent: path.join('.newpath', 'agents'),
    prompt:   path.join('.newpath', 'rules'),
  },
  user: { ... },
};
```

Also update `resolveMcpConfig()` if the MCP config path changed.

### 2. Update the platform spec file

Edit `packages/core/src/platforms/<platform>.ts` — mirror the same paths in `installPaths`:

```typescript
installPaths: {
  skill:     { project: '.newpath/skills',  user: '~/.newpath/skills' },
  subagent:  { project: '.newpath/agents',  user: '~/.newpath/agents' },
  prompt:    { project: '.newpath/rules',   user: '~/.newpath/rules' },
  mcpConfig: { project: '.newpath/mcp.json', user: '~/.newpath/mcp.json' },
},
```

> The adapter and the spec file must stay in sync. The adapter is used at install time;
> the spec is used by `compat` and documentation generation.

### 3. Update `lastVerified` in the spec file (same as Task A step 2).

### 4. Build both packages

```bash
npm run build -w @bitgenetics/aitools-core
npm run build -w @bitgenetics/aitools-cli
```

### 5. Update the reference doc

Edit `tools/create-ai-tool/references/platform-paths.md` — update the install path tables
for the changed platform. Then bump and republish:

```bash
cd tools/create-ai-tool
aitools manifest bump patch
aitools publish
```

---

## Task C — Re-verify a stale spec

The `compat` command shows `?` with a message like
`spec data unverified (last checked 2026-01-01)`.

### 1. Open the platform's docs URL

Find it in the spec file under `docsUrl`, or in the table at the top of this skill.

### 2. Check for changes since `lastVerified`

Look for:
- New frontmatter fields
- Changed or removed fields
- Updated install directory conventions
- New supported categories

### 3. Apply any changes found

Use Task A or Task B above as appropriate.

### 4. Update `lastVerified` even if nothing changed

If the docs match the current spec exactly, still update `lastVerified` to today — this records
that you verified it and resets the staleness timer.

### 5. Build and run compat

```bash
npm run build -w @bitgenetics/aitools-core
cd tools/create-ai-tool
aitools compat
```

The staleness warning should be gone.

---

## Gotchas

- **The adapter and spec file are separate** — changing one does not change the other.
  A mismatch means `compat` shows correct paths but installs go to the wrong directory.
- **`unknown` is not a substitute for research.** Use `unknown` only when the docs genuinely
  don't mention the field. If you can test it or find a reference, set the real value.
- **`platformExtension: false` for base spec fields only.** The base spec fields are:
  `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`.
  Everything else is a platform extension — set `platformExtension: true`.
- **Don't update `universal.ts` with platform-specific fields.** Universal is the
  agentskills.io baseline — it should only contain fields from that spec.
- **Build order:** `core` must build before `cli`. If you only changed a spec file,
  `npm run build -w @bitgenetics/aitools-core` is sufficient.

## Checklist

- [ ] Spec file updated (field support, install paths, or both)
- [ ] `lastVerified` set to today's date in every edited spec file
- [ ] Adapter `DIRS` updated if install paths changed
- [ ] `npm run build -w @bitgenetics/aitools-core` succeeds (add `@bitgenetics/aitools-cli` if adapter changed)
- [ ] `aitools compat` output is correct
- [ ] `tools/create-ai-tool/references/platform-paths.md` updated if paths changed
- [ ] `create-ai-tool` bumped and republished if reference docs changed
