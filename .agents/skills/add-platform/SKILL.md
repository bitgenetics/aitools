---
name: add-platform
description: >-
  Use this skill when adding support for a new AI tool platform (IDE or agent)
  to the AITools project. Use when asked to support a new platform, add a new
  adapter, or wire in a new target IDE — even if the user just says "add support
  for <platform name>".
metadata:
  project: aitools
---

Adding a platform requires changes across two packages in a specific order:
`@bitgenetics/aitools-core` (type definition) → `@bitgenetics/aitools-cli` (adapter class + registration).
Build core first — cli imports from it.

## Steps

### 1. Add to the `TargetPlatform` type

Edit `packages/core/src/types/tool.ts`. Add the new platform string to the union:

```typescript
export type TargetPlatform = 'universal' | 'vscode' | 'claude' | 'cursor' | 'windsurf' | '<new-platform>';
```

Update the JSDoc comment above the type to describe the new platform.

### 2. Create the adapter class

Create `packages/cli/src/adapters/<platform>.ts`. Copy the structure from an existing adapter (e.g. `cursor.ts`) and adjust:

- `readonly platform = '<platform>' as const;`
- `DIRS.project` — the install paths for project scope
- `DIRS.user` — the install paths for user scope  
- `resolveMcpConfig()` — path to the platform's mcp.json

Use `.agents/skills/`, `.agents/agents/`, `.agents/prompts/` for project scope unless the platform has a native convention that differs (e.g. Claude uses `.claude/skills/`). Prefer the universal paths unless there is documented platform-specific guidance.

### 3. Register the adapter

Edit `packages/cli/src/adapters/index.ts`. Add in three places:

```typescript
// 1. Import
import { <Platform>Adapter } from './<platform>.js';

// 2. Export
export { <Platform>Adapter } from './<platform>.js';

// 3. ADAPTERS record — key must be the exact TargetPlatform string literal
const ADAPTERS: Record<TargetPlatform, PlatformAdapter> = {
  // ... existing entries ...
  '<platform>': new <Platform>Adapter(),
};
```

### 4. Build in dependency order

```bash
npm run build -w @bitgenetics/aitools-core
npm run build -w @bitgenetics/aitools-cli
```

Run `npx tsc --noEmit -p packages/cli/tsconfig.json` to confirm no type errors before the full build if you want a faster check.

### 5. Update the reference documentation

Edit `tools/create-ai-tool/references/platform-paths.md` — add the new platform row to the Project scope and User scope tables.

Then bump and republish the skill:

```bash
cd tools/create-ai-tool
aitools manifest bump patch
aitools publish
```

## Gotchas

- **Build order is mandatory.** If you build cli before core, TypeScript will error because `@bitgenetics/aitools-core` won't have the new platform literal yet.
- **ADAPTERS key must be the exact string from `TargetPlatform`.** A typo compiles fine but `getAdapter('<platform>')` returns `undefined` at runtime.
- **All imports in cli use `.js` extensions** even though source files are `.ts`. This is Node16 ESM resolution — do not omit the extension or use `.ts`.
- **Check the platform's actual skill directories before setting paths.** Platforms often support multiple discovery directories. Prefer `.agents/skills/` when the platform supports the agentskills.io standard.

## File checklist

- [ ] `packages/core/src/types/tool.ts` — `TargetPlatform` union updated
- [ ] `packages/cli/src/adapters/<platform>.ts` — adapter class created
- [ ] `packages/cli/src/adapters/index.ts` — import, export, ADAPTERS entry added
- [ ] `tools/create-ai-tool/references/platform-paths.md` — install path tables updated
- [ ] Build succeeds: `npm run build -w @bitgenetics/aitools-core && npm run build -w @bitgenetics/aitools-cli`
- [ ] `create-ai-tool` republished with bumped version
