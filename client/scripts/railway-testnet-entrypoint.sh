#!/usr/bin/env bash
#
# Railway start command for the testnet keeper fleet.
#
# ecosystem.testnet.config.cjs launches every keeper via
# `tsx --env-file=.env.testnet ...`, which needs a real file on disk — but
# Railway injects secrets as container environment variables, not a dotenv
# file. This materialises one from whatever of the expected keys Railway has
# actually set, then hands off to pm2-runtime (the foreground-friendly pm2
# variant meant for exactly this: one container, multiple managed processes,
# no daemon to babysit).
set -euo pipefail
cd "$(dirname "$0")/.."

KEYS=(
  NEXT_PUBLIC_STELLAR_NETWORK NEXT_PUBLIC_STELLAR_RPC_URL
  NEXT_PUBLIC_STELLAR_PASSPHRASE NEXT_PUBLIC_STELLAR_HORIZON_URL
  NEXT_PUBLIC_ACTIVE_MARKETS DATABASE_URL DIRECT_URL
  NEXT_PUBLIC_CONTRACT_GOVERNANCE NEXT_PUBLIC_CONTRACT_ORACLE_ADAPTER
  NEXT_PUBLIC_CONTRACT_VAULT NEXT_PUBLIC_CONTRACT_ENGINE
  NEXT_PUBLIC_CONTRACT_ORDER_GATEWAY NEXT_PUBLIC_CONTRACT_INSURANCE
  NEXT_PUBLIC_CONTRACT_LIQUIDATION NEXT_PUBLIC_CONTRACT_RISK
  NEXT_PUBLIC_ASSET_NATIVE_XLM NEXT_PUBLIC_ASSET_USDC NEXT_PUBLIC_USDC_ISSUER
  ORACLE_PUBLISHER_SECRET MATCHER_OPERATOR_SECRET LIQUIDATOR_SECRET
  PUBLISH_TIME_BACKDATE_SECS PUBLISH_STAGGER_MS ALERT_WEBHOOK_URL
  SETTLEMENT_JOB_MAX_AGE_MINUTES
)

: > .env.testnet
for k in "${KEYS[@]}"; do
  v="${!k:-}"
  [[ -n "$v" ]] && printf '%s=%s\n' "$k" "$v" >> .env.testnet
done
chmod 600 .env.testnet

exec npx --yes pm2-runtime ecosystem.testnet.config.cjs
