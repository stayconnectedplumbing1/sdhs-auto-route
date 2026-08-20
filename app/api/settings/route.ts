import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETTINGS_FILE =
  process.env.AUTO_ROUTE_SETTINGS_FILE || "/tmp/auto-route-settings.json";

const SETTINGS_PIN = String(process.env.ADMIN_SETTINGS_PIN || "1234").trim();

const DEFAULT_SETTINGS = {
  centralCoastRoutingEnabled: false,
  masterTools: [
    "High-pressure jetter",
    "CCTV drain camera",
    "Leak detection equipment",
    "Gas testing equipment",
    "Roofing equipment",
    "Electrical testing equipment",
    "Hot water tools",
    "Ladders",
    "Drain locator"
  ],
  technicians: []
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate"
    }
  });
}

function authorised(request: NextRequest) {
  const suppliedPin = String(request.headers.get("x-admin-pin") || "").trim();
  return suppliedPin === SETTINGS_PIN;
}

async function readSettings() {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf8");
    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(raw)
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(settings: unknown) {
  await mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
}

export async function GET() {
  return json(await readSettings());
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return json({ error: "Wrong PIN" }, 401);
  }

  return json({
    ok: true,
    settings: await readSettings()
  });
}

export async function PUT(request: NextRequest) {
  if (!authorised(request)) {
    return json({ error: "Wrong PIN" }, 401);
  }

  const body = await request.json();
  const current = await readSettings();
  const next = {
    ...current,
    ...body
  };

  await saveSettings(next);

  return json({
    ok: true,
    settings: next
  });
}
