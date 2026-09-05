---
id: mainnet
title: Going to mainnet
sidebar_position: 7
---

# Going to mainnet

Switching network is one line:

```ts
const kryon = new KryonClient({ network: "mainnet", signer });
```

Everything else in this list is the part that matters.

## Before you switch

**Run on testnet long enough to be bored by it.** Include at least one restart,
one deliberate kill, and one period where the venue is unreachable.

**Confirm your shutdown path actually works.** Start the bot, place orders,
kill it, then read the public book back and confirm nothing of yours is left.
Do not take it on faith.

**Set `maxDrawdownUsd`.** On testnet it is a formality. On mainnet it is the
limit that ends a bad day.

**Reduce your size.** Whatever felt right on testnet, start smaller.

**Keep the key out of the code.** Environment variable or a `CallbackSigner`
backed by a KMS. The SDK never logs or serialises key material, and neither
should you.

## Know what mainnet actually is right now

Two things differ materially from testnet, and both will surprise you:

**Only XLM-PERP is live.** The venue advertises 8 markets; 7 of them are not
registered in the database and return 404. `listMarkets()` returns what is
really there.

**The XLM-PERP book is crossed by around 11%,** with most bid levels sitting
above the best ask. Those orders belong to accounts that cannot settle them, so
they rest instead of matching. The spread is not takeable. Keep
`refuseCrossedBook: true` — the default — unless you have specifically decided
otherwise.

Mainnet is also thin. Size accordingly, and do not assume you can exit a
position as fast as you entered it.

## Operating

- Alert on your bot being *down*, not just on errors. A silent bot with
  resting orders is the bad case.
- Log every order you sign, with its nonce. When something goes wrong the nonce
  is how you find it.
- Reconcile against `GET /api/orders/list` on startup, always.
- Watch `account_health.marginRatio`, not just your PnL.
- Have a manual kill switch you can run from a laptop:

```ts
await new KryonClient({ network: "mainnet", signer }).cancelAll();
```

## Custody

Kryon cannot move your funds. Withdrawal needs your signature, and the only
authority the venue ever holds is a signature over one specific order.

The corollary is that **losing your key loses your position**, and no one can
recover it for you.
