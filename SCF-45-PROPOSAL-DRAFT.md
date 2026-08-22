# Kryon Protocol — SCF #45 Build Award Submission

> **Final draft.** Complete except for four items marked `⚠️` that require your input — see the Pre-submission Checklist at the end.
> **Submission deadline: 16 August 2026.**

**At a glance —** Kryon is a perpetual-futures order book on Stellar/Soroban, live on mainnet since 7 July 2026 across eight contracts. This Open Track application requests **$99,000** over **19 weeks**, completing **23 January 2027**, to remove the three things standing between a working exchange and a used one: collateral that can only arrive as USDC already on Stellar, no programmatic access for market makers, and a single supported wallet. Eleven deliverables, costed bottom-up at 1,610 engineering hours.

---

## Submission Information

| Field | Value |
|---|---|
| **Project name** | Kryon Protocol |
| **Round** | SCF #45 — submissions close **16 August 2026** |
| **Track** | Open Track (Build Award) |
| **Submission title** | Perpetual futures order book on Soroban |
| **Requested budget** | **$99,000** USD equivalent in XLM |
| **Project duration** | ~19 weeks from award acceptance — **all deliverables complete 23 January 2027** |
| **Live app** | https://kryonprotocol.vercel.app |
| **Technical documentation** | https://kryonprotocol.vercel.app/docs |
| **GitHub** | https://github.com/Kryon-Protocol/Kryon |
| **X** | https://x.com/KryonProtocol |
| **Video presentation** | ⚠️ TODO — Open Track expects a team + product walkthrough video |
| **Network** | Stellar Mainnet (live since 2026-07-07) |

---

## Products & Services

Kryon is a decentralised perpetual-futures exchange on Stellar/Soroban, **live on Stellar mainnet since 7 July 2026**. It pairs an off-chain central-limit order book for low-latency execution with an on-chain margin engine and per-fill settlement, so traders get a CEX-style order book without surrendering custody.

Eight Soroban contracts are deployed, initialised and wired on pubnet today:

| Contract | Responsibility | Mainnet address |
|---|---|---|
| `perp-vault` | SEP-41 collateral custody, internal balances, risk-gated withdrawals | `CDXGTJQS3XLGXSWDUHKMS5PBBFRRKRXRWH3HTBFNXBIAYEZNDTDKLR4J` |
| `perp-engine` | Position lifecycle, execution price bands, OI caps, fees, funding, realised PnL | `CD6OMHCRDDBDO7I57HCUU52RORFPP7DUIRULWFBOX5WLCO5H2OB3W6LZ` |
| `perp-order-gateway` | Settlement entry point — nonce tracking, overfill protection, self-trade rejection | `CBA2PSRHSIFTSUAFZWMF6CARNO7YR52PWLWLEXYVRACORS2RXNO2DUTJ` |
| `perp-oracle-adapter` | Guarded price snapshots: publisher auth, staleness, quorum median, deviation bounds | `CD3ZFYZPLJ6W2KO6HD7HE5P5Q27M5N6ITUPHQDRP23NBIVKE6WTUY25F` |
| `perp-liquidation` | Account-health liquidation executor, capped rewards, bad-debt recording | `CBGSXCZTZOSBMM5RLGZWWLE2USNAXL5ZKCHTZQ6DOKBD3PIEUJXFYDRO` |
| `perp-insurance` | Insurance fund custody, rewards, bad-debt accounting | `CCBEJ3F2PUV5OA4JNX3CPSOJFQMYMFDPLNANR2GJZVQEEBFMB6JYNL54` |
| `perp-risk` | Soroban boundary around the pure-Rust risk engine | `CBHZWEIKXULFIH6DCSS7W6BJ3YUVQ5TJFYPP4UKQC4NKLNAF7VLPNVUI` |
| `perp-governance` | Timelock proposal registry (48h minimum) and guardian pause | `CDSIEH7UZ62BT523G3RGJQGJHE7AI4EV265ESKZB672GTIEZNBYPYDXU` |

Collateral is USDC (Circle SAC `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`). The launch market is `XLM-PERP` at up to 10× leverage.

### What this submission adds

Kryon works. What it lacks is reach: collateral can only arrive as USDC already on Stellar, market makers have no API to quote against, and most Stellar users cannot connect a wallet. Every feature below removes one of those constraints.

**1. One-step cross-chain deposit — Axelar + Circle CCTP**
Today a trader holding USDC on Ethereum, Arbitrum, Base or Solana must bridge to Stellar, then deposit — two disconnected steps, and where most external capital gives up. We are building a Soroban receiver that accepts an Axelar General Message Passing call and credits the vault directly, with native USDC moving over CCTP on routes that support it.
*How Stellar is used:* a new Soroban contract receives authenticated Axelar messages and calls `perp-vault.deposit` on the trader's behalf; CCTP mints native USDC on Stellar rather than a wrapped asset.
*Impact:* collateral arrives from 70+ chains in a single signed action. This is the highest-leverage change available to us for bringing outside capital onto Stellar.

**2. Public REST and WebSocket API, plus a TypeScript SDK**
Our endpoints are internal route handlers with no external contract or authentication. We are extracting a documented, versioned public API with API-key auth and rate limiting, a streaming feed for order-book deltas and trades, and an npm-published SDK with a working reference market-maker bot.
*How Stellar is used:* the API exposes SEP-53 order-intent signing and reads live protocol state from Soroban RPC; the SDK constructs canonical signing messages that on-chain `settle_fill_signed` verification accepts byte-for-byte.
*Impact:* market makers and trading bots can integrate. An order book without programmatic access cannot attract professional liquidity, and liquidity is what makes a derivatives venue work.

**3. Market listing framework, and BTC-PERP and ETH-PERP**
Adding a market currently means a bespoke config and deployment. We are building a factory with governance-gated listing and feed-qualification checks enforced in contract, then using it to list BTC and ETH and harden the multi-market risk path.
*How Stellar is used:* a new Soroban factory deploys and registers markets; listing is a timelocked `perp-governance` proposal; qualification checks read the oracle's SEP-40 interface on-chain.
*Impact:* every future market becomes a configuration change rather than an engineering project — including markets no grant needs to fund.

**4. Multi-wallet support — Stellar Wallets Kit**
Kryon is Freighter-only. We are migrating to Stellar Wallets Kit to support Lobstr, xBull, Albedo, Hana and Ledger.
*How Stellar is used:* the kit handles both signing surfaces Kryon depends on — SEP-53 `signMessage` for order intents and `signAuthEntry` for Soroban authorisation entries — with wallets lacking the latter routed through our autonomous signed-settlement path.
*Impact:* most Stellar users currently cannot trade on Kryon at all. This is the cheapest user-facing unlock in the roadmap.

**5. Liquidity Provider vault**
Kryon has an insurance fund but no passive liquidity layer, so the book depends entirely on active quoting. We are building a vault that accepts USDC, issues transferable share tokens, and quotes passively inside the protocol's existing risk limits.
*How Stellar is used:* a new Soroban vault issues SEP-41 share tokens and holds positions subject to the same on-chain OI caps, margin requirements and liquidation rules as any trader.
*Impact:* a thin book is unusable. Passive liquidity gives early traders something to trade against while external market making builds.

**6. Isolated margin**
The risk engine already separates cross and isolated health, but the order path cannot express the choice — the gateway hard-codes cross margin.
*How Stellar is used:* margin mode is threaded through the canonical SEP-53 signing message, the gateway's `require_auth_for_args` parameters, and the engine's margin locking and release.
*Impact:* traders can cap downside per position rather than risking their whole account, which is table stakes for anyone sizing a real position.

**7. Redundant infrastructure and mainnet launch**
Our seven services run on a single host with non-durable ingress. We are moving to redundant deployment with health-gated failover, a public status page, and alerting — then shipping everything to mainnet through the 48-hour governance timelock, raising the deposit cap on a published risk-gated schedule, and making the terminal usable on mobile.
*How Stellar is used:* contract upgrades execute as timelocked `perp-governance` proposals with published transaction hashes; keepers maintain contract TTLs under the new topology.
*Impact:* a venue holding user collateral needs to be operationally credible. This is what lets us lift the $500 deposit cap responsibly.

### How Kryon uses Stellar today

Every economically meaningful action is a Soroban state transition. Collateral lives in `perp-vault` and never moves to an operator.

A trader signs an order intent as a SEP-53 message. The matcher may only settle fills that **both** counterparties have signed, and the order gateway verifies each owner's authorisation over the exact order parameters — `market_id, is_long, size, limit_price, reduce_only, nonce, expiry_ts` — via `require_auth_for_args` before it is permitted to call the engine. Nonce-keyed `Filled(owner, nonce)` and `Cancelled(owner, nonce)` storage prevents replay and overfill.

The authorisation graph is strict and one-directional: `engine.open_position` requires the order gateway; `vault.apply_pnl` requires the engine; end-user signatures are demanded only where a user spends their own funds or revokes their own order. The operator cannot invent positions, move collateral, or bypass price bands, expiry, cancellation, overfill or self-trade checks — every one of those is enforced on-chain.

Settlement rides Stellar's ~5s finality and sub-cent fees. That fee profile is precisely what makes *per-fill on-chain settlement* economically viable on Stellar and impractical on most L1s, where perp venues are forced to settle in batches or off-chain entirely.

### Current limitations this award addresses

1. **One market, hardcoded.** BTC and ETH configs exist but were never enabled, and there is no framework for listing a new market. Multi-market account health and funding are untested at scale.
2. **Isolated margin is not wired end to end.** The gateway hard-codes `MarginMode::Cross` and the order struct carries no margin-mode field.
3. **Deposits are Stellar-only.** Collateral must already be USDC on Stellar — the single largest friction point in onboarding external capital.
4. **No programmatic access layer.** Endpoints are internal same-origin route handlers with no external contract, auth or versioning.
5. **Freighter only.** Most Stellar users cannot connect.
6. **No passive liquidity.** An insurance fund exists, but no LP layer.
7. **Single service host.** No redundancy, and non-durable WebSocket ingress.

---

## Market & Business Case

**The gap.** Perpetual futures are the highest-volume product category in crypto by a wide margin, and Stellar has no mature venue for them. Every major L1 has several; Stellar's derivatives layer is effectively unbuilt. Meanwhile the ecosystem's spot and lending layers have matured substantially — DefiLlama tracks roughly **$786M of Stellar DeFi TVL** across 15 protocols (Spiko $527M, Blend $137M, Aquarius $46M; snapshot 20 July 2026). That is a large collateral base with nowhere to express a leveraged or hedged view on-chain.

**The developer signal.** Stellar has **3,833 monthly-active developers**, up **208% year over year**, with an all-time peak on 15 July 2026 (Electric Capital Open Dev Data, as of 22 July 2026). Kryon's public API and SDKs are aimed squarely at that cohort: a documented perps API is the piece of infrastructure that lets other Stellar builders create trading bots, structured products, hedged vaults and aggregators without writing a matching engine.

**Cross-chain capital is now addressable, and wasn't a year ago.** Two pieces of infrastructure landed on Stellar in 2026 that change the onboarding calculus for a derivatives venue:

- **Axelar** went live for Stellar on **16 February 2026**, connecting 70+ chains with General Message Passing so a Soroban contract can be *called* from another chain, not merely receive tokens. Its Stellar amplifier implementation has been security-assessed by OtterSec.
- **Circle CCTP** went live on Stellar in **May 2026**, moving native USDC between Stellar and 23+ chains via 1:1 burn-and-mint — no wrapped assets, no third-party bridge risk.

Together these make a genuinely one-step cross-chain deposit possible: a trader holding USDC on Arbitrum or Base signs once and their collateral lands inside `perp-vault`, ready to trade. Today that same trader performs two disconnected operations and most abandon at the first. Perp venues are unusually sensitive to this, because a trader's decision to open a position is time-sensitive — a multi-step onboarding that takes minutes loses the trade. This is the single highest-leverage change available to Kryon for external capital, which is why it is funded here.

**Why an order book, and how Kryon differs from existing work.** Leveraged-trading work on Stellar to date is either pool-priced (a vault takes the other side and a keeper marks positions) or recursive-lending-based. Both are legitimate, and both avoid the hard problem. Kryon is a genuine **central-limit order book**: price-time priority, partial fills, maker/taker, market-order walking, with every fill settled individually on-chain into one volume-weighted position per (trader, market).

That distinction matters commercially, not just architecturally. Professional market makers price against a book, not a pool; they will not quote into an AMM-style perp because they cannot manage inventory. An order book is the precondition for real liquidity, and real liquidity is the precondition for the volume that makes a derivatives venue self-sustaining.

**Comparable prior art on Stellar** (for reviewer context, all publicly listed): Stellars Finance (SCF #40), Noether (SCF #41, still testnet as of its last recorded activity 11 July 2026), AXIS (SCF #42, a spot CLOB using the same off-chain-match / on-chain-settle pattern), Turbolong (SCF #43, recursive leverage on Blend). Kryon is the only one of these that is a perpetuals order book live on mainnet.

**Value to the ecosystem.** A working derivatives venue gives Stellar's stablecoin and RWA holders somewhere to hedge, gives market makers a reason to hold inventory on Stellar, and creates sustained USDC demand and transaction volume on pubnet. The cross-chain deposit path routes capital *into* Stellar that has no other reason to arrive. The public API and SDKs make the venue composable rather than a walled garden.

---

## Revenue Model & Sustainability

**What Kryon costs to run.** Seven off-chain services on one host, a managed Postgres, Soroban RPC, and the transaction fees the keepers pay. The oracle is the only meaningful on-chain cost, and it publishes on deviation-or-heartbeat rather than a fixed tick — roughly 1–3 XLM a day, not the hundreds a naive implementation would burn. Everything else runs in the tens of dollars a month. Kryon is cheap to operate, and that is the same property that makes per-fill on-chain settlement viable here and nowhere else.

**Where revenue comes from.** `perp-engine` charges a maker and taker fee on the notional of every fill and credits it to a configurable fee recipient, settled in USDC through the vault. The mechanism is deployed on mainnet and covered by contract tests. **It is currently set to zero.** `set_fee_config` has never been called for `XLM-PERP`, so the venue has charged no trading fee since launch — the right posture for a guarded beta running a $500 deposit cap, and not a permanent one. The 50bp liquidation fee is live and funds the liquidation keeper's reward.

**When fees turn on.** Trading fees are enabled at Tranche 3, alongside the deposit-cap lift, at **1bp maker and 5bp taker** — the rates already modelled in the engine's test fixtures. Enabling them is a governance action through the 48-hour timelock, so the change is published and reviewable before it takes effect rather than being a silent parameter flip.

**What break-even looks like.** At 5bp taker, roughly **$160,000 of monthly notional volume** covers Kryon's entire operating cost. Across three markets with a single active market maker that is a low bar — but it is not one Kryon clears today, because volume is near zero for exactly the reasons this award addresses.

**Closing the loop between revenue and operations.** Fees accrue in USDC; keepers spend XLM. Nothing connected the two, and in July 2026 that gap bit us: the state database exceeded its plan quota, the services that depend on it stalled, and the oracle correctly suspended publishing — with no alerting configured to tell anyone. A keeper-refill job now converts a slice of fee revenue into XLM on the Stellar DEX and tops up any keeper below its floor, with operator-balance alerting in front of it. Both are folded into the Tranche 3 observability deliverable, and the incident is why that deliverable is scoped the way it is.

**Until then, the team funds operations.** We have carried Kryon's full running cost since launch and will continue to through the award period; no SCF funds are requested for hosting beyond the Tranche 3 line item. The honest position is that a derivatives venue becomes self-sustaining only once it has volume, and volume is what the cross-chain deposit path, the public API and multi-wallet support exist to produce. That is the sequence this award funds — not a promise that revenue arrives on its own.

---

## Market Listing Strategy

Rather than hardcoding a fixed list of markets, this award funds a **market listing framework**: a factory plus governance-gated listing flow, so a new market is a configuration and a qualified price feed rather than a bespoke deployment. Markets are then listed in waves as feeds qualify.

**Feed qualification criteria.** A market may only be listed when its price feed demonstrably satisfies the engine's existing guards:

- ≥3 independent price sources, with a ≥2-source minimum enforced at publish time.
- Achievable staleness inside the market's `max_oracle_age_secs` (120s on current markets).
- Observed source-deviation inside the configured bound over a 14-day measurement window.
- Sufficient reference liquidity that the execution price band is not routinely breached.

**Launch waves:**

| Wave | Markets | Status | Gate |
|---|---|---|---|
| Live | `XLM-PERP` | Trading on mainnet | — |
| Wave 1 — funded, Tranche 2 | `BTC-PERP`, `ETH-PERP` | Configs exist, never enabled | Deep CEX coverage across all three existing sources; highest confidence |
| Wave 2 — framework-enabled, **not funded by this award** | `SOL-PERP`, `XRP-PERP`, Stellar-native assets, FX pairs | New | Listed through governance if and when a feed clears the criteria above |

**Only Wave 1 is a committed deliverable.** The framework this award funds makes every subsequent listing a configuration change rather than an engineering project, so Wave 2 requires no further grant funding — but we are not promising markets whose feeds we have not yet qualified. We would rather ship a framework and three solid markets than commit to a dozen thin ones.

---

## On-chain Growth Goals & Measurement

*(Required for Open Track.)*

### Measurement methodology — read this first

All figures below are measured **excluding every address controlled by the Kryon team**. We publish and maintain a public exclusion list of team-controlled Stellar addresses — deployer, governance, oracle publisher, matcher operator, liquidator, guardian, insurance, and any internal testing or book-bootstrapping wallets — in the repository, versioned in git so additions are auditable. Every metric is computed against on-chain state from the mainnet contracts and is independently reproducible by a reviewer from public ledger data plus that exclusion list. Nothing in this section counts protocol-internal or team-originated activity.

Metrics are exported from the state indexer and published on a public dashboard, refreshed daily, alongside the query definitions used to produce them.

**The funded work concludes with Tranche 3 on 23 January 2027.** Targets 1 and 2 fall inside that funded window and are gated on delivery. Targets 3 and 4 are *reporting commitments only* — we continue publishing the same dashboard after the award closes so the ecosystem impact is measurable, but no further funding is requested for them and no tranche depends on them.

### Target 1 — in-window checkpoint, at Tranche 2 (testnet, 10 December 2026)

- ≥25 distinct non-excluded addresses have placed a signed order via the public API or SDK.
- ≥2 external developers have run the reference market-maker bot against the testnet book.
- Public metrics dashboard live and publishing daily, with the address exclusion list committed.

### Target 2 — controlled targets, at Tranche 3 (mainnet, 23 January 2027)

Deliverable-gated and fully within our control:

- **Three markets live on mainnet:** `XLM-PERP`, `BTC-PERP`, `ETH-PERP`, each with an independent guarded oracle feed.
- Market listing framework deployed on mainnet, with listing gated through `perp-governance`, so further markets need no additional grant funding.
- **One-step cross-chain deposit live** from at least three external chains.
- LP vault deployed on mainnet with public share-price accounting.
- Public REST and WebSocket API live, with the TypeScript SDK published to npm.
- Public metrics dashboard and status page live, with the address exclusion list published.
- Deposit cap lifted from $500 against the published risk-gated schedule.

### Target 3 — adoption, at T3 + 90 days *(post-award reporting)*

| Metric | Target | Definition |
|---|---|---|
| Distinct external traders | **150** | Non-excluded addresses that have completed ≥1 on-chain `settle_fill` |
| External TVL | **$75,000** | USDC held in `perp-vault` + LP vault attributable to non-excluded addresses |
| Cumulative external notional volume | **$2,000,000** | Sum of fill notional where ≥1 side is non-excluded, since T3 |
| Capital arriving cross-chain | **$30,000** | Cumulative USDC deposited via the cross-chain path from non-excluded addresses |
| Independent market makers | **3** | Distinct non-excluded addresses quoting two-sided via the public API for ≥14 consecutive days |
| Days of continuous mainnet uptime | **≥85 of 90** | Oracle fresh + settlement healthy, per public status page |

### Target 4 — ecosystem composability, at T3 + 180 days *(post-award reporting)*

- **At least one independent third party in production against Kryon's public API or SDK** — a trading bot, wallet, aggregator or structured-product vault built by a team unaffiliated with Kryon, evidenced by a public repository or a live integration.

These targets are deliberately conservative. Kryon's mainnet deposit cap is currently $500 while the protocol ramps, and the honest position is that external adoption starts near zero: the venue works, but it has not yet been opened up, made integrable, or reachable from where the capital actually sits. The award funds exactly the work that removes those blockers, and the numbers above are what we believe is defensible rather than what would look impressive.

---

## Traction Evidence

Kryon is a working exchange live on Stellar mainnet since **7 July 2026**, not a prototype. Everything below is independently verifiable today.

### Live Protocol

- Trading app: https://kryonprotocol.vercel.app
- Documentation: https://kryonprotocol.vercel.app/docs
- Source code: https://github.com/Kryon-Protocol/Kryon
- X: https://x.com/KryonProtocol

### Deployed Contracts (Stellar Mainnet — all verifiable on stellar.expert)

- **Perp Vault** (collateral custody): https://stellar.expert/explorer/public/contract/CDXGTJQS3XLGXSWDUHKMS5PBBFRRKRXRWH3HTBFNXBIAYEZNDTDKLR4J
- **Perp Engine** (positions, funding, PnL): https://stellar.expert/explorer/public/contract/CD6OMHCRDDBDO7I57HCUU52RORFPP7DUIRULWFBOX5WLCO5H2OB3W6LZ
- **Order Gateway** (settlement entry point): https://stellar.expert/explorer/public/contract/CBA2PSRHSIFTSUAFZWMF6CARNO7YR52PWLWLEXYVRACORS2RXNO2DUTJ
- **Oracle Adapter** (guarded price feeds): https://stellar.expert/explorer/public/contract/CD3ZFYZPLJ6W2KO6HD7HE5P5Q27M5N6ITUPHQDRP23NBIVKE6WTUY25F
- **Liquidation** (account-health executor): https://stellar.expert/explorer/public/contract/CBGSXCZTZOSBMM5RLGZWWLE2USNAXL5ZKCHTZQ6DOKBD3PIEUJXFYDRO
- **Insurance Fund** (bad-debt backstop): https://stellar.expert/explorer/public/contract/CCBEJ3F2PUV5OA4JNX3CPSOJFQMYMFDPLNANR2GJZVQEEBFMB6JYNL54
- **Risk Engine**: https://stellar.expert/explorer/public/contract/CBHZWEIKXULFIH6DCSS7W6BJ3YUVQ5TJFYPP4UKQC4NKLNAF7VLPNVUI
- **Governance** (48h timelock): https://stellar.expert/explorer/public/contract/CDSIEH7UZ62BT523G3RGJQGJHE7AI4EV265ESKZB672GTIEZNBYPYDXU
- **USDC** (Circle SAC, collateral asset): https://stellar.expert/explorer/public/contract/CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75

Deployed WASM hashes match the optimised build artefacts recorded in the deployment manifest. `XLM-PERP` is trading live, collateralised in USDC at up to 10× leverage, with a $500 deposit cap held deliberately during ramp-up.

### Proven on Mainnet, Not Only in Tests

- **Autonomous liquidation executed in production.** The liquidation keeper detected and closed a genuinely underwater 8× position without intervention; the insurance fund paid the keeper reward; token-reserve drift reconciled to 0.0000 USDC and bad debt to 0. This is the hardest thing a perpetuals protocol has to get right, and it has been demonstrated on mainnet.
- **Guardian pause drilled on the live vault** — paused by the guardian key, unpaused by admin, verified on-chain.
- **Admin authority transferred on-chain** to the `perp-governance` timelock for the oracle adapter, vault, engine and order gateway. The contract rejects any configuration with a minimum delay below 48 hours, so the timelock cannot be weakened after the fact.
- **Guarded oracle running in production** — median of three CEX sources with a ≥2-source minimum, publish-time staleness rejection, monotonic replay rejection, confidence bounds, source-deviation bounds and a USDC-depeg guard, publishing deviation-or-heartbeat below the engine's `max_oracle_age_secs`. A stale mark fail-stops settlement rather than trading through it.

### Codebase Scope

- **~31,000 lines, fully open source.** Eight Soroban contracts (~5,500 lines of `#![no_std]` Rust) over a pure-Rust `protocol-core` fixed-point workspace and a standalone `risk-engine` crate; ~11,600 lines of TypeScript services; a ~7,000-line Next.js 16 / React 19 trading terminal.
- **Seven services running 24/7 against mainnet:** matcher, oracle keeper, state indexer, WebSocket server, settlement reconciler, liquidation keeper and alerting monitor.

### Security & Testing

- **Five internal audit reports**, including a dedicated mainnet-implementation audit. Every high and critical finding was fixed and the contracts redeployed before launch.
- `cargo test --workspace` across math, risk engine, contracts and matcher determinism, plus E2E, load, soak, failure-recovery and production-gate suites, and stateful solvency-invariant, fuzz and chaos harnesses.
- CI enforces lint, typecheck, dependency review and CodeQL on every push.
- Full threat model and trust assumptions published: https://kryonprotocol.vercel.app/docs/security

### Market Validation

- Stellar DeFi TVL is roughly **$786M across 15 tracked protocols** (DefiLlama, 20 July 2026) — a substantial collateral base with no venue to hedge or express leverage on-chain.
- Stellar has **3,833 monthly-active developers, up 208% year over year** (Electric Capital Open Dev Data, 22 July 2026) — the audience for Kryon's public API and SDKs.
- Perpetual futures are the highest-volume product category in crypto. Every major L1 has multiple venues; Stellar has no mature one.

### What We Are Not Claiming

We are **not** presenting trading volume, TVL or user counts as traction. The venue works, but the deposit cap has been held at $500 during ramp-up and external usage is not yet meaningful — because collateral must already be USDC on Stellar, there is no programmatic access layer for market makers, and only one wallet is supported. Those are precisely the blockers this award removes. All growth is measured from the Tranche 3 baseline under the exclusion methodology defined above, net of every team-controlled address.

---

## Scope Clarification — what this award funds vs. what is already live

Kryon's eight contracts, the matching engine, the oracle keeper, the indexer, the liquidation keeper and the trading terminal were built and deployed to mainnet **without SCF funding**. None of that is a deliverable here, and no line item below pays for work already completed.

This award funds ~19 weeks of net-new engineering that does not exist on mainnet today, across five areas:

1. **Risk features the protocol cannot yet express** — isolated margin, multi-market portfolio risk.
2. **Market scalability** — a listing framework replacing hardcoded markets, plus the markets it enables.
3. **Reachability of external capital** — one-step cross-chain deposit via Axelar and CCTP.
4. **The programmatic access layer market makers require** — public REST/WebSocket API, SDKs, multi-wallet support.
5. **Liquidity and operational resilience** — LP vault, redundant service fleet, observability.

Every acceptance criterion is written against an artefact a reviewer can verify independently: a deployed contract on stellar.expert, a merged commit in the public repository, a reachable endpoint, a published package, or a published test report.

---

## Deliverables & Budget

**Total requested: $99,000** USD equivalent in XLM, over ~19 weeks, completing 23 January 2027.

### How this budget was built

Every deliverable is costed bottom-up as **hours × role rate**. Three roles, three rates:

| Role | Rate | Hours | Cost | Weekly over ~19 weeks |
|---|---|---|---|---|
| **Protocol engineer** — Rust / Soroban contracts | $70/hr | 613 | $42,910 | ~33 hrs |
| **Full-stack & infrastructure** — API, SDK, terminal, services | $55/hr | 746 | $41,030 | ~40 hrs |
| **Risk / quantitative engineer & QA** — margin model, invariants, harnesses | $60/hr | 251 | $15,060 | ~14 hrs |
| **Total** | **$61.49/hr blended** | **1,610** | **$99,000** | ~87 hrs |

Rates reflect the team's actual cost base, not contractor market rates. The weekly load is deliberately sustainable: this team already operates a live protocol on mainnet, and a budget that assumed every hour was greenfield development would not survive contact with production.

### What we scoped out, and why

We considered a larger application. Four items were cut to keep the ask proportionate to a first SCF award and the team's real capacity:

- **Multi-operator settlement and permissionless exit** — valuable decentralisation work, but it brings no traders and no capital. Deferred.
- **Python SDK** — the TypeScript SDK ships; most Stellar market makers are JS-first. Python follows post-award.
- **Reflector oracle integration** — Kryon's guarded three-source CEX oracle is already in production. Reflector's standard five-minute tick cannot drive a 120-second staleness bound without a subscription feed, so this is research-dependent and belongs in a later cycle.
- **SOL and XRP markets** — the listing framework funded here makes them a configuration change, not a grant-funded project.

Everything retained either brings capital in, brings market makers in, or is required to launch safely.

### Payout structure vs. deliverable value

Two separate things, so the tables below do not match line for line — this is the standard SCF structure:

- **Deliverable value** is what each tranche's engineering costs (T1 $25,325 · T2 $32,995 · T3 $40,680 = $99,000).
- **Payout** follows SCF's fixed 10/20/30/40 schedule against the total.

| Payment | Trigger | % | Amount |
|---|---|---|---|
| Tranche #0 | Award acceptance | 10% | $9,900 |
| Tranche #1 | MVP verified | 20% | $19,800 |
| Tranche #2 | Testnet verified | 30% | $29,700 |
| Tranche #3 | Mainnet launch verified | 40% | $39,600 |
| | | | **$99,000** |

### Schedule

**All funded work completes on 23 January 2027.** SCF #45 closes 16 August 2026; with prescreen, panel review and community voting, award notification is expected mid-September. The completion dates below are firm commitments, and every interval sits well inside SCF's 90-day maximum between tranche submissions (41 and 44 days respectively). Total duration is roughly 19 weeks — comfortably inside the 6-month cap.

| Tranche | Completion date | Elapsed from acceptance |
|---|---|---|
| #0 — acceptance | mid-September 2026 | — |
| #1 — MVP | **30 October 2026** | ~6 weeks |
| #2 — Testnet | **10 December 2026** | ~12 weeks |
| #3 — Mainnet | **23 January 2027** | ~19 weeks |

---

### Tranche #1 — MVP — $25,325 — due 30 October 2026

**Tranche #1: $25,325 (Due 30/10/2026)**

- **D1. Isolated-margin mode, end to end: $10,550**
  110h protocol ($7,700) + 30h full-stack ($1,650) + 20h risk ($1,200) = 160h
- **D2. Public REST trading API v1: $10,800**
  35h protocol ($2,450) + 130h full-stack ($7,150) + 20h risk ($1,200) = 185h
- **D3. WebSocket streaming market-data feed: $3,975**
  5h protocol ($350) + 55h full-stack ($3,025) + 10h risk ($600) = 70h

*Tranche total: 415 hours — $25,325*

#### D1. Isolated-margin mode, end to end — $10,550

The risk engine already separates cross and isolated health in two passes, but the order path cannot express the choice: the order gateway hard-codes `MarginMode::Cross` and the order struct carries no margin-mode field. We will thread margin mode through the entire path — order intent and canonical SEP-53 signing message, gateway authorisation arguments, engine `open_position` / `reduce_position` margin locking and proportional release — and surface the toggle in the terminal.

*Where the money goes:* 110 protocol hours across gateway, engine and risk crate, plus the signing-message change and its byte-level golden test; 30 full-stack hours for the terminal toggle and portfolio display; 20 risk hours for the isolated-vs-cross liquidation test matrix.

**How completion is measured**
- Order struct and canonical signing message carry `margin_mode`; the byte-level golden test is updated and passing.
- A trader opens an isolated position on testnet whose losses are capped at its locked margin and cannot draw on cross collateral — proven by a contract test and a linked testnet transaction.
- Liquidating an isolated position leaves other positions untouched; cross positions continue to liquidate on aggregate account health.
- Per-position margin mode selectable in the trade terminal and shown in the portfolio view.

#### D2. Public REST trading API v1 — $10,800

Kryon's endpoints exist today as internal same-origin route handlers with no external contract, no authentication and no stability guarantee — market makers cannot integrate against them. We will extract a standalone, documented, versioned public API: order placement and cancellation, position and balance queries, market data (order-book depth, trades, funding, OHLCV candles), API-key authentication and per-key rate limiting.

*Where the money goes:* 130 full-stack hours build the API service, authentication and rate limiting; 35 protocol hours cover the signing and settlement interfaces the API must expose correctly; 20 risk hours are the integration test suite and load validation.

**How completion is measured**
- OpenAPI 3 specification published and served at a stable versioned path.
- A third party places, queries and cancels a signed order on testnet using only the published specification and no Kryon frontend code.
- API-key authentication and rate limiting enforced, with a public rate-limit table.
- Published integration test suite exercising every documented endpoint.

#### D3. WebSocket streaming market-data feed — $3,975

Polling is unusable for market making. We will ship a WebSocket feed carrying order-book deltas, trades, price ticks and account updates, with documented reconnect and resubscribe semantics.

*Where the money goes:* 55 full-stack hours for the streaming server, subscription model and reconnect handling; 10 risk hours for latency and reconnect-storm validation; 5 protocol hours for event-schema alignment with on-chain settlement.

**How completion is measured**
- WebSocket server deployed alongside the REST API, with per-market subscription channels.
- Order-book and trade updates delivered within 500ms of settlement.
- Documented reconnect and resubscribe semantics, validated under a reconnect-storm test.
- Connection examples published in the API reference.

---

### Tranche #2 — Testnet — $32,995 — due 10 December 2026

**Tranche #2: $32,995 (Due 10/12/2026)**

- **D1. Market listing framework: $9,525**
  95h protocol ($6,650) + 25h full-stack ($1,375) + 25h risk ($1,500) = 145h
- **D2. BTC-PERP and ETH-PERP with multi-market risk: $8,590**
  55h protocol ($3,850) + 36h full-stack ($1,980) + 46h risk ($2,760) = 137h
- **D3. Stellar Wallets Kit integration: $7,005**
  10h protocol ($700) + 95h full-stack ($5,225) + 18h risk ($1,080) = 123h
- **D4. TypeScript SDK + reference market-maker bot: $7,875**
  25h protocol ($1,750) + 95h full-stack ($5,225) + 15h risk ($900) = 135h

*Tranche total: 540 hours — $32,995*

#### D1. Market listing framework — $9,525

Kryon runs one market, and adding another means a bespoke config and deploy. We will build a market factory with a governance-gated listing flow, so listing becomes a parameterised, reviewable operation with feed-qualification criteria enforced in contract rather than by convention. This is the deliverable that makes every future market cheap.

*Where the money goes:* 95 protocol hours for the factory and listing contract and the on-chain feed-qualification checks; 25 full-stack hours for market-management tooling; 25 risk hours to define and validate the qualification thresholds.

**How completion is measured**
- Market factory deployed on testnet; listing a new market is a single governance-gated transaction taking market config plus an oracle feed reference.
- Feed qualification enforced on-chain: a market cannot be listed against a feed failing the configured source-count and staleness bounds.
- A market listed end to end on testnet through the factory alone, with no bespoke deployment.
- Listing procedure and qualification criteria published in the docs.

#### D2. BTC-PERP and ETH-PERP with multi-market risk — $8,590

BTC and ETH configs exist but were never enabled, because cross-market account health, per-market OI caps, per-market funding accrual and the multi-market liquidation path are untested at scale. We will list both through the factory and harden the multi-market risk path.

*Where the money goes:* 55 protocol hours for multi-market engine and vault health aggregation with per-market OI and funding accounting; 36 full-stack hours for multi-market portfolio and funding views; 46 risk hours for the stateful multi-market solvency invariant harness — the largest QA block in the award, because a multi-market accounting error is the most costly failure mode here.

**How completion is measured**
- `BTC-PERP` and `ETH-PERP` listed via the factory and trading on testnet with independent feeds, OI caps and funding indexes.
- Account health correctly aggregates exposure across all three markets; a stateful invariant test proves solvency across randomised multi-market position sets.
- A liquidation triggered by losses in one market draws on shared cross collateral in a documented, tested order.
- Multi-market portfolio and funding views live in the terminal.

#### D3. Stellar Wallets Kit integration — $7,005

Kryon is Freighter-only, which excludes most Stellar users. We will migrate the wallet layer to **Stellar Wallets Kit** (on the current SCF Integration List), covering Lobstr, xBull, Albedo, Hana and Ledger — including both signing surfaces Kryon depends on: SEP-53 `signMessage` for order intents and `signAuthEntry` for Soroban authorisation entries.

*Where the money goes:* 95 full-stack hours to replace the wallet layer and handle per-wallet signing quirks and mobile deep-linking; 10 protocol hours to route wallets lacking `signAuthEntry` through the autonomous signed-settlement path; 18 risk hours for the five-wallet × two-surface E2E matrix.

**How completion is measured**
- A trader completes deposit → signed order → settled fill → close → withdraw on testnet with each supported wallet.
- Published E2E test matrix covering both signing surfaces per wallet, documenting which wallets lack `signAuthEntry`.
- Mobile deep-linking functional for wallets that support it.

#### D4. TypeScript SDK + reference market-maker bot — $7,875

Market makers do not integrate against raw HTTP. We will ship a published SDK wrapping the Tranche 1 API: order signing (canonical SEP-53 message construction — the part hardest to reimplement correctly), order management, position and account queries, and a streaming market-data client.

*Where the money goes:* 95 full-stack hours to build, package and document the SDK and the reference bot; 25 protocol hours to port and byte-verify the canonical signing implementation; 15 risk hours to validate the bot against the testnet book.

**How completion is measured**
- `@kryon/sdk` published to npm, open-source and versioned.
- A working reference market-maker bot published in the repository, quoting a two-sided ladder on testnet.
- Byte-level test proving the SDK's signing output is accepted by on-chain `settle_fill_signed` verification.
- Quickstart documentation published in the API reference.

---

### Tranche #3 — Mainnet — $40,680 — due 23 January 2027

**Tranche #3: $40,680 (Due 23/01/2027)**

- **D1. Axelar + CCTP cross-chain deposit: $13,220**
  115h protocol ($8,050) + 70h full-stack ($3,850) + 22h risk ($1,320) = 207h
- **D2. Liquidity Provider vault: $12,170**
  115h protocol ($8,050) + 40h full-stack ($2,200) + 32h risk ($1,920) = 187h
- **D3. HA service fleet, observability, status page: $6,865**
  8h protocol ($560) + 95h full-stack ($5,225) + 18h risk ($1,080) = 121h
- **D4. Mainnet launch, cap lift, responsive terminal, docs: $8,425**
  40h protocol ($2,800) + 75h full-stack ($4,125) + 25h risk ($1,500) = 140h

*Tranche total: 655 hours — $40,680*

#### D1. Axelar + CCTP cross-chain deposit — $13,220

Today a trader holding USDC on another chain must bridge to Stellar and then deposit — two disconnected steps, and the point where most external capital is lost. We will build a one-step cross-chain deposit: a Soroban receiver contract that accepts an **Axelar** General Message Passing call carrying a deposit instruction and credits `perp-vault` for the designated Stellar account. Native USDC moves over **Circle CCTP** on routes where CCTP supports both ends (burn-and-mint, no wrapped asset); Axelar GMP carries the contract call that turns arrival into a credited deposit rather than an idle balance.

The hard part is not the happy path — it is the failure path. A cross-chain deposit that half-completes must never strand funds.

*Where the money goes:* 115 protocol hours for the GMP receiver, source-chain authorisation, replay protection, the vault credit path and the refund/recovery mechanism with its adversarial tests; 70 full-stack hours for the source-chain deposit flow, route selection, quoting and cross-chain status tracking; 22 risk hours for failure injection — dropped messages, partial delivery, source-chain reorgs.

**How completion is measured**
- Soroban GMP receiver deployed to mainnet, accepting authenticated Axelar messages only from allowlisted source-chain contracts, with replay protection tested.
- A trader completes deposit → collateral credited → open position starting from USDC on an external chain, in a single signed action. Demonstrated from **at least three external chains** with published transaction hashes on both sides.
- CCTP used for USDC transport on every route where both ends support it; the route table and transport per route documented publicly.
- Failure path proven: a deliberately failed delivery produces a claimable refund, verified by an on-chain test and a recorded drill. No test case strands funds.
- Cross-chain deposit volume instrumented as a distinct metric in the public dashboard.

#### D2. Liquidity Provider vault — $12,170

A CLOB with a thin book is unusable, and Kryon has no passive liquidity layer. We will build a Soroban LP vault that accepts USDC deposits, issues transferable SEP-41 share tokens with a documented share-accounting model, and deploys that capital as a passive quoting counterparty inside the protocol's existing risk limits — earning maker fees and funding, and bearing PnL transparently.

*Where the money goes:* 115 protocol hours for share accounting, the SEP-41 share token, quoting integration and the adversarial deposit/redeem test suite; 40 full-stack hours to expose vault state through the API and terminal; 32 risk hours on share-price invariants, since mispriced mint/redeem is the classic vault exploit.

> *This deliverable funds the engineering only. No SCF funds are used as liquidity capital.*

**How completion is measured**
- LP vault deployed to mainnet; deposit, share mint, redeem and PnL accrual covered by contract tests including adversarial deposit/redeem-around-loss sequencing.
- Share price is a pure function of vault equity and share supply, with an invariant test asserting no depositor can mint or redeem at a stale price.
- Vault equity, share price, utilisation and realised PnL exposed via the public API and shown in the terminal.
- Vault capital subject to the same OI caps, margin requirements and liquidation rules as any trader — proven by a test that liquidates the vault's own position.

#### D3. HA service fleet, observability and status page — $6,865

The seven off-chain services run on a single host with non-durable WebSocket ingress — a single point of failure for a live venue. We will migrate to a redundant deployment with health-gated failover, replace the stopgap tunnel with durable ingress, and ship structured metrics, a public status page, and alerting on stale oracle, settlement backlog, liquidation backlog, bad debt and reconciliation drift.

*Where the money goes:* 95 full-stack hours for redundant deployment, failover, durable ingress, the metrics pipeline and status page; 18 risk hours for the chaos drill, 72-hour soak and reconciliation report; 8 protocol hours for contract TTL keepalive under the new topology. Hosting, RPC, managed Postgres and mainnet contract rent for the sprint are carried inside this line rather than billed as overhead.

**How completion is measured**
- Matcher, oracle keeper, indexer and liquidation keeper run redundantly with automatic failover; a documented chaos drill kills the primary with no missed settlement and no oracle staleness breach.
- Public status page showing per-service health, oracle freshness and settlement latency.
- Alert rules published in the repository; a drill triggers each alert class and records mean time to detection.
- 72 hours of continuous mainnet operation with zero stuck settlement jobs, evidenced by an exported reconciliation report.

#### D4. Mainnet launch, deposit-cap lift, responsive terminal and documentation — $8,425

Ship everything to mainnet through the 48-hour governance timelock, list BTC and ETH on mainnet via the factory, raise the deposit cap on a documented risk-gated schedule, and make the terminal usable below 1024px — it is desktop-only today, which excludes most of Stellar's mobile-first user base.

*Where the money goes:* 75 full-stack hours for the responsive terminal rework and integration documentation; 40 protocol hours to run the timelocked governance upgrade sequence and mainnet market listings; 25 risk hours to define and validate the cap-lift schedule against insurance coverage and observed open interest.

**How completion is measured**
- All contracts upgraded on mainnet via timelocked governance proposals with published transaction hashes.
- `BTC-PERP` and `ETH-PERP` live on mainnet, listed through the factory.
- Deposit cap raised against a published schedule tied to insurance-fund coverage ratio and observed open interest.
- Trading terminal fully usable at 390px width; order entry, position management and portfolio verified on iOS and Android browsers.
- Integration documentation, API reference and SDK quickstart published; public metrics dashboard and address exclusion list live, establishing the growth-measurement baseline.

---

### What this budget does not fund

No line item pays for work already completed, marketing or user acquisition, token incentives or giveaways, liquidity provision capital, legal or entity costs, or a security audit.

**Related programs we intend to pursue separately, in sequence, not through this award:**

1. **SCF Audit Bank** — an external third-party audit of the LP vault and the cross-chain deposit receiver before they hold mainnet funds at scale. Kryon's five existing audit reports are internal, so this is the necessary next step, and the cross-chain receiver in particular warrants independent review.
2. **Stellar Liquidity Award** — liquidity bootstrapping capital, for which audited financial protocols with a live mainnet implementation may be invited to submit. We do not claim eligibility today; it follows the external audit above. Build funds are not the right instrument for that need and we are not asking for them here.

---

## Stellar Integrations Used

| Integration | Status | Role |
|---|---|---|
| **Axelar** (SCF Integration List) | New — Tranche 3 | General Message Passing for one-step cross-chain deposits from 70+ chains |
| **Circle CCTP** | New — Tranche 3 | Native USDC transport (burn-and-mint) on supported routes, no wrapped assets |
| **Stellar Wallets Kit** (SCF Integration List) | New — Tranche 2 | Multi-wallet connection layer: Lobstr, xBull, Albedo, Hana, Ledger |
| **Soroban / SEP-41** | Live | Collateral custody and LP share tokens |
| **SEP-53** | Live | Canonical signed order intents |
| **Circle USDC (SAC)** | Live | Settlement and collateral asset |

---

## Resubmission Feedback

Not applicable — this is Kryon's first SCF submission.

---

## Ambassador Affiliation

⚠️ **TODO** — state the referring SCF Ambassador if any, otherwise "None."

---

## Team

Three engineers building on-chain derivatives infrastructure for Stellar, supported by an advisory board. Between us we cover Rust and Soroban contract development, derivatives risk modelling, and production trading infrastructure. This team built and deployed Kryon to Stellar mainnet without external funding.

**Samya Deb Biswas — Founder & Protocol Engineer**

Founder and protocol architect of Kryon, a decentralised perpetuals protocol on Stellar. Specialises in DeFi protocol architecture, trading infrastructure, smart-contract engineering, risk and settlement systems, and production mainnet deployments. Previously architected and scaled multi-chain infrastructure across Stellar/Soroban, Avalanche, Celo, Solana, Algorand and Polygon, building cross-chain payment systems, developer tooling and production-grade blockchain infrastructure.

https://www.linkedin.com/in/samyadeb/

https://github.com/SamyaDeb

**Anindha Biswas — Co-Founder & Frontend Engineer**

Co-founder of Kryon, focused on frontend engineering and product experience. Works on the trading terminal, wallet integrations, client-side architecture, public APIs and developer tooling, with a focus on building fast, intuitive and reliable trading experiences.

https://www.linkedin.com/in/anindha-biswas-819138337/

**Akash Biswas — Co-Founder, Risk & Quantitative Engineer**

Risk engineer focused on derivatives margin systems and protocol solvency. Owns Kryon's margin and liquidation model, funding-rate design and oracle guard parameters, along with the invariant, stress and fuzz test harnesses. Leads the risk framework and protocol testing.

https://www.linkedin.com/in/akash-biswas-a69571322/

**Debanjan Mondal — Protocol & Multi-Chain Advisor**

Developer Relations at Rise In — a Stellar ecosystem developer-education project — and Head of Product at Kimia, focused on protocol design, developer ecosystems and multi-chain products. Brings experience across Rust, Solidity and Move, advising Kryon on protocol architecture, product direction and cross-chain strategy.

https://www.linkedin.com/in/debanjannn/

https://github.com/Debanjannnn

---

**Have we built other companies?** ⚠️ *[The form asks this explicitly — answer in one line. If Kryon is the first, say so; that is a fine answer and better than a blank.]*

---

## Legal Acknowledgements

⚠️ Completed in the SCF submission form (internal use, not shown publicly) — requires acceptance of the SCF terms of service and KYC/KYB for the receiving entity or individual.

---

## Pre-submission Checklist

### Blocking — the five `⚠️` fields

- [ ] Confirm https://github.com/Kryon-Protocol/Kryon is public and its README is current
- [ ] **Video presentation** recorded — team plus live product walkthrough; expected for Open Track
- [ ] **Ambassador affiliation** stated, or "None"
- [ ] **"Have you built other companies?"** answered in one line
- [ ] **Legal acknowledgements** accepted in the submission form

### Verify before submitting — affects claims already made in this document

- [ ] **Governance execute confirmed complete** for `perp-liquidation` and `perp-insurance`. The traction section states admin authority was transferred for the oracle adapter, vault, engine and gateway — confirm nothing broader is implied than what actually completed.
- [ ] **Address exclusion list committed** to the repository, so the growth methodology is verifiable on day one rather than promised.
- [ ] **Axelar and CCTP route support confirmed** for the three external chains committed to in Tranche 3 D2.
- [ ] **Oracle feed coverage confirmed** for BTC and ETH against the qualification criteria before those markets are committed.
- [ ] **Contract addresses re-verified** live on stellar.expert.
- [ ] **Capacity confirmed** — the budget assumes ~33 hrs/week protocol, ~40 hrs/week full-stack and ~14 hrs/week risk across ~19 weeks. Tranche #1 allows roughly six weeks from acceptance for 415 hours, leaving slack if award notification slips.

### Recommended, not required

- [ ] List Kryon in the Stellar ecosystem project directory — comparable projects are listed and Kryon currently is not.
- [ ] Register Stellar Passport builder profiles for the team.
- [ ] Publish the technical architecture in a single unified source and link it (the Docusaurus reference at `/docs` largely serves this already).

---

**Submit before 16 August 2026.**
