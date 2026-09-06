#!/usr/bin/env tsx
/**
 * cutover-testnet-v3.ts — reset the live-state metrics that a vault swap
 * invalidates.
 *
 * ── What a cutover does and does not invalidate ──────────────────────────────
 * The dashboard queries by `network`, never by contract address. That is right
 * for CUMULATIVE history — those trades really happened, and volume, trade
 * count and settlement history should survive a vault swap untouched.
 *
 * It is wrong for CURRENT STATE. `Market.longOpenInterest` / `shortOpenInterest`
 * and outstanding `Order` rows describe positions in the OLD vault, which the
 * new one knows nothing about. Left alone the dashboard reports open interest
 * against a venue nobody is trading on, and the order book shows resting orders
 * that can never fill.
 *
 * So: zero the live state, keep the history.
 *
 * Positions are read from the chain (`getPositions` hits the engine), so they
 * need no reset — the new engine simply returns none.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx scripts/cutover-testnet-v3.ts --dry-run
 *   DATABASE_URL=… npx tsx scripts/cutover-testnet-v3.ts --confirm
 */

import { neon } from "../lib/sql";

const NETWORK = "testnet";
const CONFIRM = process.argv.includes("--confirm");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌  DATABASE_URL is required (the testnet database).");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  // This is the testnet database — Market and Order carry no `network` column
  // (one database per network), while Fill does. Filter accordingly rather than
  // assuming a uniform shape.
  const [markets] = (await sql`
    SELECT COUNT(*)::int AS n,
           COALESCE(SUM(CASE WHEN "longOpenInterest" <> '0' OR "shortOpenInterest" <> '0'
                             THEN 1 ELSE 0 END), 0)::int AS with_oi
    FROM "Market"
  `) as Array<{ n: number; with_oi: number }>;

  // "Open" is an order neither cancelled nor fully filled. There is no status
  // enum; cancelled is a boolean and fill progress is filledSize vs size.
  const [orders] = (await sql`
    SELECT COUNT(*)::int AS n FROM "Order"
    WHERE cancelled = false AND "filledSize" < size
  `) as Array<{ n: number }>;

  const [fills] = (await sql`
    SELECT COUNT(*)::int AS n FROM "Fill" WHERE network = ${NETWORK}
  `) as Array<{ n: number }>;

  console.log(`network            : ${NETWORK}`);
  console.log(`markets            : ${markets.n} (${markets.with_oi} carrying open interest)`);
  console.log(`resting orders     : ${orders.n}  -> will be cancelled`);
  console.log(`fills (history)    : ${fills.n}  -> KEPT, volume and trade count survive`);

  if (!CONFIRM) {
    console.log("\nDry run - nothing changed. Rerun with --confirm to apply.");
    return;
  }

  const cancelled = (await sql`
    UPDATE "Order" SET cancelled = true, "updatedAt" = NOW()
    WHERE cancelled = false AND "filledSize" < size
    RETURNING id
  `) as unknown[];
  const reset = (await sql`
    UPDATE "Market" SET "longOpenInterest" = '0', "shortOpenInterest" = '0'
    WHERE "longOpenInterest" <> '0' OR "shortOpenInterest" <> '0'
    RETURNING id
  `) as unknown[];

  console.log(`\n  cancelled ${cancelled.length} resting orders`);
  console.log(`  zeroed open interest on ${reset.length} markets`);
  console.log(`  ${fills.n} fills untouched - cumulative volume and trade count unchanged`);
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
