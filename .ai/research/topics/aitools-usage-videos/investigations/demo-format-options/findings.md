# Findings — Demo Format Options

**Last Updated**: 2026-07-26

## Recommendation for aitools

**Default:** VHS terminal demos for install/search/list/context/cursor dry-run.  
**Exception:** Desktop screencast when the lesson is “open this `.code-workspace` / see Cursor roots,” not the CLI text itself.

## Comparison

| Criterion | VHS | asciinema | OBS / Screen Studio / Loom |
|-----------|-----|-----------|----------------------------|
| Deterministic regen | Excellent | Good (manual or scripted) | Poor |
| GitHub README inline | GIF/WebM | Needs conversion/link | Upload elsewhere |
| Shows IDE UI | No | No | Yes |
| Authoring effort | Write `.tape`, tune Sleep | Record live or script | Record + edit |
| Windows suitability | OK (often bash in CI) | OK | OBS/Loom strong; Screen Studio Mac-only |
| Fits aitools e2e fixtures | Excellent | Good | Manual setup each time |

## Scenario mapping (proposed)

| Scenario | Format |
|----------|--------|
| `aitools search` / `install` happy path | VHS |
| Config layers (`--project` vs user) | VHS |
| `aitools context swap` / `restore` | VHS (filesystem tree via `ls`/`tree` in tape) |
| `aitools cursor worker --dry-run` | VHS first; OBS if teaching “from workspace file in Explorer” |
| Plugin explode vs `--cursor-plugin` | VHS |

## Anti-patterns

- Recording full desktop for every CLI flag.
- Demos that hit production registries or real `HOME`.
- Multi-minute unedited Loom dumps as “docs.”
