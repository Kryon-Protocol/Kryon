"use client";

import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { TopNav } from "@/components/common/TopNav";
import { MarketCell, marketById } from "@/components/common/MarketCell";
import { NETWORK_LABEL } from "@/config";
import { formatMarketUsd, formatVolume } from "@/lib/format";
import { apiFetch } from "@/lib/api";
import { VolumeChart, ShareBar, type VolumePoint } from "@/features/activity/components/ActivityCharts";

/**
 * /dashboard — the protocol's public activity page.
 *
 * Every figure on this page comes from /api/activity, which derives all of them
 * from settled `Fill` rows and their on-chain settlement jobs. Nothing here is
 * hardcoded, seeded, or padded: when the venue is quiet the page says so
 * plainly, because a number a reader cannot trust is worse than a zero.
 *
 * Two clocks drive it:
 *  - the polled aggregate response, which owns every total; and
 *  - a WebSocket trade stream, which owns the tape and pulls the next poll
 *    forward the moment a print lands, so totals follow within a beat.
 */

interface MarketStat {
  marketId: number;
  symbol: string;
  active: boolean;
  lastPrice: string;
  lastOraclePrice: string;
  volume: string;
  volume24h: string;
  tradeCount: number;
  tradeCount24h: number;
  lastTradeAt: number | null;
  longOpenInterest: string;
  shortOpenInterest: string;
  openInterestNotional: string;
  openOrders: number;
  openOrderWallets: number;
  updatedAt: number;
}
interface Totals {
  activeMarkets: number;
  totalMarkets: number;
  tradeCount: number;
  tradeCount24h: number;
  uniqueTraders: number;
  uniqueTraders24h: number;
  participants: number;
  volume24h: string;
  volumeTotal: string;
  largestTrade24h: string;
  avgTradeSize24h: string;
  openInterestNotional: string;
  openOrders: number;
  lastTradeAt: number | null;
  settledOnChain: number;
  settledOnChain24h: number;
  settlementsPending: number;
  settlementsFailed: number;
  lastSettlementError: string | null;
  volumeOnChain: string;
}
interface ActivityResp {
  network: string;
  generatedAt: number;
  totals: Totals | null;
  marketStats: MarketStat[];
  volumeSeries: VolumePoint[];
}

// ── Small helpers ────────────────────────────────────────────────────────────

function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const num = (n: number) => n.toLocaleString("en-US");

// ── Presentational pieces ────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "muted";
}) {
  return (
    <div className="rounded-[10px] border border-[#2A2A31] bg-[#212128] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-[#737373]">{label}</div>
      <div
        className={`mt-1 font-mono text-[20px] font-semibold ${
          tone === "muted" ? "text-[#a3a3a3]" : "text-[#f5f5f5]"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-[#737373]">{sub}</div>}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[#2A2A31] bg-[#212128]">
      <div className="flex items-start justify-between gap-3 border-b border-[#2A2A31] px-4 py-3">
        <div>
          <h2 className="text-[14px] font-semibold text-[#f5f5f5]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-[#737373]">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading, isError, dataUpdatedAt } = useQuery<ActivityResp>({
    queryKey: ["activity"],
    queryFn: async () => {
      const res = await apiFetch("/api/activity", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  });

  const totals = data?.totals ?? null;
  const markets = useMemo(() => data?.marketStats ?? [], [data]);
  const series = data?.volumeSeries ?? [];

  // Denominator for the share bars: the busiest market's 24h volume, falling
  // back to all-time so the column still ranks when the last day was quiet.
  const { shareKey, shareMax } = useMemo(() => {
    const max24 = markets.reduce((m, x) => (BigInt(x.volume24h) > m ? BigInt(x.volume24h) : m), 0n);
    if (max24 > 0n) return { shareKey: "volume24h" as const, shareMax: max24.toString() };
    const maxAll = markets.reduce((m, x) => (BigInt(x.volume) > m ? BigInt(x.volume) : m), 0n);
    return { shareKey: "volume" as const, shareMax: maxAll.toString() };
  }, [markets]);

  const hasTraded = (totals?.tradeCount ?? 0) > 0;
  const dash = isLoading ? "…" : "—";

  return (
    <div
      className="min-h-screen bg-[#19191A] text-[#f5f5f5]"
      style={{ fontFamily: "var(--font-poppins), 'Poppins', system-ui, sans-serif" }}
    >
      <TopNav />
      <main className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight sm:text-[34px]">Activity</h1>
            <p className="mt-1 text-[13px] text-[#a3a3a3]">
              Liquidity and market activity on {NETWORK_LABEL}. Every figure is derived from
              settled fills — nothing on this page is estimated.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[11px] text-[#737373]">
              Updated {dataUpdatedAt ? timeAgo(dataUpdatedAt) : "—"}
            </span>
          </div>
        </div>

        {isError && (
          <div className="rounded-[10px] border border-[#2A2A31] bg-[#212128] px-4 py-3 text-[13px] text-[#e34c4c]">
            Failed to load activity. Retrying…
          </div>
        )}

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <KpiTile
            label="Volume (24h)"
            value={totals ? formatVolume(BigInt(totals.volume24h)) : dash}
            sub={totals ? `${formatVolume(BigInt(totals.volumeTotal))} all-time` : undefined}
          />
          <KpiTile
            label="Trades (24h)"
            value={totals ? num(totals.tradeCount24h) : dash}
            sub={totals ? `${num(totals.tradeCount)} all-time` : undefined}
          />
          <KpiTile
            label="Unique Traders"
            value={totals ? num(totals.uniqueTraders) : dash}
            sub={totals ? `${num(totals.uniqueTraders24h)} active in 24h` : undefined}
          />
          <KpiTile
            label="Open Interest"
            value={totals ? formatVolume(BigInt(totals.openInterestNotional)) : dash}
            sub={totals ? `${num(totals.openOrders)} resting orders` : undefined}
          />
          <KpiTile
            label="Settled On-Chain"
            value={totals ? num(totals.settledOnChain) : dash}
            sub={
              totals
                ? totals.settlementsPending > 0
                  ? `${num(totals.settlementsPending)} settling`
                  : `${formatVolume(BigInt(totals.volumeOnChain))} notional`
                : undefined
            }
          />
          <KpiTile
            label="Active Markets"
            value={totals ? `${totals.activeMarkets}/${totals.totalMarkets}` : dash}
            sub={totals ? `${num(totals.participants)} wallets onboarded` : undefined}
          />
        </div>

        {/* Honest empty state. The venue can be fully live — oracles publishing,
            book quoted, wallets funded — with nothing settled yet, and saying so
            is more useful than eight zeros with no explanation. */}
        {totals && !hasTraded && (
          <div className="rounded-[10px] border border-[#2A2A31] bg-[#212128] px-4 py-3 text-[13px]">
            <span className="text-[#e0a33a]">No settled trades yet on {NETWORK_LABEL}.</span>{" "}
            <span className="text-[#a3a3a3]">
              {totals.activeMarkets} markets are live and {num(totals.openOrders)} orders are resting
              from {num(totals.participants)} wallets, but no fill has settled — so volume, trader
              and trade counts are genuinely zero rather than unavailable.
            </span>
          </div>
        )}

        {/* Matching but not settling. This is the failure that hid for weeks:
            the matcher writes a fill, settlement fails, the fill is rolled back
            and deleted, and every count returns to zero — with no trace anywhere
            a reader could see. Now it says so, and says why. */}
        {totals && totals.settlementsFailed > 0 && (
          <div className="rounded-[10px] border border-[#ff4d5f]/30 bg-[#ff4d5f]/[0.06] px-4 py-3 text-[13px]">
            <span className="font-semibold text-[#ff4d5f]">
              {num(totals.settlementsFailed)} settlement
              {totals.settlementsFailed === 1 ? "" : "s"} failing.
            </span>{" "}
            <span className="text-[#a3a3a3]">
              Matched fills are not reaching the ledger, so they are rolled back and do not count
              toward volume.
            </span>
            {totals.lastSettlementError && (
              <div className="mt-1.5 break-words font-mono text-[11px] text-[#737373]">
                {totals.lastSettlementError}
              </div>
            )}
          </div>
        )}

        {/* ── Volume over time ─────────────────────────────────────────────── */}
        <Panel
          title="Volume — last 24 hours"
          subtitle="Traded notional per hour, summed from settled fills."
        >
          {isLoading ? (
            <div className="h-[168px] animate-pulse bg-[#19191A]/40" />
          ) : (
            <VolumeChart series={series} />
          )}
        </Panel>

        {/* ── Markets ──────────────────────────────────────────────────────── */}
        <Panel
          title="Markets"
          subtitle="Price, traded volume, open interest and resting depth per market — busiest first."
        >
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#737373]">
                  <th className="py-[9px] pl-4 pr-2 text-left font-semibold">Market</th>
                  <th className="px-3 py-[9px] text-right font-semibold">Price</th>
                  <th className="px-3 py-[9px] text-left font-semibold">Volume 24h</th>
                  <th className="px-3 py-[9px] text-right font-semibold">Volume all-time</th>
                  <th className="px-3 py-[9px] text-right font-semibold">Trades 24h</th>
                  <th className="px-3 py-[9px] text-right font-semibold">Open Interest</th>
                  <th className="px-3 py-[9px] text-right font-semibold">Book</th>
                  <th className="py-[9px] pl-2 pr-4 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-t border-[#2A2A31]">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="h-5 animate-pulse rounded bg-[#19191A]" />
                      </td>
                    </tr>
                  ))
                ) : markets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[13px] text-[#737373]">
                      No markets registered yet.
                    </td>
                  </tr>
                ) : (
                  markets.map((m) => {
                    const config = marketById(m.marketId);
                    return (
                      <tr key={m.marketId} className="border-t border-[#2A2A31] hover:bg-white/[0.02]">
                        <td className="py-[11px] pl-4 pr-2">
                          <MarketCell marketId={m.marketId} className="font-semibold" />
                        </td>
                        <td className="px-3 py-[11px] text-right font-mono">
                          {config ? formatMarketUsd(config, BigInt(m.lastPrice)) : m.lastPrice}
                        </td>
                        {/* Volume gets the bar: it is the column readers scan to
                            rank markets, and a bar ranks faster than digits. */}
                        <td className="px-3 py-[11px]">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono">{formatVolume(BigInt(m.volume24h))}</span>
                            <ShareBar value={m[shareKey]} max={shareMax} />
                          </div>
                        </td>
                        <td className="px-3 py-[11px] text-right font-mono text-[#a3a3a3]">
                          {formatVolume(BigInt(m.volume))}
                        </td>
                        <td className="px-3 py-[11px] text-right font-mono">
                          {num(m.tradeCount24h)}
                        </td>
                        <td className="px-3 py-[11px] text-right font-mono">
                          {formatVolume(BigInt(m.openInterestNotional))}
                        </td>
                        <td className="px-3 py-[11px] text-right font-mono text-[#a3a3a3]">
                          {num(m.openOrders)}
                        </td>
                        <td className="py-[11px] pl-2 pr-4 text-right">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${
                              m.active
                                ? "bg-[#1fae5b]/15 text-[#1fae5b]"
                                : "bg-[#737373]/15 text-[#737373]"
                            }`}
                          >
                            {m.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>

      </main>
    </div>
  );
}
