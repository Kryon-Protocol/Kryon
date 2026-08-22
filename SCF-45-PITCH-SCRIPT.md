# Kryon — SCF #45 Pitch Package

3-minute pitch script · 40-second demo video · slides · Q&A prep

**Round context:** SCF #45, phase = Submission, deadline **16 August 2026** (verify at https://communityfund.stellar.org/awards). Track: **Open Track**. Ask: **$99,000 / 19 weeks / 3 tranches**.

---

## Part 0 — The strategy this script is built on

Five things drive the structure. Each is a rule taken from the SCF Handbook or from what the awarded perps/DEX cohort actually did.

1. **Value in the first sentence, no marketing-speak.** The handbook is explicit: most panelists skim, decide at a high level, then dig. The first 12 seconds must land "what it is" and "it's live," or nothing after it gets watched. Do not open with "we are transforming derivatives on Stellar."
2. **The submission must be self-contained.** "Reviewers assess each application based solely on the information provided in the submission. No external materials are considered." So the video and the written form must both stand alone — the video cannot say "see our docs for the architecture."
3. **Live mainnet is your single biggest weapon, and it is rare.** Of the directly comparable awarded cohort — Noether ($86.2K, #41), Zenex/Hermes ($150K), Stellars Finance ($119.3K, #40), Turbolong ($99K, #43), AXIS ($136K, #42) — Noether was awarded on *testnet*, Zenex is still Pre-Release. You are on mainnet since 7 July 2026 with an autonomous liquidation already executed in production. Lead with it, show it, don't bury it.
4. **Own the gaps out loud.** The handbook's Open Track wants "existing traction or deep, proven Stellar knowledge" and the budget rules bar funding past work. Volunteering the zero-volume position and the July outage does three things: it preempts the obvious attack, it makes your $99K ask legible as *forward* work, and it reads as an operator rather than a promoter. This is the single most differentiating 20 seconds in the pitch.
5. **Narrow the novelty claim so it survives scrutiny.** Never say "the only perps venue on Stellar" — Noether, Zenex, Stellars Finance and Turbolong all exist and a panelist will know. Say the defensible version: **no other Stellar venue settles individual fills of a price-time-priority order book on-chain.** Every prior design is pool-priced or recursive-lending. That claim is true, specific, and technical enough to signal you know the field.

---

## Part 1 — The 3-minute pitch script (verbatim)

**Total: ~430 spoken words + 40s demo ≈ 3:00 at a 150 wpm delivery.**
Timings are cumulative. `[ ]` = what's on screen. Bold = land the emphasis.

---

### 0:00–0:14 — Cold open (35 words)

> [Screen: Kryon terminal, XLM-PERP book ticking live. No logo animation, no music swell.]
>
> "Kryon is a perpetual-futures exchange on Stellar with a real order book. Orders match off-chain for speed — custody, margin, funding and **every individual fill** settle on Soroban.
>
> It's been live on mainnet since the 7th of July."

*Why:* value in sentence one, liveness in sentence two. No throat-clearing.

---

### 0:14–0:34 — The gap (52 words)

> [Screen: single slide — "Stellar DeFi TVL ≈ $786M / 15 protocols · derivatives venues: 0 mature" — DefiLlama, 20 July 2026]
>
> "Every major L1 has several perpetuals venues. Stellar has none that's mature. That's roughly **$786 million of on-chain collateral with nowhere to hedge it** — so capital that wants a leveraged or hedged position leaves the chain to get it.
>
> Here's the exchange working today."

*Why:* one number, one consequence, one hand-off. Don't itemise the market — panelists discount market-size slides.

---

### 0:34–1:14 — **DEMO VIDEO PLAYS (40 seconds)** — see Part 2

> [No voiceover from you. Demo carries its own on-screen captions. Sit silent — let it run.]

---

### 1:14–1:38 — What just happened, and why it's Stellar (62 words)

> [Screen: the architecture diagram — trader → intent → matcher → gateway → engine/vault]
>
> "What you just saw: the trader signed an **order intent**, not a transaction — a SEP-53 message over exact size, price and expiry. The matcher pairs orders price-time, then settles that fill on-chain through `require_auth_for_args`.
>
> Which means the operator **cannot invent a position, move your collateral, or settle a fill you didn't sign.** That's a contract-level guarantee, not a policy."

*Why:* this is the credibility beat. Two Stellar-native primitives named precisely, then the one-line security claim they buy you.

---

### 1:38–1:52 — Why this design only works here (36 words)

> [Screen: "~5s finality · sub-cent fees → per-fill settlement is affordable"]
>
> "Settling **every** fill individually is only economically viable at Stellar's fees and finality. On any other L1 this design forces batching, or pushes settlement off-chain entirely — and the custody guarantee goes with it. Kryon isn't a port."

*Why:* answers "why Stellar and not a port?" before anyone asks. This is a standing SCF concern.

---

### 1:52–2:12 — Differentiation (54 words)

> [Screen: comparison strip — Noether #41 · Zenex · Stellars Finance #40 · Turbolong #43 · AXIS #42 — labelled pool-priced / recursive-lending / spot CLOB]
>
> "There's real prior art here and we expect the comparison. Leveraged trading on Stellar so far is pool-priced — a vault takes the other side — or recursive lending. Both are legitimate; both avoid the order book.
>
> **No Stellar venue settles individual fills of a price-time-priority book on-chain. That's the gap Kryon fills** — and market makers price against a book, never a pool."

*Why:* naming your competitors accurately is a trust move. It also converts "is this novel?" into "yes, and they know the landscape."

---

### 2:12–2:34 — The honest part (58 words)

> [Screen: plain text, two columns — "Live" / "Not true yet"]
>
> "What I'm not going to claim is traction. Volume is near zero, and I'll tell you exactly why: collateral has to already be USDC on Stellar, there's no public API for a market maker to quote against, and we only support one wallet.
>
> In July our database hit a quota limit, the services stalled, and our alerting had no destination configured. We were quiet for three weeks. It's visible on-chain and the post-mortem is in the submission."

*Why:* the highest-leverage 22 seconds you have. It reframes every weakness as a scoped, funded deliverable — and it is what most competing pitches will not do.

---

### 2:34–2:52 — The ask (52 words)

> [Screen: three tranches, one line each, with the $99,000 / 19 weeks / 23 Jan 2027 header]
>
> "So we're asking for **$99,000 over 19 weeks** — and none of it pays for what's already built. It funds exactly the three blockers: **one-step cross-chain deposits** via Axelar and CCTP, a **public API and TypeScript SDK** with a reference market-maker bot, and **multi-wallet support** — plus isolated margin, BTC and ETH markets, an LP vault, and the redundancy that July demanded."

*Why:* the ask is stated as *removal of named blockers*, which maps 1:1 to the deliverables in the form.

---

### 2:52–3:00 — Close (29 words)

> [Screen: kryonprotocol.vercel.app · github.com/Kryon-Protocol/Kryon · 8 contract addresses on stellar.expert]
>
> "Eight contracts on mainnet, 31,000 lines open source, five internal audits, and a liquidation the keeper executed autonomously in production. It's all verifiable right now.
>
> Kryon works. This award makes it reachable."

*Why:* last line is the thesis of the whole application. Say it slowly, then stop.

---

## Part 2 — The 40-second demo video (shot list)

**Rules for this cut:** no music, no zoom transitions, no cursor-hunting. Screen recording at 1920×1080, 60fps, **on-screen captions only** (it will be watched muted). Speed-ramp all typing and waiting to 2–3×; keep every confirmation moment at 1× so the panelist sees it land. Every wallet popup gets ≤1.5s.

Record two browser windows side by side for the counterparty section, or pre-stage the maker order — do **not** waste seconds explaining why two accounts exist.

| Time | Shot | On-screen caption | Notes |
|---|---|---|---|
| 0:00–0:03 | Kryon trade page, XLM-PERP, book ticking, mark price updating | `Live on Stellar mainnet · XLM-PERP` | Start with motion in the book. Don't start on a static hero. |
| 0:03–0:06 | Click Deposit, enter amount, Freighter popup | `1 · Deposit USDC into the on-chain vault` | Speed-ramp the typing. |
| 0:06–0:11 | Sign in Freighter → balance updates in UI | `Collateral custodied by contract — never by an operator` | Hold 1× on the balance changing. This is the custody proof. |
| 0:11–0:14 | Cut to order ticket, select **Long**, size + limit price, leverage slider | `2 · Place a LONG — signing an intent, not a transaction` | Show the leverage control move. It's instantly legible as "perps." |
| 0:14–0:18 | Freighter **signMessage** popup, visible order params | `SEP-53 signed intent: market · size · price · expiry` | **Critical frame.** Pause 1.5s so the signed params are readable. |
| 0:18–0:21 | Order appears in the book / open orders | `Resting on a price-time-priority order book` | |
| 0:21–0:25 | Counterparty window: **Short** at crossing price, sign | `3 · A SHORT crosses it` | Fast. No explanation. |
| 0:25–0:30 | Book crosses → fill animates → **position row appears** | `Matched off-chain in milliseconds` | Hold on the position row appearing. |
| 0:30–0:36 | Cut to stellar.expert showing the `settle_fill` transaction on the order gateway contract | `4 · Settled on-chain — every fill, individually` | **The money shot.** Show the real explorer, real contract ID, real timestamp. Do not mock this. |
| 0:36–0:40 | Back to portfolio: position with live PnL, margin, funding | `Position · margin · funding — all contract state` | End on the working product, not on a logo card. |

**Framing discipline:** the arc is *custody → signature → match → on-chain proof*. A panelist who watches this muted with no context should be able to say "they took a deposit, signed an order, it matched, and it settled on Stellar." If any second doesn't serve that sentence, cut it.

**Pre-recording checklist**
- [ ] Deposit cap is $500 — pick an amount that doesn't look trivial *or* hit the cap mid-take (~$100–200).
- [ ] Confirm all 7 services are up (matcher, oracle keeper, indexer, WS, reconciler, liquidation keeper, monitor) — a stale oracle mid-take fail-stops settlement and kills the take.
- [ ] Warm the book so the ticker is visibly moving in shot 1.
- [ ] Wallet balances pre-funded; no "insufficient XLM for fees" popup.
- [ ] Browser: hide bookmarks bar, extensions, notification badges. Clean profile.
- [ ] Do a full dry run and time it — you will overrun 40s on the first three attempts. Cut from shots 3, 6 and 8 first, never from shot 9 (`settle_fill`).
- [ ] Export with captions **burned in**, not as a sidecar track.

---

## Part 3 — What to present (slide deck: 7 slides, no more)

Every slide is one claim. No slide has more than 12 words of body text.

1. **Title** — "Kryon — perpetual futures with a real order book, on Stellar mainnet since 7 July 2026." Contract addresses in 8pt at the bottom, as a credibility artefact.
2. **The gap** — $786M Stellar DeFi TVL / 0 mature derivatives venues. Source and date on the slide.
3. **[demo video, full-screen]**
4. **Architecture** — the trader → intent → matcher → gateway → engine/vault diagram from the README. Label SEP-53 and `require_auth_for_args` directly on the arrows.
5. **Prior art** — the five named competitors, each tagged with its model. Your row tagged "CLOB, per-fill on-chain settlement."
6. **Live / Not true yet** — two columns, verbatim from the Products & Services draft. Include the July outage line.
7. **The ask** — $99,000 · 19 weeks · 3 tranches · completing 23 Jan 2027, with the three blockers named.

**Bring to the room / attach to the submission:** the stellar.expert links for all 8 contracts, the GitHub repo, the docs security page (threat model), the five audit reports, and the post-mortem. Have the liquidation transaction hash ready to pull up — if one question deserves a live browser, it's that one.

---

## Part 4 — Q&A prep (the six you will actually get)

**"Isn't this just another perps DEX? Noether, Zenex and Stellars Finance already exist."**
> Those are pool-priced or recursive-lending designs — a vault takes the other side and a keeper marks the position. Kryon is a central-limit order book with price-time priority, partial fills and maker/taker, and it settles each fill on-chain. Noether was awarded on testnet; Zenex is pre-release. We're on mainnet with an autonomous liquidation already executed in production. Different architecture, different stage.

**"You have no volume. Why fund you?"**
> Correct, and we say so in the submission. The venue works — the reason it isn't used is three specific, fixable blockers: collateral can only arrive as USDC already on Stellar, there's no API for market makers, and we support one wallet. That's the entire ask. If you fund a perps venue that hasn't solved custody or liquidation yet, you're funding risk. We already carry that risk on mainnet, unfunded.

**"You went down for three weeks. Why should we trust your operations?"**
> Database plan quota, not a contract failure or key exhaustion. Detection fired correctly; the alerting monitor had no webhook destination configured. It's visible on-chain and we published the post-mortem rather than waiting for someone to find it. Tranche 3 scopes health-gated failover, durable ingress, a status page and operator-balance alerting as *funded deliverables* — that outage is precisely why they're in the budget instead of on a wishlist.

**"Why not build this on a chain that already has derivatives infrastructure?"**
> Because per-fill on-chain settlement is what gives Kryon its custody guarantee, and it's only affordable at Stellar's fees and finality. Move it anywhere with higher fees and you batch or you settle off-chain — and then the operator can settle things you didn't sign. The architecture doesn't survive the port.

**"Can the operator steal from users?"**
> No, and that's contract-enforced rather than promised. `engine.open_position` requires the order gateway; `vault.apply_pnl` requires the engine; end-user signatures are demanded only where a user spends their own funds. The matcher can only settle fills both counterparties signed, verified with `require_auth_for_args` over the exact order parameters. Collateral never passes through an operator wallet.

**"How does this ever pay for itself?"**
> Maker/taker fees on notional, deployed and tested on mainnet but set to zero during the guarded beta. They turn on at Tranche 3 through the 48-hour governance timelock at 1bp/5bp. We're cheap to run — oracle publishes on deviation-or-heartbeat at 1–3 XLM/day — so roughly $160K of monthly notional covers full operating cost. Across three markets with one active market maker, that's a low bar. We fund operations ourselves until then, as we have since launch.

---

## Part 5 — Delivery notes

- **Rehearse to 2:50, not 3:00.** You will speed up on camera and slow down in a room; the buffer absorbs both.
- **Do not read the script.** Learn the six beats — live / gap / demo / how / honest / ask — and speak them. The verbatim text is a floor for phrasing, especially on the technical claims where precision matters.
- **Slow down for three lines only:** "live on mainnet since the 7th of July," "cannot invent a position, move your collateral, or settle a fill you didn't sign," and "Kryon works. This award makes it reachable."
- **Don't apologise during the honest section.** Deliver it in exactly the same tone as the traction section. The confidence is the point — you're reporting, not confessing.
- **If you're cut to 90 seconds:** keep the cold open, the demo, and the ask. Drop the market slide, the prior-art slide and the why-Stellar beat.
