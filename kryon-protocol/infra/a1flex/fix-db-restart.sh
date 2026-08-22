#!/usr/bin/env bash
#
# fix-db-restart.sh — restore postgresql.conf ownership and start Postgres.
# RUN ON THE DATABASE BOX.
#
# Root cause: `sudo sed -i` does not edit in place. It writes a temp file and
# renames it over the target, so the result is a NEW inode owned by root:root.
# Postgres runs as `postgres` and then cannot read its own config:
#   LOG: could not open configuration file "postgresql.conf": Permission denied
#   FATAL: configuration file contains errors
# The file contents were correct the whole time.
set -euo pipefail
PGDATA=/var/lib/pgsql/data
ok() { printf '\033[0;32m  ✓ %s\033[0m\n' "$*"; }

echo "=== ownership before ==="
sudo ls -l "${PGDATA}/postgresql.conf" "${PGDATA}/pg_hba.conf"

sudo chown postgres:postgres "${PGDATA}/postgresql.conf" "${PGDATA}/pg_hba.conf"
sudo chmod 600 "${PGDATA}/postgresql.conf" "${PGDATA}/pg_hba.conf"
ok "ownership restored to postgres:postgres, mode 600"

# Validate BEFORE starting, so a bad config is a message rather than an outage.
sudo -u postgres /usr/bin/postgres -C listen_addresses -D "$PGDATA" >/dev/null 2>&1 \
  && ok "config parses cleanly" \
  || { echo "  config still unreadable — stopping"; exit 1; }

sudo systemctl restart postgresql
sleep 3
sudo systemctl is-active postgresql | sed 's/^/  status: /'

echo "=== listening sockets ==="
sudo ss -ltn | grep 5432 || echo "  NOT LISTENING"

echo "=== data intact? ==="
sudo -u postgres psql -tAc 'SELECT count(*) FROM "Market"' kryon_mainnet 2>/dev/null | sed 's/^/  mainnet Market rows: /'
sudo -u postgres psql -tAc 'SELECT count(*) FROM "Fill"'   kryon_mainnet 2>/dev/null | sed 's/^/  mainnet Fill rows:   /'
