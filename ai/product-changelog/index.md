# Product Changelog — Index

> **AI instructions**: Always read this file first. Load only the section files relevant to your current task.
> Keep this file under 80 lines. If it grows beyond that, trim the summaries.

## System Overview

`ai-tools` is a package manager for AI tools — skills, subagents, prompts, and MCP tools. Think `npm` for the AI tooling ecosystem. It is a TypeScript + Node.js ≥20 ESM monorepo with four packages: `@ai-tools/core` (shared types, schemas, config logic), `@ai-tools/cli` (Commander v12 CLI binary), `@ai-tools/server` (Fastify registry server), and `@ai-tools/e2e` (Docker-based E2E tests). Tools are discovered from self-hosted or chained registries, installed into project or user scope, and adapted to platform-specific paths (VS Code, Claude, Cursor, Windsurf, or the universal `.agents/` convention).

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

- **2026-04-26** `d0b6f60` — `manifest init` interactive flow now prompts per skill folder (not per file) using `detectSkillFolders` — see `features.md`
- **2026-04-26** `d0b6f60` — `dev-init` command added: installs bundled `create-ai-tool` skill without a registry — see `features.md`
- **2026-04-26** `d0b6f60` — Double-nested install path bug fixed in `Installer.installFiles` — see `constraints.md`
- **2026-04-26** `d0b6f60` — Docker Compose split: `docker-compose.yml` (persistent dev registry) vs `docker-compose.e2e.yml` (ephemeral test registry) — see `architecture.md`
- **2026-04-26** `d719124` — `platforms?: TargetPlatform[]` field added to `ToolManifest` and `ToolManifestSchema`; `Installer.installFiles` rejects installs when active platform is not in the list — see `features.md`
- **2026-04-27** `d719124` — `manifest update` subcommand added: interactively or via flags edit all metadata fields of an existing manifest, including `platforms` — see `features.md`
- **2026-04-27** `d719124` — VS Code subagent install path fixed: was `.agents/agents/`, now correctly `.github/agents/` per VS Code docs — see `constraints.md`
- **2026-04-30** `d22c706` — Admin portal login page added: session-cookie gating for `/portal/admin` via `IAdminAuth` — see `features.md`
- **2026-04-30** `d22c706` — `IStorageProvider` + `IAuthProvider` abstraction layers: server supports three deployment modes (local/dev/production) — see `architecture.md`, `integrations.md`
- **2026-04-30** `d22c706` — `ToolStore` and `OrgStore` are now fully async, backed by `IStorageProvider` — see `integrations.md`

---

<!-- Last SHA: d22c706 -->
<!-- Last updated: 2026-04-30 -->
