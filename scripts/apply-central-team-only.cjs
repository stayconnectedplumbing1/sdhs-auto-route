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

source = source.replace(/function mergeSharedSettingsIntoTechs\(techs: Technician\[\], settings: SharedSettings \| null\) \{[\s\S]*?\n\}\n\nfunction distance/, merged + '\n\nfunction distance');

source = source.replace(/\n\s*<button className=\{page === \"Settings\"[\s\S]*?<\/button>\n\s*<\/nav>/, '\n      </nav>');
source = source.replace(/\{page === \"Routes\" && <><button className=\"sync-button\" onClick=\{syncServiceM8\} disabled=\{syncing\}>\{syncing \? \"Syncing…\" : \"↻ Sync ServiceM8\"\}<\/button><button className=\"board-button\"[\s\S]*?<\/button><\/>

?/, '{page === "Routes" && <button className="sync-button" onClick={syncServiceM8} disabled={syncing}>{syncing ? "Syncing…" : "↻ Sync ServiceM8"}</button>}');
source = source.replace(/\n\s*\{manageBoard && <div className=\"modal-overlay\">[\s\S]*?<\/section><\/div>\}/, '');
source = source.replace(/\n\s*const \[manageBoard, setManageBoard\] = useState\(false\);/, '');

fs.writeFileSync(file, source);
console.log('Applied central Same Day AI team-only Auto Route cleanup.');
