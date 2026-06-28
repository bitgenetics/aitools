# AITools Design Documentation Index

**Last Updated**: June 13, 2026  
**Version**: 1.1.0

---

## Welcome

This folder contains comprehensive design documentation for the **ai-tools** ecosystem. AITools is a package management system for AI-powered developer tools (skills, subagents, prompts, and MCP servers), modeled after npm but extended for AI tool ecosystems.

---

## Quick Navigation

### 📋 Overview Documents

| Document | Description | Reading Time |
|----------|-------------|--------------|
| [Executive Summary](executive-summary.md) | High-level overview for stakeholders | 5 min |
| [README](README.md) | Documentation index and quick reference | 10 min |

### 🏗️ Architecture Documents

| Document | Description | Reading Time |
|----------|-------------|--------------|
| [System Architecture](system-architecture.md) | Package structure, runtime topology, data flow | 15 min |
| [Architecture](architecture.md) | Package internals and config cascade (detailed diagrams) | 10 min |
| [Data Model](data-model.md) | Data structures, schemas, storage layout | 20 min |
| [API Design](api-design.md) | REST API endpoints, authentication, security | 25 min |
| [Platform Adapter](platform-adapter.md) | Platform path resolution and compat auditing | 15 min |
| [Key Flows](flows.md) | Sequence diagrams for install, publish, search | 15 min |
| [Deployment Design](deployment-design.md) | Deployment strategies, Kubernetes, operations | 30 min |

### 🛠️ Implementation Documents

| Document | Description | Reading Time |
|----------|-------------|--------------|
| [Implementation Guide](IMPLEMENTATION-GUIDE.md) | Development patterns, conventions, best practices | 25 min |

---

## Document Summary

### Executive Summary

**Purpose**: Provide a high-level overview for stakeholders and decision-makers.

**Key Topics**:
- Design principles
- Core components
- Supported platforms
- Security model
- Performance metrics
- Future roadmap

**Audience**: Executives, product managers, stakeholders

---

### System Architecture

**Purpose**: Understand the overall structure and components of the AITools ecosystem.

**Key Topics**:
- Package dependency graph
- Runtime topology
- Configuration cascade
- Platform adapter pattern
- Security considerations
- Performance characteristics

**Architecture Highlights**:
```
packages/
├── @bitgenetics/aitools-core/      # Library (types, schemas, utilities)
├── @bitgenetics/aitools-cli/       # CLI binary (aitools)
├── @bitgenetics/aitools-server/    # Registry API server
└── @bitgenetics/aitools-e2e/       # Docker-based E2E tests
```

**Audience**: Architects, developers, system designers

---

### Data Model

**Purpose**: Understand the data structures, schemas, and relationships.

**Key Topics**:
- Tool manifest structure
- Installed tool and lock file
- Configuration and registry settings
- Platform specifications
- Database schema (PostgreSQL)
- File system structure
- Versioning strategy

**Data Structures**:
- `ToolManifest` - Package description
- `ToolFile` - File entry
- `InstalledTool` - Installation record
- `AiToolsConfig` - Configuration
- `PlatformSpec` - Platform definition

**Audience**: Backend developers, database administrators

---

### API Design

**Purpose**: Understand the REST API endpoints and usage patterns.

**Key Topics**:
- Tool endpoints (list, get, search, publish)
- Registry endpoints
- Organization and portal endpoints
- Error responses and codes
- Rate limiting and validation
- Security considerations
- Performance optimization

**API Endpoints**:
- `GET /api/tools` - List all tools
- `GET /api/tools/:name` - Get tool manifest
- `GET /api/search?q=<query>` - Search tools
- `POST /api/tools` - Publish tool

**Audience**: API consumers, frontend developers, integrators

---

### Deployment Design

**Purpose**: Understand deployment strategies and operational procedures.

**Key Topics**:
- Single registry deployment
- Chained registry deployment
- Production Kubernetes deployment
- Local development deployment
- Security best practices
- Monitoring and observability
- Backup and recovery
- Scaling strategies

**Deployment Options**:
- Docker Compose (local/development)
- Kubernetes (production)
- Chained registries (multi-registry)
- Load balancing (horizontal scaling)

**Audience**: DevOps engineers, SREs, platform engineers

---

### Implementation Guide

**Purpose**: Provide practical development guidance and best practices.

**Key Topics**:
- Project structure
- Code organization
- Development workflow
- Testing guidelines
- Build & deployment
- Common patterns
- API development
- CLI development
- TypeScript best practices

**Development Patterns**:
- Config cascade pattern
- Platform adapter pattern
- Schema validation pattern
- Error handling pattern
- File system operations

**Audience**: Developers, contributors

---

## Getting Started

### For New Contributors

1. **Read the Implementation Guide** - Understand development patterns and conventions
2. **Set up Development Environment** - Follow the setup instructions
3. **Review Existing Code** - Examine well-tested modules
4. **Start Small** - Begin with simple fixes or additions

### For API Consumers

1. **Read the API Design** - Understand available endpoints
2. **Review Examples** - Check the examples section
3. **Test Locally** - Use the test endpoints
4. **Monitor Rate Limits** - Respect rate limiting

### For DevOps Engineers

1. **Read the Deployment Design** - Understand deployment options
2. **Choose Deployment Strategy** - Select appropriate deployment method
3. **Follow Security Best Practices** - Implement security measures
4. **Set Up Monitoring** - Configure observability

---

## Quick Reference

### Package Structure

```
ai-tools/
├── packages/
│   ├── @bitgenetics/aitools-core/      # Library
│   ├── @bitgenetics/aitools-cli/       # CLI
│   └── @bitgenetics/aitools-server/    # Server
└── docs/design/             # This folder
```

### Key Commands

```bash
# Install a tool
aitools install my-skill@1.2.0

# Search for tools
aitools search "python skill"

# Publish a tool
aitools publish --manifest aitools.manifest.json

# List installed tools
aitools list
```

### Registry Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tools` | List all tools |
| GET | `/api/tools/:name` | Get tool manifest |
| GET | `/api/search?q=<query>` | Search tools |
| GET | `/api/search/all` | Cross-registry search with pagination |
| POST | `/api/tools` | Publish tool |
| GET | `/health` | Health check |

### Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| `aitools.json` | Project dependencies | Project root |
| `aitools.config.json` | Registry and platform config | Project root |
| `aitools-lock.json` | Installation records | Project root |

---

## Design Decisions

### Key Design Principles

1. **npm-Like Familiarity**: Leverages well-understood npm patterns
2. **Platform Agnostic**: Single manifest works across all platforms
3. **Type-Safe**: Full TypeScript support with Zod validation
4. **Secure**: Comprehensive authentication and authorization
5. **Scalable**: Designed for both local and production use
6. **Extensible**: Modular architecture for future growth

### Important Decisions

- **Manifest-Based**: JSON manifests for version control
- **Config Cascade**: Project → home configuration merge
- **Platform Adapter**: Platform-specific path resolution
- **REST API**: Standard REST endpoints for registry
- **Filesystem Storage**: Tool data via `IStorageProvider` (local by default)
- **Bearer Auth**: Static or database-backed tokens (not JWT)
- **Rate Limiting**: Per-route limits on publish and auth

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | June 13, 2026 | Aligned docs with implemented API, storage, auth, and CLI |
| 1.0.0 | May 14, 2026 | Initial design documentation |

---

## Related Documentation

- [Deployment Guide](../deployment.md) - Production deployment steps
- [Operations Guide](../operations.md) - Operational procedures
- [Architecture Design](../design/architecture.md) - Original architecture decisions
- [Data Model Design](../design/data-model.md) - Original data model
- [Platform Adapter](../design/platform-adapter.md) - Platform integration details

---

## Feedback

If you have feedback or suggestions for improving this documentation:

1. **File an Issue**: Open a GitHub issue in the main repository
2. **Submit a PR**: Create a pull request with your changes
3. **Contact**: Reach out to the maintainers directly

---

## Glossary

| Term | Definition |
|------|------------|
| **Tool** | AI-powered developer tool (skill, subagent, prompt, MCP server) |
| **Manifest** | JSON file describing a tool package |
| **Registry** | Server that stores and serves tool packages |
| **CLI** | Command-line interface for managing tools |
| **Platform** | Target IDE or agent (VS Code, Claude, Cursor, etc.) |
| **Scope** | Installation scope (project or user) |
| **Cascade** | Configuration merge pattern (project → home) |

---

## License

This documentation is licensed under the same license as the AITools project.

---

**Document Status**: ✅ Current  
**Review Status**: Reviewed June 2026  
**Next Review**: Q4 2026
