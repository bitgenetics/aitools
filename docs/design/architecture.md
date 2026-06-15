# System Architecture

ai-tools is a package manager for AI tools — skills, subagents, prompts, and MCP servers —
modelled closely on npm. It is composed of three packages in a monorepo, each with a distinct
responsibility.

---

## Package dependency graph

```mermaid
graph LR
    core["@ai-tools/core<br/>Types · Schemas · Config · Lock · Platform specs"]
    cli["@ai-tools/cli<br/>CLI binary (ai-tools)"]
    server["@ai-tools/server<br/>Registry API (Fastify)"]

    core --> cli
    core --> server
```

`@ai-tools/core` has no runtime dependencies on the other two packages.
`@ai-tools/cli` and `@ai-tools/server` both depend on `core` for types and schemas.

---

## Runtime topology

A typical deployment has a developer workstation running the CLI against one or more
registry servers. Registries can be chained — each one can proxy search queries and
tarball downloads to upstream registries.

```mermaid
graph TD
    dev["Developer<br/>Workstation"]

    subgraph cli_process["ai-tools CLI process"]
        cli["Commander<br/>command parser"]
        cfg["ConfigCascade<br/>config merge"]
        adp["PlatformAdapter<br/>path resolver"]
        inst["Installer<br/>file writer"]
        cache["CacheManager<br/>~/.ai-tools/cache/"]
    end

    subgraph fs["Local File System"]
        project_files[".agents/skills/<br/>.vscode/mcp.json<br/>etc."]
        lock["ai-tools-lock.json"]
        config_files["ai-tools.config.json<br/>(project → home cascade)"]
    end

    subgraph private_registry["Private Registry (@ai-tools/server)"]
        api["Fastify HTTP API"]
        store["ToolStore<br/>(file-based)"]
        data["dataDir/<br/><name>/<version>/"]
    end

    subgraph upstream["Upstream Registries"]
        pub["Public registry<br/>(or another private instance)"]
    end

    dev --> cli
    cfg --> config_files
    cli --> cfg
    cli --> adp
    cli --> inst
    inst --> cache
    inst --> project_files
    inst --> lock
    cli -- "HTTP" --> api
    api --> store
    store --> data
    api -- "proxy" --> pub
```

---

## Package internals

### @ai-tools/core

Pure library — no CLI, no HTTP server. Imported by both `cli` and `server`.

```mermaid
graph LR
    subgraph core["@ai-tools/core"]
        types["types/<br/>ToolManifest · AiToolsConfig<br/>AiToolsLock · TargetPlatform"]
        schema["schema/<br/>Zod validators<br/>(ToolManifestSchema<br/>AiToolsConfigSchema)"]
        config["config/<br/>ConfigCascade<br/>(project→home merge)"]
        lock["lock/<br/>read · write · upsert<br/>· remove · toLockEntry"]
        manifest_mod["manifest/<br/>read · write · upsert<br/>removeToolDependency"]
        platforms["platforms/<br/>PlatformSpec data<br/>(5 platforms)<br/>compat helpers"]
    end

    types --> schema
    types --> config
    types --> lock
    types --> manifest_mod
    types --> platforms
```

### @ai-tools/cli

The `ai-tools` binary. Commands are thin orchestrators that delegate to utility classes.

```mermaid
graph LR
    subgraph cli["@ai-tools/cli"]
        entry["cli.ts<br/>(Commander entry)"]
        commands["commands/<br/>install · uninstall · update<br/>search · find · list<br/>init · publish · manifest<br/>registry · config · compat"]
        adapters["adapters/<br/>PlatformAdapter per IDE<br/>(vscode · cursor · claude<br/>windsurf · universal)"]
        utils["utils/<br/>ConfigManager<br/>Installer<br/>RegistryClient<br/>CacheManager"]
    end

    entry --> commands
    commands --> utils
    commands --> adapters
    utils --> adapters
```

### @ai-tools/server

Fastify HTTP registry. Stateless per-request — all state is in the file system.

```mermaid
graph LR
    subgraph server["@ai-tools/server"]
        app["app.ts<br/>buildApp() factory"]
        tools_route["routes/tools.ts<br/>GET/POST/PATCH /api/tools"]
        registry_route["routes/registry.ts<br/>GET /upstream · /health · /proxy/search"]
        org_route["routes/org.ts<br/>GET/POST /api/org/*"]
        admin_route["routes/admin.ts<br/>GET/POST /api/admin/*"]
        auth_route["routes/auth.ts<br/>POST /api/auth/*"]
        portal_route["routes/portal.ts<br/>HTML portal + admin login"]
        exploration_route["routes/registry-exploration.ts<br/>GET /api/registries · /api/search/all"]
        store["storage/ToolStore + OrgStore<br/>via IStorageProvider"]
        datafs["dataDir/<br/><name>/<version>/<br/>manifest.json · files.json"]
    end

    app --> tools_route
    app --> registry_route
    app --> org_route
    app --> admin_route
    app --> auth_route
    app --> portal_route
    app --> exploration_route
    tools_route --> store
    org_route --> store
    admin_route --> store
    registry_route -- "HTTP proxy" --> upstream_reg["Upstream<br/>registries"]
    store --> datafs
```

---

## Config cascade

Configuration merges from home directory down to the project directory — project values
win. Registry arrays are merged with project registries prepended (highest priority).

```mermaid
flowchart TB
    home["~/ai-tools.config.json<br/>(user defaults)"]
    parent["…/parent/ai-tools.config.json<br/>(intermediate dirs)"]
    project["./ai-tools.config.json<br/>(project root)"]
    merged["Merged AiToolsConfig<br/>(platform · defaultScope<br/>registries · installPaths)"]

    home --> parent --> project --> merged

    style merged fill:#1a6b3a,color:#fff
    style project fill:#155ba3,color:#fff
```

**Merge rules:**
- Scalar values (`platform`, `defaultScope`): project overrides parent overrides home
- `registries` array: arrays are concatenated, project entries sorted to front by priority
- `installPaths` map: shallow merge, project keys override parent keys

---

## Lock file relationship

```mermaid
erDiagram
    PROJECT_MANIFEST {
        string name
        object tools
        object devTools
    }
    LOCK_FILE {
        int lockfileVersion
        object tools
    }
    LOCK_ENTRY {
        string version
        string resolved
        string integrity
        string files
        string installedAt
    }

    PROJECT_MANIFEST ||--o{ LOCK_ENTRY : "resolved to"
    LOCK_FILE ||--|{ LOCK_ENTRY : "contains"
```

