# Research Log — Role-Based AI Context Stacks

> Entries in **descending chronological order** — newest at the top.  
> Timestamp format: `YYYY-MM-DD HH:MM:SS UTC`

---

## 2026-07-22 12:40:49 UTC — Partial swap: stay-set vs swappable-set

### Research Activity
**What We Researched**: User insight — full swap is easy; partial swap is hard when some AI-mech must stay. Two options: (1) codebase declares stay/swap intent in `aitools.json` or supporting file; (2) agent skill infers and writes a temp supporting file.  
**Research Method**: Design dialogue.  
**Sources/Data**: User message.

### Findings & Outcomes
**Key Discoveries**: Product must distinguish **full replace** (baseline ↔ profile) from **overlay** (swap subset; preserve stay-set). Stay-set needs either authored declaration (reliable) or inferred proposal (convenient, riskier). Hybrid: skill proposes → human/CI pins into manifest.  
**Evidence Quality**: Low (design)  
**Unexpected Results**: None

### Thought Progression
**Initial Hypothesis**: Hot-swap = replace whole AI-mech tree.  
**Reasoning Process**: Org/safety rules and shared AGENTS.md often must survive auditor/dev switches.  
**Cognitive Shifts**: Two modes of operation — `replace` vs `overlay` — with stay-set as first-class metadata.  
**Questions Raised**: Default stay policy? Can inferred stay-set be auto-committed?

### Impact & Next Steps
**Confidence Level**: Medium (problem framing)  
**Implications**: Manifest fields like `aiMech.stay` / `aiMech.profiles.*.swap` or sibling `aitools.ai-mech.json`; skill `propose-ai-mech-plan` writes temp plan for review.  
**Follow-up Actions**: Design spike should specify full vs overlay semantics first.  
**Knowledge Gaps**: Heuristics for safe inference (alwaysApply, AGENTS.md root, hooks, MCP).

### Research Context
**Phase**: Synthesis  
**Dependencies**: Prior hot-swap registry hypothesis  
**Connections**: Plugin portability grades; placementMode; lock integrity

---

## 2026-07-22 12:36:24 UTC — Design hypothesis: registry-backed hot-swap of AI-mech trees

### Research Activity
**What We Researched**: User refinement of AITools role — pattern/practice for hot-swapping AI-mechanism files; `aitools.json` + lock track normal state; registry holds baseline restore + swap-target profiles.  
**Research Method**: Design dialogue; fold into research summary.  
**Sources/Data**: User message; prior synthesis on coordinator vs loader.

### Findings & Outcomes
**Key Discoveries**: Aligns with coordinator model: AITools owns *which files are installed where* and *how to restore*, not *how Cursor/Claude inject context*. Registry dual-role (baseline + profile packages) makes swap/restore reproducible like `install`/`uninstall` today.  
**Evidence Quality**: Low (design hypothesis, not implemented)  
**Unexpected Results**: None

### Thought Progression
**Initial Hypothesis**: Coordinator = overlays/excludes without owning loaders.  
**Reasoning Process**: Hot-swap of on-disk AI-mech trees *is* coordination — vendors load whatever is present. Lock+registry give undo.  
**Cognitive Shifts**: “Coordinator” clarified as **state manager for AI-mech filesystem**, not merely advice generator.  
**Questions Raised**: Dirty git tree; baseline as snapshot package vs lock hashes; profile packages category (`plugin`? new `context-profile`?).

### Impact & Next Steps
**Confidence Level**: Medium (concept fit) / Low (mechanics)  
**Implications**: Natural extension of existing install/lock/registry; needs strong restore semantics.  
**Follow-up Actions**: If pursued, design spike: baseline capture, profile package shape, `aitools context swap|restore`.  
**Knowledge Gaps**: Interaction with committed vs generated AI files; multi-root workspaces.

### Research Context
**Phase**: Synthesis  
**Dependencies**: Prior discovery entry  
**Connections**: `aitools.json` / lock / publish / install; plugin-bundle layout

---

## 2026-07-22 12:31:32 UTC — Discovery: community practice vs role profiles

### Research Activity
**What We Researched**: Vendor + community mechanisms for swapping/suppressing agent instruction stacks; whether developer-vs-auditor need is real; AITools fit.  
**Research Method**: Web search + official Claude/Cursor/OpenAI docs (site-check: Norton flaky → caution entries in `.ai/sites-index.json`); synthesize against AITools existing scopes/plugins.  
**Sources/Data**: See `sources.md` (Cursor rules/modes, Claude memory + large-codebases, Codex AGENTS.md, monorepo AGENTS blogs, secure-agents-md).

### Findings & Outcomes
**Key Discoveries**:
1. Established practice is **path/package hierarchy** (nested AGENTS.md/CLAUDE.md, glob-scoped rules) and **excludes/overrides**, not named human-role profiles.
2. Closest “temp remove” levers: Claude `claudeMdExcludes` and `--setting-sources` without `project`; Cursor optional Team Rule toggles; modes do not unload rules.
3. Auditor/BYO-rules need is **plausible and partially evidenced** (security AGENTS templates; monorepo exclude docs) but **under-productized** as a session role switch.
4. Full-stack role swap is **not** a community standard — would be product invention atop fragmented vendors.

**Evidence Quality**: Medium  
**Unexpected Results**: Cursor docs explicitly state rules apply in *all* agent modes — so Ask/Plan are not a substitute for suppressing dev rules.

### Thought Progression
**Initial Hypothesis**: Real need, partly served by user-scope + disable project rules.  
**Reasoning Process**: Map user ask onto vendor primitives; distinguish package-scoped context (solved-ish) from role-scoped context (gap).  
**Cognitive Shifts**: Reframed from “is role swap a thing?” → “hierarchy/exclude is the thing; role swap is the missing productization.”  
**Questions Raised**: Portable AITools profile manifest? Quarantine vs exclude generation?

### Impact & Next Steps
**Confidence Level**: Medium  
**Implications**: AITools should help with **discovery, overlays, and vendor-mapped excludes/profiles**, not assume one loader controls Cursor+Claude+Codex.  
**Follow-up Actions**: Optional investigation on AITools `context profile` design; interview/usage signals for auditor workflows.  
**Knowledge Gaps**: Cursor project-rules exclude API; auditor workflow prevalence.

### Research Context
**Phase**: Analysis / Synthesis  
**Dependencies**: Site safety cache updated  
**Connections**: AITools project vs user install scope; `aitools cursor load` multi-root; plugin author vs consumer roles

---

## 2026-07-22 12:29:31 UTC — Topic initialization

### Research Activity
**What We Researched**: User challenge — role-swappable AI context stacks (rules/skills/agents/AGENTS.md) for monorepos; auditor vs developer; community practice; AITools fit.  
**Research Method**: Initialize topic structure; plan discovery across vendor docs and community patterns before deep fetch.  
**Sources/Data**: User prompt; existing AITools product changelog (project/user scope, plugins, cursor load).

### Findings & Outcomes
**Key Discoveries**: Topic scaffold created under `.ai/research/topics/role-based-ai-context-stacks/`. Related AITools pieces exist (scopes, plugins, multi-root load) but no first-class “role profile” feature.  
**Evidence Quality**: Low (setup only)  
**Unexpected Results**: None

### Thought Progression
**Initial Hypothesis**: Need is real for compliance/security roles and multi-team monorepos, but may be partially served by user-scope installs + disabling project rules rather than full “stack swap.”  
**Reasoning Process**: Separate (1) community practice, (2) need authenticity, (3) product fit.  
**Cognitive Shifts**: None yet  
**Questions Raised**: Do Cursor/Claude expose “disable project rules”? Are “agent modes” the vendor answer? Do auditors typically work in the same checkout?

### Impact & Next Steps
**Confidence Level**: Low  
**Implications**: Research must verify vendor capabilities before recommending AITools features.  
**Follow-up Actions**: Site-check + fetch Cursor/Claude/VS Code docs; search community for profiles/roles/AGENTS.md layering; synthesize.  
**Knowledge Gaps**: No primary sources cataloged yet.

### Research Context
**Phase**: Discovery  
**Dependencies**: site-check before any external fetch  
**Connections**: AITools config layers; `aitools cursor load`; plugin-researcher dual-role concern
