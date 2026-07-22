# Role-Based AI Context Stacks

**Created**: 2026-07-22  
**Last Updated**: 2026-07-22  
**Status**: Active  
**Confidence**: Medium

## Overview

Research whether complex / monorepo codebases need the ability to swap or temporarily suppress full stacks of agent guidance (rules, skills, agents, `AGENTS.md`, etc.) by **role** (e.g. developer vs auditor), whether this is already practiced in the community, and whether AITools should productize help for it.

## Key Questions

1. Is there an established community practice for role- or profile-based AI agent context (rules/skills/agents) in multi-root or monorepo projects?
2. Is the developer-vs-auditor “bring my own rules / temp-remove repo AI mechanisms” need real, or contrived?
3. What should AITools do (if anything) to help — profiles, scopes, disable/override, workspace loaders?

## Current Understanding

- **Community practice (High)**: Monorepos use *hierarchical, path-scoped* agent instructions (nested `AGENTS.md` / `CLAUDE.md`, glob rules) plus *excludes/overrides* — not named human-role profiles.
- **Temp suppress (High)**: Claude offers `claudeMdExcludes` and `--setting-sources` without `project`. Cursor allows toggling *optional* Team Rules; Agent/Ask/Plan modes still load rules. No clean Cursor “disable all project AI mechanisms” product story found.
- **Need authenticity (Medium)**: Real for monorepo noise and compliance/security sessions; “full stack role swap” as a UX is under-productized, not imaginary.
- **AITools fit (Medium)**: Adjacent to project vs user scope and plugins; good candidate for profile/overlay/exclude helpers — not for owning vendor loaders.

## Next Steps

- [x] Catalog vendor + community mechanisms (profiles, modes, excludes, overrides)
- [x] Assess real-world evidence for auditor / bring-your-own-rules workflows
- [x] Map gaps to AITools product surface (summary)
- [ ] Optional: design spike for `aitools context` / profile command
- [ ] Review date: 2026-08-22
