#!/usr/bin/env tsx
/**
 * faucet-usdt0.ts — send mock testnet USDT0 to a tester.
 *
 * Testnet only. The recipient must already hold a USDT0 trustline: Stellar
 * accounts cannot receive an issued asset without one, and the payment fails
 * with op_no_trust rather than anything self-explanatory. The deposit dialog
 * tells traders this too, but a faucet run is usually the first time anyone
 * hits it, so it is checked here explicitly.
 *
 * Usage:
 *   USDT0_DISTRIBUTOR_SECRET=S… npx tsx scripts/faucet-usdt0.ts GABC… [amount]
 */

import {
  Keypair, Asset, Operation, TransactionBuilder, Horizon, BASE_FEE,
} from "@stellar/stellar-sdk";
import { NETWORK, COLLATERAL } from "@/config";

const DEFAULT_AMOUNT = "10000";

async function main() {
  const [recipient, amountArg] = process.argv.slice(2);
  const amount = amountArg ?? DEFAULT_AMOUNT;

  if (NETWORK.name !== "testnet") {
    console.error(`❌  Faucet is testnet-only; active network is ${NETWORK.name}.`);
    process.exit(1);
  }
  if (!recipient?.startsWith("G") || recipient.length !== 56) {
    console.error("❌  Usage: npx tsx scripts/faucet-usdt0.ts <G… address> [amount]");
    process.exit(1);
  }

  const usdt0 = COLLATERAL.find((c) => c.code === "USDT0");
  if (!usdt0?.issuer) {
    console.error(
      "❌  No USDT0 in this network's collateral registry.\n" +
      "    Run scripts/deploy-testnet-usdt0.ts first, then set\n" +
      "    NEXT_PUBLIC_ASSET_USDT0 and NEXT_PUBLIC_USDT0_ISSUER."
    );
    process.exit(1);
  }

  const secret = process.env.USDT0_DISTRIBUTOR_SECRET;
  if (!secret) {
    console.error("❌  USDT0_DISTRIBUTOR_SECRET is required (printed by deploy-testnet-usdt0.ts).");
    process.exit(1);
  }
  const distributor = Keypair.fromSecret(secret);
  const asset = new Asset("USDT0", usdt0.issuer);
  const horizon = new Horizon.Server(NETWORK.horizonUrl);

  const account = await horizon.loadAccount(recipient).catch(() => null);
  if (!account) {
    console.error(`❌  ${recipient} does not exist on testnet — fund it with friendbot first.`);
    process.exit(1);
  }
  const hasTrustline = account.balances.some(
    (b) => "asset_code" in b && b.asset_code === "USDT0" && b.asset_issuer === usdt0.issuer
  );
  if (!hasTrustline) {
    console.error(
      `❌  ${recipient} has no USDT0 trustline.\n\n` +
      `    Add one in Freighter (Manage Assets → add USDT0), issuer:\n` +
      `      ${usdt0.issuer}\n\n` +
      `    Stellar accounts cannot hold an issued asset without a trustline.`
    );
    process.exit(1);
  }

  const source = await horizon.loadAccount(distributor.publicKey());
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE, networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(Operation.payment({ destination: recipient, asset, amount }))
    .setTimeout(60)
    .build();
  tx.sign(distributor);

  process.stdout.write(`  Sending ${Number(amount).toLocaleString()} USDT0 to ${recipient}…`);
  const res = await horizon.submitTransaction(tx);
  console.log(` ✓  ${res.hash}`);
  console.log(`\n  The tester can now deposit it as margin in the Collateral dialog.`);
}

main().catch((e) => {
  const detail = (e as { response?: { data?: { extras?: { result_codes?: unknown } } } })
    .response?.data?.extras?.result_codes;
  console.error("❌", detail ? JSON.stringify(detail) : e instanceof Error ? e.message : e);
  process.exit(1);
});
