---
name: propose-context-stay
description: >-
  Use this skill when proposing which AI-mech files should stay during an
  overlay context swap (aitools context). Judges each cataloged item for
  help vs hinder relative to a target profile, and dependency risk if another
  mech will be removed. Writes a proposal file only — never applies stay
  automatically. Also use when asked to "propose stay", "what should stay",
  or prepare for `aitools context accept-stay`.
metadata:
  author: ai-tools
---

# Propose context stay (assist only)

AITools hot-swaps on-disk AI-mech trees (`aitools context swap`). Overlay mode
preserves an **authored** stay-set in `aitools.json` → `context.stay`. This skill
**proposes** that set; it must never pin or swap by itself.

## Inputs

1. Run (or read) deterministic inventory:
   - `aitools context discover`
   - File: `.aitools/context-inventory.json`
2. Target profile name and its purpose (from user or `aitools.json` → `context.profiles.<name>`).
3. Optional: target profile package description / README if available in the registry.

## Judgment (per inventory entry)

For each `entries[]` item evaluate:

1. **Help or hinder** the swap goal for the target profile?
   - `help` — keep (recommend stay)
   - `hinder` — should be quarantined/swapped away
   - `neutral` — optional stay; prefer omit unless user needs it
2. **Dependency**: does this mech depend on another path that will be removed
   (not stay, will quarantine)? If yes, either recommend staying the dependency
   too, or mark this entry `hinder` / note the break.

Do **not** invent paths outside the inventory.

## Output (proposal only)

Write `.aitools/context-stay-proposal.json`:

```json
{
  "generatedAt": "<ISO-8601>",
  "targetProfile": "<profile-name>",
  "stay": ["AGENTS.md", ".cursor/rules/project-local.mdc"],
  "judgments": [
    {
      "path": "AGENTS.md",
      "helpOrHinder": "help",
      "note": "Project engineering contract must survive role swap"
    },
    {
      "path": ".cursor/skills/researcher/SKILL.md",
      "helpOrHinder": "hinder",
      "dependsOnRemoved": [],
      "note": "Conflicts with target profile research workflow"
    }
  ]
}
```

Rules:

- `stay` = paths with `helpOrHinder: "help"` (and any required dependency stays).
- Never edit `aitools.json` from this skill.
- Tell the user to run: `aitools context accept-stay` then `aitools context swap <profile>`.

## After accept

`accept-stay` merges into authored `context.stay`. Overlay swap then quarantines
only non-stay paths into `.aitools/context-quarantine/<id>/` (primary restore).
