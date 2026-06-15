# Implementation Guide

## Overview

This guide provides practical implementation details for developers working on the ai-tools ecosystem. It covers code structure, patterns, conventions, and best practices.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Code Organization](#code-organization)
3. [Development Workflow](#development-workflow)
4. [Testing Guidelines](#testing-guidelines)
5. [Build & Deployment](#build--deployment)
6. [Common Patterns](#common-patterns)
7. [API Development](#api-development)
8. [CLI Development](#cli-development)
9. [TypeScript Best Practices](#typescript-best-practices)

---

## Project Structure

### Monorepo Layout

```
ai-tools/
├── packages/
│   ├── @ai-tools/core/          # Library (types, schemas, utilities)
│   │   ├── src/
│   │   │   ├── types/           # TypeScript type definitions
│   │   │   ├── schema/          # Zod validation schemas
│   │   │   ├── config/          # Configuration utilities
│   │   │   ├── lock/            # Lock file utilities
│   │   │   ├── manifest/        # Manifest utilities
│   │   │   ├── platforms/       # Platform specifications
│   │   │   └── index.ts         # Public API exports
│   │   ├── jest.config.cjs
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── @ai-tools/cli/           # CLI binary
│   │   ├── src/
│   │   │   ├── cli.ts           # CLI entry point
│   │   │   ├── index.ts         # Public API exports
│   │   │   ├── commands/        # Command implementations
│   │   │   │   ├── init.ts
│   │   │   │   ├── install.ts
│   │   │   │   ├── publish.ts
│   │   │   │   └── ...
│   │   │   ├── adapters/        # Platform adapters
│   │   │   ├── utils/           # Utility functions
│   │   │   └── ...
│   │   ├── jest.config.cjs
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── @ai-tools/server/        # Registry server
│       ├── src/
│       │   ├── app.ts           # Application builder
│       │   ├── index.ts         # Entry point
│       │   ├── routes/          # API route handlers
│       │   │   ├── tools.ts
│       │   │   ├── registry.ts
│       │   │   ├── auth.ts
│       │   │   └── ...
│       │   ├── storage/         # ToolStore, OrgStore, UserStore
│       │   ├── providers/       # IStorageProvider, IAuthProvider
│       │   ├── db/              # PostgreSQL migrations (auth only)
│       │   └── ...
│       ├── jest.config.cjs
│       ├── package.json
│       └── tsconfig.json
│
│   └── @ai-tools/e2e/           # Docker-based end-to-end tests
│
├── sandbox/                     # Testing sandbox
└── docs/
    └── design/                  # Design documentation
```

**CLI binary name**: `aitools` (defined in `packages/cli/package.json`)

**CLI commands**: `init`, `dev-init`, `install`, `uninstall`, `update`, `search`, `find`, `list`, `registry`, `publish`, `manifest` (init/validate/bump/update), `config` (list/get/set/unset/edit), `compat`

---

## Code Organization

### Package Structure

Each package follows a consistent structure:

```typescript
// src/
├── types/                    # TypeScript type definitions
├── schema/                   # Zod validation schemas
├── config/                   # Configuration utilities
├── utils/                    # Utility functions
├── adapters/                 # Platform adapters (cli only)
├── commands/                 # CLI commands (cli only)
├── routes/                   # API routes (server only)
└── index.ts                  # Public API exports
```

### File Naming Conventions

- **Type definitions**: `.ts` files with `types/` prefix
- **Schemas**: `.ts` files with `schema/` prefix
- **Utilities**: `.ts` files with `utils/` prefix
- **Commands**: `.ts` files with `commands/` prefix
- **Routes**: `.ts` files with `routes/` prefix
- **Tests**: `.test.ts` files alongside source files

### Directory Naming

- **Lowercase with hyphens**: `my-tool`, `my-tool-name`
- **CamelCase for internal**: `myToolName`, `myToolNameHandler`
- **Consistent spacing**: Single spaces between words

---

## Development Workflow

### 1. Setup Development Environment

```bash
# Clone repository
git clone https://github.com/your-org/ai-tools.git
cd ai-tools

# Install dependencies
npm install

# Start development mode
npm run dev

# Or build and run
npm run build
npm run dev
```

### 2. Make Changes

```bash
# Edit source files
vi packages/core/src/types/tool.ts

# Edit CLI commands
vi packages/cli/src/commands/install.ts

# Edit server routes
vi packages/server/src/routes/tools.ts
```

### 3. Test Changes

```bash
# Run tests for specific package
npm test -w @ai-tools/core

# Run tests for CLI
npm test -w @ai-tools/cli

# Run tests for server
npm test -w @ai-tools/server

# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage
```

### 4. Build Changes

```bash
# Build specific package
npm run build -w @ai-tools/core

# Build all packages
npm run build

# Clean build artifacts
npm run clean
```

### 5. Commit Changes

```bash
# Check status
git status

# Stage changes
git add .

# Commit with message
git commit -m "feat: add new tool category"

# Push to repository
git push origin main
```

---

## Testing Guidelines

### Test File Naming

```typescript
// src/foo.ts              →   src/foo.test.ts
// src/bar.ts               →   src/bar.test.ts
// src/baz.ts               →   src/baz.test.ts
```

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { yourModule } from './your-module';

describe('YourModule', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('YourFunction', () => {
    it('should do something', () => {
      // Test case
      expect(yourModule.yourFunction()).toBe(expected);
    });

    it('should handle error case', () => {
      // Error test case
      expect(() => yourModule.yourFunction()).toThrow(expectedError);
    });
  });
});
```

### Test Quality Rules

1. **One behavior per test**: Each `it` block tests one specific behavior
2. **Descriptive test names**: "returns null when config file is missing"
3. **No `any` casts**: Fix TypeScript types instead of casting
4. **No `// @ts-ignore`**: Fix source code types
5. **Use fake timers**: `jest.useFakeTimers()` for time-dependent tests
6. **Use temp directories**: `os.tmpdir()` for file system tests

### Test Coverage Targets

- **@ai-tools/core**: ≥ 80%
- **@ai-tools/cli**: ≥ 80%
- **@ai-tools/server**: Integration tests via Fastify `inject()`

### Running Tests

```bash
# Run all workspaces
npm test

# Run single package
npm test -w @ai-tools/core

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test packages/core/src/types/tool.test.ts

# Run tests in watch mode
npm run dev
```

### Test Examples

#### Example 1: Config Cascade Tests

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConfigCascade } from '@ai-tools/core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('ConfigCascade', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  describe('load()', () => {
    it('merges project config over home config', () => {
      // Create a nested project dir so the cascade walks up to homeDir
      const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-home-'));
      const projectDir = path.join(tempDir, 'project');
      fs.mkdirSync(projectDir);

      const projectConfig = {
        registries: [{ name: 'project', url: 'http://project.registry', priority: 1 }],
        platform: 'vscode',
      };
      const homeConfig = {
        registries: [{ name: 'home', url: 'http://home.registry', priority: 2 }],
      };

      fs.writeFileSync(
        path.join(projectDir, 'ai-tools.config.json'),
        JSON.stringify(projectConfig),
      );
      fs.writeFileSync(
        path.join(homeDir, 'ai-tools.config.json'),
        JSON.stringify(homeConfig),
      );

      const config = ConfigCascade.merge([
        ConfigCascade.readFile(path.join(homeDir, 'ai-tools.config.json'))!,
        ConfigCascade.readFile(path.join(projectDir, 'ai-tools.config.json'))!,
      ]);

      expect(config.platform).toBe('vscode');
      expect(config.registries![0].name).toBe('project');

      fs.rmSync(homeDir, { recursive: true });
    });

    it('strips JSON comments correctly', () => {
      const jsonc = `{
        // This is a comment
        "registries": [
          /* Block comment */
          { "name": "test" }
        ]
      }`;

      const stripped = ConfigCascade.stripComments(jsonc);
      expect(stripped).not.toContain('//');
      expect(stripped).not.toContain('/*');
    });
  });
});
```

#### Example 2: Platform Adapter Tests

```typescript
import { describe, it, expect } from '@jest/globals';
import { getAdapter } from '../adapters/index.js'; // from @ai-tools/cli

describe('getAdapter()', () => {
  it('returns an adapter for every supported platform', () => {
    const platforms = ['universal', 'vscode', 'cursor', 'claude', 'windsurf'] as const;
    for (const platform of platforms) {
      const adapter = getAdapter(platform);
      expect(adapter.platform).toBe(platform);
      expect(typeof adapter.resolveDir).toBe('function');
      expect(typeof adapter.resolveMcpConfig).toBe('function');
    }
  });

  it('resolves vscode project skill path relative to cwd', () => {
    const adapter = getAdapter('vscode');
    const result = adapter.resolveDir('skill', 'project', '/tmp/project');
    expect(result).toBe('/tmp/project/.agents/skills');
  });
});
```

#### Example 3: Lock File Tests

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readLockFile, writeLockFile, upsertLockEntry, LOCK_FILENAME } from '@ai-tools/core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('lock file utilities', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-tools-lock-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  it('returns empty lock when file does not exist', () => {
    const lock = readLockFile(tempDir);
    expect(lock.lockfileVersion).toBe(1);
    expect(lock.tools).toEqual({});
  });

  it('round-trips a lock entry', () => {
    const entry = {
      version: '1.0.0',
      resolved: 'http://registry/test-skill/1.0.0/tarball',
      integrity: 'sha256-abc123',
      files: ['skill.md'],
      installedAt: new Date().toISOString(),
    };

    upsertLockEntry(tempDir, 'test-skill', entry);
    const lock = readLockFile(tempDir);

    expect(lock.tools['test-skill']).toEqual(entry);
  });

  it('writes lock file to expected path', () => {
    writeLockFile(tempDir, { lockfileVersion: 1, tools: {} });
    expect(fs.existsSync(path.join(tempDir, LOCK_FILENAME))).toBe(true);
  });
});
```

#### Example 4: Registry Client Tests

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import nock from 'nock';
import { RegistryClient } from '@ai-tools/cli';

describe('RegistryClient', () => {
  let client: RegistryClient;

  beforeEach(() => {
    client = new RegistryClient('http://localhost:4873');
  });

  it('fetches tool manifest from registry', async () => {
    const scope = nock('http://localhost:4873')
      .get('/api/tools/test-skill')
      .reply(200, {
        name: 'test-skill',
        version: '1.0.0',
        description: 'Test skill',
        category: 'skill',
        files: [{ src: 'skill.md', dest: 'skill.md' }],
      });

    const manifest = await client.getManifest('test-skill', '1.0.0');
    expect(manifest.name).toBe('test-skill');
    expect(manifest.version).toBe('1.0.0');

    scope.done();
  });

  it('handles 404 errors', async () => {
    const scope = nock('http://localhost:4873')
      .get('/api/tools/nonexistent')
      .reply(404, { error: { code: 'ERR_NOT_FOUND', message: 'Not found' } });

    await expect(client.getManifest('nonexistent', '1.0.0')).rejects.toThrow();
    scope.done();
  });
});
```

---

## Build & Deployment

```bash
# Run all workspaces
npm test

# Run single package
npm test -w @ai-tools/core

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test packages/core/src/types/tool.test.ts

# Run tests in watch mode
npm run dev
```

---

## Build & Deployment

### Build Commands

```bash
# Build all packages
npm run build

# Build specific package
npm run build -w @ai-tools/core

# Build in watch mode
npm run dev

# Clean build artifacts
npm run clean

# Clean all packages
npm run clean -w @ai-tools/core
npm run clean -w @ai-tools/cli
npm run clean -w @ai-tools/server
```

### Deployment

#### Docker Build

```bash
# Build Docker image
docker build -t ai-tools/registry:latest .

# Build with tags
docker build -t ai-tools/registry:latest -t ai-tools/registry:0.1.0 .
```

#### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/registry-deployment.yaml

# Scale deployment
kubectl scale deployment ai-tools-registry --replicas=3

# View logs
kubectl logs -f deployment/ai-tools-registry
```

#### Docker Compose Deployment

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Start production environment
docker-compose up -d

# Stop environment
docker-compose down -v
```

---

## Common Patterns

### 1. Config Cascade Pattern

```typescript
import { ConfigCascade } from '@ai-tools/core';

// Load configuration from cascade
const config = ConfigCascade.load(cwd);

// Access configuration
const platform = config.platform;
const registries = config.registries;
```

### 2. Platform Adapter Pattern

```typescript
import { getAdapter } from '../adapters/index.js';

// Get adapter for platform
const adapter = getAdapter(platform);

// Use adapter methods
const installPath = adapter.resolveDir(category, scope, cwd);
```

### 3. Schema Validation Pattern

```typescript
import { ToolManifestSchema } from '@ai-tools/core';

// Validate manifest
const result = ToolManifestSchema.safeParse(raw);
if (!result.success) {
  // Report validation errors
  for (const issue of result.error.issues) {
    console.error(`${issue.path.join('.')}: ${issue.message}`);
  }
}
```

### 4. Error Handling Pattern

```typescript
try {
  // Operation
  const result = await someAsyncOperation();
} catch (error) {
  // Handle error
  if (error instanceof ValidationError) {
    // Validation error
    return reply.send({
      error: {
        code: 'ERR_VALIDATION',
        message: error.message
      }
    });
  }
  // Other errors
  throw error;
}
```

### 5. File System Operations

```typescript
import fs from 'node:fs';
import path from 'node:path';

// Read file
const content = fs.readFileSync(filePath, 'utf8');

// Write file atomically
const tmpPath = `${filePath}.tmp`;
fs.writeFileSync(tmpPath, content, 'utf8');
fs.renameSync(tmpPath, filePath);

// Check if file exists
if (fs.existsSync(filePath)) {
  // File exists
}
```

### 6. Cache Management

```typescript
import { CacheManager } from './cache-manager.js';

// Create cache manager
const cache = new CacheManager();

// Check if cached
if (cache.has(name, version)) {
  // Use cached data
} else {
  // Download and cache
  const data = await download();
  cache.store(name, version, data, manifest, integrity);
}
```

---

## API Development

### Creating New Routes

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function registerNewRoutes(fastify: FastifyInstance) {
  // Define schema
  const NewRouteSchema = z.object({
    field1: z.string(),
    field2: z.number(),
  });

  // Register route
  fastify.post('/api/new-endpoint', async (req, reply) => {
    // Validate request
    const result = NewRouteSchema.safeParse(req.body);
    if (!result.success) {
      return reply.status(400).send({
        error: {
          code: 'ERR_INVALID_REQUEST',
          message: 'Invalid request body',
          details: result.error.issues
        }
      });
    }

    // Process request
    const data = await processRequest(result.data);

    // Return response
    return reply.send({
      success: true,
      data
    });
  });
}
```

### Authentication Middleware

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';

async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    await reply.status(401).send({
      error: {
        code: 'ERR_UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
    return;
  }
  
  const token = authHeader.substring(7);
  const decoded = await jwt.verify(token, process.env.JWT_SECRET!);
  
  req.user = decoded;
}
```

### Rate Limiting

```typescript
import rateLimit from '@fastify/rate-limit';

// Register rate limiter
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: 60 * 60 * 1000, // 1 hour
});
```

---

## CLI Development

### Creating New Commands

```typescript
import { Command } from 'commander';

export function createNewCommand(): Command {
  return new Command('new-command')
    .description('Description of the new command')
    .option('--option <value>', 'Option description')
    .action((options) => {
      // Command logic
      console.log('New command executed');
    });
}
```

### Registering Commands

```typescript
import { Command } from 'commander';

const program = new Command();

program
  .name('aitools')
  .description('Package manager for ai-tools')
  .version('0.1.0');

program.addCommand(createNewCommand());

program.parseAsync(process.argv).catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
```

### Using ConfigManager

```typescript
import { ConfigManager } from '../utils/config-manager.js';

const configManager = new ConfigManager(cwd);

// Get configuration
const config = configManager.get();
const platform = configManager.getPlatform();
const scope = configManager.getDefaultScope();

// Resolve install path
const installPath = configManager.resolveInstallPath(category, scope);
```

---

## TypeScript Best Practices

### Type Definitions

```typescript
// Use interfaces for object shapes
interface ToolManifest {
  name: string;
  version: string;
  description: string;
}

// Use types for unions
type ToolCategory = 'skill' | 'subagent' | 'prompt' | 'mcp-tool';

// Use const for constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
```

### Generic Functions

```typescript
// Use generics for reusable functions
function process<T>(data: T): T {
  return data;
}
```

### Error Types

```typescript
// Define custom error types
export class ValidationError extends Error {
  constructor(public message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(public message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
```

### Optional Parameters

```typescript
// Use ? for optional parameters
function optionalParam(param?: string): void {}

// Use | undefined for nullable values
function nullableParam(param: string | undefined): void {}
```

### Type Guards

```typescript
// Use type guards for type narrowing
function isToolManifest(obj: unknown): obj is ToolManifest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    'version' in obj
  );
}
```

---

## Code Review Checklist

### Before Submitting PR

- [ ] All tests pass
- [ ] Code coverage ≥ 80%
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Commit message follows convention
- [ ] Changes are well-documented
- [ ] PR description explains changes
- [ ] Tests cover new functionality

### Code Quality

- [ ] Types are explicit (no `any`)
- [ ] Functions are small and focused
- [ ] Error handling is comprehensive
- [ ] Logging is appropriate
- [ ] Code follows project conventions
- [ ] Comments explain why, not what

---

## Troubleshooting

### Common Issues

#### 1. TypeScript Errors

```bash
# Check TypeScript configuration
npm run build

# Fix errors
tsc --noEmit
```

#### 2. Test Failures

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test
npm test packages/core/src/types/tool.test.ts -t "should validate name"
```

#### 3. Build Failures

```bash
# Clean and rebuild
npm run clean
npm run build

# Check for dependency issues
npm install
```

---

## Resources

### Documentation

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Fastify Documentation](https://www.fastify.io/docs/)
- [Jest Documentation](https://jestjs.io/docs/)
- [Commander.js Documentation](https://www.npmjs.com/package/commander)
- [Zod Documentation](https://zod.dev/)

### Tools

- **Linting**: ESLint
- **Formatting**: Prettier
- **Testing**: Jest
- **Type Checking**: TypeScript
- **Code Quality**: TypeScript, ESLint

---

## Contributing

### Getting Started

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests
5. Submit a pull request

### Code of Conduct

- Be respectful
- Be constructive
- Be helpful
- Follow the project's guidelines

---

**Last Updated**: May 14, 2026  
**Version**: 1.0.0
