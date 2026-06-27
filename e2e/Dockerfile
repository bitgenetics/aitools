# syntax=docker/dockerfile:1
# Runs the e2e test suite against a live registry server.
# Build context: repo root
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/e2e/package.json packages/e2e/

# Install all workspace deps — root devDependencies include typescript, which is
# required by the build step. Scoping to individual workspaces would skip root deps.
RUN apk add --no-cache git
RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/core packages/core/
COPY packages/cli packages/cli/
COPY packages/e2e packages/e2e/

RUN npm run build -w @ai-tools/core && npm run build -w @ai-tools/cli

CMD ["npm", "test", "-w", "@ai-tools/e2e"]
