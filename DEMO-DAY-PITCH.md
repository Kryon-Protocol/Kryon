# KRYON — Demo Day Pitch (3:00, tight)

~340 spoken words + 40s demo. Don't rush — it fits.

---

## [0:00 – 0:08] Open
*[Slide: one line, huge.]*
> **We are building perps on Stellar.**
> Perpetual futures — the biggest product in crypto by volume. Live on mainnet today.

*[Pause. Two seconds.]*

---

## [0:08 – 0:45] What it is, and why nobody did it
> A perp lets you bet on Bitcoin's price going up or down, with leverage, without owning any Bitcoin.
> Every real exchange does that with an **order book** — buyers matched to sellers.
> **Nobody built one on Stellar, because order books need to be fast and blockchains are slow.** Stellar takes five seconds to settle a ledger. No trader waits five seconds. So everyone else dropped the order book and just quoted you a price from a data feed.
> **We kept the book.** We match trades off-chain in about a second, and keep your money, your margin and your settlement on-chain.
> **Exchange speed, without giving anyone your money.**

---

## [0:45 – 1:25] Demo — 40 seconds
> Here it is. Deposit, go long, go short.

| Time | On screen | Your line |
|---|---|---|
| 0–10s | Deposit USDC | "Real money into the contract." |
| 10–22s | Long order fills | "I go long. My price comes from the book." |
| 22–32s | Short matches it | "Someone else shorts. Two traders, no middleman." |
| 32–40s | Position + PnL, on-chain | "Settled on Stellar. That's my live position." |

*[If the video has audio, stay quiet.]*

---

## [1:25 – 1:45] What we built
```
  YOU ──►  MATCHER (off-chain, ~1s)  ◄── ANOTHER TRADER
                    │  settles on-chain
                    ▼
   8 CONTRACTS ON STELLAR — vault · positions · margin
   liquidation · insurance · prices · governance
```
> Eight contracts on Stellar mainnet. Eight markets. Live.
> The matcher is fast but powerless — it can only settle orders you signed yourself. It can't touch your money and it can't trade against you.
> And the price feed only checks that you're safe. It never fills your trade.

---

## [1:45 – 2:30] How we compare
> **Noether and we are both building perps on Soroban — but we made opposite bets, and I want to be precise about the difference.**

**Who's on the other side of your trade**
> Their vault is the counterparty to every trade. GMX proved that works — but the protocol carries the risk, their LPs make money when traders lose, and how much can be traded is capped by how much money they raised.
> **We don't have that ceiling, because we don't have that dependency.** Our counterparty is another trader. We grow with users, not with fundraising.

**Where the price comes from**
> If your price comes from a feed, you're not running a market — you're settling on top of someone else's. That's why those venues get picked off when the feed lags. **Our price comes from the book.**

**What you pay to hold overnight**
> Theirs is whatever their bot decides. **Ours is a formula off the order book that anyone can check.**

---

## [2:30 – 2:48] Why Stellar, and how we make money
> Stellar moves money fast and cheap, and has almost no trading products on it. That's the gap.
> **We earn a small fee on every trade**, taken by the contract on each fill, plus a fee on liquidations that funds the insurance pool. No token needed. **More trades, more revenue.**

---

## [2:48 – 3:00] Close
> Kryon is live at **kryonprotocol.live** — eight markets, on mainnet.
> We're looking for traders on our book and the SCF track to take us to launch.
> **Come put in an order — I'll be at the table.**

---

## Notes
- Spine: *books need speed, chains are slow, we split it.* One idea to leave behind.
- Run long? Cut **"Why Stellar"** — never the three comparison points.
- "Opposite bets," never "they're wrong." They're in the room.
- Pause before *"because we don't have that dependency."*
- Q: *"Off-chain isn't decentralised."* → "It can only settle orders you signed. It can't take your money or fill you at a price you didn't agree to."
- Q: *"Do you have liquidity?"* → "That's a starting problem, not a structural one. Their ceiling never goes away. Ours goes away the moment traders show up."
- Q: *"Really live?"* → Open it on your phone and place an order.
