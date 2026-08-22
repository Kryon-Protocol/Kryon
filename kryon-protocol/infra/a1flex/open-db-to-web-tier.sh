#!/usr/bin/env bash
#
# open-db-to-web-tier.sh — let the web-tier box reach Postgres over the VCN
# private network. RUN THIS ON THE DATABASE BOX (92.4.91.30).
#
#   ssh -i ~/.ssh/kryon-vm-oracle.key opc@92.4.91.30 'bash -s' < open-db-to-web-tier.sh
#
# The web tier could not be co-located with Postgres after all: the only free
# capacity was a second 1 GB micro, not the A1.Flex box. So the loopback-only
# posture becomes subnet-only instead — a narrower change than it sounds, since
# nothing outside this VCN can route to 10.0.0.0/24.
set -euo pipefail

DB_PRIVATE_IP="${DB_PRIVATE_IP:-10.0.0.222}"   # this box
WEB_PRIVATE_IP="${WEB_PRIVATE_IP:-10.0.0.130}" # kryon-web
SUBNET="${SUBNET:-10.0.0.0/24}"

ok() { printf '\033[0;32m  ✓ %s\033[0m\n' "$*"; }

PGDATA=$(sudo -u postgres psql -tAc "SHOW data_directory")
ok "PGDATA=${PGDATA}"

# Bind loopback + the private VNIC. NOT 0.0.0.0: this box holds a public IP,
# and binding every interface would put Postgres on the internet with only the
# security list in front of it.
sudo sed -i "s|^[#[:space:]]*listen_addresses.*|listen_addresses = 'localhost,${DB_PRIVATE_IP}'|" \
  "${PGDATA}/postgresql.conf"
sudo grep -q "^listen_addresses" "${PGDATA}/postgresql.conf" \
  || echo "listen_addresses = 'localhost,${DB_PRIVATE_IP}'" | sudo tee -a "${PGDATA}/postgresql.conf" >/dev/null
ok "$(sudo grep '^listen_addresses' "${PGDATA}/postgresql.conf")"

# A single host, not the subnet range: only the web tier needs in, and a /32
# means a future instance on this subnet does not silently inherit access.
if ! sudo grep -q "${WEB_PRIVATE_IP}/32" "${PGDATA}/pg_hba.conf"; then
  echo "host    all             kryon           ${WEB_PRIVATE_IP}/32          scram-sha-256" \
    | sudo tee -a "${PGDATA}/pg_hba.conf" >/dev/null
  ok "pg_hba: kryon@${WEB_PRIVATE_IP}/32 scram-sha-256"
else
  ok "pg_hba: ${WEB_PRIVATE_IP}/32 already present"
fi

if systemctl is-active --quiet firewalld; then
  sudo firewall-cmd --permanent \
    --add-rich-rule="rule family=ipv4 source address=${SUBNET} port port=5432 protocol=tcp accept" >/dev/null
  sudo firewall-cmd --reload >/dev/null
  ok "firewalld: 5432 from ${SUBNET} only"
fi

sudo systemctl reload postgresql-16 2>/dev/null || sudo systemctl reload postgresql
ok "postgres reloaded"

echo
echo "Verify the bind (expect ${DB_PRIVATE_IP}:5432 and 127.0.0.1:5432, NOT 0.0.0.0):"
sudo ss -ltnp | grep 5432 || true
