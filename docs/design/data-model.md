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
    }

    class ToolFile {
        +string src
        +string dest
        +boolean template
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
    }

    class InstalledTool {
        +string name
        +string version
        +ToolCategory category
        +InstallScope scope
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
`LockEntry` is the persisted form written to `ai-tools-lock.json`.
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
        +string type
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

`AiToolsConfig` is the merged result of all `ai-tools.config.json` files on disk.
`AiToolsManifest` is `ai-tools.json` — the project-level tool dependency list.
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

```mermaid
classDiagram
    class ToolStore {
        -string dataDir
        +publish(manifest, files) void
        +get(name, version) StoredTool
        +listVersions(name) string[]
        +search(query) ToolManifest[]
        +listAll() ToolManifest[]
    }

    class StoredTool {
        +ToolManifest manifest
        +Record~string,string~ files
        +string publishedAt
    }

    ToolStore --> StoredTool : returns
    StoredTool *-- ToolManifest
```

The on-disk layout mirrors `npm`'s local cache:

```
dataDir/
└── <sanitized-name>/
    └── <version>/
        ├── manifest.json
        └── files.json
```

`files.json` is a `Record<string, string>` mapping source paths to file contents.
Tarballs are synthesised on-the-fly when `GET /tools/:name/:version/tarball` is called.

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

## PostgreSQL Database Schema

The registry server uses PostgreSQL for persistent storage. The schema includes:

### Tables

```sql
-- Tools registry — composite PK because each (name, version) is a distinct record
CREATE TABLE tools (
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (name, version)
);

-- Tool manifests (JSONB for flexibility)
CREATE TABLE tool_manifests (
    tool_name TEXT NOT NULL,
    tool_version TEXT NOT NULL,
    manifest JSONB NOT NULL,
    PRIMARY KEY (tool_name, tool_version),
    FOREIGN KEY (tool_name, tool_version) REFERENCES tools(name, version)
);

-- Tool files
CREATE TABLE tool_files (
    tool_name TEXT NOT NULL,
    tool_version TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_content TEXT NOT NULL,
    PRIMARY KEY (tool_name, tool_version, file_path),
    FOREIGN KEY (tool_name, tool_version) REFERENCES tools(name, version)
);

-- Registry configurations
CREATE TABLE registries (
    name TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    priority INTEGER NOT NULL,
    access_mode TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users and authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    resource TEXT,
    details JSONB,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_tools_name ON tools(name);
CREATE INDEX idx_tools_category ON tools(category);
CREATE INDEX idx_tool_manifests_name ON tool_manifests(tool_name);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
```

### Views

```sql
-- Latest version of each tool
CREATE VIEW latest_tools AS
SELECT name, version, description, published_at
FROM tools
WHERE (name, version) IN (
    SELECT name, MAX(version)
    FROM tools
    GROUP BY name
);

-- Tool statistics
CREATE VIEW tool_stats AS
SELECT 
    t.name,
    COUNT(DISTINCT t.version) as version_count,
    SUM(CASE WHEN t.category = 'skill' THEN 1 ELSE 0 END) as skill_count,
    SUM(CASE WHEN t.category = 'subagent' THEN 1 ELSE 0 END) as subagent_count,
    SUM(CASE WHEN t.category = 'prompt' THEN 1 ELSE 0 END) as prompt_count,
    SUM(CASE WHEN t.category = 'mcp-tool' THEN 1 ELSE 0 END) as mcp_count
FROM tools t
GROUP BY t.name;
```

---
