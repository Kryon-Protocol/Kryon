## 3. Products & Services

**Kryon is a perpetual-futures exchange on Stellar with a genuine central-limit order book — orders match off-chain for speed, while custody, margin, funding and the settlement of every individual fill happen on Soroban.**

- Live on Stellar mainnet since **7 July 2026** across eight Soroban contracts: vault, engine, order gateway, oracle adapter, liquidation, insurance, risk and governance.
- Collateral is **Circle USDC**. The launch market is `XLM-PERP` at up to 10x, with a $500 deposit cap held deliberately during ramp-up.
- Seven off-chain services support it: matcher, oracle keeper, state indexer, WebSocket server, settlement reconciler, liquidation keeper and alerting monitor.
- ~31,000 lines, fully open source. Contract addresses and verification links are in Traction Evidence.

---

### Problems it solves

- **Stellar has no venue for leveraged or hedged positions.** Every major L1 has several perpetuals venues; Stellar has no mature one, so capital that wants directional or hedged exposure leaves the chain to get it.
- **Existing Stellar leverage designs avoid the order book.** Prior work is pool-priced — a vault takes the other side and a keeper marks positions — or recursive-lending-based. Both are legitimate; neither gives a market maker a book to price against.
- **Professional liquidity cannot be attracted without one.** Market makers price against a book, not a pool, and will not quote into an AMM-style perp because they cannot manage inventory. No order book means no professional liquidity, and no professional liquidity means no venue.
- **Custody risk kills adoption before liquidity does.** Most perps venues require trusting an operator with collateral. Kryon's operator cannot invent positions, move collateral, or bypass price bands, expiry, cancellation, overfill or self-trade checks.
- **Stellar's DeFi collateral has nowhere to be hedged.** DefiLlama tracks ~$786M of Stellar DeFi TVL across 15 protocols (20 July 2026), including ~$137M in Blend lending markets — a substantial on-chain collateral base with no on-chain venue to hedge it.
- **Capital cannot reach Stellar in one step.** Collateral must already be USDC on Stellar today. Bridge-then-deposit is where most external capital gives up, and perps are unusually sensitive to it because opening a position is time-sensitive.

---

### Audience

- **Retail and semi-professional traders** on Stellar who want leveraged or hedged exposure without leaving the chain or trusting a centralised venue with custody.
- **Market makers and quantitative trading teams** who need a price-time-priority book, programmatic order entry and a deterministic settlement guarantee before they will commit inventory.
- **Stellar's stablecoin and RWA holders** who hold on-chain collateral and currently have no venue on which to hedge it.
- **Developers building on top** — trading bots, structured products, hedged vaults and aggregators — who need a documented perps API rather than having to write a matching engine. Stellar has ~3,800 monthly-active developers, up ~200% year over year (Electric Capital, 23 July 2026).
- **Passive liquidity providers** who want exposure to market-making returns without running a quoting operation themselves.

---

### How it works

- **A trader signs an order intent, not a transaction.** The intent is a SEP-53 message over exact parameters: `market_id, is_long, size, limit_price, reduce_only, nonce, expiry_ts`.
- **The matcher matches off-chain** with price-time priority, partial fills, maker/taker classification and market-order walking — the parts that need microsecond latency and no consensus.
- **Settlement is per-fill and on-chain.** The matcher may only settle fills that *both* counterparties have signed. It cannot fabricate a counterparty, a price or a size.
- **The order gateway verifies authorisation before the engine is touched**, via `require_auth_for_args` over the exact order parameters. Nonce-keyed `Filled(owner, nonce)` and `Cancelled(owner, nonce)` storage prevents replay and overfill.
- **The authorisation graph is strict and one-directional:** `engine.open_position` requires the order gateway; `vault.apply_pnl` requires the engine; end-user signatures are demanded only where a user spends their own funds or revokes their own order.
- **Collateral never leaves the on-chain vault** and never passes through an operator wallet.
- **Fills accumulate into one volume-weighted position** per (trader, market), so a hundred partial fills are one position, not a hundred rows.
- **Risk is enforced in contract**, not in the service layer: price bands, oracle staleness limits, OI caps, margin requirements, liquidation thresholds and a 48-hour governance timelock on parameter changes.

---

### Use of Stellar and Soroban

- **Per-fill on-chain settlement is the Stellar-native bet.** At ~5s finality and sub-cent fees, settling every fill individually is economically viable here. On most L1s the same design forces batching or pushes settlement off-chain entirely.
- **This is why Kryon is a Stellar project rather than a port.** The architecture would not survive being moved to a chain with higher fees or slower finality — the per-fill settlement that gives Kryon its custody guarantee is exactly what becomes unaffordable elsewhere.
- **Soroban contracts hold every economically meaningful action.** Custody, margin locking, funding accrual, PnL application, liquidation and governance are all state transitions, not service-layer bookkeeping.
- **SEP-53** provides canonical signed order intents that on-chain verification accepts byte-for-byte.
- **SEP-41 / the Circle USDC SAC** provides collateral custody and settlement.
- **`require_auth_for_args`** binds a signature to the exact economic terms of the order, which is what makes "the operator cannot invent a position" a contract-level guarantee rather than a policy promise.
- **Protocol 27 smart accounts** (auth delegation, replay protection) enable passkey onboarding and scoped, revocable market-maker signing grants — a Tranche 1 deliverable.

---

### How this differs from existing Stellar solutions

- **No existing Stellar venue settles individual fills of a price-time-priority book on-chain.** That is the specific claim, and it is narrower than "we are the only perps venue."
- **Kryon is a genuine CLOB:** price-time priority, partial fills, maker/taker, market-order walking, one volume-weighted position per (trader, market).
- **Prior art we expect to be compared against:** Zenix (SCF Demo Day March 2026, live on mainnet, AMM-vault-priced), Hermes / Zenex (#32), Stellars Finance (#40), Noether (#41, which demonstrated cross and isolated margin on SDF's developer call in April 2026), AXIS (#42, a spot CLOB using the same off-chain-match / on-chain-settle pattern), Turbolong (#43, recursive lending), and a risk-parity perp CTA (#44).
- **We expect competition in this category rather than assuming its absence.** Full comparison in Additional Project Information.

---

### What is live today, and what is not true yet

We would rather state our gaps than have a reviewer find them.

**Live and working:**

- Eight Soroban contracts on mainnet with governance timelock, verifiable on stellar.expert.
- `XLM-PERP` matching, per-fill on-chain settlement, funding, liquidation and insurance fund.
- Guarded oracle with multi-source publishing and staleness limits.
- Non-custodial trading terminal with Freighter signing.

**Not true yet:**

- **One market.** `BTC-PERP` and `ETH-PERP` configs exist but were never enabled; multi-market account health and funding are untested at scale.
- **Isolated margin is not wired end to end.** The risk engine separates cross and isolated health, but the order gateway hard-codes `MarginMode::Cross` and the order struct carries no margin-mode field.
- **Deposits are Stellar-only.** Collateral must already be USDC on Stellar — the single largest onboarding friction.
- **No programmatic access.** Endpoints are internal same-origin route handlers with no external contract, authentication or versioning. No market maker can integrate against them.
- **Freighter only.** Most Stellar users cannot connect.
- **No passive liquidity.** An insurance fund exists; no LP layer does.
- **Trading fees are set to zero.** The mechanism is deployed and covered by contract tests, but `set_fee_config` has never been called on mainnet. Correct posture for a guarded beta; it changes at Tranche 3.
- **Single service host.** Seven services run on one VM with non-durable WebSocket ingress. A July 2026 managed-Postgres quota breach stalled the state services and, with them, oracle publishing; detection fired but had no alert destination configured, and the venue was quiet for three weeks. That gap is visible in our on-chain history and is why the Tranche 3 resilience work is scoped as it is. Full post-mortem in Traction Evidence.

---

### Scope clarification: what this award funds

- The eight contracts, matching engine, oracle keeper, indexer, liquidation keeper and trading terminal were built and deployed to mainnet **without SCF funding**.
- **None of that is a deliverable here, and no line item pays for completed work.**
- This award funds ~19 weeks of net-new engineering that does not exist on mainnet today, listed below in roadmap order.

**1. Isolated margin, end to end** *(Tranche 1)*
- *What it is:* margin mode threaded through the canonical signing message, the gateway's authorisation arguments, and the engine's margin locking and proportional release, then surfaced in the terminal.
- *Problem it solves:* traders cannot currently ring-fence risk per position; one bad position can take the whole account.
- *How it uses Stellar:* adds a margin-mode field to the SEP-53 canonical message and the `require_auth_for_args` argument set, so the authorisation binds to the margin mode as tightly as it binds to size and price.

**2. Public REST and WebSocket API, plus a TypeScript SDK** *(Tranches 1–2)*
- *What it is:* versioned endpoints with API-key authentication and rate limiting, a streaming feed for order-book deltas and trades, and an npm-published SDK shipped with a working reference market-maker bot.
- *Problem it solves:* an order book with no programmatic access cannot attract professional liquidity, and liquidity is what makes a derivatives venue work.
- *How it uses Stellar:* the SDK constructs canonical SEP-53 signing messages that on-chain verification accepts byte-for-byte — the part that is hardest to reimplement correctly, and the reason a third party cannot simply build this themselves.

**3. Passkey onboarding and delegated market-maker auth — Protocol 27** *(Tranche 1)*
- *What it is:* smart-account auth delegation for passkey sign-in, plus scoped, revocable signing grants for market makers.
- *Problem it solves:* a market maker should be able to quote continuously without holding a hot key with authority over the entire account.
- *How it uses Stellar:* built directly on Protocol 27 smart-account auth delegation and replay protection, activated on mainnet 9 July 2026.

**4. Market listing framework, then BTC-PERP and ETH-PERP** *(Tranche 2)*
- *What it is:* a governance-gated factory with feed-qualification checks enforced in contract.
- *Problem it solves:* today each market is a bespoke deployment; listing should be a parameterised operation that needs no further grant funding.
- *How it uses Stellar:* listing is gated through `perp-governance` behind the 48-hour timelock, so every new market is published and reviewable before it goes live. Qualification criteria are in the Tranche 2 acceptance criteria.

**5. Multi-wallet support and best-execution routing** *(Tranche 2)*
- *What it is:* Stellar Wallets Kit for Lobstr, xBull, Albedo, Hana and Ledger; StellarBroker for keeper-refill and insurance top-up routing.
- *Problem it solves:* Freighter-only support locks out most Stellar users — the cheapest user-facing unlock in the roadmap.
- *How it uses Stellar:* covers both signing surfaces Kryon depends on — SEP-53 `signMessage` for order intents and `signAuthEntry` for Soroban authorisation entries — with wallets lacking the latter routed through our signed-settlement path.

**6. One-step cross-chain deposit — Axelar, Allbridge and CCTP** *(Tranche 3)*
- *What it is:* a Soroban receiver that accepts an authenticated Axelar General Message Passing call and credits `perp-vault` directly.
- *Problem it solves:* collateral arrives from 70+ chains in a single signed action instead of bridge-then-deposit. The hard part is not the happy path — it is ensuring a half-completed deposit never strands funds.
- *How it uses Stellar:* native USDC moves over CCTP and Allbridge on routes where both ends support it, so no wrapped asset is involved; the receiver is a Soroban contract *called* from another chain rather than a wallet that merely receives tokens.

**7. Liquidity Provider vault to SEP-56, and yield-bearing margin via DeFindex** *(Tranche 3)*
- *What it is:* a Soroban vault issuing transferable SEP-56 share tokens that deploys capital as a passive quoting counterparty, plus DeFindex allocation of unencumbered margin collateral.
- *Problem it solves:* a thin book is unusable. Passive liquidity gives early traders something to trade against while external market making builds.
- *How it uses Stellar:* the vault sits inside the protocol's existing on-chain risk limits — same OI caps, margin requirements and liquidation rules as any trader — and its shares are composable by standard. **This funds engineering only; no SCF funds are used as liquidity capital.**

**8. Redundant infrastructure, observability and mainnet launch** *(Tranche 3)*
- *What it is:* health-gated failover, durable ingress, a public status page, alerting on stale oracle, settlement backlog, bad debt and reconciliation drift, plus the keeper-refill loop that converts fee revenue into operating XLM.
- *Problem it solves:* the July 2026 outage was a single-host failure with no alert destination. This is the direct remediation, scoped as funded work rather than an afterthought.
- *How it uses Stellar:* everything ships through the 48-hour `perp-governance` timelock, with the deposit cap raised on a published risk-gated schedule.

---

### Ecosystem impact

- **Gives Stellar's stablecoin and RWA holders somewhere to hedge**, making on-chain collateral more useful without leaving the network.
- **Gives market makers a reason to hold inventory on Stellar**, which is the precondition for depth in every other Stellar market, not just perps.
- **Creates sustained USDC demand and pubnet transaction volume** — every fill is an on-chain settlement, so venue activity is chain activity by construction.
- **Makes Stellar reachable for external capital in one step** via Axelar, Allbridge and CCTP, a path other Stellar protocols can reuse.
- **Ships a documented perps API and SDK** so Stellar's ~3,800 monthly-active developers can build bots, structured products, hedged vaults and aggregators without writing a matching engine.
- **Adds a listing framework** that makes every subsequent market a configuration change rather than an engineering project — including markets no grant needs to fund.

---
