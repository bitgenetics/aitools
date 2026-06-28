#!/bin/bash
set -euo pipefail

export GITEA_CUSTOM=/data/gitea
export USER=git

if [[ -f /data/gitea/.e2e-bootstrapped ]]; then
  exit 0
fi

bash /etc/s6/gitea/setup
su-exec git /usr/local/bin/gitea migrate
su-exec git /usr/local/bin/gitea admin user create \
  --admin \
  --username "${GITEA_ADMIN_USER}" \
  --password "${GITEA_ADMIN_PASSWORD}" \
  --email "${GITEA_ADMIN_EMAIL}" \
  --config /data/gitea/conf/app.ini

touch /data/gitea/.e2e-bootstrapped
