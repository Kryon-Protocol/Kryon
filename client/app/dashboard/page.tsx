"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { TopNav } from "@/components/common/TopNav";
import { MarketCell, marketById } from "@/components/common/MarketCell";
import { STELLAR_EXPERT_URL, NETWORK_LABEL } from "@/config";
import { priceFor, sizeFor, formatMarketUsd, formatVolume } from "@/lib/format";
import { apiFetch } from "@/lib/api";

interface Fill {
  id: string;
  marketId: number;
  price: string;
  size: string;
  side: "buy" | "sell";
  txHash: string;
  createdAt: number;
}
interface MarketStat {
  marketId: number;
  symbol: string;
  active: boolean;
  lastPrice: string;
  volume: string;
  longOpenInterest: string;
  shortOpenInterest: string;
  lastOraclePrice: string;
  updatedAt: number;
}
interface Settlement {
  id: string;
  txHash: string;
  confirmedAt: number;
}
interface Totals {
  activeMarkets: number;
  tradeCount: number;
  tradeCount24h: number;
  uniqueTraders: number;
  volume24h: string;
  volumeTotal: string;
  openInterest: string;
}
interface ActivityResp {
  recentFills: Fill[];
  marketStats: MarketStat[];
  recentSettlements: Settlement[];
  totals: Totals | null;
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[#2A2A31] bg-[#212128] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-[#737373]">{label}</div>
      <div className="mt-1 font-mono text-[18px] font-semibold text-[#f5f5f5]">{value}</div>
    </div>
  );
}

function TxLink({ hash }: { hash: string }) {
  const onChain = hash && !hash.startsWith("dbfill");
  if (!onChain) return <span className="text-[#737373]">—</span>;
  return (
    <a
      href={`${STELLAR_EXPERT_URL}/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-[#a3a3a3] underline decoration-dotted underline-offset-4 hover:text-[#f5f5f5]"
    >
      {hash.slice(0, 8)}…
    </a>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#2A2A31] bg-[#212128] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2A2A31]">
        <h2 className="text-[14px] font-semibold text-[#f5f5f5]">{title}</h2>
        {subtitle && <p className="text-[12px] text-[#737373] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery<ActivityResp>({
    queryKey: ["activity"],
    queryFn: async () => {
      const res = await apiFetch("/api/activity?limit=50", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 8_000,
    placeholderData: keepPreviousData,
  });

  const totals = data?.totals;
  const fills = data?.recentFills ?? [];
  const markets = data?.marketStats ?? [];
  const settlements = data?.recentSettlements ?? [];

  return (
    <div
      className="min-h-screen bg-[#19191A] text-[#f5f5f5]"
      style={{ fontFamily: "var(--font-poppins), 'Poppins', system-ui, sans-serif" }}
    >
      <TopNav />
      <main className="px-4 py-5 sm:px-6 sm:py-6 max-w-[1200px] mx-auto flex flex-col gap-5">
        <div>
          <h1 className="text-[26px] sm:text-[34px] font-bold tracking-tight">Activity</h1>
          <p className="mt-1 text-[13px] text-[#a3a3a3]">
            Live trades, liquidity, and on-chain settlements on {NETWORK_LABEL}.
          </p>
        </div>

        {isError && (
          <div className="rounded-[10px] border border-[#2A2A31] bg-[#212128] px-4 py-3 text-[13px] text-[#e34c4c]">
            Failed to load activity. Retrying…
          </div>
        )}

        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile label="Active Markets" value={totals ? String(totals.activeMarkets) : isLoading ? "…" : "—"} />
          <KpiTile label="Unique Traders" value={totals ? totals.uniqueTraders.toLocaleString() : isLoading ? "…" : "—"} />
          <KpiTile label="Trades (24h)" value={totals ? totals.tradeCount24h.toLocaleString() : isLoading ? "…" : "—"} />
          <KpiTile label="Trades (All-Time)" value={totals ? totals.tradeCount.toLocaleString() : isLoading ? "…" : "—"} />
          <KpiTile label="Volume (24h)" value={totals ? formatVolume(BigInt(totals.volume24h)) : isLoading ? "…" : "—"} />
          <KpiTile label="Volume (All-Time)" value={totals ? formatVolume(BigInt(totals.volumeTotal)) : isLoading ? "…" : "—"} />
        </div>

        {/* Per-market stats */}
        <Panel title="Markets" subtitle="Live price, volume, and open interest per market.">
          <div className="hidden md:grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] px-4 py-3 text-[11px] uppercase tracking-wider text-[#737373] border-b border-[#2A2A31]">
            <span>Market</span>
            <span className="text-right">Price</span>
            <span className="text-right">Volume</span>
            <span className="text-right">Open Interest</span>
            <span className="text-right">Status</span>
          </div>
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-9 rounded bg-[#19191A] animate-pulse" />
              ))}
            </div>
          ) : markets.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[#737373]">No markets registered yet.</div>
          ) : (
            markets.map((m) => {
              const config = marketById(m.marketId);
              const oi = BigInt(m.longOpenInterest) + BigInt(m.shortOpenInterest);
              return (
                <div
                  key={m.marketId}
                  className="grid grid-cols-2 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-y-2 px-4 py-3 text-[13px] border-b border-[#2A2A31] last:border-b-0 items-center"
                >
                  <span className="col-span-2 md:col-span-1">
                    <MarketCell marketId={m.marketId} />
                  </span>
                  <span className="text-right font-mono">
                    {config ? formatMarketUsd(config, BigInt(m.lastPrice)) : m.lastPrice}
                  </span>
                  <span className="text-right font-mono">{formatVolume(BigInt(m.volume))}</span>
                  <span className="text-right font-mono">{formatVolume(oi)}</span>
                  <span className="text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${
                        m.active ? "bg-[#1fae5b]/15 text-[#1fae5b]" : "bg-[#737373]/15 text-[#737373]"
                      }`}
                    >
                      {m.active ? "Active" : "Inactive"}
                    </span>
                  </span>
                </div>
              );
            })
          )}
        </Panel>

        {/* Live trade ticker */}
        <Panel title="Recent Trades" subtitle="Fills across every market, most recent first.">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full min-w-[560px] text-[12px] tabular">
              <thead>
                <tr className="text-[10px] text-[#737373] font-semibold uppercase tracking-wider">
                  <th className="pl-4 pr-2 py-[9px] text-left">Time</th>
                  <th className="px-3 py-[9px] text-left">Market</th>
                  <th className="px-3 py-[9px] text-right">Side</th>
                  <th className="px-3 py-[9px] text-right">Size</th>
                  <th className="px-3 py-[9px] text-right">Price</th>
                  <th className="pr-4 pl-2 py-[9px] text-right">Tx</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[13px] text-[#737373]">Loading…</td>
                  </tr>
                ) : fills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[13px] text-[#737373]">No trades yet.</td>
                  </tr>
                ) : (
                  fills.map((f) => (
                    <tr key={f.id} className="border-t border-[#2A2A31] hover:bg-white/[0.02] transition-colors">
                      <td className="pl-4 pr-2 py-[10px] text-left text-[#a3a3a3]">{timeAgo(f.createdAt)}</td>
                      <td className="px-3 py-[10px] text-left">
                        <MarketCell marketId={f.marketId} size={15} className="font-semibold" />
                      </td>
                      <td className={`px-3 py-[10px] text-right ${f.side === "buy" ? "text-[#1fae5b]" : "text-[#ff4d5f]"}`}>
                        {f.side === "buy" ? "Buy" : "Sell"}
                      </td>
                      <td className="px-3 py-[10px] text-right font-medium">{sizeFor(f.marketId, Number(f.size))}</td>
                      <td className="px-3 py-[10px] text-right font-medium">{priceFor(f.marketId, Number(f.price))}</td>
                      <td className="pr-4 pl-2 py-[10px] text-right"><TxLink hash={f.txHash} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Recent settlements */}
        <Panel title="Recent Settlements" subtitle="Confirmed on-chain settlement transactions.">
          <div className="flex flex-col">
            {isLoading ? (
              <div className="py-10 text-center text-[13px] text-[#737373]">Loading…</div>
            ) : settlements.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[#737373]">No confirmed settlements yet.</div>
            ) : (
              settlements.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-4 py-3 text-[13px] border-b border-[#2A2A31] last:border-b-0"
                >
                  <span className="text-[#a3a3a3]">{timeAgo(s.confirmedAt)}</span>
                  <TxLink hash={s.txHash} />
                </div>
              ))
            )}
          </div>
        </Panel>
      </main>
    </div>
  );
}
