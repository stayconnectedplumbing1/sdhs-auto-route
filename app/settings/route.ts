import { promises as fs } from "fs";
import { dirname } from "path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SharedTechnicianOverride = {
  id: string;
  name: string;
  home: string;
  vehicle: string;
  skills: string[];
  tools: string[];
  color: string;
  x: number;
  y: number;
  holding?: boolean;
};

type SharedSettings = {
  version: number;
  centralCoastEnabled: boolean;
  centralCoastRoutingEnabled?: boolean;
  tools: string[];
  technicianOverrides: SharedTechnicianOverride[];
  updatedAt?: string;
};

const DEFAULT_TOOLS = [
  "High-pressure jetter",
  "CCTV drain camera",
  "Leak detection equipment",
  "Gas testing equipment",
  "Roofing equipment",
  "Electrical testing equipment",
  "Hot water tools",
  "Ladders",
  "Drain locator",
  "Wet vacuum"
];

const DEFAULT_SETTINGS: SharedSettings = {
  version: 1,
  centralCoastEnabled: true,
  tools: DEFAULT_TOOLS,
  technicianOverrides: []
};

const SETTINGS_FILE = process.env.AUTO_ROUTE_SETTINGS_FILE || "/tmp/auto-route-settings.json";
const SETTINGS_PIN = String(process.env.ADMIN_SETTINGS_PIN || "2468").trim();

function authorised(request: NextRequest) {
  return String(request.headers.get("x-admin-pin") || "").trim() === SETTINGS_PIN;
}

function cleanList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(value => String(value || "").trim()).filter(Boolean)));
}

function normalise(settings: Partial<SharedSettings>): SharedSettings {
  const tools = cleanList(settings.tools);
  const centralCoastValue = typeof settings.centralCoastRoutingEnabled === "boolean"
    ? settings.centralCoastRoutingEnabled
    : settings.centralCoastEnabled;
  return {
    version: 1,
    centralCoastEnabled: centralCoastValue !== false,
    tools: tools.length ? tools : DEFAULT_TOOLS,
    technicianOverrides: Array.isArray(settings.technicianOverrides)
      ? settings.technicianOverrides.map(tech => ({
          id: String(tech.id || tech.name || "").trim(),
          name: String(tech.name || tech.id || "").trim(),
          home: String(tech.home || "Sydney").trim(),
          vehicle: String(tech.vehicle || "Service vehicle").trim(),
          skills: cleanList(tech.skills).length ? cleanList(tech.skills) : ["General Plumbing"],
          tools: cleanList(tech.tools),
          color: String(tech.color || "#1677ff"),
          x: Number.isFinite(Number(tech.x)) ? Number(tech.x) : 50,
          y: Number.isFinite(Number(tech.y)) ? Number(tech.y) : 50,
          holding: Boolean(tech.holding)
        })).filter(tech => tech.id && tech.name)
      : [],
    updatedAt: settings.updatedAt
  };
}

async function readSettings(): Promise<SharedSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    return normalise(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function writeSettings(settings: Partial<SharedSettings>) {
  const nextSettings = normalise({ ...settings, updatedAt: new Date().toISOString() });
  await fs.mkdir(dirname(SETTINGS_FILE), { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(nextSettings, null, 2));
  return nextSettings;
}

export async function GET() {
  return NextResponse.json(await readSettings(), { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  return NextResponse.json(await readSettings(), { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  return NextResponse.json(await writeSettings(await request.json()));
