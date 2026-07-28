---
name: create-ai-tool
description: >-
  Use this skill when asked to create, package, or publish a reusable AI tool for
  the AITools registry — even if the user doesn't explicitly say "registry" or
  "ai-tools". Covers skills, subagents, prompts, mcp-tools, plugins (anchor/hub
  layout, shared templates vs install homes), and context-profiles. Also use when
  bumping a version or republishing an existing package.
metadata:
  author: ai-tools
---

Every package needs a folder with `aitools.json` + at least one content file. Legacy `aitools.manifest.json` is still readable — run `aitools manifest migrate`.

## Creating a package

### Step 1: Create the folder and content file

For a **skill** — create `SKILL.md` with required YAML frontmatter:

```markdown
---
name: my-skill
description: >-
  Use this skill when [user intent]. Also use when [indirect trigger, even if
  user doesn't say the domain name explicitly].
---

[Step-by-step agent instructions here]
```

The `name` value **must exactly match the folder name**. This is how agents discover the skill — a mismatch causes it to never activate.

VS Code and Cursor support additional optional frontmatter fields beyond the base spec. Read [references/platform-paths.md](references/platform-paths.md#platform-specific-skillmd-frontmatter-fields) if the user needs:
- `disable-model-invocation: true` — slash-command-only, never auto-loads (VS Code + Cursor)
- `user-invocable: false` — hide from `/` menu but keep auto-loading (VS Code only)
- `argument-hint` — hint shown in chat input when invoked as `/skill-name` (VS Code only)

For a **subagent** — create a `.md` file with YAML frontmatter (name, description, tools list) and sections for Role, Responsibilities, Rules, Output Format.

For a **prompt** — create a `.md` file with the reusable instruction or template.

For an **mcp-tool** — the manifest needs an `mcpServer` block. Content files are optional. Read [references/manifest-reference.md](references/manifest-reference.md) for the `mcpServer` field spec.

For a **plugin** — a multi-file bundle (`.cursor-plugin/plugin.json`, skills, rules, scripts, etc.) published as one package. Use `manifest init --category plugin --nativeFor cursor`. On install, members explode into normal platform paths (not `.cursor/plugins/local/`). See [docs/design/plugin-marketplaces-comparison.md](../../docs/design/plugin-marketplaces-comparison.md).

#### Authoring a plugin (anchor convention)

Plugins should follow the **anchor skill** pattern so shared content stays **path-rewrite-free**:

1. **One anchor (hub) skill** named after the package — `skills/<name>/` where `<name>` is the sanitized package name (`@scope/pkg` → `@scope__pkg`). The anchor owns shared content and a managed skill-map section in its `SKILL.md`.
2. **Keep shared content under the anchor** — put `references/`, `assets/`, and `scripts/` under `skills/<name>/…`. Member skills link back with `../<name>/references/…`. Sibling skills explode side-by-side, so those relative links resolve 1:1 with **no path rewrite** → graded **path-rewrite-free**.
3. **Avoid plugin-root `assets/` / `scripts/`** — those require install-time link rewriting → **rewrite-required**. Orphan files (no install home) → **unsupported**.
4. **Single-skill plugins** use the same shape: one `skills/<name>/SKILL.md` that is both the anchor and the only skill.

**Scope of the grade:** `path-rewrite-free` means shared-content *paths* do not need rewriting. It does **not** mean installs skip all transforms — skill/rule/agent **frontmatter and format still differ by vendor** and are transformed when installing across platforms.

##### Hub skill vs install homes

Not everything “extra” belongs on the hub. Split by **who needs the file**:

| Content | Where it lives | Why |
|---|---|---|
| Skills, rules, agents, commands | `skills/`, `rules/`, `agents/`, `commands/` | First-class install homes — explode to platform paths |
| Runtime hooks (active after install) | `hooks/` (e.g. `hooks/hooks.json` + scripts) | First-class install home — not hub-only |
| MCP descriptor | `mcp.json` (or path in `plugin.json`) | First-class install home |
| Plugin descriptor | `.cursor-plugin/plugin.json` | Required for Cursor-native plugins |
| Shared methodology, docs, **templates** agents copy | Hub: `skills/<name>/references/` | Agent-readable; siblings link with `../<name>/…` |
| Shared logos / sample files / helper scripts | Hub: `skills/<name>/assets/` or `…/scripts/` | Same — keep path-rewrite-free |
| Skill-private helpers | That skill’s own folder | No need to share via hub |
| Anything with no install home | **Orphan** — fails validate | Move under hub *or* a first-class root |

**Rule of thumb:**

- If an **agent must read or copy it** as part of a workflow (templates, methodology, setup samples) → put it on the **hub skill**.
- If the **platform/runtime must have it installed** at a fixed kind of path (hooks, rules, agents, commands, MCP) → put it in that **install home** and list it in `files[]`.
- Hooks often need **both**: templates under the hub for setup guidance, plus real files under `hooks/` so install actually wires them. Hub templates alone do not activate hooks.

Do not confuse hub reference templates with `"template": true` on a `files[]` entry — the latter is install-time Handlebars substitution, not shared docs under the hub.

Authoring loop:

```bash
aitools manifest init --category plugin --nativeFor cursor   # scaffolds anchor + skill-map
aitools manifest validate                                    # structure + portability grade
aitools compat --platform cursor                             # prints portability grade
aitools compat --platform cursor --fix                      # scaffolds/refreshes skill-map
aitools publish                                              # orphans fail; warnings prompt
```

Full detail: [references/manifest-reference.md](references/manifest-reference.md#plugin-authoring-convention-anchor-skill).

For a **context-profile** — a tree overlay of AI-mech paths for `aitools context swap` (not a plugin explode). Use `category: "context-profile"` with project-relative `dest` paths. Consumer projects configure `context.stay` / `context.profiles` in `aitools.json`. See [references/manifest-reference.md](references/manifest-reference.md#context-profile-packages-role-stacks). Assist-only stay judgment: skill `propose-context-stay`.

### Step 2: Initialise the manifest

```bash
cd my-skill/
ai-tools manifest init          # interactive — prompts for all fields
```

Non-interactive (CI / scripted):

```bash
ai-tools manifest init --yes \
  --name "my-skill" \
  --category skill \
  --description "One-line summary shown in search results"
```

### Step 3: Validate

```bash
ai-tools manifest validate
```

Fix every reported error before continuing. Most common:
- `name` must be lowercase, hyphens only, no leading/trailing hyphen
- `src` file doesn't exist on disk
- `dest` accidentally prefixed with the category dir (don't — the installer adds it)

### Step 4: Dry-run, then publish

```bash
ai-tools publish --dry-run   # confirm files list
ai-tools publish             # upload to registry
```

### Bumping a version

```bash
ai-tools manifest bump patch   # 1.0.0 → 1.0.1
ai-tools manifest bump minor   # 1.0.0 → 1.1.0
ai-tools manifest bump major   # 1.0.0 → 2.0.0
```

Then publish again: `ai-tools publish`.

---

## `dest` path rule

`dest` is appended to the category install directory. Never repeat the category dir:

- ✅ `"dest": "my-skill/SKILL.md"` → `.agents/skills/my-skill/SKILL.md`
- ❌ `"dest": "skills/my-skill/SKILL.md"` — double-prefixed, wrong

Add `"template": true` to a file entry to enable Handlebars `{{variable}}` substitution during install.

---

## Writing a good `description` for a skill

The description is the **only** signal agents use to decide whether to activate the skill. Write it as an instruction:

- **Imperative**: "Use this skill when…" not "This skill does…"
- **Cover indirect triggers**: mention what the user is trying to achieve, not just the domain name — "even if they don't explicitly say 'registry'"
- **Be specific**: list the concrete operations the skill covers
- **Hard limit**: 1024 characters

Before: `"Create and publish tools."` — too vague, won't activate.

After: `"Use this skill when asked to create, package, or publish a reusable AI tool — even if the user doesn't say 'registry'. Covers skills, subagents, prompts, and MCP tools."` — activates on intent.

---

## Gotchas

- **`name` in `SKILL.md` frontmatter must match the folder name.** Mismatches silently break discovery.
- **`repository` in the manifest must be a full URL.** `user/repo` fails validation — use `https://github.com/user/repo`.
- **Run `manifest validate` before every publish** — catches missing files before they reach the registry.
- **`dest` is relative to the category dir, not the project root.** Do not prefix it with `skills/`, `agents/`, etc.
- **Plugin portability at publish** — orphan files fail publish; `rewrite-required` / `missing-anchor` warnings prompt to continue or abort (`--yes` skips the prompt, `--strict` blocks warnings). Prefer the anchor layout so the grade is **path-rewrite-free** (shared paths only — vendor frontmatter transforms still apply).
- **Hub ≠ dump for everything non-skill** — first-class roots (`hooks/`, `rules/`, `agents/`, `commands/`, …) stay at those paths; the hub holds *shared agent-readable* content. See [Hub skill vs install homes](#hub-skill-vs-install-homes).

---

## References

Read [references/manifest-reference.md](references/manifest-reference.md) for the full `aitools.json` field reference, including the `mcpServer` block and all optional fields.

Read [references/platform-paths.md](references/platform-paths.md) if you need to know exactly where files land per platform (vscode, claude, cursor, windsurf, universal) — useful when writing `dest` values or advising users on where tools install.
