import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const liveContext = await readFile(new URL("../app/api/servicem8/live-context/route.ts", import.meta.url), "utf8");
const standaloneBook = await readFile(new URL("../app/api/servicem8/standalone-book/route.ts", import.meta.url), "utf8");

test("standalone dashboard saves routes without using the Same Day AI bridge", () => {
  assert.match(page, /if \(standaloneServiceM8Ref\.current\)/);
  assert.match(page, /fetch\("\/api\/servicem8\/standalone-book"/);
  assert.match(page, /refreshStandaloneServiceM8\(\)/);
  assert.match(page, /SAME_DAY_AI_URL.*auto-route-book/s);
});

test("standalone booking validates input and writes scheduled activities with the private API key", () => {
  assert.match(standaloneBook, /"X-API-Key": apiKey/);
  assert.match(standaloneBook, /method: "POST"/);
  assert.match(standaloneBook, /Invalid Auto Route booking payload/);
  assert.match(standaloneBook, /activity_was_scheduled: "1"/);
  assert.match(standaloneBook, /source: "auto-route-booked"/);
});

test("live dashboard seeds scheduled job details from the already-loaded active jobs", () => {
  assert.match(liveContext, /const jobsByUUID = new Map<string, Row>\(\s*activeJobsRaw/s);
  assert.match(liveContext, /for \(const \[uuid, job\] of waitingByUUID\)/);
  assert.doesNotMatch(liveContext, /fetch\(new URL\("\/api\/settings"/);
});

test("opens from a shared live-data cache while manual Sync forces fresh ServiceM8 data", () => {
  assert.match(liveContext, /const LIVE_CACHE_MS = 10 \* 60 \* 1000/);
  assert.match(liveContext, /"X-Auto-Route-Cache": "HIT"/);
  assert.match(liveContext, /"X-Auto-Route-Cache": "STALE"/);
  assert.match(page, /live-context\?refresh=1/);
});

test("shows allocated jobs as waiting rather than booked before Auto Route runs", () => {
  assert.match(page, /visibleBoardJobs\.filter\(j => Boolean\(j\.techId\)\)\.length/);
});

test("turns ServiceM8 allocation staff bookings back into routable waiting jobs", () => {
  assert.match(liveContext, /function holdingWindowForStaff/);
  assert.match(liveContext, /return "AM 8-11"/);
  assert.match(liveContext, /return "PM 12-4"/);
  assert.match(liveContext, /techId: holdingWindow \? null/);
  assert.match(liveContext, /holdingWindow,/);
  assert.match(liveContext, /isActionRequired: Boolean\(holdingWindow\)/);
});
