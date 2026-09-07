#!/usr/bin/env tsx
/**
 * Funding Keeper — pokes `perp-engine.update_funding(market_id)` on every
 * active market on a fixed cadence.
 *
 * Why this service has to exist
 * -----------------------------
 * A perpetual future has no expiry, so the only thing tethering its price to
 * spot is the funding payment: when the perp trades above the index, longs pay
 * shorts, which makes being long expensive and pulls the mark back down. If
 * funding never accrues, the mark can drift arbitrarily far from the index and
 * nothing pushes it back — the contract stops being a perp and becomes an
 * isolated betting market whose price means nothing.
 *
 * `update_funding` is the on-chain half of that mechanism, and it is
 * permissionless precisely so that anyone can keep it alive. But permissionless
 * is not the same as automatic: until this keeper ran, nothing in the repo ever
 * called it, so `long_index`/`short_index` sat at zero for the life of the
 * protocol and no position ever paid or received funding (audit KRY-Q2).
 *
 * What a tick does
 * ----------------
 * For each active market, simulate then submit `update_funding(market_id)`. The
 * contract computes the rate from the mark-vs-index premium, clamps it to the
 * market's `max_rate_per_hour`, and charges at most
 * `MAX_FUNDING_ELAPSED_SECS` (1h) of accrual per call. That cap is why cadence
 * matters: ticking more often than hourly is free and harmless, but a gap
 * longer than an hour silently under-charges funding for the excess.
 *
 * The contract fails closed on a stale or low-confidence oracle. That is
 * correct — accruing funding against a price the market itself would refuse to
 * trade on is worse than accruing none — so a `StaleOracle` error here is a
 * signal about the oracle keeper, not about this one.
 *
 * Usage:
 *   FUNDING_KEEPER_SECRET=S... npx tsx scripts/funding-keeper.ts
 */

import {
  Keypair,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc as sorobanRpc,
} from "@stellar/stellar-sdk";
import { ACTIVE_MARKETS, CONTRACTS, NETWORK } from "../config";
import { assertNoPublicSecretLeak, assertRequiredSecrets } from "../lib/secrets-check";

assertRequiredSecrets(["FUNDING_KEEPER_SECRET"]);
assertNoPublicSecretLeak();

const FEE = "1000000";
// Well inside the contract's 1h accrual cap, so a missed tick or two still
// leaves the next one charging the full elapsed window rather than truncating.
const TICK_INTERVAL_MS = Number(process.env.FUNDING_INTERVAL_MS ?? String(15 * 60 * 1000));
// Spacing between markets: each update is its own transaction on one account,
// so consecutive submissions must not race the sequence number.
const STAGGER_MS = Number(process.env.FUNDING_STAGGER_MS ?? "800");

const MARKETS = Object.values(ACTIVE_MARKETS).map((m) => ({
  id: m.marketId,
  symbol: m.oracleSymbol,
}));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Submit one `update_funding` and wait for it to land. Returns the tx hash on
 * confirmed success, or null when the market declined the update for an
 * expected reason (stale oracle, unconfigured funding, or an ambiguous
 * confirmation timeout) — those are logged, not thrown, so one bad market
 * cannot stop the other seven from funding.
 *
 * Waiting for confirmation (rather than just staggering submissions) matters
 * because every market shares one account: `getAccount` returns the
 * on-chain sequence, so submitting the next market's tx before this one has
 * landed hands it a stale sequence number. A short stagger isn't enough on
 * testnet's ~5s ledger close — most submissions after the first silently
 * never land, and the one after that gets an explicit txBadSeq. This is the
 * same reason oracle-keeper's `writePrice` polls before moving on.
 */
async function updateFunding(
  server: sorobanRpc.Server,
  kp: Keypair,
  marketId: number
): Promise<string | null> {
  const account = await server.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: FEE,
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(
      new Contract(CONTRACTS.engine).call(
        "update_funding",
        nativeToScVal(marketId, { type: "u32" })
      )
    )
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (sorobanRpc.Api.isSimulationError(sim)) {
    const err = (sim as sorobanRpc.Api.SimulateTransactionErrorResponse).error ?? "";
    console.warn(`[funding] market ${marketId}: simulation declined — ${err}`);
    return null;
  }

  const prepared = sorobanRpc.assembleTransaction(tx, sim).build();
  prepared.sign(kp);
  const send = await server.sendTransaction(prepared);
  if (send.status === "ERROR") {
    throw new Error(
      `market ${marketId}: ${send.errorResult?.toXDR("base64") ?? "submit error"}`
    );
  }

  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const poll = await server.getTransaction(send.hash);
    if (poll.status === "SUCCESS") return send.hash;
    if (poll.status === "FAILED") {
      throw new Error(`market ${marketId}: tx ${send.hash} failed on-chain`);
    }
  }
  console.warn(`[funding] market ${marketId}: confirmation timeout on ${send.hash} — ambiguous, retrying next tick`);
  return null;
}

async function tick(server: sorobanRpc.Server, kp: Keypair): Promise<void> {
  for (const market of MARKETS) {
    try {
      const hash = await updateFunding(server, kp, market.id);
      if (hash) {
        console.log(`[funding] ${market.symbol} (market ${market.id}) updated — ${hash}`);
      }
    } catch (e) {
      console.error(`[funding] ${market.symbol}:`, e instanceof Error ? e.message : e);
    }
    await sleep(STAGGER_MS);
  }
}

async function main(): Promise<void> {
  const kp = Keypair.fromSecret(process.env.FUNDING_KEEPER_SECRET as string);
  const server = new sorobanRpc.Server(NETWORK.rpcUrl);

  console.log(
    `[funding] keeper up on ${NETWORK.name} as ${kp.publicKey()} — ` +
      `${MARKETS.length} market(s), every ${TICK_INTERVAL_MS / 1000}s`
  );

  for (;;) {
    const started = Date.now();
    await tick(server, kp).catch((e) => console.error("[funding] tick failed:", e));
    await sleep(Math.max(0, TICK_INTERVAL_MS - (Date.now() - started)));
  }
}

main().catch((e) => {
  console.error("[funding] fatal:", e);
  process.exit(1);
});
