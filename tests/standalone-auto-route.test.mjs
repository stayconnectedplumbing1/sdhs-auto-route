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
  assert.match(liveContext, /trySm8<Row\[]>\("queue\.json"/);
  assert.match(liveContext, /queueNames\.get\(String\(job\.queue_uuid/);
});
