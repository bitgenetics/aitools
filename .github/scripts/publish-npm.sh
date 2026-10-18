#!/usr/bin/env bash
# Publish @bitgenetics/aitools-core, -cursor, then -cli at $VERSION, in dependency order.
# Idempotent: a version already on npm is skipped, so a failed `ship` job can be re-run.
set -euo pipefail

: "${VERSION:?VERSION must be set}"
SCOPE="@bitgenetics"
RESOLVE_ATTEMPTS=30
RESOLVE_INTERVAL_SECONDS=10
CDN_SETTLE_SECONDS=5

on_npm() {
  [ "$(npm view "$SCOPE/$1@$VERSION" version --prefer-online 2>/dev/null || true)" = "$VERSION" ]
}

publish() {
  if on_npm "$1"; then
    echo "$SCOPE/$1@$VERSION is already on npm; skipping."
    return
  fi
  npm publish -w "$SCOPE/$1" --access public --provenance
}

# The CLI pins exact versions of core and cursor, so those must be resolvable on the
# registry read path before the CLI is published or installs hit ETARGET.
wait_until_resolvable() {
  for attempt in $(seq 1 "$RESOLVE_ATTEMPTS"); do
    if on_npm "$1"; then
      echo "$SCOPE/$1@$VERSION is resolvable (attempt $attempt)."
      return
    fi
    echo "Attempt $attempt/$RESOLVE_ATTEMPTS: $SCOPE/$1@$VERSION not yet visible; sleeping ${RESOLVE_INTERVAL_SECONDS}s..."
    sleep "$RESOLVE_INTERVAL_SECONDS"
  done
  echo "Timed out waiting for $SCOPE/$1@$VERSION to become resolvable."
  exit 1
}

npm pkg set "dependencies.$SCOPE/aitools-core=$VERSION" -w "$SCOPE/aitools-cli"
npm pkg set "dependencies.$SCOPE/aitools-cursor=$VERSION" -w "$SCOPE/aitools-cli"

publish aitools-core
publish aitools-cursor
wait_until_resolvable aitools-core
wait_until_resolvable aitools-cursor
sleep "$CDN_SETTLE_SECONDS"
publish aitools-cli
