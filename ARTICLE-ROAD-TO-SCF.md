---
title: "Kryon's Road to SCF — What We Built, What's Next, and How We Get There"
tags: [Kryon, Stellar, Soroban, SCF, perpetuals, DeFi]
description: "Ten weeks from first commit to eight live contracts on Stellar mainnet — and the specific 19-week plan for what comes next."
---

# Kryon's Road to SCF

### What we built, what we're building next, and exactly how we get there

> **The short version:** On 28 May 2026 we wrote the first line of Kryon. On 7 July we deployed eight contracts to Stellar mainnet. Today Kryon is the only perpetual-futures **order book** running on Stellar — and it has a specific, honest list of things stopping anyone from using it. This is the full account: the build, the mistakes, and the **$96,955 / 19-week / 14-deliverable** plan we've put to SCF #45.

[TOC]

> 📸 **IMAGE 1 — Hero.** Screenshot of the live trading terminal at kryonprotocol.vercel.app with the XLM-PERP order book visible. Full-width, top of article. This is the single most important image — it proves "live product" before anyone reads a word.

---

## Part 1 — Where this started

Perpetual futures are the largest product category in crypto by volume. Not one of several — the biggest, by a wide margin. Every major L1 has multiple venues fighting over that flow.

Stellar had none.

That's odd, because Stellar's DeFi layer isn't small anymore:

| Signal | Number | Source |
|---|---|---|
| Stellar DeFi TVL | **~$786M** across 15 protocols | DefiLlama, 20 Jul 2026 |
| Largest protocols | Spiko $527M · Blend $137M · Aquarius $46M | DefiLlama |
| Monthly-active developers | **3,833**, up **208% YoY** | Electric Capital, 22 Jul 2026 |
| Mature perps venues on Stellar | **0** | — |

A large collateral base, a fast-growing developer base, and nowhere on-chain to hedge or express a leveraged view. That's the gap we started building into.

### The decision that shaped everything else

There were easier ways to do this, and we didn't take them.

Leveraged trading on Stellar so far has been either **pool-priced** — a vault takes the other side of every trade, a keeper marks positions against an oracle — or built on **recursive lending loops**. Both are real designs. Both avoid the hard problem.

We built a **central limit order book**. Price-time priority. Partial fills. Maker and taker sides. Market orders that walk the book. Every fill settled individually, on-chain, into one volume-weighted position per trader per market.

That cost us months. Two reasons we did it anyway:

**Market makers price against a book, not a pool.** They won't quote into an AMM-style perp, because they can't manage inventory against a curve that trades against them by construction. An order book is the precondition for real liquidity. Real liquidity is the precondition for a venue that survives without subsidising its own volume.

**Per-fill on-chain settlement only works here.** Writing every single fill to the ledger is economically absurd on most L1s — which is why perp venues there batch, or settle off-chain and ask you to trust them. Stellar's sub-cent fees and ~5-second finality make it genuinely viable. The architecture we wanted was the one this chain was uniquely good at hosting.

Off-chain matching for speed. On-chain settlement for custody. A CEX-style book where you never hand over your collateral.

---

## Part 2 — What we built

### Eight contracts, live on mainnet

All deployed, initialised and wired on pubnet since 7 July 2026. Every address below is verifiable on stellar.expert right now.

| Contract | What it does | Mainnet address |
|---|---|---|
| `perp-vault` | SEP-41 collateral custody, internal balances, risk-gated withdrawals | `CDXGTJQS…DTDKLR4J` |
| `perp-engine` | Positions, execution price bands, OI caps, fees, funding, realised PnL | `CD6OMHCR…2OB3W6LZ` |
| `perp-order-gateway` | Settlement entry point — nonce tracking, overfill protection, self-trade rejection | `CBA2PSRH…RXNO2DUTJ` |
| `perp-oracle-adapter` | Guarded price snapshots: publisher auth, staleness, quorum median, deviation bounds | `CD3ZFYZP…E6WTUY25F` |
| `perp-liquidation` | Account-health liquidation executor, capped rewards, bad-debt recording | `CBGSXCZT…EUJXFYDRO` |
| `perp-insurance` | Insurance fund custody, keeper rewards, bad-debt accounting | `CCBEJ3F2…MB6JYNL54` |
| `perp-risk` | Soroban boundary around the pure-Rust risk engine | `CBHZWEIK…F7VLPNVUI` |
| `perp-governance` | Timelock proposal registry (48h minimum) + guardian pause | `CDSIEH7U…ZNBYPYDXU` |

Collateral is Circle USDC. Launch market is `XLM-PERP` at up to 10× leverage.

> 📸 **IMAGE 2 — Architecture diagram.** Use the one already in your repo (`ARCHITECTURE.md` / the docs Architecture Overview page). Place it right here. Reviewers who skim will look at exactly this.

### How a trade actually works

This is the part worth understanding, because it's where the trust model lives.

1. A trader signs an **order intent** as a SEP-53 message — never a transaction, so no gas and no custody transfer.
2. The off-chain matcher finds a cross. It may only settle fills that **both** counterparties have signed.
3. The order gateway verifies each owner's authorisation over the exact parameters — `market_id, is_long, size, limit_price, reduce_only, nonce, expiry_ts` — via `require_auth_for_args` before it's permitted to call the engine.
4. Nonce-keyed `Filled(owner, nonce)` and `Cancelled(owner, nonce)` storage blocks replay and overfill.
5. The engine opens or adjusts the position. The vault applies PnL.

The authorisation graph is strict and one-directional: `engine.open_position` requires the gateway; `vault.apply_pnl` requires the engine; end-user signatures are demanded only where a user spends their own funds or cancels their own order.

**What this means concretely:** the operator cannot invent a position, move your collateral, bypass price bands, ignore expiry, replay a cancelled order, or settle a self-trade. Every one of those is enforced in contract, not by policy.

### Everything running behind it

| Service | Job |
|---|---|
| Matcher | Price-time-priority matching engine, deterministic |
| Oracle keeper | Multi-source price aggregation and guarded publishing |
| State indexer | On-chain events → queryable state |
| WebSocket server | Live book, trades, ticks to the terminal |
| Settlement reconciler | Owns transaction confirmation; no double-settle |
| Liquidation keeper | Scans account health, executes liquidations |
| Monitor | Health checks + alerting across all of the above |

### Codebase, in numbers

| Component | Scale |
|---|---|
| Total | **~31,000 lines**, fully open source |
| Soroban contracts | ~5,500 lines of `#![no_std]` Rust across 8 contracts |
| Core libraries | `protocol-core` fixed-point math + standalone `risk-engine` crate |
| Off-chain services | ~11,600 lines TypeScript |
| Trading terminal | ~7,000 lines, Next.js 16 / React 19 |
| Commits since 28 May | 109 |

One architectural decision paid for itself repeatedly: **the money logic lives in pure Rust, independent of Soroban.** `protocol-core` and `risk-engine` are standalone workspaces we can test at millions of iterations with no blockchain in the loop. The contracts became a thin boundary around proven math, rather than the place the math lives.

### Security work — the month that doesn't show in a changelog

June was almost entirely audit and hardening. Five internal audit passes against our own protocol, worked down:

| Area | What was fixed |
|---|---|
| Settlement | Signed-settlement path, replay and overfill protection |
| Margin | Isolated/cross health separation, multi-collateral health |
| Concurrency | Concurrent matcher safety |
| Oracle | Quorum enforcement, staleness rejection, USDC depeg guard |
| Governance | 48h timelock that rejects any config below the minimum |
| Liquidation | Reward caps, bad-debt routing, funding surplus routing |
| Emergency | Guardian fast-path pause, staged-launch deposit caps |

Every high and critical finding was fixed and the contracts redeployed **before** anything touched mainnet.

Then three things landed in early July that we treated as the real gate between "working code" and "may hold other people's money":

- **An economic stress harness** — stateful, randomised solvency-invariant testing. It caught four off-chain bugs we'd otherwise have shipped. Then a fix to the harness itself: it had been measuring internal balances instead of actual token reserves. That's precisely the class of test that passes while the protocol is insolvent.
- **Guardian pause, drilled on the live mainnet vault** — paused by the guardian key, unpaused by admin, verified on-chain.
- **Admin authority transferred to the timelock**, so no single key can reconfigure the protocol without 48 hours of public notice.

Ongoing: `cargo test --workspace` across math, risk engine, contracts and matcher determinism, plus E2E, load, soak and failure-recovery suites, and stateful solvency-invariant, fuzz and chaos harnesses. CI enforces lint, typecheck, dependency review and CodeQL on every push.

### Making it cheap enough to run forever

A naive oracle publishing on every tick burns hundreds of XLM a month. We moved to **deviation-or-heartbeat** publishing: publish on a >30bp move or a 60-second heartbeat, never faster, with the heartbeat held safely inside the engine's 120-second staleness bound. Then activity-aware idling on top.

| | Before | After |
|---|---|---|
| Oracle burn | ~8.5 XLM/day | **~1 XLM/day** |

That's not trivia. It's why **~$160,000 of monthly notional volume at 5bp taker covers Kryon's entire operating cost.** Being cheap to run is what lets a venue survive the period before it has volume — and every venue has to survive that period.

### Three things that went wrong, and what we changed

We'd rather tell you these than have you find them.

| Incident | What actually happened | What changed |
|---|---|---|
| **The frontend that wouldn't leave testnet** | After mainnet deploy, the site kept serving testnet. We found and fixed three real problems — stale platform env vars, a domain alias not following deploys, a remote build cache. Still testnet. The actual cause was four lines of app code reading `process.env[key]` *dynamically*; the bundler only inlines statically-visible keys, so it resolved to `undefined` in the browser and fell through to a hardcoded fallback — regardless of what was configured anywhere. | We now verify against the **compiled artefact**, not against what we believe we configured. Three correct diagnoses in a row can still be the wrong answer. |
| **The stress harness that lied** | It measured internal accounting balances rather than real token reserves — so it would have reported solvency during insolvency. | Solvency invariants now assert against on-chain token reserves only. |
| **The outage nobody heard** | Our managed Postgres hit its plan quota and started refusing connections. Dependent services stalled. The oracle keeper — correctly, by design — saw no protocol activity and suspended publishing rather than burning fees into a void. The chain went quiet. Monitoring caught it immediately and logged the failure every 30 seconds. The alert webhook was never configured. So it was right, continuously, into nothing. | Alerting wired. A **keeper-refill job** now converts a slice of fee revenue into XLM and tops up any keeper below its floor. Two funded deliverables — the HA/observability line and the StellarBroker treasury routing line — are scoped the way they are **because of this specific incident.** |

---

## Part 3 — Where Kryon actually stands today

No spin. The state of the venue as of August 2026.

| | Status |
|---|---|
| Contracts live on mainnet | ✅ 8, since 7 July 2026 |
| Admin under 48h timelock governance | ✅ Transferred on-chain |
| Guardian pause | ✅ Drilled on the live vault |
| Markets | ⚠️ **One** — XLM-PERP only |
| Trading fees | ⚠️ **Zero.** `set_fee_config` has never been called on mainnet |
| Deposit cap | ⚠️ **$500**, deliberately, during ramp |
| Wallets supported | ⚠️ **Freighter only** — excludes most Stellar users |
| Programmatic access | ❌ Internal route handlers only. No public API, no auth, no versioning |
| Cross-chain deposits | ❌ Collateral must already be USDC on Stellar |
| Collateral efficiency | ❌ Idle margin earns nothing |
| Passive liquidity | ❌ Insurance fund exists; no LP layer |
| Infrastructure | ⚠️ Seven services, **one host** |
| External usage | ❌ Not meaningful yet |

**We are not presenting volume, TVL or user counts as traction.** The venue works; almost nobody can reach it. Presenting near-zero numbers as momentum is how you lose the trust you need later.

Look at that table again, though, and notice the pattern: **the red rows aren't protocol problems.** The hard part — matching, margin, settlement, liquidation, oracle guards, governance — is built and live. What's missing is reach and efficiency. That distinction is the entire basis of our SCF application.

---

## Part 4 — What we're building next

**SCF #45, Open Track: $96,955 over ~19 weeks. 1,580 engineering hours. 14 deliverables.**

First, what it does **not** fund: the contracts, matching engine, oracle keeper, indexer, liquidation keeper and terminal were built and deployed to mainnet **without external funding**. None of that is a deliverable. No line item pays for completed work.

The 14 deliverables answer four questions.

### Question 1 — How does capital reach us?

Today you need USDC already on Stellar. A trader holding USDC on Arbitrum or Base has to bridge, then deposit — two disconnected steps, and the exact point most external capital gives up. Perp venues are unusually sensitive to this: the decision to open a position is time-sensitive, and a multi-minute onboarding loses the trade outright.

**One-step cross-chain deposit** uses three transports, chosen per route:

| Transport | Role |
|---|---|
| **Axelar** | General Message Passing — a Soroban contract can be *called* from another chain, not just receive tokens. 70+ chains. |
| **Circle CCTP** | Native USDC via 1:1 burn-and-mint. No wrapped assets, no third-party bridge risk. |
| **Allbridge** | Additional route coverage into Stellar where CCTP doesn't reach both ends |

Sign once on another chain; collateral lands **inside the vault, ready to trade.** The hard part isn't the happy path — it's guaranteeing a half-completed cross-chain deposit never strands funds. That's where most of the hours in this line go.

### Question 2 — How do traders and market makers actually get in?

Four deliverables, one theme: Kryon is currently unreachable by almost everyone.

- **Public REST trading API v1.** Today's endpoints are internal same-origin route handlers with no external contract, no auth, no versioning. Market makers do not integrate against undocumented HTTP. We ship a versioned public API with API-key auth and per-key rate limiting, published as an OpenAPI 3 spec.
- **WebSocket streaming market data.** Polling is unusable for market making. Book deltas, trades, ticks and account updates, with documented reconnect semantics.
- **TypeScript SDK + reference market-maker bot.** `@kryon/sdk` on npm, wrapping the hardest part to reimplement correctly — canonical SEP-53 message construction — plus a working two-sided quoting bot in the open repo.
- **Stellar Wallets Kit.** Freighter-only today. The Kit brings Lobstr, xBull, Albedo, Hana and Ledger, covering both signing surfaces we depend on: SEP-53 `signMessage` for order intents and `signAuthEntry` for Soroban authorisation entries.

Then the newest piece, and the one we're most interested in:

**Passkey onboarding and delegated market-maker auth.** Stellar's smart-wallet path lets a contract account verify passkey signatures directly — so a new trader can onboard with Face ID or a security key instead of installing a browser extension and writing down a seed phrase. The same mechanism solves a separate problem at the professional end: a market maker can **delegate scoped quoting authority to a hot key** without exposing the account key that controls their collateral. Retail onboarding and institutional key hygiene turn out to be the same primitive.

### Question 3 — Does the capital work hard enough once it's here?

This is the part that's new since our earlier draft, and it changes the pitch from "a venue that works" to "a venue worth choosing."

**Yield-bearing margin via DeFindex.** Collateral sitting in `perp-vault` currently earns nothing. DeFindex (PaltaLabs — SCF #28 and #32) is live Stellar yield infrastructure built on non-custodial tokenized vaults. Routing idle margin into it means your collateral earns while it backs your position. Every CEX pays some form of this; no on-chain perp venue on Stellar does.

**Liquidity Provider vault, SEP-56 compliant.** A CLOB with a thin book is unusable. An LP vault accepts USDC, issues transferable share tokens and quotes passively inside the protocol's existing risk limits — subject to the same OI caps, margin and liquidation rules as any trader. Building it to **SEP-56, Stellar's tokenized vault standard**, means the share token is a standard instrument other Stellar protocols can hold, price and integrate — not a Kryon-only object.

**StellarBroker routing for treasury operations.** This is the direct descendant of our outage. Fees accrue in USDC; keepers spend XLM; nothing connected the two, and that gap is what eventually took the venue quiet. StellarBroker (SCF #33) is a non-custodial swap router that splits trades across Soroswap, Aquarius, Classic AMMs and the SDEX orderbook for best execution. Wiring treasury conversion through it turns keeper refill from a script that hits one venue at whatever price it finds into a routed, best-execution operation.

### Question 4 — Can it carry more than one market, and stay up?

- **Market listing framework.** Adding a market today means a bespoke config and deploy. A factory plus governance-gated listing, with feed-qualification enforced *in contract*, turns every future market into a configuration change — including markets no grant needs to fund.
- **BTC-PERP and ETH-PERP**, listed through that framework, with hardened cross-market account health, per-market OI caps and per-market funding accrual.
- **HA service fleet, observability, status page.** Seven services on one host is a single point of failure for a venue holding collateral. Redundant deployment with health-gated failover, durable ingress, structured metrics, a public status page, and alerting on stale oracle, settlement backlog, liquidation backlog, bad debt and reconciliation drift.
- **Mainnet launch, cap lift, responsive terminal, docs.** Everything ships to mainnet through the 48-hour timelock, the deposit cap rises on a published risk-gated schedule, and the terminal — desktop-only today — becomes usable on a phone.

### We're building *on* Stellar, not beside it

Five of the fourteen deliverables integrate infrastructure other Stellar teams built, four of them SCF-funded:

| Integration | Status | SCF history | What we use it for |
|---|---|---|---|
| **DeFindex** (PaltaLabs) | New — T3 | Rounds 28, 32 | Yield-bearing margin |
| **StellarBroker** | New — T2 | Round 33 | Best-execution treasury routing |
| **Allbridge** | New — T3 | Round 23 | Cross-chain deposit routes |
| **Stellar Wallets Kit** | New — T2 | Integration List | Multi-wallet support |
| **Axelar** | New — T3 | Integration List | Cross-chain contract calls (GMP) |
| **Circle CCTP** | New — T3 | — | Native USDC transport |
| **Passkeys / smart wallets** | New — T1 | Protocol-level | Onboarding + delegated MM auth |
| **SEP-56** | New — T3 | Standard | LP vault share token |
| **Soroban / SEP-41 / SEP-53 / USDC** | Live | — | Custody, signing, settlement |

> 📸 **IMAGE 3 — Integration map (recommended).** A simple diagram: Kryon in the centre, the eight integrations around it, arrows labelled with what flows. This single graphic makes the composability argument faster than three paragraphs.

---

## Part 5 — How we proceed

### The schedule

SCF #45 closes 16 August 2026. With prescreen, panel review and community voting, award notification lands around mid-September. Every interval below sits well inside SCF's 90-day maximum between tranche submissions.

| Tranche | Milestone | Completion | Elapsed | Value |
|---|---|---|---|---|
| #0 | Award acceptance | mid-Sept 2026 | — | — |
| #1 | MVP verified | **30 Oct 2026** | ~6 weeks | $25,160 |
| #2 | Testnet verified | **10 Dec 2026** | ~12 weeks | $32,430 |
| #3 | Mainnet launch verified | **23 Jan 2027** | ~19 weeks | $39,365 |
| | | | **Total** | **$96,955** |

### Tranche 1 — make it reachable and integrable

**$25,160 · 416 hours · due 30 October 2026**

| Deliverable | Hours (P/F/R) | Cost | Done when |
|---|---|---|---|
| Isolated-margin mode, end to end | 60 / 15 / 15 | $5,925 | A testnet position's losses are capped at its locked margin and provably cannot draw on cross collateral |
| Public REST trading API v1 | 35 / 130 / 20 | $10,800 | A third party places, queries and cancels a signed order using only the published OpenAPI spec — no Kryon frontend code |
| WebSocket streaming market data | 5 / 50 / 8 | $3,580 | Book and trade updates delivered within 500ms of settlement, validated under a reconnect-storm test |
| Passkey onboarding + delegated MM auth | 35 / 35 / 8 | $4,855 | A new trader onboards and places a signed order with a passkey and no browser extension; a market maker quotes from a delegated key that cannot withdraw collateral |

### Tranche 2 — make it multi-market and multi-wallet

**$32,430 · 533 hours · due 10 December 2026**

| Deliverable | Hours (P/F/R) | Cost | Done when |
|---|---|---|---|
| Market listing framework | 75 / 20 / 20 | $7,550 | A market is listed end-to-end on testnet through the factory alone, with feed qualification enforced on-chain |
| BTC-PERP + ETH-PERP, multi-market risk | 45 / 25 / 35 | $6,625 | Account health correctly aggregates across three markets; a stateful invariant test proves solvency over randomised position sets |
| Stellar Wallets Kit integration | 10 / 95 / 18 | $7,005 | Deposit → order → fill → close → withdraw completes on testnet with **each** supported wallet |
| TypeScript SDK + reference MM bot | 25 / 95 / 15 | $7,875 | `@kryon/sdk` on npm; a byte-level test proves its signing output is accepted by on-chain verification |
| StellarBroker treasury routing | 20 / 25 / 10 | $3,375 | Keeper refill executes through StellarBroker with a recorded best-execution comparison against a single-venue baseline |

### Tranche 3 — make capital reachable, productive, and safe

**$39,365 · 631 hours · due 23 January 2027**

| Deliverable | Hours (P/F/R) | Cost | Done when |
|---|---|---|---|
| Cross-chain deposit (Axelar · Allbridge · CCTP) | 95 / 55 / 15 | $10,575 | A trader goes from USDC on an external chain to an open position in one signed action, from **≥3 chains**, with published tx hashes on both sides — and a deliberately failed delivery produces a claimable refund |
| Liquidity Provider vault (SEP-56) | 80 / 30 / 25 | $8,750 | Share price is a pure function of vault equity and supply, with an invariant test proving no depositor can mint or redeem at a stale price |
| Yield-bearing margin via DeFindex | 70 / 30 / 25 | $8,050 | Idle collateral accrues yield while backing an open position; withdrawal and liquidation both remain correct and instant under a drained-strategy test |
| HA fleet, observability, status page | 8 / 95 / 18 | $6,865 | A documented chaos drill kills the primary with no missed settlement and no oracle staleness breach; 72h continuous mainnet operation, zero stuck jobs |
| Mainnet launch, cap lift, mobile terminal, docs | 25 / 45 / 15 | $5,125 | All upgrades via timelocked governance with published tx hashes; terminal fully usable at 390px; deposit cap raised against a published risk-gated schedule |

> Every acceptance criterion above is written against something a reviewer can check independently: a deployed contract on stellar.expert, a merged commit, a reachable endpoint, a published package, or a published test report. No deliverable is complete because we say so.

### Where the money goes

| Role | Rate | Hours | Cost | Weekly over ~19 weeks |
|---|---|---|---|---|
| Protocol engineer (Rust / Soroban) | $70/hr | 588 | $41,160 | ~31 hrs |
| Full-stack & infrastructure | $55/hr | 745 | $40,975 | ~39 hrs |
| Risk / quant engineer & QA | $60/hr | 247 | $14,820 | ~13 hrs |
| **Total** | **$61.36/hr blended** | **1,580** | **$96,955** | |

Rates reflect our actual cost base, not contractor market rates. The weekly load is deliberately sustainable — this team already operates a live protocol on mainnet, and a budget assuming every hour is greenfield wouldn't survive contact with production.

**Payout follows SCF's standard 10/20/30/40 schedule**, which is separate from deliverable value:

| Payment | Trigger | % | Amount |
|---|---|---|---|
| Tranche #0 | Award acceptance | 10% | $9,695 |
| Tranche #1 | MVP verified | 20% | $19,391 |
| Tranche #2 | Testnet verified | 30% | $29,087 |
| Tranche #3 | Mainnet launch verified | 40% | $38,782 |

### How fees and sustainability work

The fee mechanism is deployed and tested on mainnet but **set to zero** — the right posture for a guarded beta at a $500 cap, and not a permanent one.

| | Plan |
|---|---|
| When fees turn on | Tranche 3, alongside the deposit-cap lift |
| Rates | 1bp maker · 5bp taker |
| How | A governance action through the 48h timelock — published and reviewable before it takes effect, not a silent parameter flip |
| Break-even | ~$160,000 monthly notional volume covers full operating cost |
| Treasury loop | Fee revenue routed to XLM via StellarBroker, auto-refilling keepers below their floor |

Until then, we fund operations ourselves, as we have since launch. The honest position: a derivatives venue becomes self-sustaining only once it has volume — and volume is exactly what the cross-chain deposit path, the public API, passkey onboarding and multi-wallet support exist to produce. That's the sequence this award funds, not a promise that revenue shows up on its own.

### What we're measuring, and how you can check it

Every figure we publish **excludes every Kryon-controlled address** — deployer, governance, oracle publisher, matcher, liquidator, guardian, insurance, and any internal testing wallet. That exclusion list is committed to the repository and versioned in git, so additions are auditable. Metrics come from on-chain state and are independently reproducible by anyone with public ledger data plus that list.

| Checkpoint | Target |
|---|---|
| **Tranche 2** (10 Dec 2026) | ≥25 distinct external addresses have placed a signed order via the API or SDK · ≥2 external developers running the reference MM bot · public metrics dashboard live |
| **Tranche 3** (23 Jan 2027) | 3 markets live on mainnet · cross-chain deposit live from ≥3 chains · LP vault deployed · yield-bearing margin live · API + SDK published · deposit cap lifted on schedule |
| **T3 + 90 days** *(reporting only)* | 150 external traders · $75k external TVL · $2M cumulative external notional · $30k arriving cross-chain · 3 independent market makers · ≥85 of 90 days uptime |
| **T3 + 180 days** *(reporting only)* | ≥1 independent third party in production against our API or SDK |

These are deliberately conservative. External adoption starts near zero, because the venue has not yet been opened up, made integrable, or made reachable from where the capital sits. The numbers above are what we think is defensible, not what would look impressive.

---

## Part 6 — What we're *not* asking for

No line item funds marketing, user acquisition, token incentives, liquidity capital, legal costs, or a security audit.

Two related programs we intend to pursue separately, **in sequence**:

1. **SCF Audit Bank** — an external third-party audit of the LP vault, the DeFindex margin integration and the cross-chain deposit receiver before they hold mainnet funds at scale. Our five existing audit reports are internal; these three components in particular warrant independent review.
2. **Stellar Liquidity Award** — liquidity bootstrapping capital, which follows that external audit. We don't claim eligibility today.

Build funds are the wrong instrument for both. We'd rather ask for the right one at the right time.

---

## Part 7 — Who's building it

Three engineers plus an advisor. This team built and deployed Kryon to Stellar mainnet with no external funding.

| | Role | Owns |
|---|---|---|
| **Samya Deb Biswas** | Founder & Protocol Engineer | Protocol architecture, settlement systems, mainnet deployment. Previously built multi-chain infrastructure across Stellar/Soroban, Avalanche, Celo, Solana, Algorand, Polygon |
| **Anindha Biswas** | Co-Founder & Frontend Engineer | Trading terminal, wallet integrations, client architecture, public API surface |
| **Akash Biswas** | Co-Founder, Risk & Quant Engineer | Margin and liquidation model, funding-rate design, oracle guard parameters, invariant/stress/fuzz harnesses |
| **Debanjan Mondal** | Protocol & Multi-Chain Advisor | DevRel at Rise In, Head of Product at Kimia. Protocol design, developer ecosystems, cross-chain strategy |

> 📸 **IMAGE 4 — Team (optional).** A simple 4-up card with names and roles. SCF reviewers and X readers both respond to a visible team.

---

## Part 8 — Why this matters past us

The pattern in SCF's largest cumulative awards is consistent. The projects that keep getting funded are the ones that become **primitives other people build on** — Reflector, Phoenix, Soroswap. Infrastructure, not applications.

We built Kryon that way on purpose:

- `protocol-core` and `risk-engine` are standalone Rust workspaces, usable outside Kryon.
- The oracle adapter is a guarded SEP-40 surface.
- The LP vault is a **SEP-56** tokenized vault, so its share token is a standard instrument other protocols can hold and price.
- The API and SDK exist so other Stellar builders can create trading bots, structured products, hedged vaults and aggregators **without writing a matching engine first.**

And the flow runs both ways. Kryon integrates DeFindex, StellarBroker, Allbridge, Axelar and Stellar Wallets Kit — routing volume and fees *to* other Stellar teams rather than rebuilding what they've already shipped. A derivatives venue is one of the densest sources of on-chain activity there is; wiring it into existing ecosystem infrastructure compounds for everyone, not just us.

A working derivatives venue gives Stellar's stablecoin and RWA holders somewhere to hedge. It gives market makers a reason to hold inventory on Stellar. And the cross-chain deposit path routes capital *into* Stellar that currently has no reason to arrive at all.

That's the road. Eight contracts live, an honest account of what works and what doesn't, and fourteen specific things standing between here and a venue people actually use.

---

### Check us

| | |
|---|---|
| **Live app** | https://kryonprotocol.vercel.app |
| **Docs** | https://kryonprotocol.vercel.app/docs |
| **Code** | https://github.com/Kryon-Protocol/Kryon |
| **X** | https://x.com/KryonProtocol |

Every contract address is published and verifiable on stellar.expert. Don't take our word for any of it.

---

*Kryon Protocol — August 2026*
