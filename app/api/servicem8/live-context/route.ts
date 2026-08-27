import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = process.env.SERVICEM8_API_BASE || "https://api.servicem8.com/api_1.0";
type Row = Record<string, any>;

async function sm8<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_BASE}/${path}`, {
    headers: { "X-API-Key": token, Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`ServiceM8 ${path} returned ${response.status}`);
  return response.json() as Promise<T>;
}

async function trySm8<T>(path: string, token: string, fallback: T): Promise<T> {
  try { return await sm8<T>(path, token); }
  catch { return fallback; }
}

function sydneyDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function fullName(staff: Row) {
  return `${String(staff.first || "").trim()} ${String(staff.last || "").trim()}`.trim() || String(staff.name || "Technician");
}

function holdingWindowForStaff(staff: Row | undefined) {
  const name = fullName(staff || {}).replace(/[.]/g, " ").replace(/\s+/g, " ").trim();
  if (/8\s*[-–—]\s*11\s*AM/i.test(name)) return "AM 8-11";
  if (/12\s*[-–—]\s*4\s*PM/i.test(name)) return "PM 12-4";
  return null;
}

function cleanList(value: unknown): string[] {
  return Array.isArray(value) ? Array.from(new Set(value.map(item => String(item || "").trim()).filter(Boolean))) : [];
}

function classify(job: Row) {
  const text = [job.job_description, job.work_done_description, job.description, job.category_name, job.queue_name, job.status]
    .map(value => String(value || "")).join(" ");
  if (/(?:blocked|blockage|block).{0,28}(?:drain|toilet)|(?:drain|toilet).{0,28}(?:blocked|blockage)/i.test(text)) {
    return { service: "Blocked drain or toilet", skill: "Blocked Drains", tool: "High-pressure jetter", priority: "Urgent", duration: 90 };
  }
  if (/(?:hws|hot\s*water|water\s*heater).{0,45}(?:leak|burst|repair|replace|not\s*working|no\s*hot\s*water|fault)|(?:leak|burst|repair|replace|fault).{0,45}(?:hws|hot\s*water|water\s*heater)/i.test(text)) {
    return { service: "Hot water replacement or repair", skill: "Hot Water", tool: "Hot water tools", priority: "Urgent", duration: 90 };
  }
  if (/burst.{0,24}(?:pipe|water|line)|flood(?:ed|ing)?|water\s+(?:everywhere|pouring|gushing)/i.test(text)) {
    return { service: "Burst pipe or active flooding", skill: "General Plumbing", tool: "", priority: "Urgent", duration: 90 };
  }
  if (/gas.{0,24}leak|leak.{0,24}gas/i.test(text)) return { service: "Gas leak", skill: "Gas", tool: "Gas testing equipment", priority: "Urgent", duration: 90 };
  if (/regrout|grout/i.test(text)) return { service: "Shower regrout", skill: "Waterproofing", tool: "", priority: "Standard", duration: 180 };
  if (/roof|gutter/i.test(text)) return { service: "Roof repair", skill: "Roofing", tool: "Roofing equipment", priority: "Standard", duration: 120 };
  return { service: "General enquiry", skill: "General Plumbing", tool: "", priority: "Standard", duration: 60 };
}

function actionRequired(job: Row, queueNames = new Map<string, string>()) {
  const queueName = String(job.queue_name || job.queue || queueNames.get(String(job.queue_uuid || "")) || "");
  return /action\s*required/i.test(queueName)
    || String(job.is_action_required || "").toLowerCase() === "true"
    || String(job.is_action_required || "") === "1";
}

export async function GET() {
  const token = String(process.env.SERVICEM8_API_KEY || "").trim();
  if (!token) return NextResponse.json({ error: "SERVICEM8_API_KEY is not configured" }, { status: 503 });

  try {
    const today = sydneyDateKey();
    const horizon = addDays(today, 8);
    const activityFilter = encodeURIComponent(`start_date gt '${today} 00:00:00' and start_date lt '${horizon} 00:00:00'`);
    const activeJobFilter = encodeURIComponent("active eq 1");
    const [activitiesRaw, staffRaw, activeJobsRaw] = await Promise.all([
      sm8<Row[]>(`jobactivity.json?%24filter=${activityFilter}`, token),
      sm8<Row[]>("staff.json", token),
      trySm8<Row[]>(`job.json?%24filter=${activeJobFilter}`, token, [])
    ]);

    const activities = activitiesRaw.filter(activity => String(activity.active ?? "1") !== "0" && String(activity.activity_was_scheduled ?? "1") !== "0");
    const queueNames = new Map<string, string>();
    const staffByUUID = new Map(staffRaw.map(staff => [String(staff.uuid || ""), staff]));
    const waitingJobs = activeJobsRaw.filter(job => actionRequired(job, queueNames));
    const waitingByUUID = new Map(waitingJobs.map(job => [String(job.uuid || ""), job]));
    const jobUUIDs = Array.from(new Set([
      ...activities.map(activity => String(activity.job_uuid || "")),
      ...waitingJobs.map(job => String(job.uuid || ""))
    ].filter(Boolean)));
    // The active-job response already contains almost every scheduled job. Seed
    // the lookup from it so dashboard loading does not make one API request per
    // appointment (which previously made the add-on appear to hang).
    const jobsByUUID = new Map<string, Row>(
      activeJobsRaw
        .map(job => [String(job.uuid || ""), job] as const)
        .filter(([uuid]) => Boolean(uuid))
    );
    for (const [uuid, job] of waitingByUUID) jobsByUUID.set(uuid, job);

    await Promise.all(jobUUIDs.filter(uuid => !jobsByUUID.has(uuid)).map(async uuid => {
      const rows = await trySm8<Row[]>(`job.json?%24filter=${encodeURIComponent(`uuid eq '${uuid}'`)}`, token, []);
      if (rows[0]) jobsByUUID.set(uuid, rows[0]);
    }));

    const activityByJob = new Map<string, Row>();
    for (const activity of activities) {
      const uuid = String(activity.job_uuid || "");
      const current = activityByJob.get(uuid);
      if (uuid && (!current || String(activity.start_date || "") < String(current.start_date || ""))) activityByJob.set(uuid, activity);
    }

    const jobs = jobUUIDs.map((uuid, index) => {
      const job = jobsByUUID.get(uuid) || {};
      const activity = activityByJob.get(uuid);
      const category = classify(job);
      const start = activity?.start_date ? String(activity.start_date) : undefined;
      const end = activity?.end_date ? String(activity.end_date) : undefined;
      const holdingWindow = holdingWindowForStaff(staffByUUID.get(String(activity?.staff_uuid || "")));
      const startMs = start ? new Date(start.replace(" ", "T")).getTime() : NaN;
      const endMs = end ? new Date(end.replace(" ", "T")).getTime() : NaN;
      return {
        id: Number(job.generated_job_id || 0) || 900000 + index,
        customer: String(job.company_name || job.contact_name || "Customer"),
        phone: String(job.contact_phone || ""),
        suburb: String(job.geo_city || job.geo_suburb || ""),
        address: String(job.job_address || ""),
        service: category.service,
        issue: String(job.job_description || ""),
        value: Number(job.total_price || job.invoice_total || 0) || 0,
        duration: Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs ? Math.max(30, Math.round((endMs - startMs) / 60000)) : category.duration,
        priority: category.priority,
        requiredSkill: category.skill,
        requiredTool: category.tool,
        techId: holdingWindow ? null : activity?.staff_uuid ? String(activity.staff_uuid) : null,
        order: activity ? activities.filter(item => String(item.staff_uuid || "") === String(activity.staff_uuid || "")).sort((a, b) => String(a.start_date || "").localeCompare(String(b.start_date || ""))).findIndex(item => item.uuid === activity.uuid) + 1 : 0,
        bookingDay: "Today",
        latitude: Number.isFinite(Number(job.lat)) ? Number(job.lat) : null,
        longitude: Number.isFinite(Number(job.lng)) ? Number(job.lng) : null,
        scheduledStart: start,
        scheduledEnd: end,
        activityUUID: activity?.uuid ? String(activity.uuid) : null,
        allocationUUID: null,
        holdingWindow,
        isActionRequired: Boolean(holdingWindow) || (actionRequired(job, queueNames) && !activity),
        queueName: holdingWindow ? "Allocation" : String(job.queue_name || queueNames.get(String(job.queue_uuid || "")) || ""),
        jobStatus: String(job.status || "Quote"),
        scheduledDate: start ? start.slice(0, 10) : today,
        serviceM8UUID: uuid
      };
    });

    const activeStaff = staffRaw.filter(staff => String(staff.active ?? "1") !== "0" && String(staff.hide_from_schedule ?? "0") !== "1");
    const scheduledStaff = new Set(activities.map(activity => String(activity.staff_uuid || "")).filter(Boolean));
    const colors = ["#1677ff", "#ef4444", "#7c3aed", "#0f9f6e", "#f59e0b", "#0891b2", "#db2777", "#475569"];
    // Shared roles and skills are loaded by the page's /api/settings request and
    // merged into these live ServiceM8 staff records. Avoid calling our own
    // public URL from this server route; on Railway that self-request could
    // stall the whole add-on sync before eventually falling back.
    const selected = activeStaff.filter(staff => scheduledStaff.has(String(staff.uuid || "")));
    const technicians = selected.map((profile: Row, index: number) => {
      const staff = profile;
      return {
        id: String(staff?.uuid || profile.id || ""),
        name: String(profile.name || fullName(staff || profile)),
        status: String(staff?.status_message || "Available"),
        latitude: Number.isFinite(Number(staff?.lat)) ? Number(staff?.lat) : null,
        longitude: Number.isFinite(Number(staff?.lng)) ? Number(staff?.lng) : null,
        home: String(profile.home || "Sydney"),
        vehicle: String(profile.vehicle || "Service vehicle"),
        skills: cleanList(profile.skills).length ? cleanList(profile.skills) : ["General Plumbing", "Blocked Drains", "Hot Water", "Gas", "Roofing", "Leak Detection", "Waterproofing"],
        tools: cleanList(profile.tools),
        color: String(profile.color || colors[index % colors.length]),
        x: Number.isFinite(Number(profile.x)) ? Number(profile.x) : 50,
        y: Number.isFinite(Number(profile.y)) ? Number(profile.y) : 50,
        holding: Boolean(profile.holding) || Boolean(holdingWindowForStaff(staff || profile)),
        roles: Boolean(profile.holding) || Boolean(holdingWindowForStaff(staff || profile)) ? [] : Array.isArray(profile.roles) ? profile.roles : ["sales"],
        workDays: Array.isArray(profile.workDays) ? profile.workDays : [1, 2, 3, 4, 5],
        shiftStart: String(profile.shiftStart || "07:00"),
        shiftHours: Number(profile.shiftHours) || 9
      };
    }).filter((staff: Row) => staff.id);

    return NextResponse.json({
      source: "servicem8-auto-route",
      jobs,
      technicians,
      focusJobUUID: null,
      focusJobNumber: null,
      syncedAt: new Date().toISOString()
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Standalone ServiceM8 dashboard sync failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load ServiceM8 dashboard" }, { status: 502 });
  }
}
