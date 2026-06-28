#!/bin/bash
set -euo pipefail

if [[ ! -f /data/gitea/.e2e-bootstrapped ]]; then
  tr -d '\r' < /bootstrap.sh | /bin/bash
fi

exec /usr/bin/entrypoint "$@"
