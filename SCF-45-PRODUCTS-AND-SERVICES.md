Kryon is a perpetual-futures exchange on Stellar with a genuine central-limit order book. Orders match off-chain for speed; custody, margin, funding and the settlement of every individual fill happen on Soroban. A trader signs an order intent as a SEP-53 message rather than a transaction, and the matcher may only settle fills that both counterparties have signed. Collateral never leaves the on-chain vault and never passes through an operator wallet.

Per-fill on-chain settlement is the Stellar-native part. At ~5s finality and sub-cent fees, settling every fill individually is economically viable here; on most L1s the same design forces batching or pushes settlement off-chain entirely. That is the architectural bet Kryon is built on, and it is why this is a Stellar project rather than a port.

Kryon has been live on Stellar mainnet since 7 July 2026 across eight Soroban contracts — vault, engine, order gateway, oracle adapter, liquidation, insurance, risk and governance — with Circle USDC as collateral. The launch market is `XLM-PERP` at up to 10x, with a $500 deposit cap held deliberately during ramp-up. Seven off-chain services support it: matcher, oracle keeper, state indexer, WebSocket server, settlement reconciler, liquidation keeper and alerting monitor. The codebase is ~31,000 lines, fully open source. Contract addresses and verification links are in Traction Evidence.

---

## How Kryon uses Stellar today

Every economically meaningful action is a Soroban state transition.

A trader signs an order intent as a SEP-53 message. The order gateway verifies each owner's authorisation over the exact order parameters — `market_id, is_long, size, limit_price, reduce_only, nonce, expiry_ts` — via `require_auth_for_args` before it is permitted to call the engine. Nonce-keyed `Filled(owner, nonce)` and `Cancelled(owner, nonce)` storage prevents replay and overfill.

The authorisation graph is strict and one-directional: `engine.open_position` requires the order gateway; `vault.apply_pnl` requires the engine; end-user signatures are demanded only where a user spends their own funds or revokes their own order. The operator cannot invent positions, move collateral, or bypass price bands, expiry, cancellation, overfill or self-trade checks. Every one of those is enforced on-chain.

---

## What is not true yet

We would rather state our gaps than have a reviewer find them.

**One market.** `BTC-PERP` and `ETH-PERP` configs exist but were never enabled. Multi-market account health and funding are untested at scale.

**Isolated margin is not wired end to end.** The risk engine separates cross and isolated health, but the order gateway hard-codes `MarginMode::Cross` and the order struct carries no margin-mode field.

**Deposits are Stellar-only.** Collateral must already be USDC on Stellar — the single largest onboarding friction.

**No programmatic access.** Endpoints are internal same-origin route handlers with no external contract, authentication or versioning. No market maker can integrate against them.

**Freighter only.** Most Stellar users cannot connect.

**No passive liquidity.** An insurance fund exists; no LP layer does.

**Trading fees are set to zero.** The fee mechanism is deployed and covered by contract tests, but `set_fee_config` has never been called on mainnet. That is the correct posture for a guarded beta and it changes at Tranche 3.

**Single service host.** Seven services run on one VM with non-durable WebSocket ingress. In July 2026 our managed Postgres exceeded its plan quota; the state services stalled, and because the oracle suspends publishing when it cannot observe protocol activity, on-chain publishing stopped with it. Detection worked correctly — and had no alert destination configured. The venue was quiet for three weeks, and that gap is visible in our on-chain history. It is the reason the Tranche 3 resilience work is scoped the way it is, and why operator-balance alerting and a revenue-to-operations refill loop are part of it rather than afterthoughts.

---

## Scope clarification: what this award funds

The eight contracts, matching engine, oracle keeper, indexer, liquidation keeper and trading terminal were built and deployed to mainnet **without SCF funding**. None of that is a deliverable here, and no line item pays for completed work.

This award funds ~19 weeks of net-new engineering that does not exist on mainnet today.

**1. One-step cross-chain deposit — Axelar + Circle CCTP.** A Soroban receiver accepts an authenticated Axelar General Message Passing call and credits `perp-vault` directly; native USDC moves over CCTP on routes where both ends support it, so no wrapped asset is involved. Collateral arrives from 70+ chains in a single signed action instead of bridge-then-deposit, which is where most external capital gives up. The hard part is not the happy path — it is ensuring a half-completed deposit never strands funds.

**2. Public REST and WebSocket API, plus a TypeScript SDK.** Versioned endpoints with API-key authentication and rate limiting, a streaming feed for order-book deltas and trades, and an npm-published SDK shipped with a working reference market-maker bot. The SDK constructs canonical SEP-53 signing messages that on-chain verification accepts byte-for-byte — the part that is hardest to reimplement correctly. An order book without programmatic access cannot attract professional liquidity, and liquidity is what makes a derivatives venue work.

**3. Market listing framework, then BTC-PERP and ETH-PERP.** A governance-gated factory with feed-qualification checks enforced in contract, so listing becomes a parameterised operation rather than a bespoke deployment — including markets no grant needs to fund.

**4. Multi-wallet support — Stellar Wallets Kit.** Lobstr, xBull, Albedo, Hana and Ledger, covering both signing surfaces Kryon depends on: SEP-53 `signMessage` for order intents and `signAuthEntry` for Soroban authorisation entries, with wallets lacking the latter routed through our signed-settlement path. This is the cheapest user-facing unlock in the roadmap.

**5. Liquidity Provider vault.** A Soroban vault issuing transferable SEP-41 share tokens that deploys capital as a passive quoting counterparty inside the protocol's existing risk limits — subject to the same OI caps, margin requirements and liquidation rules as any trader. A thin book is unusable; passive liquidity gives early traders something to trade against while external market making builds. This funds engineering only; no SCF funds are used as liquidity capital.

**6. Isolated margin, end to end.** Margin mode threaded through the canonical signing message, the gateway's authorisation arguments, and the engine's margin locking and proportional release, then surfaced in the terminal.

**7. Redundant infrastructure, observability and mainnet launch.** Health-gated failover, durable ingress, a public status page, alerting on stale oracle, settlement backlog, bad debt and reconciliation drift, plus the keeper-refill loop that converts fee revenue into operating XLM. Then everything ships to mainnet through the 48-hour governance timelock, with the deposit cap raised on a published risk-gated schedule and the terminal made usable on mobile.

---

## Why an order book, and how Kryon differs

Leveraged-trading work on Stellar to date is either pool-priced — a vault takes the other side and a keeper marks positions — or recursive-lending-based. Both are legitimate, and both avoid the hard problem.

Kryon is a genuine CLOB: price-time priority, partial fills, maker/taker, market-order walking, with every fill settled individually on-chain into one volume-weighted position per (trader, market). That distinction is commercial, not merely architectural. Professional market makers price against a book, not a pool; they will not quote into an AMM-style perp because they cannot manage inventory. An order book is the precondition for real liquidity, and real liquidity is the precondition for a venue that sustains itself.

Publicly listed prior art, for reviewer context: Hermes (SCF #32), Stellars Finance (#40), Noether / NoEther (#41, which demonstrated cross and isolated margin on SDF's developer call in April 2026), AXIS (#42, a spot CLOB using the same off-chain-match / on-chain-settle pattern), Turbolong (#43), and a risk-parity perp CTA (#44). Kryon is the only perpetuals order book live on mainnet today. We expect competition in this category rather than assuming its absence.

---

## Market

Perpetual futures are the highest-volume product category in crypto. Every major L1 has several venues; Stellar has no mature one. Meanwhile DefiLlama tracks roughly **$786M of Stellar DeFi TVL** across 15 protocols (snapshot 20 July 2026) — a substantial collateral base with nowhere to hedge or express a leveraged view on-chain. Stellar has **3,833 monthly-active developers, up 208% year over year** (Electric Capital, 22 July 2026), and a documented perps API is the infrastructure that lets that cohort build trading bots, structured products, hedged vaults and aggregators without writing a matching engine.

Two pieces of infrastructure landed in 2026 that change the onboarding calculus. **Axelar** went live for Stellar on 16 February 2026, connecting 70+ chains with General Message Passing so a Soroban contract can be *called* from another chain rather than merely receive tokens. **Circle CCTP** went live in May 2026, moving native USDC between Stellar and 23+ chains by 1:1 burn-and-mint. Together they make a genuinely one-step cross-chain deposit possible. Perp venues are unusually sensitive to this friction, because the decision to open a position is time-sensitive — onboarding that takes minutes loses the trade.

A working derivatives venue gives Stellar's stablecoin and RWA holders somewhere to hedge, gives market makers a reason to hold inventory on Stellar, and creates sustained USDC demand and transaction volume on pubnet.

---

## Market listing strategy

Rather than hardcoding a fixed list of markets, this award funds a factory plus a governance-gated listing flow. A market may only be listed when its price feed demonstrably satisfies the engine's existing guards: three or more independent sources with a two-source minimum enforced at publish time, achievable staleness inside the market's `max_oracle_age_secs`, observed source deviation inside the configured bound over a 14-day measurement window, and reference liquidity sufficient that the execution price band is not routinely breached.

- **Live:** `XLM-PERP`
- **Wave 1 — funded, Tranche 2:** `BTC-PERP`, `ETH-PERP`. Configs exist, deep CEX coverage across all three existing sources.
- **Wave 2 — framework-enabled, not funded here:** `SOL`, `XRP`, Stellar-native assets, FX pairs. Listed through governance if and when a feed clears the criteria above.

Only Wave 1 is a committed deliverable. The framework makes every subsequent listing a configuration change rather than an engineering project, so Wave 2 needs no further grant funding — but we are not promising markets whose feeds we have not yet qualified.

---

## On-chain growth goals and measurement

All figures below exclude every address controlled by the Kryon team. We publish and maintain a public exclusion list — deployer, governance, oracle publisher, matcher operator, liquidator, guardian, insurance, and any internal testing or book-bootstrapping wallets — versioned in git so additions are auditable. Every metric is computed from mainnet contract state and is independently reproducible by a reviewer from public ledger data plus that list. Nothing counts protocol-internal or team-originated activity.

**Target 1 — at Tranche 2 (testnet, 10 December 2026)**
- 25 or more distinct non-excluded addresses have placed a signed order via the public API or SDK
- 2 or more external developers have run the reference market-maker bot against the testnet book
- Public metrics dashboard live and publishing daily, with the exclusion list committed

**Target 2 — at Tranche 3 (mainnet, 23 January 2027).** Deliverable-gated and fully within our control.
- Three markets live on mainnet, each with an independent guarded oracle feed
- Listing framework deployed, with listing gated through `perp-governance`
- One-step cross-chain deposit live from at least three external chains
- LP vault deployed with public share-price accounting
- Public REST and WebSocket API live, TypeScript SDK published to npm
- Trading fees enabled through the timelock; deposit cap lifted on the published risk-gated schedule
- Public metrics dashboard and status page live

**Target 3 — at T3 + 90 days.** *Post-award reporting only; no tranche depends on these.*

| Metric | Target |
|---|---|
| Distinct external traders (1+ on-chain `settle_fill`) | 150 |
| External TVL in vault + LP vault | $75,000 |
| Cumulative external notional volume since T3 | $2,000,000 |
| Capital arriving via the cross-chain path | $30,000 |
| Independent market makers quoting two-sided 14+ days | 3 |
| Days of continuous mainnet uptime | 85 of 90 |

**Target 4 — at T3 + 180 days.** At least one independent third party in production against Kryon's public API or SDK — a trading bot, wallet, aggregator or structured-product vault built by an unaffiliated team, evidenced by a public repository or live integration.

These targets are deliberately conservative. External adoption starts near zero: the venue works, but it has not yet been opened up, made integrable, or made reachable from where the capital actually sits. The award funds exactly the work that removes those blockers, and these numbers are what we believe is defensible rather than what would look impressive.
