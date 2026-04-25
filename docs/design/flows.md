# Key Flows

Sequence diagrams for the primary operations. Actor abbreviations:

- **User** — developer running the CLI
- **CLI** — `aitools` binary (Commander entry + command handler)
- **ConfigManager** — reads and merges `aitools.config.json` cascade
- **Installer** — downloads and writes files
- **CacheManager** — local tarball cache at `~/.ai-tools/cache/`
- **Adapter** — platform-specific path resolver
- **RegistryClient** — HTTP client for a single registry endpoint
- **Registry** — `@ai-tools/server` (or any compatible registry)
- **FS** — local file system

---

## Install flow

```mermaid
sequenceDiagram
    actor User
    participant CLI
    participant ConfigManager
    participant RegistryClient
    participant Registry
    participant CacheManager
    participant Installer
    participant Adapter
    participant FS

    User->>CLI: aitools install @scope/my-skill
    CLI->>ConfigManager: load config cascade
    ConfigManager-->>CLI: AiToolsConfig (platform, registries, scope)

    CLI->>RegistryClient: getManifest("@scope/my-skill", "latest")
    RegistryClient->>Registry: GET /tools/@scope/my-skill
    Registry-->>RegistryClient: ToolManifest
    RegistryClient-->>CLI: ToolManifest

    CLI->>Installer: install(client, manifest, scope)

    alt cache hit
        Installer->>CacheManager: getExtracted(name, version)
        CacheManager-->>Installer: extracted file paths
    else cache miss
        Installer->>RegistryClient: download(name, version)
        RegistryClient->>Registry: GET /tools/:name/:version/tarball
        Registry-->>RegistryClient: tarball Buffer
        RegistryClient-->>Installer: Buffer
        Installer->>CacheManager: store(name, version, buffer)
        CacheManager->>FS: write ~/.ai-tools/cache/<name>/<version>/
        Installer->>CacheManager: getExtracted(name, version)
        CacheManager-->>Installer: extracted file paths
    end

    Installer->>Adapter: resolveDir(category, scope, cwd)
    Adapter-->>Installer: absolute destination path

    Installer->>FS: copy files → destination
    Installer->>FS: upsertLockEntry → ai-tools-lock.json
    Installer-->>CLI: InstalledTool

    CLI-->>User: ✔ installed @scope/my-skill@1.0.0
```

---

## MCP tool install flow

MCP tools do not write files — they inject a server entry into the platform's `mcp.json`.

```mermaid
sequenceDiagram
    actor User
    participant CLI
    participant Installer
    participant Adapter
    participant FS

    User->>CLI: aitools install @scope/my-mcp-tool
    CLI->>Installer: install(client, manifest, scope)
    Note over Installer: manifest.category === "mcp-tool"

    Installer->>Adapter: resolveMcpConfig(scope, cwd)
    Adapter-->>Installer: path to mcp.json

    alt mcp.json exists
        Installer->>FS: read mcp.json
        Installer->>FS: merge server entry → write mcp.json
    else mcp.json missing
        Installer->>FS: write new mcp.json with server entry
    end

    Installer->>FS: upsertLockEntry → ai-tools-lock.json
    Installer-->>CLI: InstalledTool
    CLI-->>User: ✔ registered MCP server @scope/my-mcp-tool
```

---

## Publish flow

```mermaid
sequenceDiagram
    actor User
    participant CLI
    participant FS
    participant RegistryClient
    participant Registry

    User->>CLI: aitools publish
    CLI->>FS: read ai-tools.manifest.json
    CLI->>CLI: validate with ToolManifestSchema (Zod)

    alt validation fails
        CLI-->>User: ✖ validation errors
    end

    CLI->>FS: read each declared file (src paths)
    CLI->>RegistryClient: publish(manifest, files)
    RegistryClient->>Registry: POST /tools — body: {manifest, files}

    alt version already exists
        Registry-->>RegistryClient: 409 Conflict
        RegistryClient-->>CLI: Error
        CLI-->>User: ✖ version already published — bump with `aitools manifest bump`
    else success
        Registry-->>RegistryClient: {name, version, integrity}
        RegistryClient-->>CLI: PublishResult
        CLI-->>User: ✔ published @scope/my-skill@1.0.0
    end
```

---

## Search flow (multi-registry)

```mermaid
sequenceDiagram
    actor User
    participant CLI
    participant ConfigManager
    participant RegistryClient_1 as RegistryClient (priority 1)
    participant RegistryClient_2 as RegistryClient (priority 2)
    participant Registry_1 as Registry A
    participant Registry_2 as Registry B

    User->>CLI: aitools search "code review"
    CLI->>ConfigManager: load config cascade
    ConfigManager-->>CLI: registries (sorted by priority)

    par query all registries concurrently
        CLI->>RegistryClient_1: search("code review")
        RegistryClient_1->>Registry_1: GET /search?q=code+review
        Registry_1-->>RegistryClient_1: SearchResult[]

    and
        CLI->>RegistryClient_2: search("code review")
        RegistryClient_2->>Registry_2: GET /search?q=code+review
        Registry_2-->>RegistryClient_2: SearchResult[]
    end

    CLI->>CLI: deduplicate by name (lower-priority duplicates removed)
    CLI-->>User: merged results table
```

---

## Config cascade load

```mermaid
sequenceDiagram
    participant CLI
    participant ConfigCascade
    participant FS

    Note over ConfigCascade: called with cwd = process.cwd()
    ConfigCascade->>ConfigCascade: resolveConfigFiles(cwd)

    loop walk up from cwd to root
        ConfigCascade->>FS: check <dir>/ai-tools.config.json
    end
    ConfigCascade->>FS: check ~/ai-tools.config.json

    ConfigCascade->>FS: read each file that exists
    Note over ConfigCascade: parse JSONC (strip comments)
    Note over ConfigCascade: validate each layer with AiToolsConfigSchema

    ConfigCascade->>ConfigCascade: merge layers (project scalars win, registries prepended)
    ConfigCascade-->>CLI: AiToolsConfig
```

---

## `compat` audit flow

```mermaid
sequenceDiagram
    actor User
    participant CLI
    participant FS
    participant PLATFORM_SPECS

    User->>CLI: aitools compat [--platform vscode]
    CLI->>FS: read ai-tools.manifest.json
    CLI->>CLI: validate with ToolManifestSchema

    alt category === "skill"
        CLI->>FS: read SKILL.md (from files[].src)
        CLI->>CLI: parse YAML frontmatter fields
    end

    loop for each TargetPlatform (or --platform arg)
        CLI->>PLATFORM_SPECS: lookup spec
        CLI->>CLI: isSpecStale(spec)?
        CLI->>CLI: cross-reference frontmatter fields against spec.skillFrontmatter
        CLI->>CLI: build FieldIssue[] list
    end

    CLI-->>User: compatibility matrix (✔ / ⚠ / ✖ / ? per platform)
```
