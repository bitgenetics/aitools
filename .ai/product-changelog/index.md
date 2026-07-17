# Product Changelog — Index

> **AI instructions**: Always read this file first. Load only the section files relevant to your current task.
> Keep this file under 80 lines. If it grows beyond that, trim the summaries.

## System Overview

`AITools` is a package manager for AI tools — skills, rules, commands, agents, hooks, and MCP tools. Think `npm` for the AI tooling ecosystem. It is a TypeScript + Node.js ≥20 ESM monorepo with four packages: `@bitgenetics/aitools-core`, `@bitgenetics/aitools-cli` (binary: `aitools`), `@bitgenetics/aitools-server` (Fastify HTTP registry), and `@bitgenetics/aitools-e2e`. Three file roles: `aitools.json` + `aitools-lock.json` (deps/lock under project cwd or `~/.aitools/` by install scope), `aitools.config.json` (settings — user default on write, project overrides on read). Install can **transform** across IDE platforms; plugins default to **explode**, with opt-in `--cursor-plugin` (opaque local plugin) and `--plugin-bundle` (author-layout roots for shipping members). Per-file `placementMode` defaults to **strict** (honor `dest`); **transform** remaps placement (e.g. plugin assets). Registries can be **HTTP** or **git-backed**. Product context: `.ai/product-changelog/` (load `index.md` first).

---

## Section Map

| File | Contents | Load when... |
|---|---|---|
| [architecture.md](./architecture.md) | Major structural decisions with rationale | Touching core structure, choosing patterns, or when a decision's rationale matters |
| [features.md](./features.md) | Product behaviours & APIs (expectation source for e2e) | Working on or near a feature area; planning e2e |
| [patterns.md](./patterns.md) | Recurring code patterns used across the codebase | Writing new code, reviewing, or refactoring |
| [constraints.md](./constraints.md) | Accepted tradeoffs and known limitations | About to "fix" something that may be intentional |
| [integrations.md](./integrations.md) | How subsystems connect to each other | Working across module boundaries |
| [archived.md](./archived.md) | Superseded entries | Investigating historical decisions |

---

## Recent Changes

- **2026-07-17** — File `placementMode` (`strict` default vs `transform` remap) — see `features.md`
- **2026-07-16** `8c15b68` — Plugin-bundle install layout (`--plugin-bundle` → author roots `skills/`/`rules/`/…) — see `features.md`, `constraints.md`, `patterns.md`
- **2026-07-16** `ad7a20d` — Catch-up `a8239bb..HEAD` + user-scope/`--cursor-plugin`/MCP paths/changelog-first e2e — see `features.md`, `architecture.md`, `constraints.md`, `patterns.md`
- **2026-07-15** `a556dd4` / `dee6a92` / `43b5c50` — Shared references core; manifest init/files; `reference` not an adapter file category — see `features.md`, `architecture.md`, `patterns.md`
- **2026-07-14** `8a80e17` — Plugin explode + path rewrite + lock mcpKeys/hooksAdded (landed under mislabeled bump) — see `features.md`, `patterns.md`, `constraints.md`
- **2026-07-14** `a708c41` / `80f6568` / `4452a4d` / `b653839` / `cb32793` — Legacy manifest removed; portable lock paths; shared `--platform`; plugin scan; dev-init platform — see `constraints.md`, `patterns.md`, `features.md`
- **2026-06-28** `e0a753f` — Config layer model; `config-layers` e2e; coverage CI gate — see `architecture.md`, `features.md`, `patterns.md`
- **2026-06-27** `6eba41d` / `8ffd641` / `f2a0a54` — Transforms + `aitools mcp`; rebrand; `@bitgenetics` org — see `architecture.md`, `features.md`
- **2026-06-26** `d7f8fa0` / `52eaa5a` — Git registry + Gitea e2e; README registry types — see `architecture.md`, `features.md`
- **2026-06-15** `95123f3` — AGPL + CI unit/E2E/image; user auth portal — see `architecture.md`, `features.md`
- **2026-04-30** `d22c706` — Admin portal, provider abstractions — see `architecture.md`, `features.md`

---

<!-- Last SHA: 605b8cc -->
<!-- Last updated: 2026-07-17 -->
