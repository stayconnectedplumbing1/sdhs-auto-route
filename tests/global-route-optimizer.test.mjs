import assert from "node:assert/strict";
import test from "node:test";
import { optimiseWholeDayRoutes } from "../app/global-route-optimizer.ts";

const grid = (latitude, longitude) => ({
  x: (longitude - 150.45) * 100,
  y: (-33.35 - latitude) * 100,
});

const technicians = [
  { id: "joel", name: "Joel", start: grid(-33.835, 150.99) },
  { id: "gary", name: "Gary", start: grid(-33.84, 151.207) },
  { id: "tom", name: "Tom", start: grid(-33.92, 150.925) },
];

const allTechs = technicians.map((tech) => tech.id);
const job = (id, label, latitude, longitude, window) => ({
  id,
  label,
  point: grid(latitude, longitude),
  window,
  priority: 2,
  durationMinutes: 30,
  eligibleTechIds: allTechs,
});

const screenshotPattern = [
  job(1, "Potts Point", -33.87, 151.225, "AM"),
  job(2, "Bankstown A", -33.918, 151.034, "AM"),
  job(3, "Bankstown B", -33.918, 151.034, "AM"),
  job(4, "Austral", -33.93, 150.808, "PM"),
  job(5, "Dural", -33.68, 151.03, "PM"),
  job(6, "South Penrith", -33.77, 150.69, "PM"),
  job(7, "North Sydney", -33.84, 151.207, "AM"),
  job(8, "Liverpool", -33.92, 150.925, "AM"),
  job(9, "Bonnyrigg", -33.89, 150.89, "AM"),
  job(10, "Camperdown", -33.89, 151.177, "AM"),
  job(11, "Potts Point PM", -33.87, 151.225, "PM"),
  job(12, "Millers Point", -33.86, 151.204, "PM"),
  job(13, "Greenacre", -33.90, 151.055, "PM"),
  job(14, "Taren Point", -34.02, 151.12, "PM"),
];

test("globally re-groups the exact zigzag suburb pattern instead of filling runs greedily", () => {
  const result = optimiseWholeDayRoutes({
    technicians,
    movableJobs: screenshotPattern,
    maxJobs: 6,
  });

  assert.equal(result.unassignedJobIds.length, 0);
  assert.equal(result.plans.length, screenshotPattern.length);
  const counts = Object.values(result.counts).sort((a, b) => b - a);
  assert.ok(counts[0] <= 6, `largest run was ${counts[0]}`);
  assert.equal(counts[2], 3, `light run should hold 3 jobs but held ${counts[2]}`);

  const joelSequence = result.plans
    .filter((plan) => plan.techId === "joel")
    .sort((a, b) => a.startMinute - b.startMinute)
    .map((plan) => plan.jobId);
  assert.notDeepEqual(joelSequence, [1, 2, 3, 4, 5, 6]);
  assert.ok(result.backtracking < 80, `backtracking penalty remained too high: ${result.backtracking}`);
});

test("keeps Central Coast work Joel-only without stopping Joel from taking Sydney work", () => {
  const result = optimiseWholeDayRoutes({
    technicians,
    movableJobs: [
      {
        ...job(21, "Gosford", -33.425, 151.342, "AM"),
        eligibleTechIds: ["joel"],
      },
      job(22, "Parramatta", -33.815, 151.003, "PM"),
    ],
    maxJobs: 6,
  });

  const gosford = result.plans.find((plan) => plan.jobId === 21);
  const parramatta = result.plans.find((plan) => plan.jobId === 22);
  assert.equal(gosford?.techId, "joel");
  assert.ok(parramatta);
});

test("orders urgent work before standard work inside the same booking window", () => {
  const standard = job(31, "Standard", -33.90, 151.05, "AM");
  const urgent = { ...job(32, "Urgent", -33.91, 151.06, "AM"), priority: 0 };
  const result = optimiseWholeDayRoutes({ technicians, movableJobs: [standard, urgent], maxJobs: 6 });
  const sameTech = result.plans.filter((plan) => plan.techId === result.plans.find((plan) => plan.jobId === 32)?.techId);
  const urgentPlan = sameTech.find((plan) => plan.jobId === 32);
  const standardPlan = sameTech.find((plan) => plan.jobId === 31);
  if (standardPlan) assert.ok(urgentPlan.startMinute < standardPlan.startMinute);
});

test("keeps fixed bookings outside allocation lanes without breaking the remaining plan", () => {
  const fixedLateJob = {
    ...job(41, "Fixed 4pm", -33.84, 151.20, "PM"),
    fixed: true,
    techId: "gary",
    fixedStartMinute: 16 * 60,
    fixedEndMinute: 16 * 60 + 30,
  };
  const result = optimiseWholeDayRoutes({
    technicians,
    movableJobs: [job(42, "Movable PM", -33.85, 151.19, "PM")],
    fixedJobs: [fixedLateJob],
    maxJobs: 6,
  });
  assert.equal(result.unassignedJobIds.length, 0);
  assert.equal(result.plans.length, 1);
  assert.ok(result.plans[0].endMinute <= 16 * 60);
});

test("routes seven AM quotes across two sales techs using 8–11 as an arrival window", () => {
  const twoTechs = technicians.slice(0, 2);
  const eligible = twoTechs.map((tech) => tech.id);
  const morningQuotes = Array.from({ length: 7 }, (_, index) => ({
    ...job(100 + index, `AM Quote ${index + 1}`, -33.84 + index * .002, 151.1 + index * .002, "AM"),
    eligibleTechIds: eligible,
  }));
  const result = optimiseWholeDayRoutes({ technicians: twoTechs, movableJobs: morningQuotes, maxJobs: 12 });

  assert.deepEqual(result.unassignedJobIds, []);
  assert.equal(result.plans.length, 7);
  assert.ok(result.plans.every((plan) => plan.startMinute <= 11 * 60));
  assert.ok(result.plans.some((plan) => plan.endMinute > 11 * 60));
});
