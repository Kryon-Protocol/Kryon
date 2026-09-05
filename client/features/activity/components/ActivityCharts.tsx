"use client";

import { useState } from "react";
import { formatVolume } from "@/lib/format";

/**
 * Chart pieces for the activity dashboard.
 *
 * Both charts here carry ONE series, so neither takes a legend — the panel
 * title names the measure. Volume is drawn in the product's accent green and
 * nothing else on the page reuses that hue for a different meaning.
 *
 * Bars are plain HTML rather than SVG on purpose: 24 hourly bars and a handful
 * of market rows need no path maths, and flex layout keeps them responsive
 * without a viewBox that would stretch the mark geometry off-square.
 */

const ACCENT = "#1fae5b";
const AXIS = "#737373";
const GRID = "#2A2A31";

/** Bigint-safe max over 1e7 USD strings. */
function maxOf(values: string[]): bigint {
  return values.reduce((m, v) => {
    const n = BigInt(v);
    return n > m ? n : m;
  }, 0n);
}

/** Height percentage for a value against a max, with a visible floor for
 *  non-zero values so a small-but-real hour never renders as nothing. */
function heightPct(value: bigint, max: bigint): number {
  if (max <= 0n) return 0;
  if (value <= 0n) return 0;
  const pct = Number((value * 10000n) / max) / 100;
  return Math.max(pct, 1.5);
}

// ── 24h volume histogram ─────────────────────────────────────────────────────

export interface VolumePoint {
  hourStart: number;
  volume: string;
  trades: number;
}

export function VolumeChart({ series }: { series: VolumePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = maxOf(series.map((p) => p.volume));
  const total = series.reduce((s, p) => s + BigInt(p.volume), 0n);
  const active = hover !== null ? series[hover] : null;

  const hourLabel = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="px-4 pb-4 pt-3">
      {/* Hero reading — the tooltip target doubles as the headline so the chart
          always states a number, hovered or not. */}
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="font-mono text-[22px] font-semibold text-[#f5f5f5]">
            {formatVolume(active ? BigInt(active.volume) : total)}
          </div>
          <div className="mt-0.5 text-[11px] text-[#737373]">
            {active
              ? `${hourLabel(active.hourStart)} · ${active.trades.toLocaleString()} ${active.trades === 1 ? "trade" : "trades"}`
              : "Total across the last 24 hours"}
          </div>
        </div>
        {max > 0n && (
          <div className="text-right text-[11px] text-[#737373]">
            peak hour
            <div className="font-mono text-[13px] text-[#a3a3a3]">{formatVolume(max)}</div>
          </div>
        )}
      </div>

      <div className="relative mt-3">
        {/* Recessive baseline only — no gridlines competing with 24 thin bars. */}
        <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: GRID }} />
        <div className="flex h-[104px] items-end gap-[3px]">
          {series.map((p, i) => {
            const v = BigInt(p.volume);
            const h = heightPct(v, max);
            const on = hover === i;
            return (
              <button
                key={p.hourStart}
                type="button"
                aria-label={`${hourLabel(p.hourStart)}: ${formatVolume(v)} across ${p.trades} trades`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                // The button spans the full height so the hit target is the
                // whole column, not the few pixels of a quiet hour's bar.
                className="group relative flex h-full flex-1 items-end outline-none"
              >
                <span
                  className="w-full rounded-t-[3px] transition-[background-color,opacity] duration-150"
                  style={{
                    height: `${h}%`,
                    minHeight: v > 0n ? 2 : 0,
                    background: v > 0n ? ACCENT : GRID,
                    opacity: hover === null || on ? 1 : 0.4,
                  }}
                />
                {/* An empty hour still needs a visible floor tick, otherwise the
                    column reads as missing data rather than as a quiet hour. */}
                {v === 0n && (
                  <span className="absolute inset-x-0 bottom-0 h-px" style={{ background: GRID }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[10px]" style={{ color: AXIS }}>
        <span>{series.length ? hourLabel(series[0].hourStart) : "—"}</span>
        <span>now</span>
      </div>
    </div>
  );
}

// ── Share-of-volume bar, for the markets table ───────────────────────────────

export function ShareBar({ value, max }: { value: string; max: string }) {
  const v = BigInt(value);
  const m = BigInt(max);
  const pct = m > 0n ? Number((v * 10000n) / m) / 100 : 0;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: GRID }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(pct, v > 0n ? 2 : 0)}%`, background: ACCENT }}
      />
    </div>
  );
}
