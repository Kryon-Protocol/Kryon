# Content moved out of Products & Services — with the field each block belongs in

---

## → Field: Additional Project Information

The SCF Handbook names revenue model, sustainability, further funding, and market research as belonging here, not in Products & Services.

### Market

Perpetual futures are the highest-volume product category in crypto. Every major L1 has several venues; Stellar has no mature one. DefiLlama tracks roughly **$786M of Stellar DeFi TVL** across 15 protocols (snapshot 20 July 2026) — including ~$137M in Blend lending markets, a substantial on-chain collateral base with no venue on which to hedge it or express a leveraged view. Stellar has roughly **3,800 monthly-active developers, up ~200% year over year** (Electric Capital, snapshot 23 July 2026), and a documented perps API is the infrastructure that lets that cohort build trading bots, structured products, hedged vaults and aggregators without writing a matching engine.

Two pieces of infrastructure landed in 2026 that change the onboarding calculus. **Axelar** went live for Stellar on 16 February 2026, connecting 70+ chains with General Message Passing so a Soroban contract can be *called* from another chain rather than merely receive tokens. **Circle CCTP** went live on 19 May 2026, moving native USDC between Stellar and 23 chains by 1:1 burn-and-mint. Together they make a genuinely one-step cross-chain deposit possible. Perp venues are unusually sensitive to this friction, because the decision to open a position is time-sensitive — onboarding that takes minutes loses the trade.

A working derivatives venue gives Stellar's stablecoin and RWA holders somewhere to hedge, gives market makers a reason to hold inventory on Stellar, and creates sustained USDC demand and transaction volume on pubnet.

### Competitive context

Publicly listed prior art, for reviewer context: Hermes (SCF #32), Stellars Finance (#40), Noether (#41, which demonstrated cross and isolated margin on SDF's developer call in April 2026), AXIS (#42, a spot CLOB using the same off-chain-match / on-chain-settle pattern), Turbolong (#43), and a risk-parity perp CTA (#44). Leveraged-trading work on Stellar to date is either pool-priced — a vault takes the other side and a keeper marks positions — or recursive-lending-based. Kryon is the only perpetuals order book live on mainnet today. We expect competition in this category rather than assuming its absence.

### Revenue model and sustainability

**Revenue model.** `perp-engine` charges a maker/taker fee on the notional of every fill, settled in USDC through the vault and credited to a configurable fee recipient. The mechanism is deployed on mainnet and covered by contract tests. It is currently set to zero — `set_fee_config` has never been called for `XLM-PERP`, the right posture for a guarded beta running a $500 deposit cap, and not a permanent one. The 50bp liquidation fee is live and funds the liquidation keeper's reward.

**When fees turn on.** Trading fees are enabled at Tranche 3 alongside the deposit-cap lift, at 1bp maker and 5bp taker — the rates already modelled in the engine's test fixtures. Enabling them is a governance action through the 48-hour timelock, so the change is published and reviewable before it takes effect rather than being a silent parameter flip.

**What break-even looks like.** Kryon is cheap to run. The oracle publishes on deviation-or-heartbeat rather than a fixed tick, holding on-chain costs to 1–3 XLM a day, and hosting runs in the tens of dollars a month. At 5bp taker, roughly $160,000 of monthly notional volume covers full operating cost. Across three markets with a single active market maker that is a low bar — and not one we clear today, because volume is near zero for the reasons this award addresses.

**Keeping it running.** Fees accrue in USDC while keepers spend XLM, and nothing connected the two. A keeper-refill job converts a slice of fee revenue into XLM through StellarBroker and tops up any keeper below its floor, with operator-balance alerting in front of it. Both are Tranche 3 deliverables, scoped in response to the July 2026 incident described in Traction Evidence. Until volume covers costs, the team funds operations as it has since launch.

**Further funding.** We intend to pursue the SCF Audit Bank for an external audit of the LP vault, the DeFindex allocation controller and the cross-chain receiver before they hold mainnet funds at scale, and the Stellar Liquidity Award thereafter. Neither is requested here, and build funds are not the right instrument for liquidity capital.

---

## → Field: Budget justification

Every deliverable is costed bottom-up as hours multiplied by a role rate. Three roles, three rates.

| Role | Rate | Hours | Cost |
|---|---|---|---|
| Protocol engineer — Rust / Soroban contracts | $70/hr | 588 | $41,160 |
| Full-stack and infrastructure — API, SDK, terminal, services | $55/hr | 745 | $40,975 |
| Risk / quantitative engineer and QA — margin model, invariants, harnesses | $60/hr | 247 | $14,820 |
| **Total** | **$61.36 blended** | **1,580** | **$96,955** |

Rates reflect the team's actual cost base, not contractor market rates. The weekly load — roughly 31 hours protocol, 39 hours full-stack and 13 hours risk across 19 weeks — is deliberately sustainable: this team already operates a live protocol on mainnet, and a budget assuming every hour was greenfield would not survive contact with production.

**What this budget does not fund.** No line item pays for work already completed, marketing or user acquisition, token incentives or giveaways, liquidity provision capital, legal or entity costs, or a security audit.

---

## → Field: Tranche 2 deliverable / acceptance criteria

**Market listing framework + BTC-PERP and ETH-PERP.** Rather than hardcoding a fixed list of markets, this award funds a factory plus a governance-gated listing flow. A market may only be listed when its price feed demonstrably satisfies the engine's existing guards:

- three or more independent sources, with a two-source minimum enforced at publish time
- achievable staleness inside the market's `max_oracle_age_secs`
- observed source deviation inside the configured bound over a 14-day measurement window
- reference liquidity sufficient that the execution price band is not routinely breached

Listing waves:

- **Live:** `XLM-PERP`
- **Wave 1 — funded, Tranche 2:** `BTC-PERP`, `ETH-PERP`. Configs exist, deep CEX coverage across all three existing sources.
- **Wave 2 — framework-enabled, not funded here:** `SOL`, `XRP`, Stellar-native assets, FX pairs. Listed through governance if and when a feed clears the criteria above.

Only Wave 1 is a committed deliverable. The framework makes every subsequent listing a configuration change rather than an engineering project, so Wave 2 needs no further grant funding — but we are not promising markets whose feeds we have not yet qualified.

---

## → Field: On-chain growth goals

*(Unchanged from the original draft — this is already its own form field and should not sit inside Products & Services.)*

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

---

## → Field: Traction Evidence (add this block)

**July 2026 outage — post-mortem.** On 10 July 2026 our managed Postgres (Neon) exceeded its plan quota and returned 402. The state indexer, WebSocket server and reconciler stalled. The oracle keeper suspends publishing when it cannot observe protocol activity, so on-chain publishing stopped with it. Detection logic fired correctly; the alerting monitor had no webhook destination configured, so nobody was paged. The venue was quiet for three weeks until the quota was restored. Root cause was a database plan limit, not funding, key exhaustion or contract failure. The gap is visible in our on-chain history and we are not hiding it: it is the direct reason Tranche 3 scopes health-gated failover, durable ingress, a public status page, operator-balance alerting and the revenue-to-operations refill loop as funded deliverables rather than afterthoughts.
