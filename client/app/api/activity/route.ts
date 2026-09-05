import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { networkAwareCacheControl, networkFromRequest } from "@/lib/network-server";

/**
 * GET /api/activity — the public "proof of activity" feed behind /dashboard.
 *
 * Aggregates across every market, unlike /api/markets/:id/trades (one market)
 * and /api/fills (one address).
 *
 * ── Units, once, so every consumer can stop guessing ─────────────────────────
 * Prices are stored at 1e18 (PRICE_PRECISION); base sizes at 1e7
 * (AMOUNT_PRECISION). A trade's USD notional is therefore
 *
 *     size(1e7) × price(1e18) / 1e18  →  USD at 1e7
 *
 * Every monetary field this route returns is a **USD value at 1e7**, as a
 * decimal string, so the client can BigInt it without precision loss.
 * `longOpenInterest`/`shortOpenInterest` are the exception and stay in BASE
 * units at 1e7 — they are quantities of the base asset, not dollars — which is
 * why `openInterestNotional` is computed separately rather than by formatting
 * raw OI as if it were money. Timestamps are epoch milliseconds.
 *
 * ── Where the numbers come from ──────────────────────────────────────────────
 * Volume and trade counts are derived from `Fill`, never from `Market.volume`.
 * That column is an incrementally-updated counter that historically only ever
 * went up — a rolled-back fill left its notional behind — so it reads in the
 * hundreds of millions against a few hundred dollars of real fills. Summing the
 * raw fills is the ground truth, and is what every figure here means.
 *
 * ── Why this is ONE statement ────────────────────────────────────────────────
 * It used to be eight parallel queries. The driver sends each as its own round
 * trip, so they saw eight different database snapshots — and the matcher
 * deletes fills as it rolls back failed settlements, so panels genuinely
 * disagreed: a response was observed carrying `tradeCount24h: 1` and
 * `volume24h: $417` beside an hourly series that summed to zero, because the
 * fill was rolled back between the two queries. A dashboard whose own totals
 * contradict its own chart is worse than a slow one. A single statement is a
 * single snapshot, and costs one round trip instead of eight.
 *
 * ── Time ─────────────────────────────────────────────────────────────────────
 * `Fill.createdAt` is `timestamp WITHOUT time zone` holding UTC. Comparing it
 * to `NOW()` (which is `timestamptz`) makes Postgres convert using the session
 * time zone, so the 24h window silently shifts on any server not set to UTC.
 * Every comparison below uses `NOW() AT TIME ZONE 'UTC'` — naive UTC, the same
 * domain as the column. Timestamps leave as epoch millis via EXTRACT(EPOCH),
 * which reads a naive timestamp as UTC, rather than as a bare ISO string that
 * `new Date()` would parse in the client's local zone.
 */

const PRICE_PRECISION = 1000000000000000000n; // 1e18

export async function GET(req: NextRequest) {
  const network = networkFromRequest(req);
  const fillsLimit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10) || 50, 200);

  try {
    const sql = db(network);

    const rows = await sql`
      WITH
      -- Every fill for this network, with its USD notional computed once.
      fx AS (
        SELECT
          f.id, f."marketId", f.maker, f.taker, f."makerNonce", f."takerNonce",
          f."fillSize", f."fillPrice", f."txHash", f."createdAt",
          FLOOR(f."fillSize"::numeric * f."fillPrice"::numeric / 1000000000000000000::numeric) AS notional
        FROM "Fill" f
        WHERE f.network = ${network}
      ),
      recent_24h AS (
        SELECT * FROM fx WHERE "createdAt" > (NOW() AT TIME ZONE 'UTC') - INTERVAL '24 hours'
      ),
      -- Resting book depth. Mirrors the matcher's filter exactly
      -- (scripts/matcher-service.ts loadRestingOrders): cancelled, fully
      -- filled and EXPIRED orders are not live liquidity.
      open_orders AS (
        SELECT "marketId", COUNT(*)::int AS open_orders, COUNT(DISTINCT owner)::int AS wallets
        FROM "Order"
        WHERE cancelled = false
          AND "limitPrice" <> '0'
          AND "filledSize"::numeric < size::numeric
          AND ("expiryTs"::numeric = 0 OR "expiryTs"::numeric > EXTRACT(EPOCH FROM NOW()))
        GROUP BY "marketId"
      ),
      per_market AS (
        SELECT
          "marketId",
          COALESCE(SUM(notional), 0) AS volume,
          COALESCE(SUM(notional) FILTER (WHERE "createdAt" > (NOW() AT TIME ZONE 'UTC') - INTERVAL '24 hours'), 0) AS volume_24h,
          COUNT(*)::int AS trade_count,
          COUNT(*) FILTER (WHERE "createdAt" > (NOW() AT TIME ZONE 'UTC') - INTERVAL '24 hours')::int AS trade_count_24h,
          MAX("createdAt") AS last_trade_at
        FROM fx
        GROUP BY "marketId"
      ),
      -- One row per (wallet, fill). A wallet on both sides of the same fill is
      -- counted once, not twice — self-trades must not inflate a ranking.
      trader_fills AS (
        SELECT maker AS address, notional, "createdAt" FROM fx
        UNION ALL
        SELECT taker, notional, "createdAt" FROM fx WHERE taker <> maker
      )
      SELECT
        -- ── Recent fills, with the settlement job for each ─────────────────
        -- A fill is matched OFF-chain (the matcher stores a deterministic
        -- "dbfill…" id) and settled ON-chain by a TxJob keyed on that same
        -- value: Fill.txHash = TxJob.payloadHash, unique on
        -- (network, kind, payloadHash), so the join is 1:1. Side is the
        -- TAKER's direction, joined from the taker's own order — "Order" is
        -- unique on (owner, nonce). It replaces "makerNonce % 2", a coin flip
        -- on a nonce that mislabelled roughly half of every print.
        (
          SELECT COALESCE(json_agg(r ORDER BY r.created_at DESC, r.id DESC), '[]'::json)
          FROM (
            SELECT
              fx.id::text                                   AS id,
              fx."marketId"                                 AS market_id,
              fx."fillPrice"::text                          AS price,
              fx."fillSize"::text                           AS size,
              fx.notional::bigint::text                     AS notional,
              fx.maker, fx.taker,
              ot."isLong"                                   AS taker_is_long,
              (EXTRACT(EPOCH FROM fx."createdAt") * 1000)::bigint AS created_at,
              tj.status::text                               AS settle_status,
              tj."submittedHash"                            AS settle_hash,
              (EXTRACT(EPOCH FROM tj."updatedAt") * 1000)::bigint AS settled_at
            FROM fx
            LEFT JOIN "Order" ot ON ot.owner = fx.taker AND ot.nonce = fx."takerNonce"
            LEFT JOIN "TxJob" tj ON tj.network = ${network} AND tj.kind = 'settle_fill' AND tj."payloadHash" = fx."txHash"
            ORDER BY fx."createdAt" DESC, fx.id DESC
            LIMIT ${fillsLimit}
          ) r
        ) AS recent_fills,

        -- ── Markets ───────────────────────────────────────────────────────
        (
          SELECT COALESCE(json_agg(m ORDER BY m.market_id), '[]'::json)
          FROM (
            SELECT
              mk.id                                   AS market_id,
              mk.symbol,
              mk.active,
              mk."lastPrice"                          AS last_price,
              mk."lastOraclePrice"                    AS last_oracle_price,
              mk."longOpenInterest"                   AS long_open_interest,
              mk."shortOpenInterest"                  AS short_open_interest,
              COALESCE(pm.volume, 0)::bigint::text    AS volume,
              COALESCE(pm.volume_24h, 0)::bigint::text AS volume_24h,
              COALESCE(pm.trade_count, 0)             AS trade_count,
              COALESCE(pm.trade_count_24h, 0)         AS trade_count_24h,
              (EXTRACT(EPOCH FROM pm.last_trade_at) * 1000)::bigint AS last_trade_at,
              COALESCE(oo.open_orders, 0)             AS open_orders,
              COALESCE(oo.wallets, 0)                 AS open_order_wallets,
              (EXTRACT(EPOCH FROM mk."updatedAt") * 1000)::bigint AS updated_at
            FROM "Market" mk
            LEFT JOIN per_market pm ON pm."marketId" = mk.id
            LEFT JOIN open_orders oo ON oo."marketId" = mk.id
          ) m
        ) AS market_stats,

        -- ── Confirmed on-chain settlements ────────────────────────────────
        (
          SELECT COALESCE(json_agg(s ORDER BY s.confirmed_at DESC), '[]'::json)
          FROM (
            SELECT
              id::text AS id,
              "submittedHash" AS tx_hash,
              (EXTRACT(EPOCH FROM "updatedAt") * 1000)::bigint AS confirmed_at
            FROM "TxJob"
            WHERE network = ${network} AND kind = 'settle_fill' AND status = 'CONFIRMED'
              AND "submittedHash" IS NOT NULL
            ORDER BY "updatedAt" DESC
            LIMIT 20
          ) s
        ) AS recent_settlements,

        -- ── Top traders by traded notional ────────────────────────────────
        (
          SELECT COALESCE(json_agg(t ORDER BY t.volume_num DESC, t.last_trade_at DESC), '[]'::json)
          FROM (
            SELECT
              address,
              SUM(notional)                AS volume_num,
              SUM(notional)::bigint::text  AS volume,
              COUNT(*)::int                AS trade_count,
              (EXTRACT(EPOCH FROM MAX("createdAt")) * 1000)::bigint AS last_trade_at
            FROM trader_fills
            GROUP BY address
            ORDER BY SUM(notional) DESC, MAX("createdAt") DESC
            LIMIT 25
          ) t
        ) AS top_traders,

        -- ── Hourly volume, last 24h ───────────────────────────────────────
        -- generate_series so quiet hours come back as explicit zeros; a chart
        -- that simply omitted them would compress a silent night into a
        -- straight line and misstate the shape of activity. Buckets are naive
        -- UTC, the same domain as "createdAt".
        (
          SELECT COALESCE(json_agg(h ORDER BY h.hour_start), '[]'::json)
          FROM (
            SELECT
              (EXTRACT(EPOCH FROM gs.hour_start) * 1000)::bigint AS hour_start,
              COALESCE(SUM(fx.notional), 0)::bigint::text AS volume,
              COUNT(fx.id)::int AS trades
            FROM generate_series(
              date_trunc('hour', (NOW() AT TIME ZONE 'UTC') - INTERVAL '23 hours'),
              date_trunc('hour', (NOW() AT TIME ZONE 'UTC')),
              INTERVAL '1 hour'
            ) AS gs(hour_start)
            LEFT JOIN fx
              ON fx."createdAt" >= gs.hour_start
             AND fx."createdAt" <  gs.hour_start + INTERVAL '1 hour'
            GROUP BY gs.hour_start
          ) h
        ) AS volume_series,

        -- ── Protocol totals ───────────────────────────────────────────────
        -- "unique_traders" counts DISTINCT addresses over the whole fill
        -- history. It used to be the LENGTH of a list query carrying
        -- "LIMIT 100", so the headline capped at 100 however many wallets had
        -- traded; it also unioned in every "Order.owner", counting a wallet
        -- that placed one order and never traded as a trader. Those wallets
        -- are still interesting, so they are reported separately and honestly
        -- as "participants".
        (SELECT COUNT(*)::int FROM fx) AS trade_count,
        (SELECT COUNT(*)::int FROM recent_24h) AS trade_count_24h,
        (SELECT COALESCE(SUM(notional), 0)::bigint::text FROM fx) AS volume_total,
        (SELECT COALESCE(SUM(notional), 0)::bigint::text FROM recent_24h) AS volume_24h,
        (SELECT COALESCE(MAX(notional), 0)::bigint::text FROM recent_24h) AS largest_trade_24h,
        (SELECT COUNT(DISTINCT address)::int FROM trader_fills) AS unique_traders,
        (SELECT COUNT(DISTINCT address)::int FROM trader_fills
          WHERE "createdAt" > (NOW() AT TIME ZONE 'UTC') - INTERVAL '24 hours') AS unique_traders_24h,
        (SELECT COUNT(DISTINCT owner)::int FROM "Order") AS participants,
        (SELECT (EXTRACT(EPOCH FROM MAX("createdAt")) * 1000)::bigint FROM fx) AS last_trade_at,

        -- On-chain settlement lifecycle, counted from TxJob rather than
        -- inferred from the fill feed, so the figures stay right even when a
        -- settled fill is older than the rows the feed carries.
        (SELECT COUNT(*)::int FROM "TxJob" WHERE network = ${network} AND kind = 'settle_fill' AND status = 'CONFIRMED') AS settled_on_chain,
        (SELECT COUNT(*)::int FROM "TxJob" WHERE network = ${network} AND kind = 'settle_fill' AND status = 'CONFIRMED'
           AND "updatedAt" > (NOW() AT TIME ZONE 'UTC') - INTERVAL '24 hours') AS settled_on_chain_24h,
        (SELECT COUNT(*)::int FROM "TxJob" WHERE network = ${network} AND kind = 'settle_fill' AND status IN ('QUEUED','SUBMITTED')) AS settlements_pending,
        (SELECT COUNT(*)::int FROM "TxJob" WHERE network = ${network} AND kind = 'settle_fill' AND status = 'FAILED') AS settlements_failed,
        -- The most recent settlement failure reason. Surfaced so a venue that
        -- is matching but not settling explains itself on its own dashboard,
        -- instead of only in container logs nobody can reach mid-incident.
        (SELECT "lastError" FROM "TxJob"
          WHERE network = ${network} AND kind = 'settle_fill' AND status = 'FAILED' AND "lastError" IS NOT NULL
          ORDER BY "updatedAt" DESC LIMIT 1) AS last_settlement_error,
        -- Notional that actually reached the ledger. The gap between this and
        -- volume_total is exactly the un-settled backlog.
        (SELECT COALESCE(SUM(fx.notional), 0)::bigint::text
           FROM fx
           JOIN "TxJob" tj ON tj.network = ${network} AND tj.kind = 'settle_fill' AND tj."payloadHash" = fx."txHash"
          WHERE tj.status = 'CONFIRMED') AS volume_on_chain
    `;

    type Row = Record<string, unknown>;
    const r = (rows as Row[])[0] ?? {};
    const n = (v: unknown): number => Number(v ?? 0);
    const s = (v: unknown): string => String(v ?? "0");
    /** Epoch millis arrive as bigint-ish; null stays null. */
    const t = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

    const recentFills = ((r.recent_fills as Row[]) ?? []).map((f) => ({
      id: String(f.id),
      marketId: n(f.market_id),
      price: s(f.price),
      size: s(f.size),
      notional: s(f.notional),
      maker: String(f.maker),
      taker: String(f.taker),
      // null when the taker's order row has been pruned — the UI renders no
      // side rather than a fabricated one.
      side:
        f.taker_is_long === null || f.taker_is_long === undefined
          ? null
          : ((f.taker_is_long ? "buy" : "sell") as "buy" | "sell"),
      createdAt: n(f.created_at),
      settlement: f.settle_status
        ? {
            status: String(f.settle_status) as "QUEUED" | "SUBMITTED" | "CONFIRMED" | "FAILED",
            // Only a CONFIRMED job's hash is a real, explorable ledger tx.
            onChainHash: f.settle_hash ? String(f.settle_hash) : null,
            at: n(f.settled_at),
          }
        : null,
    }));

    const marketStats = ((r.market_stats as Row[]) ?? []).map((m) => {
      const longOi = BigInt(s(m.long_open_interest));
      const shortOi = BigInt(s(m.short_open_interest));
      // Mark the book at the oracle, falling back to the last traded price.
      // Open interest is a BASE quantity; turning it into dollars needs a
      // price, which is why rendering `long + short` as money was wrong by
      // whatever the asset happens to cost.
      const oracle = BigInt(s(m.last_oracle_price));
      const last = BigInt(s(m.last_price));
      const mark = oracle > 0n ? oracle : last;

      return {
        marketId: n(m.market_id),
        symbol: String(m.symbol),
        active: Boolean(m.active),
        lastPrice: s(m.last_price),
        lastOraclePrice: s(m.last_oracle_price),
        volume: s(m.volume),
        volume24h: s(m.volume_24h),
        tradeCount: n(m.trade_count),
        tradeCount24h: n(m.trade_count_24h),
        lastTradeAt: t(m.last_trade_at),
        longOpenInterest: s(m.long_open_interest),
        shortOpenInterest: s(m.short_open_interest),
        openInterestNotional: (((longOi + shortOi) * mark) / PRICE_PRECISION).toString(),
        openOrders: n(m.open_orders),
        openOrderWallets: n(m.open_order_wallets),
        updatedAt: n(m.updated_at),
      };
    });

    // Busiest first, by 24h volume then all-time, so the markets actually
    // trading lead the table. Compared as BigInt — notionals run past 2^53 and
    // Number() would start tying rows at random.
    marketStats.sort((a, b) => {
      const d24 = BigInt(b.volume24h) - BigInt(a.volume24h);
      if (d24 !== 0n) return d24 > 0n ? 1 : -1;
      const dAll = BigInt(b.volume) - BigInt(a.volume);
      if (dAll !== 0n) return dAll > 0n ? 1 : -1;
      return a.marketId - b.marketId;
    });

    const recentSettlements = ((r.recent_settlements as Row[]) ?? []).map((x) => ({
      id: String(x.id),
      txHash: String(x.tx_hash),
      confirmedAt: n(x.confirmed_at),
    }));

    const topTraders = ((r.top_traders as Row[]) ?? []).map((x) => ({
      address: String(x.address),
      volume: s(x.volume),
      tradeCount: n(x.trade_count),
      lastTradeAt: n(x.last_trade_at),
    }));

    const volumeSeries = ((r.volume_series as Row[]) ?? []).map((x) => ({
      hourStart: n(x.hour_start),
      volume: s(x.volume),
      trades: n(x.trades),
    }));

    const tradeCount24h = n(r.trade_count_24h);
    const volume24h = s(r.volume_24h);

    // Summed as BigInt across markets. This was `sum + Number(long) + Number(short)`,
    // which loses integer precision above 2^53 and, more basically, added
    // base-asset quantities across eight different assets — BTC and TRX units
    // in one total — then rendered the result as dollars. Only the per-market
    // notionals are commensurable.
    const openInterestNotional = marketStats
      .reduce((sum, m) => sum + BigInt(m.openInterestNotional), 0n)
      .toString();

    const totals = {
      activeMarkets: marketStats.filter((m) => m.active).length,
      totalMarkets: marketStats.length,
      tradeCount: n(r.trade_count),
      tradeCount24h,
      uniqueTraders: n(r.unique_traders),
      uniqueTraders24h: n(r.unique_traders_24h),
      /** Wallets that have placed an order, traded or not. Not "traders". */
      participants: n(r.participants),
      volume24h,
      volumeTotal: s(r.volume_total),
      largestTrade24h: s(r.largest_trade_24h),
      /** Mean notional per trade over 24h; 0 when there were none. */
      avgTradeSize24h:
        tradeCount24h > 0 ? (BigInt(volume24h) / BigInt(tradeCount24h)).toString() : "0",
      openInterestNotional,
      openOrders: marketStats.reduce((acc, m) => acc + m.openOrders, 0),
      lastTradeAt: t(r.last_trade_at),

      // ── On-chain ───────────────────────────────────────────────────────────
      settledOnChain: n(r.settled_on_chain),
      settledOnChain24h: n(r.settled_on_chain_24h),
      settlementsPending: n(r.settlements_pending),
      settlementsFailed: n(r.settlements_failed),
      lastSettlementError: r.last_settlement_error ? String(r.last_settlement_error) : null,
      volumeOnChain: s(r.volume_on_chain),
    };

    return NextResponse.json(
      {
        network,
        generatedAt: Date.now(),
        totals,
        marketStats,
        recentFills,
        recentSettlements,
        topTraders,
        volumeSeries,
      },
      { headers: { "Cache-Control": networkAwareCacheControl(req, "s-maxage=5, stale-while-revalidate=15") } }
    );
  } catch (e) {
    console.error("activity feed error:", e);
    return NextResponse.json(
      {
        network,
        generatedAt: Date.now(),
        totals: null,
        marketStats: [],
        recentFills: [],
        recentSettlements: [],
        topTraders: [],
        volumeSeries: [],
        error: "activity_unavailable",
      },
      { status: 500 }
    );
  }
}
