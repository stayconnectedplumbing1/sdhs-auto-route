import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = process.env.SERVICEM8_API_BASE || "https://api.servicem8.com/api_1.0";

type ShiftActivity = {
  activityUUID?: string;
  jobUUID?: string;
  staffUUID?: string;
  startDate?: string;
  endDate?: string;
};

async function sm8Write(path: string, apiKey: string, payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 403) {
      throw new Error("ServiceM8 needs schedule-management permission before Auto Route can save bookings.");
    }
    throw new Error(`ServiceM8 POST ${path} failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }

  return response.headers.get("x-record-uuid") || "";
}

function validSm8Date(value: unknown) {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(value || ""));
}

function activityPayload(jobUUID: string, staffUUID: string, startDate: string, endDate: string) {
  return {
    job_uuid: jobUUID,
    staff_uuid: staffUUID,
    start_date: startDate,
    end_date: endDate,
    activity_was_scheduled: "1",
    activity_was_recorded: "0",
    activity_was_automated: 0
  };
}

export async function POST(request: NextRequest) {
  const apiKey = String(process.env.SERVICEM8_API_KEY || "").trim();
  if (!apiKey) {
    return NextResponse.json({ error: "SERVICEM8_API_KEY is not configured" }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const jobUUID = String(body.jobUUID || "").trim();
    const staffUUID = String(body.staffUUID || "").trim();
    const startDate = String(body.startDate || "");
    const endDate = String(body.endDate || "");
    const activityUUID = String(body.activityUUID || "").trim();
    const shiftActivities: ShiftActivity[] = Array.isArray(body.shiftActivities) ? body.shiftActivities : [];

    if (!jobUUID || !staffUUID || !validSm8Date(startDate) || !validSm8Date(endDate)) {
      return NextResponse.json({ error: "Invalid Auto Route booking payload." }, { status: 400 });
    }

    const mainPayload = activityPayload(jobUUID, staffUUID, startDate, endDate);
    const savedActivityUUID = activityUUID
      ? await sm8Write(`jobactivity/${encodeURIComponent(activityUUID)}.json`, apiKey, mainPayload)
      : await sm8Write("jobactivity.json", apiKey, mainPayload);

    const shifted: Array<{ activityUUID: string; startDate: string; endDate: string }> = [];
    for (const shift of shiftActivities) {
      const shiftUUID = String(shift.activityUUID || "").trim();
      const shiftJobUUID = String(shift.jobUUID || "").trim();
      const shiftStaffUUID = String(shift.staffUUID || staffUUID).trim();
      const shiftStart = String(shift.startDate || "");
      const shiftEnd = String(shift.endDate || "");
      if (!shiftUUID || !shiftJobUUID || !shiftStaffUUID || !validSm8Date(shiftStart) || !validSm8Date(shiftEnd)) continue;

      await sm8Write(
        `jobactivity/${encodeURIComponent(shiftUUID)}.json`,
        apiKey,
        activityPayload(shiftJobUUID, shiftStaffUUID, shiftStart, shiftEnd)
      );
      shifted.push({ activityUUID: shiftUUID, startDate: shiftStart, endDate: shiftEnd });
    }

    return NextResponse.json({
      ok: true,
      source: "auto-route-booked",
      jobUUID,
      activityUUID: savedActivityUUID || activityUUID,
      startDate,
      endDate,
      shifted
    });
  } catch (error) {
    console.error("Standalone Auto Route booking failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Auto Route booking failed" }, { status: 502 });
  }
}
