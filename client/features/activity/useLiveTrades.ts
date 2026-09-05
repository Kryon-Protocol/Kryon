"use client";

import { useEffect, useRef, useState } from "react";
import { ACTIVE_MARKETS, WS_URL } from "@/config";

/**
 * Live trade prints for the activity dashboard, streamed from the ws-server.
 *
 * ── Why a second socket rather than `lib/market/websocket.ts` ────────────────
 * That module is a process-wide singleton with exactly ONE set of handlers
 * (`wsSetHandlers` overwrites them). It belongs to the trade screen's
 * MarketDataProvider. If the dashboard called it, whichever of the two mounted
 * last would silently steal the other's callbacks — and because the dashboard
 * wants all eight markets while the trade screen wants one, they would also
 * fight over the subscription set. A dashboard-scoped connection is a few lines
 * and cannot interfere; it is torn down on unmount.
 *
 * ── What it is and is not ────────────────────────────────────────────────────
 * The socket delivers *prints* the instant the matcher writes them. It does not
 * carry aggregates, so the KPI figures stay owned by the polled /api/activity
 * response, which remains the single source of truth for every number on the
 * page. This hook's job is the tape and a "connected" light: it makes the page
 * feel live between polls without ever inventing a total. `pendingCount` lets
 * the page tell the caller how many prints have landed since the last poll so
 * the poll can be pulled forward instead of guessed at.
 *
 * When `NEXT_PUBLIC_WS_URL` is unset the hook stays dormant and the page runs
 * on polling alone — same contract as the trade screen.
 */

export interface LiveTrade {
  marketId: number;
  price: string;
  size: string;
  side: "buy" | "sell" | null;
  timestamp: number;
}

const PING_INTERVAL_MS = 25_000;
const MAX_RECONNECT_DELAY = 30_000;
const MAX_BUFFERED = 60;

export function useLiveTrades(enabled = true): {
  trades: LiveTrade[];
  connected: boolean;
  /** Prints received since `clearPending()` — a cue to refetch aggregates. */
  pendingCount: number;
  clearPending: () => void;
} {
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [connected, setConnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Held in a ref so reconnect scheduling survives re-renders without
  // re-running the effect and tearing the socket down mid-flight.
  const socketRef = useRef<WebSocket | null>(null);
  const closedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !WS_URL) return;

    closedRef.current = false;
    let reconnectDelay = 1_000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const channels = Object.values(ACTIVE_MARKETS).map((m) => `trades:${m.marketId}`);

    function open() {
      if (closedRef.current) return;

      let ws: WebSocket;
      try {
        ws = new WebSocket(WS_URL as string);
      } catch {
        scheduleReconnect();
        return;
      }
      socketRef.current = ws;

      ws.onopen = () => {
        reconnectDelay = 1_000;
        setConnected(true);
        ws.send(JSON.stringify({ type: "subscribe", channels }));
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (e: MessageEvent<string>) => {
        let msg: { type?: string; market_id?: number; price?: string; size?: string; side?: "buy" | "sell" | null; timestamp?: number };
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.type !== "trade" || typeof msg.market_id !== "number") return;

        const trade: LiveTrade = {
          marketId: msg.market_id,
          price: String(msg.price ?? "0"),
          size: String(msg.size ?? "0"),
          side: msg.side ?? null,
          timestamp: msg.timestamp ?? Date.now(),
        };

        setTrades((prev) => {
          // The server replays its last prints on (re)subscribe, so the same
          // trade can arrive twice across a reconnect. Dedupe on the tuple that
          // identifies a print rather than trusting arrival order.
          const key = `${trade.marketId}:${trade.timestamp}:${trade.price}:${trade.size}`;
          if (prev.some((t) => `${t.marketId}:${t.timestamp}:${t.price}:${t.size}` === key)) {
            return prev;
          }
          return [trade, ...prev].slice(0, MAX_BUFFERED);
        });
        setPendingCount((n) => n + 1);
      };

      ws.onerror = () => { /* onclose follows */ };

      ws.onclose = () => {
        socketRef.current = null;
        setConnected(false);
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (closedRef.current) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      // ±20% jitter so many open tabs don't reconnect in lockstep.
      const delay = reconnectDelay * (0.8 + Math.random() * 0.4);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        open();
      }, delay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    }

    open();

    return () => {
      closedRef.current = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      socketRef.current?.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled]);

  return {
    trades,
    connected,
    pendingCount,
    clearPending: () => setPendingCount(0),
  };
}
