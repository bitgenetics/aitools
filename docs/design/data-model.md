# Data Model

All core types are defined in `packages/core/src/types/`. Zod schemas in
`packages/core/src/schema/` validate the same shapes at runtime boundaries
(manifest files, registry API payloads, config files).

---

## Tool manifest

The central type. Published to the registry and downloaded by the installer.

```mermaid
classDiagram
    class ToolManifest {
        +string name
        +string version
        +string description
        +ToolCategory category
        +ToolFile[] files
        +McpServerConfig mcpServer
        +string[] keywords
        +string author
        +string repository
        +Record~string,string~ dependencies
        +string[] tags
        +TargetPlatform[] platforms
        +boolean private
    }

    class ToolFile {
        +string src
        +string dest
        +boolean template
        +TargetPlatform platform
    }

    class McpServerConfig {
        +string command
        +string[] args
        +Record~string,string~ env
        +string url
        +string type
    }

    class ToolCategory {
        <<enumeration>>
        skill
        subagent
        prompt
        mcp-tool
        plugin
    }

    ToolManifest "1" *-- "1..*" ToolFile : files
    ToolManifest "0..1" *-- "0..1" McpServerConfig : mcpServer
    ToolManifest --> ToolCategory : category
```

---

## Installed tool and lock file

The lock file pins exact resolved versions for reproducible installs.
Analogous to `package-lock.json`.

```mermaid
classDiagram
    class AiToolsLock {
        +int lockfileVersion
        +Record~string,LockEntry~ tools
    }

    class LockEntry {
        +string version
        +string resolved
        +string integrity
        +string[] files
        +string installedAt
        +TargetPlatform platform
        +ToolCategory category
        +InstallScope scope
    }

    class InstalledTool {
        +string name
        +string version
        +ToolCategory category
        +InstallScope scope
        +TargetPlatform platform
        +string installedAt
        +string[] files
        +string registry
        +string integrity
    }

    class InstallScope {
        <<enumeration>>
        project
        user
    }

    AiToolsLock "1" *-- "0..*" LockEntry : tools
    InstalledTool --> ToolCategory
    InstalledTool --> InstallScope
```

`InstalledTool` is the in-memory representation used during an install operation.
`LockEntry` is the persisted form written to `aitools-lock.json`.
`toLockEntry(tool, resolved)` converts between them.

---

## Configuration

```mermaid
classDiagram
    class AiToolsConfig {
        +RegistryConfig[] registries
        +InstallScope defaultScope
        +TargetPlatform platform
        +Record~string,string~ installPaths
    }

    class RegistryConfig {
        +string name
        +string url
        +int priority
        +RegistryAuth auth
    }

    class RegistryAuth {
        +bearer|basic type
        +string token
        +string username
        +string password
    }

    class AiToolsManifest {
        +string name
        +Record~string,string~ tools
        +Record~string,string~ devTools
        +RegistryConfig[] registries
    }

    class TargetPlatform {
        <<enumeration>>
        universal
        vscode
        claude
        cursor
        windsurf
    }

    AiToolsConfig "1" *-- "0..*" RegistryConfig : registries
    RegistryConfig "1" *-- "0..1" RegistryAuth : auth
    AiToolsConfig --> TargetPlatform : platform
    AiToolsManifest "1" *-- "0..*" RegistryConfig : registries
```

`AiToolsConfig` is the merged result of all `aitools.config.json` files on disk.
`AiToolsManifest` is `aitools.json` — the project-level tool dependency list.
`installPaths` keys use the format `"<scope>.<category>"`, e.g. `"project.skill"`.

---

## Platform spec

Used by the `compat` command to audit SKILL.md frontmatter compatibility and
to document install paths per platform.

```mermaid
classDiagram
    class PlatformSpec {
        +TargetPlatform id
        +string name
        +string docsUrl
        +string lastVerified
        +ToolCategory[] supportedCategories
        +Record~string,SkillFieldSpec~ skillFrontmatter
        +InstallPaths installPaths
    }

    class SkillFieldSpec {
        +boolean required
        +FieldSupport support
        +boolean platformExtension
        +string note
    }

    class FieldSupport {
        <<enumeration>>
        supported
        ignored
        unsupported
        unknown
    }

    class InstallPaths {
        +InstallPathSpec skill
        +InstallPathSpec subagent
        +InstallPathSpec prompt
        +InstallPathSpec mcpConfig
    }

    class InstallPathSpec {
        +string project
        +string user
    }

    PlatformSpec "1" *-- "0..*" SkillFieldSpec : skillFrontmatter
    PlatformSpec "1" *-- "1" InstallPaths : installPaths
    SkillFieldSpec --> FieldSupport : support
    InstallPaths *-- InstallPathSpec
    PlatformSpec --> TargetPlatform : id
```

`lastVerified` is an ISO-8601 date. The `compat` command treats specs older than
90 days (`SPEC_STALE_DAYS`) as unverified and emits a warning.

---

## Server storage

Tool data is persisted via `IStorageProvider` (default: `LocalStorageProvider`). PostgreSQL is **not** used for tool storage — it is only used for user/auth when `DATABASE_URL` is configured.

```mermaid
classDiagram
    class IStorageProvider {
        <<interface>>
        +read(path) string
        +write(path, content) void
        +list(prefix) string[]
        +delete(path) void
    }

    class ToolStore {
        -IStorageProvider storage
        +publish(manifest, files, publisher) void
        +get(name, version) StoredTool
        +listVersions(name) string[]
        +search(query) ToolManifest[]
        +getOwner(name) OwnerRecord
        +deprecate(name, version) void
        +unpublish(name, version) void
        +setPrivacy(name, private, publisher) void
        +buildTarball(name, version) Buffer
    }

    class OrgStore {
        -IStorageProvider storage
        +createOrg(name, actor) Org
        +listOrgs() Org[]
        +addMember(org, userId, actor) Org
        +getAuditLog(org) AuditEntry[]
    }

    class StoredTool {
        +ToolManifest manifest
        +Record~string,string~ files
        +string publishedAt
    }

    IStorageProvider <|.. LocalStorageProvider
    ToolStore --> IStorageProvider
    OrgStore --> IStorageProvider
    ToolStore --> StoredTool : returns
    StoredTool *-- ToolManifest
```

### On-disk layout

```
dataDir/
├── orgs.json
├── audit-log.jsonl
└── <sanitized-name>/
    ├── owner.json
    └── <version>/
        ├── manifest.json
        ├── files.json
        └── deprecated.json   (optional)
```

`files.json` is a `Record<string, string>` mapping source paths to file contents.
Tarballs are synthesised on-the-fly when `GET /api/tools/:name/:version/tarball` is called as a JSON array of `{ path, content }` objects.

---

## Type relationship overview

```mermaid
erDiagram
    TOOL_MANIFEST {
        string name PK
        string version PK
        string category
        string description
    }
    TOOL_FILE {
        string src
        string dest
        boolean template
    }
    MCP_SERVER_CONFIG {
        string command
        string url
        string type
    }
    LOCK_ENTRY {
        string name
        string version
        string resolved
        string integrity
        string installedAt
    }
    REGISTRY_CONFIG {
        string name PK
        string url
        int priority
    }
    PLATFORM_SPEC {
        string id PK
        string name
        string lastVerified
    }
    SKILL_FIELD_SPEC {
        string field PK
        string support
        boolean platformExtension
    }

    TOOL_MANIFEST ||--|{ TOOL_FILE : "contains"
    TOOL_MANIFEST ||--o| MCP_SERVER_CONFIG : "has"
    TOOL_MANIFEST ||--o{ LOCK_ENTRY : "resolved as"
    PLATFORM_SPEC ||--|{ SKILL_FIELD_SPEC : "defines"
    REGISTRY_CONFIG ||--o{ TOOL_MANIFEST : "serves"
```

---

## PostgreSQL (auth only)

When `DATABASE_URL` is set and user management is enabled, PostgreSQL stores users and API tokens via `UserStore`. Tool manifests and files remain on the filesystem (or future cloud storage provider).

Migrations live in `packages/server/src/db/migrations/`. Org metadata and audit logs are stored in `orgs.json` and `audit-log.jsonl` on the storage provider, not in PostgreSQL.

---
