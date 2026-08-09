# @bitgenetics/aitools-cli

CLI for **AITools** — a package manager for AI tools. Discover, install, update, and publish **skills**, **subagents**, **prompts**, and **MCP tools** across projects and IDE environments.

Think `npm`, but for the AI tooling ecosystem.

> **Experimental software.** This project is under active development. APIs, file formats, and behavior may change without notice. There are **no warranties of any kind**, express or implied. **Use at your own risk.**
>
> **Full docs:** [github.com/bitgenetics/aitools](https://github.com/bitgenetics/aitools)

## Install

```bash
npm install -g @bitgenetics/aitools-cli
```

Requires Node.js >= 20 and npm >= 10.

## Quick start

```bash
# Tell aitools which IDE you use (once, user config by default)
aitools config set platform vscode   # vscode | claude | cursor | windsurf

# Initialise a project (creates aitools.json)
aitools init

# Search / install
aitools search copilot
aitools find "pull request review"
aitools install @scope/my-skill
aitools list
aitools update
```

## What this package includes

| Binary | Purpose |
|--------|---------|
| `aitools` | Install, publish, search, config, registries |

It depends on `@bitgenetics/aitools-core` (shared library) and `@bitgenetics/aitools-cursor` (Cursor Agent workspace helper).

The HTTP registry server is **not** on npm — build from the repo, Docker, or `ghcr.io/bitgenetics/aitools`.

## Learn more

- [Repository README](https://github.com/bitgenetics/aitools#readme) — features, CLI reference, registries, self-hosting
- [License (AGPL-3.0-or-later)](https://github.com/bitgenetics/aitools/blob/main/LICENSE)

## License

This software is provided **as is**, without warranty of any kind. See the experimental notice at the top of this document.

Maintained by [Nucleic Logic Studios, LLC](https://github.com/bitgenetics).
