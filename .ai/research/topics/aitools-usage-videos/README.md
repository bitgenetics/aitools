# Research Topic: AITools Usage Videos

**Created**: 2026-07-26  
**Last Updated**: 2026-07-26  
**Status**: Active — Synthesis  
**Overall Confidence**: High

## Question

How should we produce short videos that teach people how to use **aitools** (install, search, context, cursor helpers) — as documentation/marketing assets — without building video generation into the product?

## Short Answer

Treat most demos as **versioned terminal recordings** ([VHS](https://github.com/charmbracelet/vhs) `.tape` → GIF/WebM), regenerated when CLI UX changes. Reserve one-off **desktop screencasts** (OBS on Windows; Screen Studio if Mac) for flows that need IDE/UI context (e.g. Cursor + `aitools cursor worker`). Keep clips ≤30–45s, hide setup, use fixtures/mock registry so output is deterministic.

## Structure

| File | Purpose |
|------|---------|
| [summary.md](./summary.md) | Key findings, gaps, recommendations |
| [sources.md](./sources.md) | Cited sources |
| [research-log.md](./research-log.md) | Timestamped research activity |
| [investigations/demo-format-options/](./investigations/demo-format-options/) | Format bake-off (VHS vs asciinema vs screencast) |

## Specs

| Document | Status | Path |
|----------|--------|------|
| PRD | Not started | — |
| TRD | Not started | — |
| Implementation plan | Not started | — |

## Recommended Next Steps

1. Pick 3–5 scenarios from product changelog (install, search, context swap dry-run, cursor worker dry-run).
2. Prototype one VHS tape against e2e-style fixtures + local registry.
3. Decide embed targets (README GIF vs docs site WebM/MP4 vs YouTube).
4. Optionally record one narrated OBS clip for multi-root / Cursor-facing flows.
