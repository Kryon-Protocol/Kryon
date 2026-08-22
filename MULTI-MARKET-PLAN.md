# Kryon — Multi-Market Implementation Plan

**8 perpetual markets: BTC · ETH · XLM · SOL · XRP · ADA · BNB · TRX**

| | |
| --- | --- |
| Status | Plan — not yet implemented |
| Written | 2026-08-22 |
| Scope | Config, oracle, on-chain registration, DB, frontend, liquidity, ops |
| Chart | Keep TradingView embed, fix per-market (no native chart rewrite) |
| Deploy | Build + prove on **testnet**; mainnet is a **runbook**, not executed here |
| Contracts | **No Soroban code change. No redeploy.** |

---

## 1. Context

Kryon trades exactly one market today: `XLM-PERP` (`market_id = 1`). This plan brings
eight markets online side by side with a working market switcher, per-market charts,
per-market tick ladders and price precision, and per-market risk parameters.

The central finding from exploring the codebase: **almost nothing is actually
single-market.**

- The 8 Soroban contracts key every piece of state on `u32 market_id` —
  `DataKey::Market(market_id)` at `kryon-protocol/contracts/perp-engine/src/lib.rs:39`,
  registration entrypoint `set_market` at `:104`. There is **one** deployment of each
  contract, multi-market by storage key. Not one contract per market.
- The Prisma schema already carries `marketId` on `Order`, `Fill`, `Position`,
  `OracleSnapshot`, `FundingUpdate`, `KeeperAction`, `PnlEvent`, `FundingPayment`.
- All seven PM2 services already iterate `Object.values(ACTIVE_MARKETS)` — matcher
  (`matcher-service.ts:38`), oracle keeper (`oracle-keeper.ts:60`), indexer
  (`state-indexer.ts:35`), WS server (`ws-server.ts:29`), liquidation keeper
  (`liquidation-keeper.ts:50`), monitor (`monitor.ts:97`), seeder (`seed-markets.ts`).
- The API surface is fully parameterized: `/api/markets/[id]`, `/orderbook`, `/trades`,
  `/candles`. Order intake validates against `VALID_MARKET_IDS` (`lib/validation.ts:9`).
- The trade route already resolves a dynamic segment
  (`app/trade/[market]/page.tsx:14-15`) and `MarketHeader.tsx:49-50` already renders a
  switcher dropdown, gated on `activeMarkets.length > 1`.

What actually pins the system to one market is only three things:

1. `NEXT_PUBLIC_ACTIVE_MARKETS=XLM-PERP` in every env file, `render.yaml` (6×), CI, and
   the `?? "XLM-PERP"` fallback at `client/config/index.ts:116`.
2. Only `market_id = 1` was ever registered on-chain (`engine.set_market`,
   `oracle.set_feed`). `MARKETS` already contains BTC (id 2) and ETH (id 3) config
   entries that have never been registered anywhere.
3. A tail of hardcoded XLM assumptions in the UI — the logo, ~20 `.toFixed(4)` calls,
   and a tick ladder tuned for a $0.30 asset.

So the work is: **config + on-chain registration + oracle coverage + UI
de-XLM-ification + liquidity.** The money math does not move.

---

## 2. Oracle research: can we use Reflector?

Raven MCP is not installed in this environment; `raven.stellar.buzz` is the landing page
for an OAuth-gated MCP server at `https://raven.stellar.org/mcp`. The Reflector contracts
were therefore queried directly with the `stellar` CLI (simulate-only, no submissions).

### 2.1 What was verified live

**Reflector "External CEX & DEX" oracle**

| Network | Contract |
| --- | --- |
| Mainnet | `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` |
| Testnet | `CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63` |

```
$ stellar contract invoke --id CAFJ… --send=no -- assets
[{"Other":"BTC"},{"Other":"ETH"},{"Other":"USDT"},{"Other":"XRP"},{"Other":"SOL"},
 {"Other":"USDC"},{"Other":"ADA"},{"Other":"AVAX"},{"Other":"DOT"},{"Other":"MATIC"},
 {"Other":"LINK"},{"Other":"DAI"},{"Other":"ATOM"},{"Other":"XLM"},{"Other":"UNI"},
 {"Other":"EURC"}]

$ … -- decimals      → 14
$ … -- resolution    → 300
$ … -- lastprice --asset '{"Other":"BTC"}'
{"price":"7699652210273382009","timestamp":1787376300}      # $76,996.52, 80s old
```

The **testnet contract returns the identical 16-asset list**, so coverage is the same on
both networks. The interface is SEP-40 (`lastprice`, `price`, `assets`, `decimals`,
`resolution`).

### 2.2 Two hard blockers against Reflector as the primary mark price

**Blocker 1 — 300s resolution vs. a 120s staleness guard.**
`max_oracle_age_secs = 120` on XLM-PERP, enforced on-chain by `OracleGuard`. A feed that
refreshes every 5 minutes spends most of its life outside that window, so settlement
would fail-stop constantly. The "fix" — raising the guard past 300s — means liquidating
traders against a five-minute-old price. That is not a defensible perps posture.
ReflectorPulse is designed for lending protocols, where a 5-minute mark is fine; perps
are the one product where it is not.

**Blocker 2 — BNB and TRX are absent.** Neither is in Reflector's asset list, on either
network. Two of the eight requested markets have no Reflector coverage at all.

(ReflectorBeam offers faster updates for an XRF invocation fee. That is a real future
option, but it is a paid subscription and a separate integration — out of scope here.)

### 2.3 Recommendation — Reflector as an independent guard, not the mark

Keep the existing keeper as primary: 8s fetch, median of Binance + Coinbase + Kraken,
publish on deviation-or-heartbeat. Add Reflector as a **fourth, independent
cross-check**: if Kryon's CEX median diverges from Reflector's `lastprice` by more than
`REFLECTOR_DIVERGENCE_HALT_BPS`, **halt publishing for that market** and let the on-chain
staleness guard fail-stop the protocol.

This is precisely the CEX-manipulation circuit breaker a perps DEX needs — an attacker
who moves all three CEX feeds still has to move Reflector's independent node consensus to
land a bad mark. It costs one simulate-read per tick and **zero gas**.

The contract side already exists and is unused:

- `OracleSource::Reflector` is in the enum — `crates/protocol-core/src/oracle.rs:5-11`
- `set_quorum_feed` (`:117`), `write_quorum_price` (`:199`), and
  `max_source_deviation_bps` are implemented and unit-tested in
  `contracts/perp-oracle-adapter/src/lib.rs`

Every feed today is registered single-source under a `RedStone` label. Turning on the
guard is wiring, not new contract code.

### 2.4 CEX coverage check for the new assets

Verified live against both APIs — including the two Reflector misses:

| Asset | Binance | Coinbase | Kraken | Sources |
| --- | --- | --- | --- | --- |
| SOL | `SOLUSDT` | `SOL-USD` ✅ | `SOLUSD` ✅ | 3 |
| XRP | `XRPUSDT` | `XRP-USD` ✅ | `XXRPZUSD` ✅ | 3 |
| ADA | `ADAUSDT` | `ADA-USD` ✅ | `ADAUSD` ✅ | 3 |
| **BNB** | `BNBUSDT` | `BNB-USD` ✅ | `BNBUSD` ✅ | 3 |
| **TRX** | `TRXUSDT` | `TRX-USD` ✅ | `TRXUSD` ✅ | 3 |

All 8 markets keep a genuine 3-source median. Note Kraken returns XRP under the legacy
key `XXRPZUSD`; `krakenPrice()` takes `Object.values(result)[0]`
(`oracle-keeper.ts:115`) so this already works, but it is worth a regression test.

---

## 3. Market table

`marketId` 1–3 already exist in `MARKETS`; 4–8 are new.

| id | market | oracleSym | binance | tvSymbol | lev | IM bps | MM bps | liqFee | maxOI | priceDec | tickSizes | Reflector |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | XLM-PERP | XLM | XLMUSDT | `COINBASE:XLMUSD` | 10x | 1000 | 500 | 50 | $300k | 4 | .0001 .001 .01 .1 | ✅ |
| 2 | BTC-PERP | BTC | BTCUSDT | `COINBASE:BTCUSD` | 50x | 200 | 100 | 25 | $2M | 1 | .1 1 10 100 | ✅ |
| 3 | ETH-PERP | ETH | ETHUSDT | `COINBASE:ETHUSD` | 20x | 500 | 250 | 35 | $1M | 2 | .01 .1 1 10 | ✅ |
| 4 | SOL-PERP | SOL | SOLUSDT | `COINBASE:SOLUSD` | 10x | 1000 | 500 | 50 | $500k | 2 | .01 .1 1 5 | ✅ |
| 5 | XRP-PERP | XRP | XRPUSDT | `COINBASE:XRPUSD` | 10x | 1000 | 500 | 50 | $500k | 4 | .0001 .001 .01 .1 | ✅ |
| 6 | ADA-PERP | ADA | ADAUSDT | `COINBASE:ADAUSD` | 5x | 2000 | 1000 | 50 | $200k | 4 | .0001 .001 .01 .1 | ✅ |
| 7 | BNB-PERP | BNB | BNBUSDT | `BINANCE:BNBUSD` | 10x | 1000 | 500 | 50 | $300k | 2 | .01 .1 1 5 | ❌ |
| 8 | TRX-PERP | TRX | TRXUSDT | `COINBASE:TRXUSD` | 5x | 2000 | 1000 | 50 | $200k | 5 | .00001 .0001 .001 .01 | ❌ |

**Invariant:** `maxLeverageBps = 1e8 / initialMarginBps`. The engine enforces it
(`validate_engine_market`, `perp-engine/src/lib.rs:510`), so the two fields must never
drift. Phase 1 adds a unit test for exactly this.

`maxOI` is stored on-chain as `PRECISION * units`. Kraken's `BTC → XBT` remap is already
handled (`oracle-keeper.ts:110`).

---

## 4. Phase 1 — Market registry

`client/config/index.ts` is the single source of truth every service and every page
reads. This phase is where most of the leverage is.

### 4.1 Extend `MarketConfig`

Three fields the UI currently fakes with hardcoded constants:

```ts
export interface MarketConfig {
  // … existing fields …
  priceDecimals: number;      // 1 for BTC, 5 for TRX — replaces every .toFixed(4)
  sizeDecimals: number;       // base-unit display precision
  tickSizes: number[];        // replaces OrderBook.tsx:14 TICKS
  reflectorSymbol?: string;   // omitted for BNB / TRX — no Reflector feed
}
```

Backfill these on the three existing entries, then add entries 4–8 per §3. Example:

```ts
"SOL-PERP": {
  marketId: 4,
  symbol: "SOL-PERP",
  displayName: "SOL-PERP",
  baseAsset: "SOL",
  quoteAsset: "USDC",
  oracleSymbol: "SOL",
  priceSourceSymbol: "SOLUSDT",
  reflectorSymbol: "SOL",
  settlementAsset: ASSETS.usdc,
  tvSymbol: "COINBASE:SOLUSD",
  maxLeverageBps: 100000,       // 10x = 1e8 / 1000
  initialMarginBps: 1000,
  maintenanceMarginBps: 500,
  liquidationFeeBps: 50,
  priceDecimals: 2,
  sizeDecimals: 3,
  tickSizes: [0.01, 0.1, 1, 5],
},
```

### 4.2 Flip the default

`client/config/index.ts:116` currently reads `(raw ?? "XLM-PERP")`. Change the fallback
to the full 8-symbol list, so a missing env var yields the intended production set rather
than silently collapsing to one market.

### 4.3 Set the env var everywhere

`NEXT_PUBLIC_ACTIVE_MARKETS` must list all 8 in:

- `client/.env.local`, `client/.env.local.example`, `client/.env.mainnet`
- `client/render.yaml` — **six** occurrences (lines 33, 67, 91, 121, 169, 201)
- `.github/workflows/mainnet-preflight.yml:38`
- Vercel project env (via the REST API — see the `mainnet-deployment` notes on why the
  interactive CLI silently corrupted this exact variable once before)

### 4.4 What follows for free

Once §4.1–4.3 land, these need **no code change** — they all iterate `ACTIVE_MARKETS`:
matcher, oracle keeper, state indexer, WS server, liquidation keeper, monitor,
`seed-markets.ts`, and `lib/validation.ts`'s `VALID_MARKET_IDS`. That is the design
paying off.

### 4.5 Deploy manifests

`kryon-protocol/infra/deploy/environments/{mainnet,testnet}.toml` model a single market
under `[initial_market]` (singular). Convert to a `[[markets]]` array and have the deploy
script iterate it:

```toml
[[markets]]
market_id = 1
symbol = "XLM-PERP"
base_asset = "XLM"
# …

[[markets]]
market_id = 4
symbol = "SOL-PERP"
base_asset = "SOL"
# …
```

---

## 5. Phase 2 — Oracle

### 5.1 Reflector reader

New helper in `client/lib/stellar/reflector.ts`:

```ts
// Reflector "External CEX & DEX" oracle, SEP-40. Prices are 1e14; Kryon is 1e18.
const REFLECTOR_DECIMALS = 14n;

export async function reflectorLastPrice(
  symbol: string
): Promise<{ price: bigint; timestamp: number } | null> {
  // simulate-read lastprice({Other: symbol}); returns null when the feed is absent
  // normalize: price * 10n ** (18n - REFLECTOR_DECIMALS)
}
```

Reuse the existing simulate helper in `client/lib/stellar/` — do **not** stand up a
second RPC client.

### 5.2 Wire the divergence guard

In `client/scripts/oracle-keeper.ts`, inside `publishMarket()` (`:260`), after
`aggregatePrice()` returns the CEX median:

```
median  ← Binance/Coinbase/Kraken   (existing)
ref     ← reflectorLastPrice(market.reflectorSymbol)

skip the guard when:
  · market.reflectorSymbol is undefined          (BNB, TRX)
  · ref is null                                   (feed absent / RPC failure)
  · now - ref.timestamp > REFLECTOR_MAX_AGE_SECS  (Reflector itself is stale)

otherwise:
  divergenceBps = |median - ref| / ref * 10_000
  if divergenceBps > REFLECTOR_DIVERGENCE_HALT_BPS:
      log loudly + alert + DO NOT PUBLISH
```

Not publishing is the safe action: the on-chain `OracleGuard` then fail-stops settlement
on staleness, which is exactly the intended behaviour when the price is untrustworthy.
This mirrors the existing USDC de-peg halt (`oracle-keeper.ts:298`).

New env vars:

| Var | Default | Meaning |
| --- | --- | --- |
| `REFLECTOR_CONTRACT_ID` | network-selected | mainnet/testnet address from §2.1 |
| `REFLECTOR_GUARD_ENABLED` | `true` | master switch |
| `REFLECTOR_DIVERGENCE_HALT_BPS` | `300` | 3% — halt threshold |
| `REFLECTOR_MAX_AGE_SECS` | `600` | ignore Reflector beyond 2 resolutions |

### 5.3 Fix the single-market oracle read

`client/lib/stellar/oracle.ts:10,19` defaults `assetSymbol` to `ASSET_SYMBOL_XLM`, and
`MarketDataProvider.tsx:101` calls `getOraclePrice()` **with no argument**. Every market
would therefore display XLM's oracle price as its mark. Make the parameter **required**
so no caller can silently fall back, and pass `market.oracleSymbol` at the call site.

### 5.4 Gas and sequence contention — the one genuinely new operational load

Each market is an independent `write_price` transaction. Soroban permits **one**
host-function invocation per transaction, so these cannot be batched into one tx.

- **Cost.** XLM alone burns ~1 XLM/day at 30bps-or-60s publishing. Eight markets is
  **~8–10 XLM/day**. The publisher account needs real funding (it held 9.79 XLM at last
  check) and a low-balance alarm.
- **Contention.** One account submitting 8 markets' writes will hit sequence-number
  races. Stagger `publishMarket` calls across the 8s fetch window and keep the existing
  `tick()` overlap guard. If races persist, move to per-market channel accounts.

---

## 6. Phase 3 — On-chain registration

Adding a market is admin calls against the **already deployed** contracts. No redeploy,
no new WASM, no upload fees.

| # | Call | Contract | Notes |
| --- | --- | --- | --- |
| 1 | `set_feed(SYM, publisher, source, guard{120s, 1000bps}, true)` | oracle-adapter | one per new base asset |
| 2 | `set_market(EngineMarketConfig)` | engine | internally calls `vault.set_market_config` (`perp-engine/src/lib.rs:110`) — the separate vault call in `mainnet-deploy.ts:460` is redundant |
| 3 | `set_market(MarketSnapshot)` | risk | exists (`perp-risk/src/lib.rs:52`) but was **never called for market 1 either**. Decide explicitly: start using it, or leave it consistently unused. Do not half-adopt it. |

### 6.1 New script: `client/scripts/add-market.ts`

The concrete deliverable of this phase. Model it on the checkpointed pattern in
`mainnet-deploy.ts:400-465` — a `done()` / `mark()` JSON ledger so a half-failed run
resumes instead of double-paying.

```
npx tsx scripts/add-market.ts --market SOL-PERP --dry-run
npx tsx scripts/add-market.ts --all --dry-run
npx tsx scripts/add-market.ts --all --emit-governance   # emit queue payloads
```

It reads parameters from `MARKETS` so the config stays the single source of truth, and
builds the same `scvMap` shapes already proven in `mainnet-deploy.ts:437-451`.

### 6.2 Testnet — execute

Admin on testnet is the governance contract
`CBZT5HUXI42TD55GGB5Y7OZZ72IT5SN64ONOGDYS2PFQCOWIT4XOA6MU` with a 48h `min_delay`, so even
testnet registration is `governance.queue` → wait 48h → `governance.execute`.

> **Verify the actual current admin on each contract before assuming anything** — read
> instance storage directly rather than trusting the runbook. The governance ceremony has
> a history of partial completion across contracts.

### 6.3 Mainnet — runbook only, do not execute

State these blockers plainly at the top of the runbook:

1. **48h timelock.** 16 proposals (8 × `set_feed` + 8 × `set_market`), queued in one
   session, executable no sooner than 48h later.
2. **Funding.** The deployer wallet holds **1.51 XLM** and last transacted 2026-07-20.
   It needs funding before anything at all.
3. **The stack is down.** Mainnet has published nothing since 2026-07-10 (Neon compute
   quota, HTTP 402). Reviving DB + PM2 services is a **prerequisite**, not part of this
   work.

---

## 7. Phase 4 — Database

The schema is already multi-market. The work is data plus three latent integrity gaps
that 8 markets will expose.

### 7.1 Seed

Run `npm run db:seed-markets` after Phase 1 lands. It iterates `ACTIVE_MARKETS` and is
`ON CONFLICT DO NOTHING`, so it is safe to run repeatedly. `state-indexer.ts` also
self-heals missing `Market` rows on every 5s poll.

### 7.2 Migration `add_market_integrity`

- **`@@unique` on `Market.symbol`.** Today the only constraint is `Market_pkey` on `id`,
  so duplicate symbols are insertable.
- **FK `Order.marketId → Market.id`.** `Order` is the only market-carrying table without
  one; `Fill`, `Position`, `OracleSnapshot`, `FundingUpdate` all have it.

### 7.3 Nonce collision across markets — a correctness bug, not a nuisance

`client/lib/market/order-intent.ts:34` sets:

```ts
nonce: BigInt(Date.now()),
```

Millisecond resolution. Meanwhile **both** `Order @@unique([owner, nonce])` and the
on-chain `Filled(owner, nonce)` / `Cancelled(owner, nonce)` keys
(`perp-order-gateway/src/lib.rs:23-24`) are **global per account, not per market**.

With one market this is nearly unreachable. With eight — and a quoting bot posting
ladders across all of them — one trader placing orders in two markets in the same
millisecond collides. Off-chain that is a unique-constraint error. **On-chain it means
two different orders sharing one fill counter**, which is a settlement-correctness
issue: filling order A advances the counter that limits order B, and a cancel on one
nonce cancels both.

Fix in `order-intent.ts` — no contract change needed:

```ts
let nonceCounter = 0;
const nonce = BigInt(Date.now()) * 1000n + BigInt(nonceCounter++ % 1000);
```

Add the regression test described in §11 step 10.

---

## 8. Phase 5 — Frontend

The scaffold is already there — `app/trade/[market]/page.tsx:14-15` resolves the URL
segment against `ACTIVE_MARKETS`, and the `MarketHeader.tsx:49-50` switcher lights up on
its own once `activeMarkets.length > 1`. The work is removing XLM assumptions.

### 8.1 Build these three shared primitives first

They collapse most of the repetition, so everything after is a one-line substitution.

**`components/common/AssetLogos.tsx`** — the single biggest blocker. It exports only
`UsdcLogo` and `XlmLogo`, and **eight** call sites do
`baseSymbol === "XLM" ? <XlmLogo/> : null`, meaning every other market renders no mark at
all. Add BTC/ETH/SOL/XRP/ADA/BNB/TRX marks plus a registry:

```tsx
export function logoFor(symbol: string, size = 16): ReactNode
// falls back to a lettered circle for unknown symbols
```

**`lib/format.ts`** — `formatPrice(market, value)` and `formatSize(market, value)` driven
by the new `priceDecimals` / `sizeDecimals`. There are ~20 hardcoded `.toFixed(4)` calls
across `MarketHeader`, `OrderEntry`, `OrderBook`, `PositionsTable` — correct for a $0.30
asset, wrong by four orders of magnitude for BTC (`76996.5000`).

**`<MarketCell market={…} />`** — one component for the near-identical logo+symbol cell
duplicated in `OrderHistoryTable:67`, `TradeHistoryTable:66`, `FundingHistoryTable:69`,
`OpenOrdersTable:109,192`, `PositionsTable:228`.

### 8.2 Per-file changes

| File | Change |
| --- | --- |
| `features/trade/components/MarketDataProvider.tsx` | **L101 `getOraclePrice()` takes no argument** → pass `market.oracleSymbol` (see §5.3). Also fix the `getBinancePair` XLM fallback at L22-26. |
| `features/trade/components/MarketHeader.tsx` | `logoFor` at L109/L159; `formatPrice` at L43/45/58/61; add search + live price/24h% per row now the dropdown carries 8 entries. |
| `features/trade/components/OrderBook.tsx` | `TICKS` (L14) from `market.tickSizes`; unit label (L53) from `market.baseAsset` — literal `"XLM"` today; `formatPrice` at L266. **Needs the full `MarketConfig`; currently receives only `marketId`.** |
| `features/trade/components/OrderEntry.tsx` | Logo ternary L495; `formatPrice` at L165/201/226/420/434/639. |
| `features/trade/components/PositionsTable.tsx` | Logo L228; decimals L201/268/272/274. Uses `MARKETS` (L168) where it should use `ACTIVE_MARKETS`. |
| `features/trade/components/OpenOrdersTable.tsx` | Logos L109/L192; lookups L88/L176. |
| `features/trade/components/{Order,Trade,Funding}HistoryTable.tsx` | Replace with `<MarketCell>` — L67 / L66 / L69. |
| `features/trade/components/SettlementModal.tsx` | Hardcoded `"XLM"` size units at L194 and L252. |
| `features/trade/components/BottomPanel.tsx` | Market filter (L54, L103) needs scroll/search at 8 entries. |
| `app/markets/page.tsx` | `logoFor` (L59) + live price / 24h% / volume / OI columns — this becomes the real markets landing page. |
| `components/common/TopNav.tsx` | Trade tab → `DEFAULT_MARKET_SYMBOL` (L11-14); consider a global switcher here. |
| `app/LandingPage.tsx`, `app/layout.tsx` | Hardcoded `XLM-PERP` links/copy — LandingPage L13/29/42/322/338/522/647; layout L19 metadata. |

### 8.3 Chart — keep TradingView, fix per-market

Per the chosen approach, the `tv.js` embed stays. Four fixes:

- `TradingViewWidget.tsx:49` — drop the `"COINBASE:XLMUSD"` default; require the symbol.
- `TradeChart.tsx:20` — drop the `marketId = 1` default.
- **`KryonChart.tsx:26` destructures only `{ symbol }`**, silently discarding the
  `position` and `orders` overlays that `TradeChart.tsx:41-79` carefully builds
  (entry / liq / mark / PnL / leverage / resting orders). Either wire them through
  TradingView's `createShape` / horizontal-line API in `onChartReady`, or delete the dead
  overlay construction. **Do not leave code computing overlays and throwing them away.**
- `stores/chart.ts` — persist `timeframe` / `chartType` **per market**. Today one global
  value lives under `kryon-chart-v1`, so a 1m view on TRX resets your 4h view on BTC.

Housekeeping: `lightweight-charts@^5.2.0` is in `package.json` and imported by nothing.
Either remove it or leave a comment marking it reserved for a future native chart.

### 8.4 WebSocket

`lib/market/websocket.ts:138-146` uses a single global handler set, so only one
subscriber can be active at a time. Channels are already market-scoped
(`orderbook:${marketId}`, `trades:${marketId}`, L152). This is fine while the terminal
shows one market at a time — **only** refactor to a per-channel fan-out registry if the
switcher dropdown or markets page shows live streaming prices.

---

## 9. Phase 6 — Liquidity

Without resting orders the book is empty, nothing fills, and `/api/markets/[id]/candles`
(which synthesizes OHLCV from the `Fill` table) has nothing to return.

Generalize `client/scripts/_drill_orderbook.ts` — currently `const MARKET_ID = 1` (L35) —
into a market-parameterized quoter:

- Read the oracle mid for its market.
- Post a symmetric ladder using that market's `tickSizes`.
- Refresh on price move; cancel-and-replace on drift.
- Size the ladder from the market's `maxOI` so the quoter cannot itself breach an OI cap.

Run one PM2 instance per market via `ecosystem.config.cjs`.

> The four drill wallets were merged out of existence in the 2026-07-20 treasury sweep.
> Testnet quoter wallets must be recreated and funded first.

---

## 10. Phase 7 — Ops

- **Set `ALERT_WEBHOOK_URL`.** Still unset. This is why the July outage ran **21 days**
  undetected while the monitor correctly logged failures every 30s to nowhere. Eight
  markets multiplies the failure surface; this is the highest value-per-minute fix in the
  whole plan.
- `client/scripts/monitor.ts` already iterates `ACTIVE_MARKETS` (L97, L176) so it will
  check 8 feeds automatically. **Make the alert payload name the market** — with 8
  markets, "4 check(s) failed" is useless.
- `liquidation-keeper.ts:213-217` silently skips positions whose market isn't in
  `ACTIVE_MARKETS`. Correct behaviour, but it must **log** the skip: an unliquidated
  position in a de-listed market is bad debt accruing in silence.
- `ecosystem.config.cjs` — add the per-market quoter instances from Phase 6.
- `live-production-gate.ts:67` asserts `/trade/XLM-PERP` returns 200. Extend to all 8.

---

## 11. Verification

**Static**

1. `cd client && npm run lint && npx tsc --noEmit`
2. `cd kryon-protocol && cargo test` — contracts are unchanged; this is a regression guard.
3. New unit test over `MARKETS`: every entry satisfies
   `maxLeverageBps * initialMarginBps === 1e8`, has a unique `marketId` and `symbol`, and
   has non-empty `tickSizes`.

**Oracle — no chain writes required**

4. `REFLECTOR_GUARD_ENABLED=true npx tsx scripts/oracle-keeper.ts --dry-run` — prints per
   market: 3-source median, Reflector price, divergence bps, publish/skip decision.
   Expect all 8 to resolve 3 CEX sources, and BNB/TRX to log
   *"no Reflector feed — guard skipped"*.
5. Stub one source to force a divergence over threshold; confirm the keeper **skips the
   publish** rather than publishing.

**Testnet end-to-end**

6. `npx tsx scripts/add-market.ts --all --dry-run`, then queue via governance. After the
   48h delay, execute and confirm with a simulate-read of the engine's market config for
   ids 1–8.
7. `npm run db:seed-markets` → 8 rows in `Market`.
8. Start the 7 services; confirm the oracle publishes 8 symbols and `state-indexer`
   populates `lastOraclePrice` for all 8.
9. Run the quoter on 2 markets, then drive one full trade **in a non-XLM market (BTC)**:
   deposit → signed order → matcher settlement → position appears → close → withdraw.
   *This is the test that catches the `getOraclePrice()` bug — it cannot be caught on
   XLM-PERP, where the bug is invisible.*
10. Place orders in **two markets within the same millisecond** and confirm no
    `(owner, nonce)` collision — the specific regression §7.3 fixes.

**Frontend**

11. `npm run dev`; visit `/trade/BTC-PERP`, `/trade/TRX-PERP`, `/markets`. Check:
    correct logo per market · BTC price reads `76,996.5` not `76996.5000` · TRX shows 5dp ·
    tick ladder matches the asset · switcher lists 8 and routes correctly · chart loads the
    right TradingView symbol · per-market timeframe persists across a switch.
12. `npx tsx scripts/production-gate.ts` and `live-production-gate.ts` (extended per §10).

---

## 12. Risks and open items

| Risk | Detail | Mitigation |
| --- | --- | --- |
| **BNB / TRX have no Reflector cross-check** | Both run on the CEX median alone — no independent oracle to catch a coordinated CEX move | Accept a weaker posture reflected in their params (TRX already 5x), or drop the two markets. **Flagging, not deciding.** |
| **Oracle gas scales linearly** | ~8–10 XLM/day at 8 markets, plus sequence contention on one publisher account | Fund the publisher, add a balance alarm, stagger publishes; channel accounts if races persist |
| **Mainnet is timelocked, dead, and underfunded** | 48h delay · deployer at 1.51 XLM · nothing published since 2026-07-10 | Phase 3's mainnet half is a runbook to execute later, after Neon and funding are resolved |
| **Insurance fund is shared across all markets** | `perp-insurance` has no market key — a blowup in a thin alt draws on the same fund backing BTC. The mainnet fund holds **4.80 USDC**. | Per-market OI caps are the only mitigation available without a contract change. Size them conservatively. |
| **Do not raise `max_oracle_age_secs` past 120s** | The tempting "fix" to accommodate Reflector's 300s resolution | Trading a slower staleness guard for a decentralized-feed label is exactly the wrong trade for perps. Reflector stays a guard. |

---

## 13. Summary of files touched

**New**

```
client/lib/stellar/reflector.ts          Reflector SEP-40 reader + 1e14→1e18 normalize
client/lib/format.ts                     formatPrice / formatSize from MarketConfig
client/scripts/add-market.ts             checkpointed market registration
kryon-protocol/prisma/migrations/…_add_market_integrity/
```

**Core edits**

```
client/config/index.ts                   +5 markets, +3 MarketConfig fields, default flip
client/scripts/oracle-keeper.ts          Reflector divergence guard, publish staggering
client/lib/stellar/oracle.ts             remove the XLM default (required param)
client/lib/market/order-intent.ts        nonce collision fix
client/components/common/AssetLogos.tsx  8 asset marks + logoFor registry
client/features/trade/components/*.tsx   ~10 files: logos, decimals, ticks, units
client/features/chart/*.tsx              per-market symbol, overlay wiring, per-market tf
client/scripts/_drill_orderbook.ts       market-parameterized quoter
```

**Config / env**

```
client/.env.local · .env.local.example · .env.mainnet
client/render.yaml                       6 occurrences
client/ecosystem.config.cjs              per-market quoters
.github/workflows/mainnet-preflight.yml
kryon-protocol/infra/deploy/environments/{mainnet,testnet}.toml   [[markets]] array
```

**Zero changes**

```
kryon-protocol/contracts/**              all 8 Soroban contracts
kryon-protocol/crates/**                 protocol-core · risk-engine · order-types
```
