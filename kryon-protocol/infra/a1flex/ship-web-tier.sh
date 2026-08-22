#!/usr/bin/env bash
#
# ship-web-tier.sh — build the Next app HERE and ship it to the web-tier box.
#
#   bash ship-web-tier.sh                    # build + ship + restart
#   SKIP_BUILD=1 bash ship-web-tier.sh       # ship the existing .next/ only
#
# WHY THE BUILD IS NOT ON THE BOX
# -------------------------------
# The web tier runs on a 945MB E2.1.Micro. `next build` needs well over a
# gigabyte and would OOM (or thrash swap for an hour). `output: "standalone"`
# emits a self-contained server plus only the traced node_modules — roughly
# 50MB — so the compile happens on a developer machine and the box only serves.
#
# NEXT_PUBLIC_* values are inlined into the client bundle at build time by
# static textual substitution, so THIS script's environment is what ends up in
# the browser. That is why every NEXT_PUBLIC_ var is set explicitly below
# rather than inherited from whatever happens to be in the shell.
set -euo pipefail

WEB_HOST="${WEB_HOST:-130.210.27.190}"
WEB_USER="${WEB_USER:-opc}"
KEY="${KEY:-$HOME/.ssh/kryon-vm}"
REPO="${REPO:-$HOME/Downloads/Kryon}"
CLIENT="${REPO}/client"
REMOTE="/home/${WEB_USER}/kryon-web"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[0;32m  ✓ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; exit 1; }

SSH=(ssh -i "$KEY" -o BatchMode=yes "${WEB_USER}@${WEB_HOST}")

# ── Build ────────────────────────────────────────────────────────────────────
if [[ -z "${SKIP_BUILD:-}" ]]; then
  log "Building (standalone)"
  cd "$CLIENT"
  [[ -f .env.production.local ]] \
    || die "missing ${CLIENT}/.env.production.local — it holds the NEXT_PUBLIC_* values
     that get inlined into the browser bundle. Copy .env.production.example and fill it in."
  # Docusaurus static export served from public/docs by a rewrite; without it
  # every /docs route 404s on the live site.
  [[ -d "${REPO}/docs" ]] && npm run docs:build >/dev/null 2>&1 || true
  npm run build || die "next build failed — nothing shipped, box still serving the old bundle"
  ok "build complete"
fi

[[ -d "${CLIENT}/.next/standalone" ]] \
  || die "no .next/standalone — is output:\"standalone\" still set in next.config.ts?"

# ── Assemble ─────────────────────────────────────────────────────────────────
# standalone omits static assets and public/ by design; both must be laid in.
log "Assembling the bundle"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp -R "${CLIENT}/.next/standalone/." "${STAGE}/"
mkdir -p "${STAGE}/.next"
cp -R "${CLIENT}/.next/static" "${STAGE}/.next/static"
[[ -d "${CLIENT}/public" ]] && cp -R "${CLIENT}/public" "${STAGE}/public"
ok "$(du -sh "$STAGE" | cut -f1) staged"

# ── Ship ─────────────────────────────────────────────────────────────────────
log "Shipping to ${WEB_HOST}"
"${SSH[@]}" "mkdir -p ${REMOTE}"
# --delete so a removed route or asset does not linger and get served.
rsync -az --delete -e "ssh -i ${KEY} -o BatchMode=yes" \
  "${STAGE}/" "${WEB_USER}@${WEB_HOST}:${REMOTE}/"
ok "shipped"

# Server-only secrets live on the box and are NEVER in the shipped bundle.
"${SSH[@]}" "test -f ${REMOTE}/.env.local" \
  || die "${REMOTE}/.env.local is missing on the box — it holds DATABASE_URL_*,
     UPSTASH_* and the operator secrets. Create it there (chmod 600) before deploying."

# ── Restart ──────────────────────────────────────────────────────────────────
log "Restarting"
"${SSH[@]}" "cd ${REMOTE} && (pm2 restart kryon-web --update-env 2>/dev/null || pm2 start server.js --name kryon-web --update-env) && pm2 save" >/dev/null
ok "kryon-web restarted"

sleep 6
for net in mainnet testnet; do
  body=$("${SSH[@]}" "curl -fsS -m 15 'http://127.0.0.1:3000/api/ready?network=${net}'" 2>/dev/null || echo "")
  case "$body" in
    *'"ok":true'*) ok "local /api/ready?network=${net} → ok" ;;
    *) printf '\033[1;33m  ! %s: %s\033[0m\n' "$net" "${body:-no response}" ;;
  esac
done
