# Sources — Role-Based AI Context Stacks

> Add new sources at the top of the relevant section. Include all fields.

---

## Official Documentation

### Cursor Rules (project / user / team precedence)
- **Type**: Official Documentation
- **URL**: https://cursor.com/docs/rules
- **Author/Organization**: Cursor
- **Date Accessed**: 2026-07-22 UTC
- **Reliability**: High
- **Relevance**: Defines layers Team → Project → User; optional vs enforced team rules; AGENTS.md / CLAUDE.md as simple always-on project instructions; modes still load rules.
- **Key Insights**: No first-class “role profile” that swaps an entire rules/skills stack. Optional team rules can be toggled off by members; enforced team rules cannot. Agent/Ask/Plan/Debug modes all still include rules.

### Cursor Agent modes
- **Type**: Official Documentation
- **URL**: https://cursor.com/help/ai-features/agent
- **Author/Organization**: Cursor
- **Date Accessed**: 2026-07-22 UTC
- **Reliability**: High
- **Relevance**: Modes change edit posture (read-only Ask vs Agent), not which project AI mechanisms load.
- **Key Insights**: “Do rules apply in all modes? Yes.” Modes ≠ role-based context stacks.

### Claude Code memory / CLAUDE.md
- **Type**: Official Documentation
- **URL**: https://code.claude.com/docs/en/memory
- **Author/Organization**: Anthropic
- **Date Accessed**: 2026-07-22 UTC
- **Reliability**: High
- **Relevance**: Layered memory (user / project / local / managed); path-scoped `.claude/rules/`; monorepo excludes.
- **Key Insights**: `claudeMdExcludes` skips irrelevant CLAUDE.md trees. Excluding `project` from `--setting-sources` skips project rules. Managed policy cannot be excluded. Closest practice to “temp remove repo AI mechanisms.”

### Claude Code monorepos and large codebases
- **Type**: Official Documentation
- **URL**: https://code.claude.com/docs/en/large-codebases
- **Author/Organization**: Anthropic
- **Date Accessed**: 2026-07-22 UTC
- **Reliability**: High
- **Relevance**: Official monorepo guidance: nested CLAUDE.md, excludes, start from package cwd, permission deny rules.
- **Key Insights**: Community need for *filtering* monorepo agent context is first-class in Claude docs — framed as team/package relevance, not auditor roles.

### OpenAI Codex AGENTS.md guide
- **Type**: Official Documentation
- **URL**: https://developers.openai.com/codex/guides/agents-md
- **Author/Organization**: OpenAI
- **Date Accessed**: 2026-07-22 UTC
- **Reliability**: High
- **Relevance**: Global + project instruction chain; `AGENTS.override.md` for directory-level overrides.
- **Key Insights**: Override files strengthen/narrow guidance by path — still not a named “auditor profile,” but supports role-like overlays in a tree.

---

## Blog Posts & Articles

### AGENTS.md vs .cursorrules vs Claude Skills (2026 comparison)
- **Type**: Blog Post
- **URL**: https://blog.buildbetter.ai/agents-md-vs-cursorrules-vs-claude-skills-2026-comparison/
- **Author/Organization**: BuildBetter
- **Date Accessed**: 2026-07-22 UTC
- **Reliability**: Medium
- **Relevance**: Cross-tool reality: teams juggle AGENTS.md + vendor-specific rules/skills.
- **Key Insights**: AGENTS.md positioned as portable baseline; Cursor `.cursor/rules` for scoped extras; multi-tool teams avoid putting everything in one vendor format.

### AGENTS.md in a monorepo (nested + precedence)
- **Type**: Blog Post
- **URL**: https://dev.to/promptmaster/agentsmd-in-a-monorepo-nested-files-and-precedence-1b7d
- **Author/Organization**: DEV / PromptMaster
- **Date Accessed**: 2026-07-22 UTC
- **Reliability**: Medium
- **Relevance**: Established community pattern for monorepos = hierarchy by package, not by human role.
- **Key Insights**: Root for shared conventions; leaf for package specifics; avoid duplicating shared rules.

### Knack — AGENTS.md monorepo precedence
- **Type**: Blog Post
- **URL**: https://getknack.ai/blog/agents-md-monorepo
- **Author/Organization**: Knack
- **Date Accessed**: 2026-07-22 UTC
- **Reliability**: Medium
- **Relevance**: Spec ambiguity (merge vs nearest-wins); Codex `AGENTS.override.md` as extension.
- **Key Insights**: Role-like stricter rules for sensitive dirs use overrides; portable AGENTS.md alone is underspecified across runtimes.

---

## Other

### CloudDefenseAI/secure-agents-md
- **Type**: Other (GitHub template)
- **URL**: https://github.com/CloudDefenseAI/secure-agents-md
- **Author/Organization**: CloudDefenseAI
- **Date Accessed**: 2026-07-22 UTC
- **Reliability**: Medium
- **Relevance**: Security-first AGENTS.md + override pattern for agents.
- **Key Insights**: Security posture as committed baseline + directory overrides — supports “auditor-like” hardening as *content*, not as session profile switch.

### Cursor forum — AGENTS.md / alwaysApply loading issues
- **Type**: Other (forum)
- **URL**: https://forum.cursor.com/t/agents-md-not-automatically-injected/158448
- **Author/Organization**: Cursor community
- **Date Accessed**: 2026-07-22 UTC
- **Reliability**: Medium
- **Relevance**: Shows friction when multi-root / workspace loading interacts with rules injection.
- **Key Insights**: Multi-root workspaces already complicate which AI mechanisms load — adjacent to role/stack swapping pain.
