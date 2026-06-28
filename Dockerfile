# syntax=docker/dockerfile:1
# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Copy manifests first so dependency install is cached
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/

# Install all workspace deps — root devDependencies include typescript, which is
# required by the build step. Scoping to individual workspaces would skip root deps.
RUN npm ci --ignore-scripts

# Copy source
COPY tsconfig.base.json ./
COPY packages/core packages/core/
COPY packages/server packages/server/

RUN npm run build -w @bitgenetics/aitools-core && npm run build -w @bitgenetics/aitools-server

# ---- Runtime stage ----
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/

RUN npm ci --workspace=@bitgenetics/aitools-core --workspace=@bitgenetics/aitools-server --omit=dev --ignore-scripts

COPY --from=builder /app/packages/core/dist packages/core/dist/
COPY --from=builder /app/packages/server/dist packages/server/dist/

# Run as non-root user for container security
RUN addgroup -g 1001 nodejs && adduser -D -u 1001 -G nodejs app && \
    mkdir -p /data && chown app:nodejs /data

EXPOSE 4873

ENV PORT=4873
ENV HOST=0.0.0.0
ENV AITOOLS_DATA_DIR=/data

VOLUME ["/data"]

USER 1001

CMD ["node", "packages/server/dist/index.js"]
