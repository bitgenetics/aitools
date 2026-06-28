# Product Changelog — Index

> **AI instructions**: Always read this file first. Load only the section files relevant to your current task.
> Keep this file under 80 lines. If it grows beyond that, trim the summaries.

## System Overview

`AITools` is a package manager for AI tools — skills, rules, commands, agents, hooks, and MCP tools. Think `npm` for the AI tooling ecosystem. It is a TypeScript + Node.js ≥20 ESM monorepo with four packages: `@bitgenetics/aitools-core`, `@bitgenetics/aitools-cli` (binary: `aitools`), `@bitgenetics/aitools-server` (Fastify HTTP registry), and `@bitgenetics/aitools-e2e`. Install can **transform** content across IDE platforms when `nativeFor` differs from the active platform. Registries can be **HTTP** (`@bitgenetics/aitools-server`) or **git-backed** (any git remote, no server). Project context for AI assistants lives in `.ai/product-changelog/` (load `index.md` first, then section files as needed).

---

## Section Map

| File | Contents | Load when... |
|---|---|---|
| [architecture.md](./architecture.md) | Major structural decisions with rationale | Touching core structure, choosing patterns, or when a decision's rationale matters |
| [features.md](./features.md) | Completed features, their APIs and key files | Working on or near a feature area |
| [patterns.md](./patterns.md) | Recurring code patterns used across the codebase | Writing new code, reviewing, or refactoring |
| [constraints.md](./constraints.md) | Accepted tradeoffs and known limitations | About to "fix" something that may be intentional |
| [integrations.md](./integrations.md) | How subsystems connect to each other | Working across module boundaries |
| [archived.md](./archived.md) | Superseded entries | Investigating historical decisions |

---

## Recent Changes

- **2026-06-27** `6eba41d` — Cross-platform install transforms (rule/command/agent/hook), `aitools mcp`, `nativeFor` manifest field — see `architecture.md`, `features.md`, `integrations.md`, `patterns.md`, `constraints.md`
- **2026-06-27** `8ffd641` — Rebrand to `aitools` CLI and `@bitgenetics/aitools-*` packages (`aitools.config.json`, `AITOOLS_*` env vars) — see `architecture.md`
- **2026-06-26** `52eaa5a` — README reorganized: table of contents, **Registry types** section, lightweight git registry quick start — see `features.md`
- **2026-06-26** `d7f8fa0` — Git registry mode + Gitea Docker e2e (`gitea-init` CLI bootstrap, not web install) — see `architecture.md`, `features.md`, `integrations.md`, `constraints.md`
- **2026-06-15** `907cce7` — CLI shebang moved to line 1 (copyright header follows) — fixes `tsc` TS18026 — see `constraints.md`
- **2026-06-15** `21e553f` — Design docs (`docs/design/`) rewritten to match implemented API, storage, and auth — see `architecture.md`
- **2026-06-15** `21e553f` — Experimental-software disclaimer added to `readme.md` — see `constraints.md`
- **2026-06-15** `95123f3` — AGPL-3.0-or-later: `LICENSE` + copyright headers on all source files — see `architecture.md`
- **2026-06-15** `95123f3` — GitHub Actions CI: unit tests, E2E (Docker), image build — see `architecture.md`
- **2026-06-15** `95123f3` — User auth API (`/api/auth/*`) + HTML browse portal — see `features.md`
- **2026-04-30** `d22c706` — Admin portal login, provider abstractions, async stores — see `architecture.md`, `features.md`, `integrations.md`

---

<!-- Last SHA: 6eba41d -->
<!-- Last updated: 2026-06-27 -->
