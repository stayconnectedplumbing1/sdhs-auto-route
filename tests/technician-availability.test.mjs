import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { availableForRouting } from '../app/technician-availability.ts';

const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const techs = [{ id: 'joel' }, { id: 'tom' }, { id: 'gary' }];

test('off technicians are excluded without removing or changing the displayed team', () => {
  assert.deepEqual(availableForRouting(techs, ['joel', 'tom']), [{ id: 'gary' }]);
  assert.equal(techs.length, 3);
  assert.deepEqual(availableForRouting(techs, []), techs);
  assert.deepEqual(availableForRouting(techs, techs.map(t => t.id)), []);
});

for (const name of ['routeAllocationWindow', 'autoRouteSelectedDay']) {
  test(`${name} reloads availability, excludes off techs and retains bookings`, async () => {
    const start = source.indexOf(`  const ${name} = `);
    const end = source.indexOf('\n  };', start) + 5;
    const jobs = [{ id: 1, techId: 'joel' }, { id: 2, techId: null, holdingWindow: 'AM 8-11' }];
    let called = false;
    const context = {
      availabilityBusyRef: { current: false }, autoRouteQueue: [], setPlanningDay() {},
      selectedDate: '2026-09-12', boardTechs: techs, visibleBoardJobs: jobs,
      selectedDayRouteCandidates: [jobs[1]], planningWindowName: job => job.holdingWindow,
      loadDayAvailability: async date => { assert.equal(date, '2026-09-12'); return ['joel']; },
      availableForRouting, startAutoRouteQueue() {}, showToast() {},
      optimiseWaitingAllocations: (date, waiting, eligible, fixed) => {
        called = true;
        assert.deepEqual(Array.from(eligible, t => t.id), ['tom', 'gary']);
        assert.ok(fixed.some(job => job.id === 1 && job.techId === 'joel'));
        assert.equal(waiting.length, 1);
        return [];
      }
    };
    const run = vm.runInNewContext(stripTypeScriptTypes(source.slice(start, end)) + `\n${name};`, context);
    await run('AM 8-11');
    assert.equal(called, true);
    called = false;
    context.loadDayAvailability = async () => { throw new Error('offline'); };
    await run('AM 8-11');
    assert.equal(called, false, 'availability failure must not silently route onto an off run');
    assert.equal(context.availabilityBusyRef.current, false);
  });
}
