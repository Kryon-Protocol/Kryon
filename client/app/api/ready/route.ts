import { NextRequest, NextResponse } from "next/server";
import { db, withRetry } from "@/lib/db";
import { ACTIVE_MARKET_SYMBOLS, getWsUrl } from "@/config";
import { networkFromRequest } from "@/lib/network-server";

export async function GET(req: NextRequest) {
  const network = networkFromRequest(req);
  try {
    const sql = db(network);
    await withRetry(async () => {
      await sql`SELECT 1`;
    }, 2);

    return NextResponse.json(
      {
        ok: true,
        network,
        markets: ACTIVE_MARKET_SYMBOLS,
        websocketConfigured: Boolean(getWsUrl(network)),
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "readiness_unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
