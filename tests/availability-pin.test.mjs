import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const toggleDayAvailability = ');
const end = source.indexOf('\n  const startAutoRouteQueue', start);
for (const pin of ['test-pin', null]) {
  test(`embedded availability ${pin ? 'submits entered PIN' : 'cancels without saving'} without browser prompt`, async () => {
    let saves = 0;
    let cachedPin = '';
    const context = {
      availabilityBusyRef: { current: false }, autoRouteQueue: [], planningDay: false,
      setAvailabilitySaving() {}, selectedDate: '2026-09-12', loadDayAvailability: async () => [],
      directSessionTokenRef: { current: '' }, settingsPin: '', requestAvailabilityPin: async () => pin,
      setSettingsPin: value => { cachedPin = value; }, setOffByDate() {}, techs: [{ id: 'joel', name: 'Joel' }], showToast() {},
      window: { prompt: () => { throw new Error('prompt is not available'); } },
      fetch: async (url, options) => {
        saves++;
        assert.equal(options.headers['x-admin-pin'], pin);
        assert.deepEqual(JSON.parse(options.body), { date: '2026-09-12', techId: 'joel', off: true });
        return { ok: true, json: async () => ({ offTechIds: ['joel'] }) };
      }
    };
    const toggle = vm.runInNewContext(stripTypeScriptTypes(source.slice(start, end)) + '\ntoggleDayAvailability;', context);
    await toggle('joel');
    assert.equal(saves, pin ? 1 : 0);
    assert.equal(cachedPin, pin || '');
    assert.equal(context.availabilityBusyRef.current, false);
  });
}
