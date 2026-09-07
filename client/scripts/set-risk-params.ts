#!/usr/bin/env tsx
/**
 * Set the two risk parameters the audit found unset, and report the coverage
 * they imply.
 *
 * Why this exists
 * ---------------
 * `max_reward_bps` could only be set at `initialize` and had no reader, so its
 * value could not be inspected or corrected on a running deployment without a
 * redeploy. Both gaps are fixed in the contract; this is the tool that uses
 * them.
 *
 * `set_oi_policy` bounds a market's open-interest notional against the
 * insurance fund. Liquidation closes a distressed position with no
 * counterparty, so the fund is the protocol's implicit other side; until a
 * policy is set that exposure is unbounded (audit KRY-Q4). The cap is inert
 * until configured, so a fresh deployment has no bound at all — and because the
 * cap is measured against the fund, capitalise the fund BEFORE setting a
 * policy or the cap computes to zero and refuses every new position.
 *
 * Neither entrypoint exists on the older deployments still live on testnet and
 * mainnet: those were built without an `upgrade` function and are permanently
 * immutable. This script targets a redeployment from current source.
 *
 * DRY RUN BY DEFAULT. Nothing is submitted without `--execute`.
 *
 * Usage:
 *   npx tsx scripts/set-risk-params.ts
 *   npx tsx scripts/set-risk-params.ts --execute
 *   npx tsx scripts/set-risk-params.ts --execute --reward-bps=50 --oi-multiple=10
 */

import {
  Account,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
  rpc as sorobanRpc,
} from "@stellar/stellar-sdk";
import { ACTIVE_MARKETS, CONTRACTS, NETWORK } from "../config";
import { assertNoPublicSecretLeak, assertRequiredSecrets } from "../lib/secrets-check";

assertRequiredSecrets(["PROTOCOL_ADMIN_SECRET"]);
assertNoPublicSecretLeak();

const FEE = "20000000";
const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");

function numArg(name: string, fallback: number): number {
  const raw = args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${name} must be a positive number`);
  return n;
}

/**
 * Liquidator reward, in bps of closed notional. Defaults to 50 (0.5%), which
 * matches the markets' own `liquidationFeeBps` so the reward never exceeds the
 * penalty collected. The contract caps this at 1000.
 */
const REWARD_BPS = Math.round(numArg("reward-bps", 50));

/**
 * Open-interest notional ceiling, as a multiple of the insurance fund.
 * Expressed here as a multiple for legibility and converted to bps for the
 * contract. A tighter number is a stronger bound; pick it against a capitalised
 * fund rather than whatever the fund happens to hold today.
 */
const OI_MULTIPLE = numArg("oi-multiple", 10);
const OI_BPS = Math.round(OI_MULTIPLE * 10_000);

const server = new sorobanRpc.Server(NETWORK.rpcUrl);
const admin = Keypair.fromSecret(process.env.PROTOCOL_ADMIN_SECRET as string);

let simSeq = 100;

async function read(contractId: string, method: string, callArgs: xdr.ScVal[] = []) {
  const tx = new TransactionBuilder(
    new Account(Keypair.random().publicKey(), (simSeq++).toString()),
    { fee: FEE, networkPassphrase: NETWORK.passphrase }
  )
    .addOperation(new Contract(contractId).call(method, ...callArgs))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (sorobanRpc.Api.isSimulationError(sim)) {
    return { error: sim.error.split("\n")[0].replace("HostError: ", "").slice(0, 60) };
  }
  const retval = (sim as sorobanRpc.Api.SimulateTransactionSuccessResponse).result?.retval;
  try {
    return { value: retval ? scValToNative(retval) : null };
  } catch {
    return { value: null };
  }
}

async function submit(contractId: string, method: string, callArgs: xdr.ScVal[], label: string) {
  const account = await server.getAccount(admin.publicKey());
  const tx = new TransactionBuilder(account, { fee: FEE, networkPassphrase: NETWORK.passphrase })
    .addOperation(new Contract(contractId).call(method, ...callArgs))
    .setTimeout(120)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (sorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`${label}: ${sim.error.split("\n")[0]}`);
  }
  if (!EXECUTE) return "(dry run — not submitted)";

  const prepared = sorobanRpc.assembleTransaction(tx, sim).build();
  prepared.sign(admin);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`${label} rejected: ${sent.errorResult?.toXDR("base64")}`);
  }
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 1200));
    const got = await server.getTransaction(sent.hash);
    if (got.status === "SUCCESS") return sent.hash;
    if (got.status === "FAILED") throw new Error(`${label} failed on-chain: ${sent.hash}`);
  }
  throw new Error(`${label} unconfirmed: ${sent.hash}`);
}

/** i128::MAX, which `insurance_coverage_bps` returns for a market with no OI. */
const UNBOUNDED = (1n << 127n) - 1n;

function describeCoverage(result: { value?: unknown; error?: string }): string {
  // #5 is InvalidConfig, which here means `load_market` found nothing — the
  // policy was still set, the market just is not registered on this deployment
  // yet. Reporting the raw error read as a failure of the write above it.
  if (result.error?.includes("#5")) return "policy set (market not registered yet)";
  if (result.error) return result.error;
  if (result.value === null || result.value === undefined) return "unavailable";
  const bps = BigInt(result.value as string | number | bigint);
  if (bps >= UNBOUNDED) return "idle (no open interest)";
  return `${Number(bps) / 100}% of open interest`;
}

async function main(): Promise<void> {
  console.log(`Risk parameters — ${NETWORK.name}`);
  console.log(`  admin  ${admin.publicKey()}`);
  console.log(`  mode   ${EXECUTE ? "⚠ EXECUTE — transactions WILL be submitted" : "dry run"}\n`);

  console.log("── liquidator reward ──────────────────────────────────");
  const before = await read(CONTRACTS.liquidation, "max_reward_bps");
  if (before.error) {
    throw new Error(
      `cannot read max_reward_bps: ${before.error}\n` +
        `   This deployment predates the entrypoint. The contracts live on testnet\n` +
        `   and mainnet have no upgrade() either, so they cannot be given it —\n` +
        `   redeploy from current source first.`
    );
  }
  console.log(`   before  ${JSON.stringify(before.value)}`);
  const rewardHash = await submit(
    CONTRACTS.liquidation,
    "set_max_reward_bps",
    [nativeToScVal(REWARD_BPS, { type: "u32" })],
    "set_max_reward_bps"
  );
  console.log(`   set to  ${REWARD_BPS} bps (${REWARD_BPS / 100}% of closed notional)  ${rewardHash}`);

  console.log("\n── open-interest policy ───────────────────────────────");
  console.log(`   cap: OI notional <= ${OI_MULTIPLE}x the insurance fund (${OI_BPS} bps)\n`);
  for (const market of Object.values(ACTIVE_MARKETS)) {
    const hash = await submit(
      CONTRACTS.engine,
      "set_oi_policy",
      [
        nativeToScVal(market.marketId, { type: "u32" }),
        nativeToScVal(OI_BPS, { type: "u32" }),
      ],
      `set_oi_policy(${market.marketId})`
    );
    const coverage = describeCoverage(
      await read(CONTRACTS.engine, "insurance_coverage_bps", [
        nativeToScVal(market.marketId, { type: "u32" }),
      ])
    );
    console.log(`   ${market.symbol.padEnd(10)} ${coverage.padEnd(28)} ${hash}`);
  }

  if (!EXECUTE) {
    console.log("\n  Dry run only. Re-run with --execute to submit.");
  }
}

main().catch((e) => {
  console.error(`\n❌ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
