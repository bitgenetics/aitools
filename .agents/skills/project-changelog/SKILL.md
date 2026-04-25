---
name: project-changelog
description: >-
  Use this skill to initialize, update, and read a project changelog that keeps
  AI assistants continuously aware of key features, design decisions, and
  architectural choices. Use when starting a new project, after architectural
  decisions, after significant feature completions, when onboarding an AI to an
  existing codebase, or when an AI session needs project context. Also use when
  asked to "update the changelog", "record this decision", "add to project
  context", or "summarize what we built".
argument-hint: "init | add-entry | read | prune"
---

# Project Changelog Skill

Maintains a structured folder at `./ai/product-changelog/` that gives any AI assistant instant, accurate awareness of the project's current state, key decisions, and architectural patterns — without requiring the AI to re-explore the entire codebase each session.

The folder structure keeps each concern in a separate file so the AI loads **only what is relevant** to the current task, minimising context cost.

```
./ai/product-changelog/
├── index.md          ← Always read first: system overview + section map (keep < 80 lines)
├── architecture.md   ← ADR-style: major structural choices with rationale
├── features.md       ← Completed features with API surface & key files
├── patterns.md       ← Recurring code patterns used across the codebase
├── constraints.md    ← Accepted tradeoffs and known limitations
├── integrations.md   ← How subsystems connect to each other
└── archived.md       ← Superseded entries (history, never delete)
```

## When to Use

- **Session start**: Read `index.md`, then load only the files relevant to the task
- **After an architectural decision**: Add to `architecture.md`
- **After a feature is completed**: Add to `features.md`
- **After adopting a codebase-wide pattern**: Add to `patterns.md`
- **When accepting a tradeoff**: Add to `constraints.md`
- **When two subsystems are wired together**: Add to `integrations.md`
- **When context feels stale**: Prune outdated entries (move to `archived.md`)

---

## Workflow

### 1. Read Before Acting

**At the start of any session that involves code changes**, read the index first:

```
read_file ./ai/product-changelog/index.md
```

The index contains a `Last SHA` marker — the git commit at the time of the last changelog update. Use it to surface unrecorded work:

```bash
git log <last-sha>..HEAD --oneline
```

If commits exist since the last SHA, tell the user: *"There are N commits since the last changelog update. You may want to record any decisions from that work before we continue."* Then offer to add entries (Step 3).

From the index, identify which section files are relevant to the current task and load only those. Surface relevant entries to the user before touching code.

If no changelog folder exists, offer to initialize one (Step 2).

---

### 2. Initialize

When the project has no changelog yet:

1. Explore the codebase — semantic search, read entry points, check `package.json` / `README.md`.
2. Run `git rev-parse HEAD` to capture the current commit SHA.
3. Create the folder and files using the [templates](./references/templates/).
4. Populate `index.md` with the architecture overview, section map, and set `Last SHA` to the SHA from step 2.
5. Fill the other files based on what you discover. Mark inferred entries clearly so the user can review.
6. Ask the user to validate and fill any gaps.

**Folder to create**: `./ai/product-changelog/`  
**Files to create**: `index.md`, `architecture.md`, `features.md`, `patterns.md`, `constraints.md`, `integrations.md`, `archived.md`

Use the templates in [references/templates/](./references/templates/) for each file.

---

### 3. Add an Entry

**Pick the right file**:

| What happened | File to update |
|---|---|
| Major structural choice (DB, framework, execution model, auth) | `architecture.md` |
| New feature completed | `features.md` |
| Codebase-wide pattern adopted | `patterns.md` |
| Known limitation or accepted tradeoff | `constraints.md` |
| Two subsystems integrated or wired together | `integrations.md` |

**Entry format** (max ~10 lines per entry):

```markdown
### [Short title] — YYYY-MM-DD `abc1234`
**What**: One sentence describing the decision or completion.  
**Why**: Rationale. What alternatives were rejected and why.  
**Impact**: What this constrains or enables going forward.  
**Key files**: `path/to/file.ts`, `path/to/other.ts`
```

The short SHA (`git rev-parse --short HEAD`) in the title marks exactly which commit this entry describes. This lets git bridge the gap between entries.

After adding, **update `index.md`**:
- Update `Last SHA` to the current HEAD short SHA
- Add a one-line summary to the **Recent Changes** list
- Update the System Overview paragraph if the system has materially changed

---

### 4. Prune & Maintain

Prune when any section file exceeds ~150 lines or entries are stale:

- **Move** superseded entries to `archived.md` (never delete — history matters)
- **Remove** feature entries whose key files have been deleted
- **Merge** near-duplicate entries
- **Update** stale `Key files` references after renames
- **Re-summarise** `index.md` after major pruning

---

## Quality Criteria

A good entry:
- [ ] Clear, searchable title
- [ ] Explains **why**, not just what
- [ ] Lists key files for direct navigation
- [ ] Dated with short git SHA in the title
- [ ] Under 10 lines

A healthy changelog folder:
- [ ] `index.md` under 80 lines (always cheap to load)
- [ ] No file exceeds ~150 lines
- [ ] No entries contradicting each other across files
- [ ] Reflects current reality, not aspirational state
- [ ] `archived.md` holds superseded content rather than deletion

---

## Anti-Patterns

- **Monolithic file**: Don't collapse everything into one file. The whole value of the folder structure is selective loading.
- **Changelog as release notes**: Don't copy git log messages. Capture *why* — not just *what*.
- **Too granular**: Don't log every small bug fix. Log decisions that affect future AI sessions.
- **Too vague**: "Refactored auth" is useless. "Moved auth to server-side JWT (was client-side) for XSS safety — see `auth/middleware.ts`" is useful.
- **Stale entries**: An outdated changelog misleads the AI. Prune regularly.
- **Skipping the read**: Always read `index.md` before acting. The value is lost if skipped.
