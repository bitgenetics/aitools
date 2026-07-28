# Summary — AITools Usage Videos

**Last Updated**: 2026-07-26  
**Overall Confidence**: High

## Key Findings

| Finding | Confidence | Source |
|---------|-----------|--------|
| For CLI products, **scripted terminal demos (VHS)** beat manual screen recording for README/docs: deterministic, reviewable as code, regenerable in CI | High | [VHS](sources.md#vhs-charmbracelet), [Kun TUI demo](sources.md#polished-tui-demo), [Sleeper bake-off](sources.md#sleeper-demo-recording) |
| **asciinema** wins when viewers need copy/paste or interactive replay; weaker for GitHub README inline (needs GIF via `agg` or external player) | High | [asciinema](sources.md#asciinema), [Sleeper bake-off](sources.md#sleeper-demo-recording) |
| Desktop polish tools (Screen Studio, Loom, OBS) fit **IDE + terminal** stories; Screen Studio is Mac-only — Windows production should prefer **OBS** or Loom | Medium | [Screen recording comparisons](sources.md#screen-tool-comparisons) |
| Production quality comes from **Hide setup, short runtime, deterministic fixtures**, optional ffmpeg zoom/speed — not from a heavy NLE | High | [Kun TUI demo](sources.md#polished-tui-demo) |
| Network/registry-backed flows need **fixture/demo mode** (local registry, canned packages) or demos go stale/flake | High | [Kun TUI demo](sources.md#polished-tui-demo); aitools e2e already has this pattern |

## Evidence Quality Assessment

- **Strong evidence**: OSS CLI projects standardizing on VHS; Charm VHS docs/community; asciinema’s event-stream model.
- **Moderate evidence**: Screencast tool comparisons (vendor/blog roundups, 2026).
- **Weak / unverified**: Exact audience preference for GIF vs narrated YouTube for aitools specifically (no user research yet).

## Knowledge Gaps

- Preferred distribution: README-only vs docs site vs YouTube/short-form.
- Whether voiceover/captions are required for first wave.
- Windows VHS/ttyd rendering quirks for `aitools` PowerShell demos.

## Actionable Insights

1. **Primary track**: VHS tapes under `docs/demos/` (or similar), one scenario each, GIF for README + WebM/MP4 for site/social.
2. **Secondary track**: 1–2 OBS screencasts for Cursor-facing commands (`cursor load` / `cursor worker`) where the workspace file + IDE matter.
3. **Reuse e2e isolation**: temp HOME, local registry, published fixtures — same as `packages/e2e` — so demos don’t hit real registries or flake.
4. **Do not** frame this as an aitools product feature; optional later: a human/agent *docs workflow* that authors `.tape` files (docs tooling, not CLI UX).

## Open Questions

- Bash vs PowerShell in published demos (audience is cross-platform; many OSS CLIs standardize on bash in Docker).
- Caption/accessibility requirements for public site.
