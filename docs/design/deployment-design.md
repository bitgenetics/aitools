# Deployment Design

## Overview

The AITools ecosystem supports multiple deployment scenarios:

1. **Local dev registry**: Docker Compose with optional PostgreSQL for auth
2. **E2E test registry**: Ephemeral registry via `docker-compose.e2e.yml`
3. **Chained registries**: Upstream proxy for search and tarball downloads
4. **Public + Private**: `REGISTRY_ACCESS=public` with per-tool `private` flag
5. **Production Kubernetes**: Scalable deployment (see below for aspirational examples)

### Deployment modes

The server selects storage and auth backends via provider factories in `packages/server/src/providers/`:

| Mode | Storage | Auth | Typical use |
|------|---------|------|-------------|
| **Local/simple** | `LocalStorageProvider` (filesystem) | `SimpleAuthProvider` (env tokens) | Dev, single-team registry |
| **Database auth** | Filesystem | `DatabaseAuthProvider` + `UserStore` | Multi-user with registration |
| **Production stubs** | Azure/S3 stubs | OIDC stub | Future cloud deployment |

Tool data is always stored on the filesystem (or cloud storage provider) — PostgreSQL is used for user/auth only when `DATABASE_URL` is configured.

---

## Single Registry Deployment

### Docker Compose (local dev)

The repo ships `docker-compose.yml` for a persistent dev registry:

```yaml
# docker-compose.yml (simplified)
services:
  registry:
    build: { context: ., dockerfile: Dockerfile }
    ports: ["4873:4873"]
    env_file: [packages/server/.env]
    environment:
      PORT: "4873"
      AITOOLS_DATA_DIR: /data
    depends_on:
      postgres: { condition: service_healthy }
    volumes: [registry-data:/data]

  postgres:
    image: postgres:16-alpine
    env_file: [packages/server/.env]
    volumes: [postgres-data:/var/lib/postgresql/data]
```

E2E tests use `docker-compose.e2e.yml` — an ephemeral registry without persistent volumes.

### Environment Variables

See `packages/server/.env.example`. Key variables:

```bash
PORT=4873
HOST=0.0.0.0
AITOOLS_DATA_DIR=./data
REGISTRY_ACCESS=private          # or public
DATABASE_URL=postgresql://...    # optional, enables user auth
AITOOLS_PUBLISH_TOKEN=...       # static publish token
AITOOLS_PUBLISHER_TOKENS=...    # JSON map of token → { userId, orgs }
AITOOLS_ADMIN_TOKEN=...         # admin portal access
UPSTREAMS=public=https://...     # comma-separated name=url pairs
CORS_ORIGINS=https://...         # comma-separated allowed origins
```

---

## Chained Registry Deployment

### Architecture

```mermaid
graph TD
    A[Developer CLI] -->|1. Search| B[Primary Registry]
    B -->|2. Proxy Search| C[Upstream Registry 1]
    B -->|3. Proxy Search| D[Upstream Registry 2]
    B -->|4. Proxy Search| E[Upstream Registry 3]
    
    A -->|5. Publish| B
    B -->|6. Store Tarball| F[Primary Storage]
    
    B -->|7. Proxy Download| C
    B -->|8. Proxy Download| D
    B -->|9. Proxy Download| E
```

### Docker Compose for Chained Registries

```yaml
# docker-compose-chained.yml
version: '3.8'

services:
  primary:
    build: .
    ports:
      - "4873:4873"
    environment:
      - PORT=4873
      - HOST=0.0.0.0
      - REGISTRY_ACCESS=private
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=postgresql://user:pass@postgres:5432/ai-tools-primary
      - UPSTREAMS='[{"name":"public","url":"https://registry.aitools.io"}]'
    depends_on:
      - postgres
    volumes:
      - ./data/primary:/app/data

  upstream1:
    build: .
    ports:
      - "4874:4873"
    environment:
      - PORT=4874
      - HOST=0.0.0.0
      - REGISTRY_ACCESS=public
      - DATABASE_URL=postgresql://user:pass@postgres:5432/ai-tools-upstream1
    depends_on:
      - postgres
    volumes:
      - ./data/upstream1:/app/data

  upstream2:
    build: .
    ports:
      - "4875:4873"
    environment:
      - PORT=4875
      - HOST=0.0.0.0
      - REGISTRY_ACCESS=public
      - DATABASE_URL=postgresql://user:pass@postgres:5432/ai-tools-upstream2
    depends_on:
      - postgres
    volumes:
      - ./data/upstream2:/app/data

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=ai-tools-primary
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Registry Chain Configuration

```typescript
// aitools.config.json
{
  "registries": [
    {
      "name": "primary",
      "url": "http://localhost:4873",
      "priority": 1
    },
    {
      "name": "upstream1",
      "url": "http://localhost:4874",
      "priority": 2
    },
    {
      "name": "upstream2",
      "url": "http://localhost:4875",
      "priority": 3
    }
  ]
}
```

---

## Production Kubernetes Deployment

### Kubernetes Manifest

```yaml
# k8s/registry-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-tools-registry
  labels:
    app: ai-tools-registry
    version: v1.0.0
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-tools-registry
  template:
    metadata:
      labels:
        app: ai-tools-registry
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "4873"
    spec:
      serviceAccountName: ai-tools-registry
      containers:
      - name: registry
        image: ai-tools/registry:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 4873
          name: http
        env:
        - name: PORT
          value: "4873"
        - name: HOST
          value: "0.0.0.0"
        - name: REGISTRY_ACCESS
          valueFrom:
            configMapKeyRef:
              name: registry-config
              key: registry-access
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: registry-secrets
              key: jwt-secret
        - name: DATABASE_URL
          valueFrom:
            configMapKeyRef:
              name: database-config
              key: database-url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: cache-config
              key: redis-url
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: logging-config
              key: log-level
        - name: RATE_LIMIT_REQUESTS
          value: "100"
        - name: RATE_LIMIT_WINDOW
          value: "hour"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: data
          mountPath: /app/data
        - name: config
          mountPath: /app/config
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: registry-pvc
      - name: config
        configMap:
          name: registry-config
      serviceAccountName: ai-tools-registry
---
# Service
apiVersion: v1
kind: Service
metadata:
  name: ai-tools-registry
  labels:
    app: ai-tools-registry
spec:
  type: ClusterIP
  ports:
  - port: 4873
    targetPort: http
    protocol: TCP
    name: http
  selector:
    app: ai-tools-registry
---
# Persistent Volume Claim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: registry-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
# ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: registry-config
data:
  registry-access: "private"
  log-level: "info"
  redis-url: "redis://registry-redis:6379"
---
# Secret
apiVersion: v1
kind: Secret
metadata:
  name: registry-secrets
type: Opaque
stringData:
  jwt-secret: "change-me-in-production"
---
# Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ai-tools-registry-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - registry.aitools.io
    - registry.staging.aitools.io
    secretName: registry-tls
  rules:
  - host: registry.aitools.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ai-tools-registry
            port:
              number: 4873
```

### Helm Chart

```yaml
# charts/ai-tools-registry/
values.yaml:
replicaCount: 3

image:
  repository: ai-tools/registry
  tag: latest
  pullPolicy: Always

service:
  type: ClusterIP
  port: 4873

ingress:
  enabled: true
  className: nginx
  annotations:
    kubernetes.io/ingress.class: nginx
  hosts:
    - host: registry.aitools.io
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: registry-tls
      hosts:
        - registry.aitools.io

resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

persistence:
  size: 10Gi
  storageClass: ""

logging:
  level: info

rateLimit:
  requests: 100
  window: hour
```

---

## Local Development Deployment

### Docker Compose for Development

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  registry:
    build: .
    ports:
      - "4873:4873"
    environment:
      - PORT=4873
      - HOST=0.0.0.0
      - REGISTRY_ACCESS=private
      - JWT_SECRET=dev-secret-change-in-production
      - DATABASE_URL=postgresql://dev:dev@postgres:5432/ai-tools-dev?schema=public
      - LOG_LEVEL=debug
    volumes:
      - ./src:/app/src
      - ./data:/app/data
    depends_on:
      - postgres
    command: >
      sh -c "npm run migrate && npm run dev"

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=dev
      - POSTGRES_PASSWORD=dev
      - POSTGRES_DB=ai-tools-dev
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  pgadmin:
    image: dpage/pgadmin4:latest
    environment:
      - PGADMIN_DEFAULT_EMAIL=dev@localhost
      - PGADMIN_DEFAULT_PASSWORD=dev
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  postgres_dev_data:
  pgadmin_data:
```

### Development Scripts

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Access registry
http://localhost:4873

# Access PostgreSQL
psql postgresql://dev:dev@localhost:5432/ai-tools-dev

# Access pgAdmin
http://localhost:5050

# Stop development environment
docker-compose -f docker-compose.dev.yml down -v
```

---

## Security Best Practices

### 1. Environment Variables

```bash
# .env.example (DO NOT COMMIT)
PORT=4873
HOST=0.0.0.0
REGISTRY_ACCESS=private
JWT_SECRET=$(openssl rand -base64 32)
DATABASE_URL=postgresql://user:pass@localhost:5432/ai-tools
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=hour
```

### 2. Database Security

```sql
-- Enable SSL for PostgreSQL
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = '/etc/ssl/certs/ssl-cert-snakeoil.pem';
ALTER SYSTEM SET ssl_key_file = '/etc/ssl/private/ssl-cert-snakeoil.key';

-- Enable connection limiting
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET idle_in_transaction_session_timeout = 30min;
```

### 3. Rate Limiting

```typescript
// Rate limiter configuration
const rateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // requests per window
  message: {
    error: {
      code: 'ERR_RATE_LIMITED',
      message: 'Rate limit exceeded. Please try again later.'
    }
  }
});
```

### 4. Input Validation

```typescript
// Validate all inputs
const schema = z.object({
  name: z.string().min(1).max(255),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(1000),
});

const result = schema.safeParse(input);
if (!result.success) {
  // Return validation errors
  return reply.send({
    error: {
      code: 'ERR_INVALID_REQUEST',
      message: 'Invalid request parameters',
      details: result.error.issues
    }
  });
}
```

### 5. Authentication

```typescript
// JWT authentication middleware
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

---

## Monitoring and Observability

### Prometheus Metrics

```typescript
// Metrics registration
import { register } from 'prom-client';

const registry = register;

// Custom metrics
export const registryRequestCounter = register
  . Gauge({
    name: 'ai_tools_registry_requests_total',
    help: 'Total number of registry requests',
    labelNames: ['method', 'endpoint', 'status']
  });

export const registryRequestDuration = register
  . Histogram({
    name: 'ai_tools_registry_request_duration_seconds',
    help: 'Duration of registry requests',
    labelNames: ['method', 'endpoint']
  });
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "AI Tools Registry Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(ai_tools_registry_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "title": "Request Duration",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(ai_tools_registry_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95 latency"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "sum(rate(ai_tools_registry_requests_total{status=~'5..'}[5m])) / sum(rate(ai_tools_registry_requests_total[5m]))",
            "legendFormat": "Error rate"
          }
        ]
      }
    ]
  }
}
```

---

## Backup and Recovery

### Database Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/ai-tools"
DATE=$(date +%Y%m%d_%H%M%S)
PGPASSWORD=$POSTGRES_PASSWORD pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER -d ai-tools > $BACKUP_DIR/ai-tools-$DATE.sql

# Compress and retain last 7 days
gzip $BACKUP_DIR/ai-tools-$DATE.sql
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

### Disaster Recovery

```yaml
# k8s/disaster-recovery.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: disaster-recovery
spec:
  template:
    spec:
      containers:
      - name: recovery
        image: ai-tools/recovery:latest
        command: ["sh", "-c"]
        args:
          - |
            # Restore from backup
            pg_restore -h $POSTGRES_HOST -U $POSTGRES_USER -d ai-tools < /backups/ai-tools-$(date +%Y%m%d).sql.gz
            
            # Verify recovery
            pg_isready -h $POSTGRES_HOST -U $POSTGRES_USER
```

---

## Scaling Strategies

### Horizontal Scaling

```yaml
# Auto-scaling configuration
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
  targetMemoryUtilizationPercentage: 80
```

### Load Balancing

```yaml
# Load balancer configuration
ingress:
  className: nginx
  annotations:
    nginx.ingress.kubernetes.io/load-balancer-backend-protocol: http
    nginx.ingress.kubernetes.io/upstream-hash-by: $arg_uri
```

### Database Read Replicas

```yaml
# Database replicas
database:
  primary:
    replicas: 1
  readReplicas:
    replicas: 2
    strategy: read-replicas
```

---

## MCP Tool Deployment

MCP (Model Context Protocol) tools are special — they don't write files but inject server entries into platform-specific MCP configuration files.

### MCP Configuration Files

Each platform has its own MCP config location:

| Platform | Config File |
|----------|-------------|
| VS Code | `.vscode/mcp.json` |
| Cursor | `.cursor/mcp.json` |
| Claude | `.mcp.json` |
| Windsurf | `.windsurf/mcp.json` |

### MCP Install Flow

When installing an MCP tool:

1. CLI reads `aitools.json`
2. Installer validates manifest with `ToolManifestSchema`
3. Installer resolves MCP config path via adapter
4. If config exists, merge new server entry
5. If config missing, create new config with server entry
6. Update lock file with installation record

### MCP Server Registration

MCP servers are registered in the platform's MCP config:

```json
{
  "mcpServers": {
    "my-mcp-tool": {
      "command": "node",
      "args": ["./dist/index.js"],
      "env": {
        "AITOOLS_REGISTRY_URL": "http://localhost:4873"
      }
    }
  }
}
```

### MCP Deployment Considerations

1. **Config File Permissions**: Ensure MCP config files are writable by the user
2. **Environment Variables**: Pass necessary env vars to MCP servers
3. **Version Compatibility**: Ensure MCP protocol version compatibility
4. **Authentication**: Configure auth for private registries in MCP config

---

## Summary

The ai-tools deployment design provides:

✅ **Flexible Deployment**: Support for single, chained, and production deployments  
✅ **Scalability**: Horizontal scaling with Kubernetes and load balancing  
✅ **Security**: Comprehensive security measures and best practices  
✅ **Monitoring**: Full observability with Prometheus and Grafana  
✅ **Backup**: Automated backup and disaster recovery procedures  
✅ **Development**: Easy local development with Docker Compose  
✅ **MCP Support**: Full MCP tool deployment and configuration  
