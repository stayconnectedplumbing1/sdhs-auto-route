import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { optimiseWholeDayRoutes } from '../app/global-route-optimizer.ts';

const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const techs = ['joel', 'tom'].map(id => ({ id, name: id, start: { x: 0, y: 0 }, skills: ['Plumbing'], tools: ['Jetter'] }));
const fixed = (id, techId, start, end, x = 0) => ({ id, techId, label: String(id), point: { x, y: 0 }, fixed: true, fixedStartMinute: start, fixedEndMinute: end, durationMinutes: end - start, window: start < 720 ? 'AM' : 'PM', priority: 2, eligibleTechIds: [] });
const quote = (id, window, eligibleTechIds, x = 0) => ({ id, label: String(id), point: { x, y: 0 }, durationMinutes: 30, window, priority: 2, eligibleTechIds });

test('whole-day candidates exclude every assigned quote and work order, including stale holding labels', () => {
  const expression = source.match(/const selectedDayRouteCandidates = ([\s\S]*?);/)[1];
  const visibleBoardJobs = [
    { id: 1, techId: 'joel', jobStatus: 'Work Order' },
    { id: 2, techId: 'joel', jobStatus: 'Quote', holdingWindow: 'AM 8-11' },
    { id: 3, techId: 'tom', jobStatus: 'Work Order' },
    { id: 4, techId: null, holdingWindow: 'AM 8-11' },
    { id: 5, techId: null, holdingWindow: 'PM 12-4' },
    { id: 6, techId: null }
  ];
  const result = vm.runInNewContext(expression, { visibleBoardJobs });
  assert.deepEqual(Array.from(result, job => job.id), [4, 5]);
});

test('Joel two work orders and Tom one booking stay fixed with quotes before, between and after', () => {
  const fixedJobs = [fixed(1, 'joel', 480, 540), fixed(2, 'joel', 720, 780), fixed(3, 'tom', 720, 780)];
  const before = structuredClone(fixedJobs);
  const result = optimiseWholeDayRoutes({ technicians: techs, fixedJobs, movableJobs: [quote(4, 'AM', ['joel']), quote(5, 'PM', ['joel']), quote(6, 'AM', ['tom'])], maxJobs: 12 });
  assert.equal(result.plans.length, 3);
  assert.deepEqual(fixedJobs, before);
  assert.ok(result.plans.every(plan => plan.jobId > 3));
  assert.ok(result.plans.find(p => p.jobId === 4).startMinute >= 570);
  assert.ok(result.plans.find(p => p.jobId === 4).endMinute + 25 <= 720);
  assert.ok(result.plans.find(p => p.jobId === 5).startMinute >= 810);
  assert.ok(result.plans.find(p => p.jobId === 6).endMinute + 25 <= 720);
});

test('rejects gaps that lack travel to the next fixed booking, reallocating or leaving unassigned', () => {
  const fixedJobs = [fixed(1, 'joel', 480, 540), fixed(2, 'joel', 660, 960)];
  const constrained = quote(3, 'AM', ['joel'], 25);
  const blocked = optimiseWholeDayRoutes({ technicians: techs, fixedJobs, movableJobs: [constrained] });
  assert.deepEqual(blocked.unassignedJobIds, [3]);
  const alternate = optimiseWholeDayRoutes({ technicians: techs, fixedJobs, movableJobs: [{ ...constrained, eligibleTechIds: ['joel', 'tom'] }] });
  assert.equal(alternate.plans[0].techId, 'tom');
});

const assignSource = source.slice(source.indexOf('  const assign = '), source.indexOf('\n  useEffect(() => {', source.indexOf('  const assign = ')));
for (const priority of ['Standard', 'Urgent']) {
  test(`saving an automatic ${priority} quote preserves its slot and never shifts existing bookings`, () => {
    const existing = { id: 1, techId: 'joel', scheduledStart: '2026-09-11 12:00:00', scheduledEnd: '2026-09-11 13:00:00', order: 1 };
    const job = { id: 2, techId: null, requiredSkill: 'Plumbing', requiredTool: 'Jetter', priority, scheduledStart: '2026-09-11 10:00:00', scheduledEnd: '2026-09-11 10:30:00', plannedOrder: 1, holdingWindow: 'AM 8-11' };
    let jobs = [existing, job];
    const sent = [];
    const context = {
      techs, jobs, isOutsideServiceArea: () => false, isCentralCoastJob: () => false,
      parseServiceM8Date: value => new Date(value.replace(' ', 'T') + '+10:00'),
      jobDateKey: () => '2026-09-11', sendBooking: payload => sent.push(payload),
      setJobs: update => { jobs = update(jobs); }, setReview() {}, setPage() {}, showToast() {},
      recommendation: () => { throw new Error('Automatic save must not invoke manual insertion'); }
    };
    const assign = vm.runInNewContext(stripTypeScriptTypes(assignSource) + '\nassign;', context);
    const pending = assign(job, 'joel', { plannedRoute: true, deferCommit: true });
    assert.ok(pending);
    assert.equal(sent[0].startDate, job.scheduledStart);
    assert.equal(sent[0].endDate, job.scheduledEnd);
    assert.equal(sent[0].shiftActivities.length, 0);
    assert.equal(jobs[1].techId, null);
    pending.commit();
    assert.equal(jobs[0], existing);
    assert.equal(jobs[1].techId, 'joel');
    assert.equal(assign({ ...job, techId: 'tom' }, 'joel', { plannedRoute: true }), null);
    assert.equal(sent.length, 1);
  });
}
