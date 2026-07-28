# Sources — AITools Usage Videos

> Newest sources toward the top of each section. Access dates UTC.

---

## Official Documentation / Project Repos

### VHS (Charmbracelet) {#vhs-charmbracelet}
- **Type**: Official project / documentation
- **URL**: https://github.com/charmbracelet/vhs
- **Author/Organization**: Charmbracelet
- **Date Accessed**: 2026-07-26 UTC
- **Reliability**: High
- **Relevance**: Primary tool for “terminal demos as code” (`.tape` → GIF/MP4/WebM)
- **Key Insights**: Scripted Type/Enter/Sleep; themes/sizing; Hide/Show; CI-friendly regeneration; widely adopted for CLI README demos

### asciinema CLI {#asciinema}
- **Type**: Official project / documentation
- **URL**: https://github.com/asciinema/asciinema ; https://docs.asciinema.org/manual/cli/quick-start/
- **Author/Organization**: asciinema
- **Date Accessed**: 2026-07-26 UTC
- **Reliability**: High
- **Relevance**: Interactive terminal recordings (`.cast`), idle-time limiting, optional web player
- **Key Insights**: Records events not pixels; best for shareable interactive playback / copy; pair with `agg` for GIF if needed

### OBS Studio {#obs}
- **Type**: Official project
- **URL**: https://obsproject.com / https://github.com/obsproject/obs-studio
- **Author/Organization**: OBS Project
- **Date Accessed**: 2026-07-26 UTC
- **Reliability**: High
- **Relevance**: Free cross-platform desktop capture for IDE+terminal narrated clips (Windows-capable)
- **Key Insights**: Powerful but setup-heavy; right tool when UI chrome matters; not ideal for every README regen

---

## Blog Posts & Articles

### Making a Polished TUI Demo Video Without a Video Editor {#polished-tui-demo}
- **Type**: Blog Post
- **URL**: https://blog.kunchenguid.com/p/making-a-polished-tui-demo-video
- **Author/Organization**: Kun Chen
- **Date Accessed**: 2026-07-26 UTC
- **Reliability**: High (practitioner write-up with concrete pipeline)
- **Relevance**: End-to-end VHS + ffmpeg + demo-mode pattern for CLI README demos
- **Key Insights**: Record large then downscale; Hide setup; mock non-deterministic backends; ffmpeg for zoom/speed/palette; `make demo` regenerates assets

### Sleeper demo-recording bake-off {#sleeper-demo-recording}
- **Type**: Project documentation
- **URL**: https://github.com/daviddwlee84/Sleeper/blob/main/docs/demo-recording.md
- **Author/Organization**: daviddwlee84 / Sleeper
- **Date Accessed**: 2026-07-26 UTC
- **Reliability**: High (documented decision record)
- **Relevance**: Explicit comparison VHS vs asciinema vs screen recorders for README embeds
- **Key Insights**: VHS won for inline GitHub GIF + scripted regen; asciinema if copy/paste or length; Kap/ffmpeg if non-terminal UI

### How to Create Terminal Demos as Code with VHS {#vhs-hypertext}
- **Type**: Blog Post
- **URL**: https://tenthirtyam.org/dispatches/2026/04/16/how-to-create-terminal-demos-as-code-with-vhs-by-charm/
- **Author/Organization**: Hypertext Dispatches / Tenthirtyam
- **Date Accessed**: 2026-07-26 UTC
- **Reliability**: Medium–High
- **Relevance**: Docs-as-API framing; CI regen with vhs-action
- **Key Insights**: Consistent theme/size; avoid volatile output; treat demos as versioned docs artifacts

### Screen recording tool comparisons (2026) {#screen-tool-comparisons}
- **Type**: Blog / roundup (multiple)
- **URL**: https://pickuma.com/for-dev/screen-recording-tools-developers-screen-studio-cleanshot-obs-2026/ ; https://toolchew.com/en/best-screen-recording-mac/ ; https://autozoom.app/articles/autozoom-vs-loom-vs-obs-vs-screenstudio
- **Author/Organization**: Various
- **Date Accessed**: 2026-07-26 UTC
- **Reliability**: Medium (vendor-adjacent roundups)
- **Relevance**: When to use Screen Studio / Loom / OBS for polished or async demos
- **Key Insights**: Screen Studio = polished Mac demos; Loom = fast async share; OBS = free/cross-platform/complex

---

## Other

### Site-check notes
- **Type**: Process note
- **URL**: n/a
- **Date Accessed**: 2026-07-26 UTC
- **Reliability**: n/a
- **Relevance**: Norton SafeWeb timed out / 500 for several domains; used github.com (cached safe) + search snippets for blogs
- **Key Insights**: Domains marked caution in sites-index where Norton unavailable
