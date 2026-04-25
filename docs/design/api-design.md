# API Design

## Overview

The ai-tools server is built with **Fastify** and provides a RESTful API for registry operations. The API follows REST conventions and includes proper error handling, rate limiting, and authentication support.

---

## API Endpoints

### Base URL

```
https://registry.ai-tools.io/api
```

### Authentication

All endpoints require authentication when `REGISTRY_ACCESS=private`:

```http
Authorization: Bearer <token>
```

---

## Tool Endpoints

### List All Tools

```http
GET /api/tools
```

**Description**: List all available tools (latest version of each).

**Response** (200 OK):

```json
{
  "tools": [
    {
      "name": "my-python-skill",
      "version": "1.2.0",
      "description": "A Python skill for AI agents",
      "category": "skill",
      "keywords": ["python", "llm"],
      "tags": ["python", "llm"]
    }
  ]
}
```

**Authentication**: Required (private mode)

---

### Get Tool Manifest

```http
GET /api/tools/:name
```

**Description**: Get the latest version manifest for a tool.

**Response** (200 OK):

```json
{
  "name": "my-python-skill",
  "version": "1.2.0",
  "description": "A Python skill for AI agents",
  "category": "skill",
  "files": [
    {
      "src": "skill.md",
      "dest": "skill.md"
    }
  ],
  "keywords": ["python", "llm"],
  "author": "Jane Developer",
  "repository": "https://github.com/company/my-python-skill"
}
```

**Authentication**: Required (private mode)

---

### Get Tool Version

```http
GET /api/tools/:name/:version
```

**Description**: Get a specific version manifest for a tool.

**Response** (200 OK):

```json
{
  "name": "my-python-skill",
  "version": "1.2.0",
  "description": "A Python skill for AI agents",
  "category": "skill",
  "files": [
    {
      "src": "skill.md",
      "dest": "skill.md"
    }
  ]
}
```

**Authentication**: Required (private mode)

---

### Download Tool Tarball

```http
GET /api/tools/:name/:version/tarball
```

**Description**: Download the tool tarball for installation.

**Response** (200 OK):

```
Content-Type: application/gzip
Content-Disposition: attachment; filename="my-python-skill-1.2.0.tar.gz"
Content-Length: 123456
```

**Authentication**: Required (private mode)

---

### Search Tools

```http
GET /api/search?q=<query>
```

**Description**: Search tools by query string.

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | No | Search query (keywords, tags, description) |

**Response** (200 OK):

```json
{
  "results": [
    {
      "name": "my-python-skill",
      "version": "1.2.0",
      "description": "A Python skill for AI agents",
      "category": "skill",
      "keywords": ["python", "llm"],
      "tags": ["python", "llm"]
    },
    {
      "name": "my-llm-prompt",
      "version": "1.0.0",
      "description": "An LLM prompt template",
      "category": "prompt",
      "keywords": ["llm", "prompt"],
      "tags": ["llm"]
    }
  ]
}
```

**Authentication**: Required (private mode)

---

### Publish Tool

```http
POST /api/tools
```

**Description**: Publish a new tool version.

**Request Body**:

```json
{
  "manifest": {
    "name": "my-python-skill",
    "version": "1.2.0",
    "description": "A Python skill for AI agents",
    "category": "skill",
    "files": [
      {
        "src": "skill.md",
        "dest": "skill.md"
      }
    ]
  },
  "files": {
    "skill.md": "# My Python Skill\n...",
    "assets/icon.png": "<binary data>"
  }
}
```

**Response** (201 Created):

```json
{
  "name": "my-python-skill",
  "version": "1.2.0",
  "id": "uuid-1234-5678-9abc-def012345678"
}
```

**Authentication**: Required (publisher token)

---

### Update Tool Privacy

```http
PATCH /api/tools/:name
```

**Description**: Update the privacy setting for a tool.

**Request Body**:

```json
{
  "private": true
}
```

**Response** (200 OK):

```json
{
  "name": "my-python-skill",
  "private": true
}
```

**Authentication**: Required (publisher token)

---

## Registry Endpoints

### Get Registry Info

```http
GET /api/registry
```

**Description**: Get registry metadata and configuration.

**Response** (200 OK):

```json
{
  "name": "ai-tools-registry",
  "version": "0.1.0",
  "access": "private",
  "upstreams": [
    {
      "name": "public",
      "url": "https://registry.ai-tools.io"
    }
  ]
}
```

---

### Search Registry

```http
GET /api/registry/search?q=<query>
```

**Description**: Search across all upstream registries.

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | No | Search query |

**Response** (200 OK):

```json
{
  "results": [
    {
      "name": "my-python-skill",
      "version": "1.2.0",
      "source": "public",
      "url": "https://registry.ai-tools.io/api/tools/my-python-skill/1.2.0"
    }
  ]
}
```

---

## Organization Endpoints

### List Organizations

```http
GET /api/orgs
```

**Description**: List all organizations (admin only).

**Response** (200 OK):

```json
{
  "organizations": [
    {
      "name": "company",
      "tools": ["my-python-skill", "my-llm-prompt"]
    }
  ]
}
```

**Authentication**: Required (admin token)

---

### Create Organization

```http
POST /api/orgs
```

**Description**: Create a new organization (admin only).

**Request Body**:

```json
{
  "name": "company"
}
```

**Response** (201 Created):

```json
{
  "name": "company",
  "id": "org-uuid-1234"
}
```

**Authentication**: Required (admin token)

---

## Portal Endpoints

### Get Portal Dashboard

```http
GET /api/portal
```

**Description**: Get portal dashboard data (admin only).

**Response** (200 OK):

```json
{
  "stats": {
    "totalTools": 150,
    "totalVersions": 450,
    "totalDownloads": 12500
  },
  "recentActivity": [
    {
      "action": "published",
      "tool": "my-python-skill",
      "version": "1.2.0",
      "timestamp": "2026-05-14T10:30:00Z"
    }
  ]
}
```

**Authentication**: Required (admin token)

---

## Admin Endpoints

### Admin Dashboard

```http
GET /api/admin
```

**Description**: Get admin dashboard data (admin only).

**Response** (200 OK):

```json
{
  "systemHealth": {
    "status": "healthy",
    "uptime": "30d",
    "lastBackup": "2026-05-14T00:00:00Z"
  },
  "security": {
    "activeSessions": 5,
    "failedAuthAttempts": 0
  }
}
```

**Authentication**: Required (admin token)

---

## Error Responses

### Standard Error Format

```json
{
  "error": {
    "code": "ERR_XXX",
    "message": "Human-readable error message",
    "details": "Additional error details (optional)"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| ERR_UNAUTHORIZED | 401 | Authentication required or failed |
| ERR_FORBIDDEN | 403 | Insufficient permissions |
| ERR_NOT_FOUND | 404 | Resource not found |
| ERR_INVALID_REQUEST | 400 | Invalid request format |
| ERR_RATE_LIMITED | 429 | Rate limit exceeded |
| ERR_SERVER_ERROR | 500 | Internal server error |

### Rate Limiting

```http
RateLimit: 100/hour
Retry-After: 3600
```

---

## API Versioning

The API currently uses unversioned endpoints:

```
/api/tools
/api/search
/api/registry
```

Versioning will be introduced via URL path when a breaking change is required:

```
/api/v1/tools
/api/v1/search
```

Future versions will be:

```
/api/v2/tools
/api/v2/search
```

---

## Request/Response Validation

All requests are validated using **Zod** schemas:

### Publish Request Validation

```typescript
const PublishBodySchema = z.object({
  manifest: ToolManifestSchema,
  files: z.record(z.string()),
});

const result = PublishBodySchema.safeParse(requestBody);
if (!result.success) {
  // Return 400 with validation errors
  return reply.send({
    error: {
      code: 'ERR_INVALID_REQUEST',
      message: 'Request validation failed',
      details: result.error.issues
    }
  });
}
```

### Response Validation

All responses are validated to ensure consistency:

```typescript
const ResponseSchema = z.object({
  success: z.boolean(),
  data: z.any(),
  error: z.object({
    code: z.string(),
    message: z.string()
  }).nullable(),
});

const result = ResponseSchema.safeParse(response);
if (!result.success) {
  // Log and handle invalid response
  logger.error('Invalid response format');
}
```

---

## Security Considerations

### Authentication

1. **Bearer Tokens**: JWT tokens for API authentication
2. **Token Expiration**: 24-hour default expiration
3. **Token Rotation**: Automatic token refresh

### Authorization

1. **Role-Based Access Control (RBAC)**:
   - `publisher`: Can publish tools
   - `admin`: Full access to admin endpoints
   - `reader`: Read-only access (public mode)

2. **Resource Ownership**: Tools can be marked as private to specific organizations

### Input Validation

1. **Schema Validation**: All inputs validated against Zod schemas
2. **Length Limits**: Maximum file sizes and description lengths
3. **Sanitization**: All user input sanitized to prevent injection attacks

### Rate Limiting

1. **Per-User Limits**: 100 requests/hour for authenticated users
2. **Per-IP Limits**: 1000 requests/hour for anonymous users
3. **Exponential Backoff**: Automatic retry delays on rate limit

---

## Performance Optimization

### Caching Strategy

1. **Response Caching**: 5-minute cache for search results
2. **CDN Integration**: Static assets served from CDN
3. **Redis Cache**: Hot data cached in Redis

### Database Optimization

1. **Indexing**: Indexed fields for common queries
2. **Connection Pooling**: PostgreSQL connection pooling
3. **Query Optimization**: Optimized search queries with full-text search

### API Gateway

1. **Load Balancing**: Horizontal scaling with load balancer
2. **SSL Termination**: HTTPS at load balancer
3. **Request Routing**: Smart routing based on user role

---

## Monitoring and Observability

### Metrics

- **Request Rate**: Requests per second
- **Error Rate**: Percentage of failed requests
- **Latency**: P50, P95, P99 response times
- **Cache Hit Rate**: Cache effectiveness

### Logging

- **Structured Logs**: JSON-formatted logs
- **Log Levels**: DEBUG, INFO, WARN, ERROR
- **Correlation IDs**: Request tracing with correlation IDs

### Alerting

- **Error Thresholds**: Alert on >1% error rate
- **Latency Thresholds**: Alert on >1s P99 latency
- **Resource Usage**: Alert on high CPU/memory usage

---

## Deployment Considerations

### Environment Variables

```bash
# Server configuration
PORT=4873
HOST=0.0.0.0
REGISTRY_ACCESS=private

# Authentication
JWT_SECRET=<secure-random-string>
JWT_EXPIRATION=24h

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ai-tools

# Rate limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=hour

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/ai-tools/server.log
```

### Docker Deployment

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4873
CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-tools-registry
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-tools-registry
  template:
    metadata:
      labels:
        app: ai-tools-registry
    spec:
      containers:
      - name: registry
        image: ai-tools/registry:latest
        ports:
        - containerPort: 4873
        env:
        - name: PORT
          value: "4873"
        - name: REGISTRY_ACCESS
          value: "private"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

---

## Future Enhancements

1. **GraphQL API**: Alternative GraphQL endpoint for complex queries
2. **Webhooks**: Notify subscribers of tool updates
3. **API Keys**: Alternative to JWT for service accounts
4. **Pagination**: Support for large result sets
5. **Filtering**: Advanced search with filters
6. **Export**: Bulk export tools to CSV/JSON
