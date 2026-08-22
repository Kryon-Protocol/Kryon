# Mainnet Runbook — Registering Markets 2–8

**Status: NOT EXECUTED.** This document is the procedure, not a record of one.
Everything below was built and proven on testnet; nothing has been queued or
submitted against mainnet.

Written 2026-08-22 alongside `MULTI-MARKET-PLAN.md`.

---

## 0. Blockers — read these before touching anything

Three conditions must be cleared first. None of them are code.

| # | Blocker | Detail | Clears when |
| --- | --- | --- | --- |
| 1 | **The stack is down** | Mainnet has published nothing since 2026-07-10. Root cause is the Neon compute quota returning HTTP 402 — still reproducing as of 2026-08-22 (`npm run db:seed-markets` fails against it right now). | Neon plan upgraded / quota reset, DB reachable, PM2 services restarted |
| 2 | **Funding** | The deployer wallet held **1.51 XLM** and last transacted 2026-07-20 (the treasury sweep). The oracle publisher needs real funding too: 8 markets is **~8–10 XLM/day** in `write_price` fees, up from ~1. | Deployer funded for 16 governance txs; publisher funded with weeks of runway **and a low-balance alarm** |
| 3 | **48h timelock** | Admin on both the engine and the oracle adapter is the governance contract, whose on-chain `MinDelay` is **172800s**. 14 proposals must be queued, then wait 48h, then executed individually. | N/A — this is a scheduling constraint, plan for it |

> **Do not raise `max_oracle_age_secs` past 120s.** It is the tempting "fix" for
> Reflector's 300s resolution. Trading a slower staleness guard for a
> decentralized-feed label is exactly the wrong trade for perps. Reflector stays
> a guard, never the mark.

---

## 1. Pre-flight

```bash
cd client

# Contracts unchanged — regression guard only.
(cd ../kryon-protocol && cargo test)

# Registry invariants, nonce regression, display precision.
npm test

# Static config gate: all 8 markets, margins, naming, leverage bounds.
npx tsx --env-file=.env.mainnet scripts/production-gate.ts

# Feed coverage. Expect 8× "3 src"; BNB and TRX log
# "no Reflector feed — guard skipped". No secrets or DB needed.
npx tsx scripts/oracle-keeper.ts --dry-run
```

## 2. Verify on-chain state — do not trust this document

The governance ceremony has a history of completing unevenly across contracts,
so read the admin out of instance storage rather than assuming it.

```bash
npx tsx --env-file=.env.mainnet scripts/add-market.ts --all --check
```

This prints, per contract, the `Admin` read directly from the contract instance
ledger entry (plus any un-accepted `PendingAdmin`), and per market whether the
oracle feed and engine market config already exist. Expect market 1 present and
2–8 missing.

## 3. Validate the payloads

```bash
npx tsx --env-file=.env.mainnet scripts/add-market.ts --all --dry-run
```

A dry run **simulates** every call without submitting. This is what catches a
malformed `EngineMarketConfig` map — a bad payload queued now would otherwise
fail at `execute()` 48 hours later, having consumed the whole timelock. All 14
calls must report `args valid`.

## 4. Queue

```bash
npx tsx --env-file=.env.mainnet scripts/add-market.ts --all --emit-governance
```

Writes `kryon-protocol/infra/deploy/mainnet-market-proposals.json`: 14 proposals
(7 new base assets × `set_feed`, 7 × `engine.set_market`; XLM is already
registered). `min_delay` is read from the governance contract, not from a toml —
`environments/testnet.toml` claimed 3600 while the deployed contract held
172800, and an eta computed from the stale value is rejected as `InvalidConfig`.

Each proposal id is a deterministic hash of `network|target|action|key`, so
re-emitting produces the same id and `queue()` rejects a duplicate — that is the
guard against accidentally queueing a market twice.

Submit each `queue(id, target, action, args, wasm_hash, eta)` from the
governance admin account.

**Note:** `engine.set_market` internally calls `vault.set_market_config`
(`perp-engine/src/lib.rs:110`). There is deliberately **no** separate vault
proposal — the extra call in `mainnet-deploy.ts:460` was always redundant.

**On `perp-risk.set_market`:** deliberately not called, for any market. It was
never called for market 1 either, and its `MarketSnapshot` carries a live
`oracle_price` that is stale the moment it is written. Registering 2–8 there
while 1 is absent would leave the risk contract holding a partial, half-stale
view of the venue — worse than the current consistent non-use. Adopt it for
every market at once with a refreshing keeper, or not at all.

## 5. Wait 48h, then execute

Call `governance.execute(id)` per proposal. Then verify:

```bash
npx tsx --env-file=.env.mainnet scripts/add-market.ts --all --check
```

All eight markets must show `feed=present` and `engine.market=present`.

## 6. Bring up off-chain

```bash
# Requires blocker #1 cleared.
npm run db:seed-markets          # → 8 rows in "Market"
npx tsx --env-file=.env.mainnet scripts/apply-migration.ts \
  ../kryon-protocol/prisma/migrations/20260822120000_add_market_integrity/migration.sql

# Frontend env — all 8 symbols.
#   NEXT_PUBLIC_ACTIVE_MARKETS=XLM-PERP,BTC-PERP,ETH-PERP,SOL-PERP,XRP-PERP,ADA-PERP,BNB-PERP,TRX-PERP
# Set it in Vercel via the REST API, NOT the interactive CLI — the CLI silently
# corrupted this exact variable once before (see the mainnet-deployment notes).

pm2 restart all                  # 7 services; all iterate ACTIVE_MARKETS
```

**Set `ALERT_WEBHOOK_URL` before relying on any of this.** It is still unset,
and it is why the July outage ran 21 days undetected while the monitor
faithfully logged failures to nowhere. The monitor now refuses to start quietly
without it.

## 7. Verify live

```bash
npx tsx --env-file=.env.mainnet scripts/live-production-gate.ts
```

Now covers `/trade/<SYMBOL>` and the four `/api/markets/<id>/*` routes for
**every** active market, not just XLM-PERP.

Then drive one full trade **in a non-XLM market** — deposit → signed order →
matcher settlement → position appears → close → withdraw. Use BTC-PERP. This is
the test that would have caught the `getOraclePrice()` default-to-XLM bug; it is
invisible on XLM-PERP by construction.

## 8. Liquidity

The four original drill wallets were merged out of existence in the 2026-07-20
treasury sweep. **Recreate and fund quoter wallets first.**

```bash
pm2 start _drill_ecosystem.config.cjs   # one instance per market, staggered 15s
```

Each instance sizes its ladder as `LADDER_OI_FRACTION` (default 25%) of that
market's registered `max_open_interest`, so a quoter cannot breach the cap it is
quoting into.

---

## Rollback

Registration is additive and there is no `remove_market`. To take a market out
of service:

1. Drop it from `NEXT_PUBLIC_ACTIVE_MARKETS` and redeploy — this removes it from
   the UI, the matcher, the keepers and order validation immediately, with no
   timelock.
2. Stop that market's quoter: `pm2 stop kryon-drill-<SYMBOL>`.
3. **Positions in that market do not disappear.** The liquidation keeper skips
   markets outside `ACTIVE_MARKETS` — it now logs loudly when it does, but an
   unliquidated position in a de-listed market is bad debt accruing. Close out
   open positions before de-listing, or keep the market active until they are
   flat.
4. Only then queue `set_market` with `active: false` if a permanent on-chain
   disable is wanted (another 48h).

## Known risk, accepted

**The insurance fund is shared across all markets.** `perp-insurance` has no
market key, so a blowup in a thin alt draws on the same fund backing BTC. The
mainnet fund holds **4.80 USDC**. Per-market OI caps are the only mitigation
available without a contract change, which is why they are sized conservatively
(see `maxOpenInterestBase` in `client/config/index.ts`). Size the fund before
raising any cap.
