# Deployment Guide

## Docker (single container, filesystem storage)

The simplest production setup: one container backed by a local volume.

```bash
cp .env.example .env
# Edit .env — set AI_TOOLS_ADMIN_TOKEN, POSTGRES_PASSWORD, DATABASE_URL, etc.

docker compose up -d
```

The registry is then available at `http://localhost:4873`.

> **TLS**: Place a reverse proxy (nginx, Caddy, Traefik) in front and terminate TLS there. The app binds plain HTTP.

---

## Docker Compose with PostgreSQL (recommended for teams)

`docker-compose.yml` starts both the registry and a PostgreSQL database.

```bash
cp .env.example .env
# Mandatory: set unique values for
#   AI_TOOLS_ADMIN_TOKEN   (generate with: openssl rand -hex 32)
#   POSTGRES_PASSWORD
#   DATABASE_URL           (must match POSTGRES_USER/POSTGRES_PASSWORD)
#   AUTH_BACKEND=database

docker compose up -d
docker compose logs -f registry   # watch startup
```

---

## Kubernetes

Minimal manifest — adapt namespace, image tag, and secret names to your environment.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-tools-registry
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ai-tools-registry
  template:
    metadata:
      labels:
        app: ai-tools-registry
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
      containers:
        - name: registry
          image: ghcr.io/your-org/ai-tools:latest
          ports:
            - containerPort: 4873
          envFrom:
            - secretRef:
                name: ai-tools-secrets
          env:
            - name: PORT
              value: "4873"
            - name: AUTH_BACKEND
              value: database
            - name: REGISTRY_ACCESS
              value: private
          livenessProbe:
            httpGet:
              path: /health
              port: 4873
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 4873
            initialDelaySeconds: 5
            periodSeconds: 10
          volumeMounts:
            - name: data
              mountPath: /data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: ai-tools-data
---
apiVersion: v1
kind: Service
metadata:
  name: ai-tools-registry
spec:
  selector:
    app: ai-tools-registry
  ports:
    - port: 4873
      targetPort: 4873
```

Create the secret:

```bash
kubectl create secret generic ai-tools-secrets \
  --from-literal=AI_TOOLS_ADMIN_TOKEN="$(openssl rand -hex 32)" \
  --from-literal=DATABASE_URL="postgresql://user:password@postgres-host:5432/ai_tools" \
  --from-literal=POSTGRES_PASSWORD="strong-password"
```

---

## Systemd (bare-metal / VM)

```ini
[Unit]
Description=ai-tools registry
After=network.target postgresql.service

[Service]
Type=simple
User=ai-tools
EnvironmentFile=/etc/ai-tools/env
WorkingDirectory=/opt/ai-tools
ExecStart=/usr/bin/node packages/server/dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Place environment variables in `/etc/ai-tools/env` (mode 0600, owned by root):

```
AI_TOOLS_ADMIN_TOKEN=...
DATABASE_URL=postgresql://...
AUTH_BACKEND=database
REGISTRY_ACCESS=private
PORT=4873
```

---

## Reverse proxy (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name registry.example.com;

    ssl_certificate     /etc/letsencrypt/live/registry.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/registry.example.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:4873;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        client_max_body_size 20m;
    }
}
```

---

## Health endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness — always returns `200 { status: "ok" }` |
| `GET /health/ready` | Readiness — checks DB connectivity; returns `503` if unavailable |

Use `/health` for liveness probes and `/health/ready` for readiness probes.

---

## Storage backends

Set `STORAGE_BACKEND` in `.env`:

| Value | Description |
|-------|-------------|
| `filesystem` (default) | Stores data under `AI_TOOLS_DATA_DIR`. Mount a persistent volume. |
| `azure` | Azure Blob Storage. Requires `AZURE_STORAGE_CONNECTION_STRING` + `AZURE_STORAGE_CONTAINER`. |
| `s3` | AWS S3. Requires `AWS_S3_BUCKET` + `AWS_REGION`. Reads credentials from environment / instance role. |
