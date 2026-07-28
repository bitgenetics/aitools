# Investigation: Demo Format Options

**Created**: 2026-07-26  
**Last Updated**: 2026-07-26  
**Status**: Complete (initial)  
**Confidence**: High

## Summary

For teaching people to use **aitools**, choose formats by *surface shown*:

| Surface | Best format | Why |
|---------|-------------|-----|
| Terminal-only CLI flows | **VHS** `.tape` → GIF/WebM | Scripted, regenerable, README-friendly |
| Long / copyable sessions | **asciinema** `.cast` (+ player or `agg`) | Interactive, idle trim |
| Terminal + Cursor/IDE | **OBS** (Windows) or Screen Studio (Mac) | Needs real window chrome |
| Async internal walkthrough | **Loom** | Fast share link, not polished marketing |

## Gap Analysis

| Gap | Impact | Next |
|-----|--------|------|
| No aitools demo scenarios recorded yet | Can’t validate timing/output noise | One VHS prototype |
| Windows tty rendering for VHS | May force bash-in-Docker demos | Test early on Windows + Linux CI |
| Narration/captions undecided | Affects OBS vs silent GIF choice | Decide per channel |

## Actionable Next Steps

1. Scenario list from changelog (5 clips max for v1).
2. VHS prototype with Hide-block fixture setup.
3. One OBS clip only if Cursor workspace UX is in scope for launch messaging.
