const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "page.tsx");
let source = fs.readFileSync(pagePath, "utf8");

function text(lines) {
  return lines.join("\n");
}

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error("Could not patch app/page.tsx: " + label);
  source = source.replace(from, to);
}

if (!source.includes("function addSydneyDays(")) {
  const addSydneyDaysBlock = text([
    '',
    'function addSydneyDays(dateKey: string, days: number) {',
    '  const [year, month, day] = dateKey.split("-").map(Number);',
    '  const next = new Date(Date.UTC(year, month - 1, day + days));',
    '  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;',
    '}',
    ''
  ]);
  if (source.includes("function normaliseUUID(value: unknown) {")) {
    replaceOnce(
      text([
        'function normaliseUUID(value: unknown) {',
        '  return String(value || "").trim().toLowerCase();',
        '}',
        ''
      ]),
      text([
        'function normaliseUUID(value: unknown) {',
        '  return String(value || "").trim().toLowerCase();',
        '}',
        addSydneyDaysBlock
      ]),
      "addSydneyDays after normaliseUUID"
    );
  } else {
    replaceOnce(
      text([
        'function sydneyDateKey(date = new Date()) {',
        '  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);',
        '}',
        ''
      ]),
      text([
        'function sydneyDateKey(date = new Date()) {',
        '  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);',
        '}',
        addSydneyDaysBlock
      ]),
      "addSydneyDays"
    );
  }
}

replaceOnce(
  'type RecommendationOptions = { sameDayRequested?: boolean; plannedRoute?: boolean; deferCommit?: boolean; reloadAfterBooking?: boolean };',
  'type RecommendationOptions = { sameDayRequested?: boolean; requestedDateKey?: string; plannedRoute?: boolean; deferCommit?: boolean; reloadAfterBooking?: boolean };',
  "RecommendationOptions"
);

replaceOnce(
  'function sameDayStandardSlot(tech: Technician, job: Job, jobs: Job[], now = new Date()) {',
  'function sameDayStandardSlot(tech: Technician, job: Job, jobs: Job[], routeDateKey = sydneyDateKey(), now = new Date()) {',
  "sameDayStandardSlot signature"
);
replaceOnce(
  '  const dateKey = sydneyDateKey(now);',
  '  const dateKey = routeDateKey;',
  "selected date key"
);
replaceOnce(
  text([
    '  const durationMinutes = quoteRouteDuration(job);',
    '  const existing = buildRemainingRun(tech, jobs.filter(item => item.id !== job.id), dateKey, now);',
    '  const jobPoint = routePoint(job);',
    '  const travelMinutes = (from: RoutePoint, to: RoutePoint) => Math.max(10, Math.round(routeDistance(from, to) * 1.7));',
    '  const active = currentBooking(tech.id, jobs, now);'
  ]),
  text([
    '  const durationMinutes = quoteRouteDuration(job);',
    '  const routeNow = dateKey === sydneyDateKey(now) ? now : new Date(`${dateKey}T00:00:00`);',
    '  const existing = buildRemainingRun(tech, jobs.filter(item => item.id !== job.id), dateKey, routeNow);',
    '  const jobPoint = routePoint(job);',
    '  const travelMinutes = (from: RoutePoint, to: RoutePoint) => Math.max(10, Math.round(routeDistance(from, to) * 1.7));',
    '  const active = dateKey === sydneyDateKey(now) ? currentBooking(tech.id, jobs, now) : null;'
  ]),
  "routeNow setup"
);
source = source.replaceAll("stop.window.start.getTime() <= now.getTime() && stop.window.end.getTime() > now.getTime()", "stop.window.start.getTime() <= routeNow.getTime() && stop.window.end.getTime() > routeNow.getTime()");
source = source.replaceAll("new Date(Math.max(windowStart.getTime(), now.getTime()))", "new Date(Math.max(windowStart.getTime(), routeNow.getTime()))");
source = source.replaceAll("today after existing run; closest route fit was after", "after existing run; closest route fit was after");

replaceOnce(
  text([
    '  if (missingSkill || missingTool) return { eligible: false, score: 0, eta: 0, reason: missingTool ? `Doesn’t carry ${job.requiredTool}` : `Missing ${job.requiredSkill} skill`, requiresMove: false, moveJob: null as Job | null };',
    '  const sameDayStandard = job.priority !== "Urgent"',
    '    && (options.sameDayRequested === true || jobDateKey(job) === sydneyDateKey());',
    '  const routeDateKey = sameDayStandard ? sydneyDateKey() : jobDateKey(job);',
    '  const dayJobs = jobs.filter(j => j.techId === tech.id && jobDateKey(j) === routeDateKey);',
    '  const assigned = dayJobs.length;',
    '  const sameDaySlot = sameDayStandard ? sameDayStandardSlot(tech, job, dayJobs) : null;'
  ]),
  text([
    '  if (missingSkill || missingTool) return { eligible: false, score: 0, eta: 0, reason: missingTool ? `Doesn’t carry ${job.requiredTool}` : `Missing ${job.requiredSkill} skill`, requiresMove: false, moveJob: null as Job | null };',
    '  const requestedDateKey = options.requestedDateKey || "";',
    '  const sameDayStandard = job.priority !== "Urgent"',
    '    && (options.sameDayRequested === true || Boolean(requestedDateKey) || jobDateKey(job) === sydneyDateKey());',
    '  const routeDateKey = requestedDateKey || (sameDayStandard ? sydneyDateKey() : jobDateKey(job));',
    '  const dayJobs = jobs.filter(j => j.techId === tech.id && jobDateKey(j) === routeDateKey);',
    '  const assigned = dayJobs.length;',
    '  const sameDaySlot = sameDayStandard ? sameDayStandardSlot(tech, job, dayJobs, routeDateKey) : null;'
  ]),
  "recommendation selected date"
);

replaceOnce(
  text([
    '    const sameDayRequested = options.sameDayRequested === true',
    '      || (job.priority !== "Urgent" && jobDateKey(job) === sydneyDateKey());',
    '    const routeCheck = recommendation(tech, job, jobs.filter(j => j.id !== job.id), { ...options, sameDayRequested });'
  ]),
  text([
    '    const requestedDateKey = options.requestedDateKey || "";',
    '    const sameDayRequested = options.sameDayRequested === true',
    '      || Boolean(requestedDateKey)',
    '      || (job.priority !== "Urgent" && jobDateKey(job) === sydneyDateKey());',
    '    const routeDateKey = requestedDateKey || (sameDayRequested ? sydneyDateKey() : jobDateKey(job));',
    '    const routeCheck = recommendation(tech, job, jobs.filter(j => j.id !== job.id), { ...options, sameDayRequested, requestedDateKey: routeDateKey });'
  ]),
  "assign selected date"
);
replaceOnce(
  text([
    '    const routeDateKey = sameDayRequested ? sydneyDateKey() : jobDateKey(job);',
    '    const sameDay = jobs.filter(j => j.techId === techId && jobDateKey(j) === routeDateKey && j.id !== job.id);'
  ]),
  '    const sameDay = jobs.filter(j => j.techId === techId && jobDateKey(j) === routeDateKey && j.id !== job.id);',
  "remove duplicate route date"
);
replaceOnce(
  '      return j.id === job.id ? { ...j, techId, order, duration: bookingDuration, scheduledStart: startDate, scheduledEnd: endDate, routeReason: job.routeReason } : j;',
  '      return j.id === job.id ? { ...j, techId, order, duration: bookingDuration, scheduledDate: routeDateKey, scheduledStart: startDate, scheduledEnd: endDate, routeReason: job.routeReason } : j;',
  "persist selected date"
);
replaceOnce(
  '    showToast(options.deferCommit ? `Saving job #${job.id} with ${tech.name} in ServiceM8…` : sameDayRequested ? `Same-day job inserted into ${tech.name}’s run at ${timeLabel(start)}.` : respectAllocation ? `Booking job #${job.id} in its ${job.holdingWindow} allocation with ${tech.name}.` : job.priority === "Urgent" ? shiftActivities.length ? `Urgent job sent to ${tech.name}; ${shiftActivities.length} conflicting booking${shiftActivities.length === 1 ? "" : "s"} moved one hour.` : `Urgent job fits on ${tech.name}’s run without moving later bookings.` : `Booking job #${job.id} with ${tech.name} in ServiceM8…`);',
  '    showToast(options.deferCommit ? `Saving job #${job.id} with ${tech.name} in ServiceM8…` : sameDayRequested ? `Job inserted into ${tech.name}’s ${routeDateKey} run at ${timeLabel(start)}.` : respectAllocation ? `Booking job #${job.id} in its ${job.holdingWindow} allocation with ${tech.name}.` : job.priority === "Urgent" ? shiftActivities.length ? `Urgent job sent to ${tech.name}; ${shiftActivities.length} conflicting booking${shiftActivities.length === 1 ? "" : "s"} moved one hour.` : `Urgent job fits on ${tech.name}’s run without moving later bookings.` : `Booking job #${job.id} with ${tech.name} in ServiceM8…`);',
  "selected-date toast"
);

replaceOnce(
  text([
    '  const [sameDayRequested, setSameDayRequested] = useState(false);',
    '  const [reassignMode, setReassignMode] = useState(false);',
    '  const scores = useMemo(() => job',
    '    ? techs',
    '        .filter(tech => !reassignMode || tech.id !== job.techId)',
    '        .map(tech => ({ tech, ...recommendation(tech, job, jobs.filter(item => item.id !== job.id), { sameDayRequested: sameDayRequested || reassignMode }) }))',
    '        .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score)',
    '    : [], [techs, job, jobs, sameDayRequested, reassignMode]);',
    '  const best = sameDayRequested ? scores[0] : scores.find(score => score.eligible);',
    '  const [choice, setChoice] = useState("");'
  ]),
  text([
    '  const todayKey = sydneyDateKey();',
    '  const tomorrowKey = addSydneyDays(todayKey, 1);',
    '  const [sameDayRequested, setSameDayRequested] = useState(false);',
    '  const [requestedDateKey, setRequestedDateKey] = useState(todayKey);',
    '  const [reassignMode, setReassignMode] = useState(false);',
    '  const scores = useMemo(() => job',
    '    ? techs',
    '        .filter(tech => !reassignMode || tech.id !== job.techId)',
    '        .map(tech => ({ tech, ...recommendation(tech, job, jobs.filter(item => item.id !== job.id), { sameDayRequested: sameDayRequested || reassignMode, requestedDateKey: sameDayRequested ? requestedDateKey : undefined }) }))',
    '        .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score)',
    '    : [], [techs, job, jobs, sameDayRequested, requestedDateKey, reassignMode]);',
    '  const best = scores.find(score => score.eligible);',
    '  const [choice, setChoice] = useState("");',
    '  const requestedDateLabel = requestedDateKey === todayKey',
    '    ? "today"',
    '    : requestedDateKey === tomorrowKey',
    '    ? "tomorrow"',
    '    : new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${requestedDateKey}T12:00:00`));'
  ]),
  "JobCardDecision selected date state"
);
replaceOnce(
  text([
    '    setSameDayRequested(false);',
    '    setReassignMode(false);'
  ]),
  text([
    '    setSameDayRequested(false);',
    '    setRequestedDateKey(sydneyDateKey());',
    '    setReassignMode(false);'
  ]),
  "reset selected date"
);

replaceOnce(
  '      {job.priority !== "Urgent" && !assignedTech && <section className={`same-day-request ${sameDayRequested ? "active" : ""}`}><div><small>STANDARD JOB — OPTIONAL SAME-DAY REQUEST</small><b>Did the customer ask to be booked today?</b><p>Analyse each technician’s live location and full remaining run, then insert this job where it adds the least travel and avoids unnecessary backtracking.</p></div><button onClick={() => setSameDayRequested(value => !value)}>{sameDayRequested ? "✓ Customer requested today" : "Customer requested today"}</button></section>}',
  '      {job.priority !== "Urgent" && !assignedTech && <section className={`same-day-request ${sameDayRequested ? "active" : ""}`}><div><small>STANDARD JOB — REQUESTED DATE INSERTION</small><b>Select the date the customer wants.</b><p>Auto Route scans every sales rep’s run on that date and inserts this job where it creates the best whole-day route, shifting later standard jobs if needed.</p></div><div className="date-request-controls"><input type="date" min={todayKey} value={requestedDateKey} onChange={(event) => { setRequestedDateKey(event.target.value || todayKey); setSameDayRequested(true); }} /><button type="button" onClick={() => { setRequestedDateKey(todayKey); setSameDayRequested(true); }}>Today</button><button type="button" onClick={() => { setRequestedDateKey(tomorrowKey); setSameDayRequested(true); }}>Tomorrow</button><button type="button" onClick={() => setSameDayRequested(value => !value)}>{sameDayRequested ? `✓ Finding best spot ${requestedDateLabel}` : "Find best spot"}</button></div></section>}',
  "requested-date selector"
);
source = source.replace('sameDayRequested ? "Best whole-day insertion" : "Best technicians for this route"', 'sameDayRequested ? "Best requested-date insertion" : "Best technicians for this route"');
source = source.replace('sameDayRequested ? "Ranked by testing the job at every reasonable position in each technician’s remaining run, then choosing the lowest added travel that still works today." : "Ranked using live location, current bookings, skills, tools, travel and daily capacity."', 'sameDayRequested ? `Ranked by testing the job at every reasonable position in each technician’s ${requestedDateLabel} run, then choosing the lowest added travel inside business hours.` : "Ranked using live location, current bookings, skills, tools, travel and daily capacity."');
source = source.replace('sameDayRequested ? "Customer requested today · whole-day route insertion" : job.holdingWindow || job.bookingDay', 'sameDayRequested ? `Customer requested ${requestedDateLabel} · whole-day route insertion` : job.holdingWindow || job.bookingDay');
source = source.replaceAll('const routeDateKey = sameDayRequested ? sydneyDateKey() : jobDateKey(job);', 'const routeDateKey = sameDayRequested ? requestedDateKey : jobDateKey(job);');
source = source.replace('sameDayRequested ? "BEST SAME-DAY INSERTION" : "SELECTED TECHNICIAN"', 'sameDayRequested ? "BEST REQUESTED-DATE INSERTION" : "SELECTED TECHNICIAN"');
source = source.replace('sameDayRequested ? " · whole-day insertion selected" : ` · estimated ${chosen.eta} minute travel`', 'sameDayRequested ? ` · ${requestedDateLabel} insertion selected` : ` · estimated ${chosen.eta} minute travel`');
source = source.replace('reassignMode || sameDayRequested ? "No practical same-day route is available" : "Review the requirements above"', 'reassignMode || sameDayRequested ? `No practical route is available for ${requestedDateLabel}` : "Review the requirements above"');
source = source.replace('assign(job, choice, { sameDayRequested: sameDayRequested || reassignMode })', 'assign(job, choice, { sameDayRequested: sameDayRequested || reassignMode, requestedDateKey: sameDayRequested ? requestedDateKey : undefined })');
source = source.replace('`${sameDayRequested ? "Book same-day with" : "Book with"} ${techs.find(tech => tech.id === choice)?.name || "technician"} in ServiceM8`', '`${sameDayRequested ? `Book ${requestedDateLabel} with` : "Book with"} ${techs.find(tech => tech.id === choice)?.name || "technician"} in ServiceM8`');
source = source.replace(
  text([
    '    const routeDateKey = sameDayRequested ? requestedDateKey : jobDateKey(job);',
    '    const sameDay = jobs.filter(j => j.techId === techId && jobDateKey(j) === routeDateKey && j.id !== job.id);'
  ]),
  '    const sameDay = jobs.filter(j => j.techId === techId && jobDateKey(j) === routeDateKey && j.id !== job.id);'
);


replaceOnce(
  text([
    '  const focusedJobKey = normaliseUUID(focusedJobUUID.current);',
    '  const focusedJobId = focusedJobNumber.current;',
    '  const jobCardJob = focusedJobKey',
    '    ? boardJobs.find(job => normaliseUUID(job.serviceM8UUID) === focusedJobKey) || (focusedJobId ? boardJobs.find(job => Number(job.id) === focusedJobId) : null)',
    '    : focusedJobId',
    '    ? boardJobs.find(job => Number(job.id) === focusedJobId)',
    '    : null;'
  ]),
  text([
    '  const focusedJobKey = normaliseUUID(focusedJobUUID.current);',
    '  const focusedJobId = focusedJobNumber.current;',
    '  const focusedJobPool = jobs;',
    '  const jobCardJob = focusedJobKey',
    '    ? focusedJobPool.find(job => normaliseUUID(job.serviceM8UUID) === focusedJobKey) || (focusedJobId ? focusedJobPool.find(job => Number(job.id) === focusedJobId) : null)',
    '    : focusedJobId',
    '    ? focusedJobPool.find(job => Number(job.id) === focusedJobId)',
    '    : null;'
  ]),
  "focused job full payload lookup"
);

fs.writeFileSync(pagePath, source);
console.log("Applied requested-date Auto Route insertion patch.");
