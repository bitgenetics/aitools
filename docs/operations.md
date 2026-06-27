# Operations Runbook

## Monitoring checklist

| Check | How |
|-------|-----|
| Registry liveness | `GET /health` → `{ status: "ok" }` |
| Registry readiness | `GET /health/ready` → `{ status: "ready" }` |
| Disk usage (filesystem backend) | `df -h /data` or cloud storage dashboard |
| PostgreSQL connectivity | `psql $DATABASE_URL -c 'SELECT 1'` |
| Container running | `docker compose ps` or `kubectl get pods` |

---

## Log shipping

The server emits **structured JSON logs** via Fastify's built-in Pino logger. Each line is a JSON object.

### Docker / systemd → file

```bash
# Docker
docker compose logs --no-color registry | tee -a /var/log/ai-tools.log

# systemd (logs already in journal)
journalctl -u aitools -o json-pretty -f
```

### Forwarding to a log aggregator

Point your log shipper (Fluentd, Logstash, Vector, etc.) at the container stdout. Example Vector sink:

```toml
[sources.docker]
type = "docker_logs"
include_containers = ["aitools-registry"]

[sinks.loki]
type = "loki"
inputs = ["docker"]
endpoint = "http://loki:3100"
```

### Audit log

The org store appends an audit trail to `<AITOOLS_DATA_DIR>/audit-log.jsonl`. Each line is a timestamped JSON event. Ship this file separately for compliance.

```bash
tail -f /data/audit-log.jsonl | jq .
```

---

## Backup strategy

### PostgreSQL

Run `pg_dump` on a schedule and store the output offsite.

```bash
# Daily backup
pg_dump "$DATABASE_URL" | gzip > /backups/ai-tools-$(date +%F).sql.gz

# Restore
gunzip -c /backups/ai-tools-2026-01-01.sql.gz | psql "$DATABASE_URL"
```

In Kubernetes, use a `CronJob` backed by a persistent volume or cloud bucket.

### Filesystem storage

Back up the `AITOOLS_DATA_DIR` volume. Because tool files are immutable once published, an rsync snapshot is safe:

```bash
rsync -az /data/ s3://my-bucket/ai-tools-backup/
```

For Azure/S3 backends, enable versioning on the container/bucket — no additional backup required.

---

## Token rotation procedure

1. Generate a new admin token:
   ```bash
   openssl rand -hex 32
   ```
2. Update the secret (`AITOOLS_ADMIN_TOKEN` in `.env`, Kubernetes secret, or Vault).
3. Restart the server to pick up the new token.
4. Revoke old tokens via the admin portal (`/portal/admin`) or directly in the database:
   ```sql
   DELETE FROM auth_tokens WHERE description = 'old-token-description';
   ```

For API (publisher) tokens in database mode, users can rotate via:
```bash
aitools registry token create --org @myorg --description "new-token"
# then revoke the old one
aitools registry token revoke <token-id>
```

---

## Performance tuning

### PostgreSQL pool size

The default pool in `packages/server/src/db/client.ts` is `min: 2, max: 20`. Adjust based on your Postgres `max_connections` setting:

```
# .env
DATABASE_URL=postgresql://...?max=30
```

Or edit `initPool()` directly for more control.

### Request body limit

Default is 10 MB. Raise it if users publish large tool archives:

```
# app.ts bodyLimit: 50 * 1024 * 1024  (50 MB)
```

### Log level

In high-traffic deployments, set `LOG_LEVEL=warn` to reduce log volume:

```
# .env
LOG_LEVEL=warn
```

---

## Upgrading

1. Pull the new image or rebuild: `docker compose pull && docker compose up -d`
2. Migrations run automatically on startup (idempotent `CREATE TABLE IF NOT EXISTS`).
3. If a migration fails, check logs: `docker compose logs registry`.

No manual SQL migrations are required for minor versions.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `503` on `/health/ready` | Database unreachable | Check `DATABASE_URL`, Postgres health, firewall rules |
| `401` on all requests | No auth configured / wrong token | Verify `AITOOLS_ADMIN_TOKEN` or `AITOOLS_PUBLISHER_TOKENS` in env |
| `429` on login | Rate limit triggered | Wait 15 minutes, or reduce login attempts |
| Container exits immediately | Bad env var (e.g. `AUTH_BACKEND=database` without `DATABASE_URL`) | Check startup logs for `FATAL:` messages |
| Tool files missing after restart | `AITOOLS_DATA_DIR` not persisted | Mount a named volume or PVC to `/data` |
