# Research Log — AITools Usage Videos

> Newest entries first. Timestamps UTC.

---

## 2026-07-26 22:40:00 UTC — Scope clarification + format synthesis

### Research Activity
**What We Researched**: How to produce short **usage/teaching** videos for aitools (docs & marketing), explicitly *not* a product feature that generates video from the CLI. Compared terminal-as-code (VHS, asciinema) vs desktop screencast tools (OBS, Screen Studio, Loom).  
**Research Method**: Topic init; site-check (Norton flaky); WebSearch + GitHub README/docs + practitioner blog fetch.  
**Sources/Data**: [sources.md](./sources.md)

### Findings & Outcomes
**Key Discoveries**:
1. Industry default for CLI README demos is **VHS** (scripted `.tape`, GIF/WebM, CI regenerable).
2. **asciinema** better for interactive/copyable sessions; weaker for inline GitHub README without conversion.
3. Desktop recorders only needed when IDE/UI is part of the teaching story; on Windows prefer OBS/Loom over Screen Studio (Mac-only).
4. Quality levers: Hide setup, ≤30–45s, fixtures/local registry, optional ffmpeg polish — aligns with existing aitools e2e isolation patterns.

**Evidence Quality**: High for CLI format choice; Medium for screencast vendor comparisons  
**Unexpected Results**: Strong consensus that “record my desktop” is the wrong default for CLI tools; polish can stay in ffmpeg without a video editor.

### Thought Progression
**Initial Hypothesis**: User wanted agent-automated video generation *in* aitools.  
**Reasoning Process**: Clarified intent → reframed as content-production research for teaching users.  
**Cognitive Shifts**: Separated *docs production pipeline* from *product capability*.  
**Questions Raised**: Distribution channel; bash vs PowerShell; need for voiceover.

### Impact & Next Steps
**Confidence Level**: High  
**Implications**: Recommend VHS-first docs demos + selective OBS clips; no changelog/feature work required.  
**Follow-up Actions**: Prototype one tape for `aitools search`/`install` against local registry; list scenario backlog from product changelog.  
**Knowledge Gaps**: Audience channel preference; Windows VHS quirks.

### Research Context
**Phase**: Synthesis  
**Dependencies**: Local registry / e2e fixtures if prototyping  
**Connections**: `.ai/product-changelog/features.md` (scenario inventory); `packages/e2e` isolation patterns

---

## 2026-07-26 22:38:00 UTC — Topic created

### Research Activity
**What We Researched**: Initialized topic `aitools-usage-videos` under `.ai/research/topics/`.  
**Research Method**: Researcher skill init templates.  
**Sources/Data**: n/a

### Findings & Outcomes
**Key Discoveries**: Structure ready; investigation `demo-format-options` scaffolded.  
**Evidence Quality**: n/a  
**Unexpected Results**: None

### Thought Progression
**Initial Hypothesis**: Broad “how to make videos” needs a bake-off investigation.  
**Reasoning Process**: Init → gather sources → synthesize.  
**Cognitive Shifts**: None yet  
**Questions Raised**: Primary research question locked to teaching/usage content.

### Impact & Next Steps
**Confidence Level**: Low (pre-research)  
**Implications**: —  
**Follow-up Actions**: Source gathering and format comparison.  
**Knowledge Gaps**: All.

### Research Context
**Phase**: Discovery  
**Dependencies**: site-check for external URLs  
**Connections**: User clarification that this is not an aitools video-generation feature
