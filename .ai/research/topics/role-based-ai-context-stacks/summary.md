# Summary — Role-Based AI Context Stacks

**Last Updated**: 2026-07-22  
**Overall Confidence**: Medium

## Key Findings

| Finding | Confidence | Source |
|---------|-----------|--------|
| Community practice exists for **path/package hierarchical** agent instructions (nested AGENTS.md / CLAUDE.md / scoped rules), not for named human **roles** | High | [Claude monorepos](sources.md#claude-code-monorepos-and-large-codebases), [DEV monorepo AGENTS.md](sources.md#agentsmd-in-a-monorepo-nested--precedence), [Codex AGENTS.md](sources.md#openai-codex-agentsmd-guide) |
| Closest vendor “temp remove repo AI” controls: Claude `claudeMdExcludes` + `--setting-sources` excluding `project`; Cursor optional Team Rules toggle; modes do **not** drop rules | High | [Claude memory](sources.md#claude-code-memory--claudemd), [Cursor rules](sources.md#cursor-rules-project--user--team-precedence), [Cursor modes](sources.md#cursor-agent-modes) |
| Developer-vs-auditor “bring own stack / suppress repo mechanisms” is a **real but under-productized** need (compliance, conflict, context noise) — not fully contrived; usually solved ad hoc | Medium | Synthesis + [secure-agents-md](sources.md#clouddefenseaisecure-agents-md) + Claude excludes framing |
| Full-stack **role profile swap** (rules+skills+agents+AGENTS.md) is **not** an established community standard yet | High | Absence across vendor docs; hierarchy/exclude/override dominate |
| AITools is a natural fit for **install-scope / profile / deactivate** workflows across vendors — adjacent to existing project vs user scope and plugins | Medium | Product changelog + gap vs Claude excludes / Cursor team toggles |

## Evidence Quality Assessment

- **Strong evidence**: Vendor docs on layers, monorepo excludes, modes-vs-rules; Codex override files.
- **Moderate evidence**: Community blogs on nested AGENTS.md; security AGENTS templates; forum multi-root rule bugs.
- **Weak / unverified**: Quantitative frequency of auditor-in-checkout workflows; Norton ratings incomplete (timeouts).

## Knowledge Gaps

- Whether Cursor will add project-rules exclude / profile APIs comparable to Claude’s `--setting-sources` / `claudeMdExcludes`
- How often auditors work *inside* the app checkout vs a separate review clone/tooling
- Ideal AITools UX: `profile activate auditor` vs `context disable --project` vs skill packages per role

## Actionable Insights

1. Treat the need as **real for monorepo noise + adversarial/compliance sessions**, but design against **hierarchy + exclude + user-scope overlay**, not inventing a proprietary “role OS” that fights vendors.
2. Near-term AITools experiments: document conventions; optional `profile`/`context` commands that (a) install role skill packs to user scope, (b) list/detect project AI surfaces, (c) generate exclude/ignore hints or local overlay files — without claiming to rewrite vendor loaders.
3. Do **not** conflate Cursor Agent/Ask/Plan modes with role stacks — docs explicitly keep rules in all modes.
4. **Emerging AITools-shaped approach (user design, 2026-07-22):** supply **pattern + practice** for hot-swapping AI-mechanism files in a project hierarchy. Extend `aitools.json` + lock to record the codebase’s **normal (baseline) AI-mech state**; keep **baseline** and **target profile** packages in a **registry** so swap-to and restore-to-original are both reproducible. AITools coordinates filesystem layout/install; vendor IDEs remain the loaders of whatever is currently on disk.

## Open Questions

- Should AITools ship a portable “context profile” manifest that maps to vendor-specific exclude/override mechanisms?
- Is temporary filesystem quarantine (move `.cursor/rules` aside) ever acceptable, or too footgun-prone?
- How is “normal state” captured — lock of paths+hashes, or a published `@org/repo-ai-baseline` package?
- Are swapped profiles project-local only, or can they be user-scoped overlays that leave git dirty-state minimal?
- Conflict with committed `.cursor/` / `AGENTS.md` — swap mutates working tree; need clear restore + dirty-tree rules
- **Partial swap:** some AI-mech are designed to **stay** (org safety, shared AGENTS.md, MCP) while others are role-swappable — how is the stay-set declared vs inferred?
