import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("publishes Auto Route in both the ServiceM8 add-ons menu and job card", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../public/servicem8-auto-route-manifest.json", import.meta.url), "utf8"),
  );

  assert.equal(manifest.version, "4.3");
  assert.deepEqual(manifest.actions, [
    {
      name: "Auto Route This Job",
      type: "online",
      entity: "job",
      iconURL: "https://same-day-intelligent-dispatch.hello151759.chatgpt.site/auto-route-icon.png",
      event: "open_auto_route_job",
      location: "window",
    },
  ]);
  assert.deepEqual(manifest.menuItems, [
    {
      name: "Auto Route Dashboard",
      type: "addon",
      iconURL: "https://same-day-intelligent-dispatch.hello151759.chatgpt.site/auto-route-icon.png",
      event: "open_auto_route_dashboard",
    },
  ]);
});

test("supports customer-requested same-day standard bookings", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /Customer requested today/);
  assert.match(source, /sameDayStandardSlot/);
  assert.match(source, /Existing bookings will not be moved or overlapped/);
});

test("enforces Joel-only Central Coast routing and labels it on the map", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /Central Coast jobs are assigned to Joel only/);
  assert.match(source, /CENTRAL COAST — JOEL ONLY/);
  assert.match(source, /CENTRAL COAST JOB · JOEL ONLY/);
  assert.match(source, /Central Coast jobs can only be booked to Joel/);
});

test("ranks same-day standard and urgent work by the closest eligible route", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Maximum 6 jobs reached/);
  assert.match(source, /jobDateKey\(job\) === sydneyDateKey\(\)/);
  assert.match(source, /sameDayStandard\s*\? Math\.max\(35, Math\.min\(99, Math\.round\(99 - travel \* 2\)\)\)/);
  assert.match(source, /99 - travel \* 1\.8 - remainingMinutes \* \.65/);
  assert.match(source, /Job count will not outweigh distance, even above six jobs/);
  assert.match(source, /skills, tools and a non-overlapping gap/);
  assert.match(source, /Six jobs is a planning target, not a hard limit/);
});

test("plans next-day runs by urgency, route continuity and realistic time capacity", async () => {
  const source = await readFile(new URL("../app/global-route-optimizer.ts", import.meta.url), "utf8");
  assert.match(source, /function priorityOrderIsValid/);
  assert.match(source, /function pathBacktracking/);
  assert.match(source, /function improveRoutes/);
  assert.match(source, /if \(count > maxJobs\)/);
  assert.match(source, /for \(let pass = 0; pass < 60; pass \+= 1\)/);
});

test("can concentrate work while preserving one lighter same-day reserve run", async () => {
  const source = await readFile(new URL("../app/global-route-optimizer.ts", import.meta.url), "utf8");
  assert.match(source, /if \(minimum < 3\) workloadPenalty/);
  assert.match(source, /if \(minimum > 3\) workloadPenalty/);
  assert.match(source, /maximum - minimum > 3/);
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Lighter run ready for same-day work/);
  assert.match(page, /one lighter run may be kept for same-day work/);
});

test("rebuilds future unfinished standard runs but keeps urgent and completed bookings fixed", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /isFutureStandardReplanCandidate/);
  assert.match(source, /job\.priority !== "Urgent"/);
  assert.match(source, /serviceStatus\(job\) !== "completed"/);
  assert.match(source, /const fixedJobs = visibleBoardJobs\.filter\(job => !candidateIds\.has\(job\.id\)\)/);
  assert.match(source, /plannedOrder: plan\.order/);
  assert.match(source, /routeReason: plan\.reason/);
  assert.match(source, /assign\(\{ \.\.\.routedJob, scheduledStart: plan\.startDate, scheduledEnd: plan\.endDate, plannedOrder: plan\.order, routeReason: plan\.reason \}, plan\.techId, \{ plannedRoute: true, deferCommit: true, reloadAfterBooking: autoRouteQueue\.length === 1 \}\)/);
  assert.match(source, /onClick=\{autoRouteSelectedDay\}/);
});

test("waits for a ServiceM8 acknowledgement before advancing the booking queue", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /data\.source === "auto-route-booked"/);
  assert.match(source, /data\.source === "auto-route-booking-error"/);
  assert.match(source, /if \(!options\.deferCommit\) commit\(\)/);
  assert.match(source, /pending\.commit\(\)/);
  assert.match(source, /current\.slice\(1\)/);
  assert.match(source, /The queue was stopped to prevent duplicate bookings/);
  assert.match(source, /reloadAfterBooking: options\.reloadAfterBooking !== false/);
  assert.doesNotMatch(source, /setTimeout\(\(\) => \{\s*const \[plan, \.\.\.remaining\] = autoRouteQueue/);
});

test("routes standard sales appointments without requiring stored trade skills", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(job\.priority !== "Urgent"\) return true/);
  assert.match(source, /const enforceCapability = job\.priority === "Urgent"/);
  assert.match(source, /if \(isCentralCoastJob\(job\) && !isJoel\(tech\)\) return false/);
});

test("uses Camden as the south-west service boundary", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const beyondCamdenSouthWest = lng <= 150\.95 && lat < -34\.10/);
  assert.match(source, /return !inSydney \|\| beyondCamdenSouthWest/);
});

test("can safely reassign a delayed technician's existing ServiceM8 booking", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /Technician delayed — find replacement/);
  assert.match(source, /tech\.id !== job\.techId/);
  assert.match(source, /job\.techId && job\.techId !== techId && !job\.activityUUID/);
  assert.match(source, /existing ServiceM8 booking to someone closer/);
  assert.match(source, /Move from \$\{assignedTech\.name\}/);
});

test("can switch Central Coast routing on or off from Settings", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /CENTRAL_COAST_SETTING/);
  assert.match(source, /Central Coast routing switched/);
  assert.match(source, /role="switch" aria-checked=\{centralCoastEnabled\}/);
  assert.match(source, /if \(isCentralCoastJob\(job\)\) return !centralCoastRoutingEnabled\(\)/);
  assert.match(source, /Central Coast jobs stay visible but are treated as outside the active service area/);
});
