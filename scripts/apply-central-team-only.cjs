const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app', 'page.tsx');
let source = fs.readFileSync(file, 'utf8');

const merged = `function mergeSharedSettingsIntoTechs(techs: Technician[], settings: SharedSettings | null) {
  if (!settings) return techs;
  const liveById = new Map(techs.map(tech => [String(tech.id || '').trim().toLowerCase(), tech]));
  const liveByName = new Map(techs.map(tech => [String(tech.name || '').trim().toLowerCase(), tech]));
  return settings.technicianOverrides.map(override => {
    const idKey = String(override.id || '').trim().toLowerCase();
    const nameKey = String(override.name || '').trim().toLowerCase();
    const live = liveById.get(idKey) || liveByName.get(nameKey);
    return {
      ...(live || {}),
      id: override.id,
      name: override.name,
      home: override.home || live?.home || 'Sydney',
      vehicle: override.vehicle || live?.vehicle || 'Service vehicle',
      status: live?.status || 'Available',
      skills: override.skills.length ? override.skills : (live?.skills || ['General Plumbing']),
      tools: override.tools,
      color: override.color || live?.color || '#1677ff',
      x: Number.isFinite(override.x) ? override.x : (live?.x ?? 50),
      y: Number.isFinite(override.y) ? override.y : (live?.y ?? 50),
      latitude: live?.latitude ?? null,
      longitude: live?.longitude ?? null,
      holding: Boolean(override.holding),
      roles: override.roles || [],
      workDays: override.workDays || live?.workDays || [1, 2, 3, 4, 5],
      shiftStart: override.shiftStart || live?.shiftStart || '07:00',
      shiftHours: override.shiftHours || live?.shiftHours || 9
    } as Technician;
  });
}`;

const mergePattern = /function mergeSharedSettingsIntoTechs\(techs: Technician\[\], settings: SharedSettings \| null\) \{[\s\S]*?\n\}\n\nfunction distance/;
if (!mergePattern.test(source)) throw new Error('Could not locate shared technician merge function');
source = source.replace(mergePattern, merged + '\n\nfunction distance');

const settingsNav = `        <button className={page === "Settings" ? "active" : ""} onClick={() => {
          setSettingsUnlocked(false);
          setSettingsPin("");
          setPage("Settings");
        }}><span>Settings</span></button>\n`;
source = source.replace(settingsNav, '');

const oldRouteActions = `{page === "Routes" && <><button className="sync-button" onClick={syncServiceM8} disabled={syncing}>{syncing ? "Syncing…" : "↻ Sync ServiceM8"}</button><button className="board-button" onClick={() => { if (!settingsUnlocked) { setSettingsPin(""); setPage("Settings"); showToast("Unlock owner Settings to change the shared team"); return; } setManageBoard(true); }}>Manage shared team <b>{boardTechs.length}</b></button></>}`;
const newRouteActions = `{page === "Routes" && <button className="sync-button" onClick={syncServiceM8} disabled={syncing}>{syncing ? "Syncing…" : "↻ Sync ServiceM8"}</button>}`;
if (!source.includes(newRouteActions)) {
  if (!source.includes(oldRouteActions)) throw new Error('Could not locate Routes top actions');
  source = source.replace(oldRouteActions, newRouteActions);
}

fs.writeFileSync(file, source);
console.log('Applied central Same Day AI team-only Auto Route cleanup.');
