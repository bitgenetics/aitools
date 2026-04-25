# Platform Adapter Pattern

The platform adapter pattern decouples the installer from the concrete directory
structure of each IDE. The installer always asks "where does a `skill` go for
`project` scope?" — the adapter answers differently per platform.

---

## Interface and implementations

```mermaid
classDiagram
    class PlatformAdapter {
        <<interface>>
        +TargetPlatform platform
        +resolveDir(category, scope, cwd) string
        +resolveMcpConfig(scope, cwd) string
    }

    class UniversalAdapter {
        +platform = "universal"
        +resolveDir(category, scope, cwd) string
        +resolveMcpConfig(scope, cwd) string
    }

    class VscodeAdapter {
        +platform = "vscode"
        +resolveDir(category, scope, cwd) string
        +resolveMcpConfig(scope, cwd) string
    }

    class CursorAdapter {
        +platform = "cursor"
        +resolveDir(category, scope, cwd) string
        +resolveMcpConfig(scope, cwd) string
    }

    class ClaudeAdapter {
        +platform = "claude"
        +resolveDir(category, scope, cwd) string
        +resolveMcpConfig(scope, cwd) string
    }

    class WindsurfAdapter {
        +platform = "windsurf"
        +resolveDir(category, scope, cwd) string
        +resolveMcpConfig(scope, cwd) string
    }

    PlatformAdapter <|.. UniversalAdapter
    PlatformAdapter <|.. VscodeAdapter
    PlatformAdapter <|.. CursorAdapter
    PlatformAdapter <|.. ClaudeAdapter
    PlatformAdapter <|.. WindsurfAdapter
```

---

## Adapter registry

`getAdapter(platform)` is a simple lookup — no dynamic dispatch or DI container.

```mermaid
classDiagram
    class AdapterRegistry {
        +Record~TargetPlatform,PlatformAdapter~ ADAPTERS$
        +getAdapter(platform) PlatformAdapter$
    }

    AdapterRegistry --> UniversalAdapter
    AdapterRegistry --> VscodeAdapter
    AdapterRegistry --> CursorAdapter
    AdapterRegistry --> ClaudeAdapter
    AdapterRegistry --> WindsurfAdapter
```

---

## Spec Staleness

Platform specs are considered stale if `lastVerified` is more than **90 days** old.
The `compat` command warns about stale specs to encourage regular verification.

```typescript
// packages/core/src/platforms/index.ts
export const SPEC_STALE_DAYS = 90;

export function isSpecStale(spec: PlatformSpec): boolean {
  const verified = new Date(spec.lastVerified);
  const ageMs = Date.now() - verified.getTime();
  return ageMs > SPEC_STALE_DAYS * 24 * 60 * 60 * 1000;
}
```

---

## Resolved install paths per platform

The install paths each adapter returns for **project scope**:

```mermaid
graph TB
    subgraph skill["category: skill"]
        u_s["universal → .agents/skills/"]
        v_s["vscode    → .agents/skills/"]
        cu_s["cursor   → .agents/skills/"]
        cl_s["claude   → .claude/skills/"]
        w_s["windsurf  → .windsurf/skills/"]
    end

    subgraph subagent["category: subagent"]
        u_a["universal → .agents/agents/"]
        v_a["vscode    → .agents/agents/"]
        cu_a["cursor   → .agents/agents/"]
        cl_a["claude   → .claude/agents/"]
        w_a["windsurf  → .windsurf/agents/"]
    end

    subgraph prompt["category: prompt"]
        u_p["universal → .agents/prompts/"]
        v_p["vscode    → .agents/prompts/"]
        cu_p["cursor   → .agents/prompts/"]
        cl_p["claude   → .claude/commands/"]
        w_p["windsurf  → .windsurf/rules/"]
    end

    subgraph mcp["category: mcp-tool (config file)"]
        u_m["universal → (no MCP config)"]
        v_m["vscode    → .vscode/mcp.json"]
        cu_m["cursor   → .cursor/mcp.json"]
        cl_m["claude   → .mcp.json"]
        w_m["windsurf  → .windsurf/mcp.json"]
    end
```

---

## Relationship between adapter and PlatformSpec

The adapter handles **runtime installs**. The `PlatformSpec` handles **compatibility
auditing and documentation**. They encode the same install paths and must stay in sync.

```mermaid
graph LR
    adapter["PlatformAdapter<br/>(packages/cli/src/adapters/)"]
    spec["PlatformSpec<br/>(packages/core/src/platforms/)"]
    installer["Installer<br/>(runtime file writes)"]
    compat["compat command<br/>(audit + docs)"]

    adapter -- "resolveDir()" --> installer
    spec -- "installPaths" --> compat

    adapter -. "must match" .-> spec
```

When a platform changes its install paths:
1. Update the adapter `DIRS` object (runtime behaviour)
2. Update the spec `installPaths` (audit + documentation)
3. Update `tools/create-ai-tool/references/platform-paths.md` (published reference)

See `.agents/skills/update-platform-spec/SKILL.md` for the step-by-step process.

---

## ConfigManager integration

`ConfigManager` bridges config, adapter selection, and path resolution for commands.

```mermaid
classDiagram
    class ConfigManager {
        -AiToolsConfig config
        -string cwd
        -PlatformAdapter adapter
        +get() AiToolsConfig
        +getDefaultScope() InstallScope
        +getPlatform() TargetPlatform
        +resolveInstallDir(category, scope) string
        +resolveMcpConfig(scope) string
    }

    ConfigManager --> PlatformAdapter : delegates path resolution
    ConfigManager --> ConfigCascade : loads config

    class ConfigCascade {
        +load(cwd) AiToolsConfig$
        +resolveConfigFiles(cwd) string[]$
        +merge(layers) AiToolsConfig$
    }
```

---

## Adding a new platform — decision flow

```mermaid
flowchart TD
    start([New platform to support])
    type["Add string literal to<br/>TargetPlatform union<br/>(packages/core/src/types/tool.ts)"]
    spec_file["Create PlatformSpec file<br/>packages/core/src/platforms/&lt;platform&gt;.ts"]
    spec_index["Register in PLATFORM_SPECS<br/>packages/core/src/platforms/index.ts"]
    adapter["Create PlatformAdapter class<br/>packages/cli/src/adapters/&lt;platform&gt;.ts"]
    adapters_index["Register in ADAPTERS record<br/>packages/cli/src/adapters/index.ts"]
    build["Build: core → cli<br/>npm run build -w @ai-tools/core<br/>npm run build -w @ai-tools/cli"]
    docs["Update platform-paths.md<br/>bump + republish create-ai-tool"]
    done([Done])

    start --> type --> spec_file --> spec_index --> adapter --> adapters_index --> build --> docs --> done
```

See `.agents/skills/add-platform/SKILL.md` for full details and gotchas.

