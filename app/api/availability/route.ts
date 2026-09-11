import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const STORE_URL = new URL("/api/servicem8/auto-route-availability", process.env.AUTO_ROUTE_SETTINGS_STORE_URL || "https://same-day-ai-live-production.up.railway.app");

async function proxy(req: NextRequest, write: boolean) {
  const token = String(process.env.AUTO_ROUTE_SETTINGS_TOKEN || "").trim();
  if (!token) return NextResponse.json({ error: "Shared availability is not configured." }, { status: 503 });
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (write && req.headers.get("x-sdhs-session")) {
    headers["x-sdhs-session"] = req.headers.get("x-sdhs-session")!;
  } else {
    if (write) {
      const pin = Buffer.from(String(req.headers.get("x-admin-pin") || "").trim());
      const expected = Buffer.from(String(process.env.ADMIN_SETTINGS_PIN || "2468").trim());
      if (!pin.length || pin.length !== expected.length || !timingSafeEqual(pin, expected)) {
        return NextResponse.json({ error: "Open Auto Route from Same Day AI, or enter the owner PIN." }, { status: 401 });
      }
    }
    headers.authorization = `Bearer ${token}`;
  }
  try {
    const url = new URL(STORE_URL);
    if (!write) url.searchParams.set("date", req.nextUrl.searchParams.get("date") || "");
    const response = await fetch(url, { method: write ? "PUT" : "GET", headers, body: write ? await req.text() : undefined, cache: "no-store", signal: AbortSignal.timeout(10000) });
    return NextResponse.json(await response.json(), { status: response.status, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not reach shared technician availability. Please retry." }, { status: 503 });
  }
}

export async function GET(req: NextRequest) { return proxy(req, false); }
export async function PUT(req: NextRequest) { return proxy(req, true); }
