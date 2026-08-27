import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const settingsRoute = await readFile(new URL("../app/api/settings/route.ts", import.meta.url), "utf8");

test("uses the shared Sales Tech role for the live quote board", () => {
  assert.match(page, /t\.roles\.includes\("sales"\)/);
  assert.match(page, /same Sales Tech list used by Auto Route and Same Day AI \/ Quote for every admin/);
});

test("allows a shared Installer role and persists role-specific availability", () => {
  assert.match(page, /toggleRole\(t, "installer"\)/);
  assert.match(page, /Installer working days/);
  assert.match(settingsRoute, /AUTO_ROUTE_SETTINGS_STORE_URL/);
  assert.match(settingsRoute, /roles: cleanRoles/);
  assert.match(settingsRoute, /workDays: cleanWorkDays/);
});
