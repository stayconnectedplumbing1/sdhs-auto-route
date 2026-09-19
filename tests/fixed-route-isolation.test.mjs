import assert from 'node:assert/strict';
import test from 'node:test';
import { optimiseWholeDayRoutes } from '../app/global-route-optimizer.ts';

const technicians = ['raf', 'tom', 'gary', 'joel'].map(id => ({ id, name: id, start: { x: 0, y: 0 } }));
const fixed = (id, start, end, x = 0) => ({
  id, label: `Existing ${id}`, point: { x, y: 0 }, window: start < 720 ? 'AM' : 'PM',
  priority: 2, durationMinutes: end - start, eligibleTechIds: [], fixed: true,
  techId: 'tom', fixedStartMinute: start, fixedEndMinute: end,
});
const quote = (id, window = 'AM', eligibleTechIds = technicians.map(tech => tech.id)) => ({
  id, label: `Quote ${id}`, point: { x: 0, y: 0 }, window, priority: 2,
  durationMinutes: 30, eligibleTechIds,
});

test('one tight existing run does not reject all ten waiting jobs for the team', () => {
  // A 30-minute gap cannot fit the unchanged travel, buffer and rounding rules.
  const fixedJobs = [fixed(1, 720, 750), fixed(2, 780, 810, 15)];
  const movableJobs = Array.from({ length: 10 }, (_, index) => quote(10 + index, index < 7 ? 'AM' : 'PM'));
  const before = structuredClone({ technicians, fixedJobs, movableJobs });
  const result = optimiseWholeDayRoutes({ technicians, fixedJobs, movableJobs, maxJobs: 12 });
  assert.equal(result.plans.length, 10);
  assert.deepEqual(result.unassignedJobIds, []);
  assert.ok(Number.isFinite(result.objective));
  assert.ok(result.plans.every(plan => plan.techId !== 'tom'));
  assert.equal(result.counts.tom, 2, 'existing bookings must still count');
  assert.equal(Object.values(result.counts).reduce((a, b) => a + b, 0), 12);
  assert.deepEqual({ technicians, fixedJobs, movableJobs }, before);
  for (const plan of result.plans) {
    const job = movableJobs.find(job => job.id === plan.jobId);
    assert.ok(plan.startMinute >= (job.window === 'AM' ? 480 : 720));
    assert.ok(plan.startMinute <= (job.window === 'AM' ? 660 : 960));
    assert.equal(plan.endMinute - plan.startMinute, 30);
  }
});

for (const [label, fixedJobs, maxJobs] of [
  ['overlapping fixed bookings', [fixed(1, 480, 600), fixed(2, 540, 630)], 12],
  ['conflict across AM and PM', [fixed(1, 660, 780), fixed(2, 720, 810)], 12],
  ['existing bookings over capacity', [fixed(1, 480, 510), fixed(2, 600, 630)], 1],
]) {
  test(`${label} affect only their technician and never override eligibility`, () => {
    const result = optimiseWholeDayRoutes({
      technicians, fixedJobs, maxJobs,
      movableJobs: [quote(10, 'AM', ['tom']), quote(11, 'PM', ['gary'])],
    });
    assert.deepEqual(result.unassignedJobIds, [10]);
    assert.equal(result.plans.length, 1);
    assert.equal(result.plans[0].jobId, 11);
    assert.equal(result.plans[0].techId, 'gary');
    assert.equal(result.counts.tom, 2);
  });
}

test('all conflicting or unavailable technicians leave jobs unassigned without moving fixed bookings', () => {
  const fixedJobs = [fixed(1, 720, 750), fixed(2, 780, 810, 15)];
  const before = structuredClone(fixedJobs);
  const result = optimiseWholeDayRoutes({ technicians: technicians.filter(tech => tech.id === 'tom'), fixedJobs, movableJobs: [quote(10)] });
  assert.deepEqual(result.plans, []);
  assert.deepEqual(result.unassignedJobIds, [10]);
  assert.equal(result.counts.tom, 2);
  assert.deepEqual(fixedJobs, before);
  const unavailable = optimiseWholeDayRoutes({ technicians: [], fixedJobs, movableJobs: [quote(10)] });
  assert.deepEqual(unavailable.plans, []);
  assert.deepEqual(unavailable.unassignedJobIds, [10]);
});
