const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "page.tsx");
let source = fs.readFileSync(pagePath, "utf8");

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) {
    throw new Error(`Could not patch app/page.tsx: missing ${label}`);
  }
  source = source.replace(from, to);
}

replaceOnce(
`function sydneyDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
`,
`function sydneyDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function addSydneyDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return \`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}\`;
}
`,
"addSydneyDays helper"
);

replaceOnce(
`type RecommendationOptions = { sameDayRequested?: boolean; plannedRoute?: boolean; deferCommit?: boolean; reloadAfterBooking?: boolean };`,
`type RecommendationOptions = { sameDayRequested?: boolean; requestedDateKey?: string; plannedRoute?: boolean; deferCommit?: boolean; reloadAfterBooking?: boolean };`,
"RecommendationOptions requestedDateKey"
);

replaceOnce(
`function sameDayStandardSlot(tech: Technician, job: Job, jobs: Job[], now = new Date()) {
  const requested = customerRequestedWindow(job);
  const dateKey = sydneyDateKey(now);
  const windowStart = new Date(\`${dateKey}T${String(requested.startHour).padStart(2, "0")}:00:00\`);
  const windowEnd = new Date(\`${dateKey}T${String(requested.endHour).padStart(2, "0")}:00:00\`);
  const dayEnd = windowEnd;
  const durationMinutes = quoteRouteDuration(job);
  const existing = buildRemainingRun(tech, jobs.filter(item => item.id !== job.id), dateKey, now);
  const jobPoint = routePoint(job);
  const travelMinutes = (from: RoutePoint, to: RoutePoint) => Math.max(10, Math.round(routeDistance(from, to) * 1.7));
  const active = currentBooking(tech.id, jobs, now);
`,
`function sameDayStandardSlot(tech: Technician, job: Job, jobs: Job[], routeDateKey = sydneyDateKey(), now = new Date()) {
  const requested = customerRequestedWindow(job);
  const dateKey = routeDateKey;
  const windowStart = new Date(\`${dateKey}T${String(requested.startHour).padStart(2, "0")}:00:00\`);
  const windowEnd = new Date(\`${dateKey}T${String(requested.endHour).padStart(2, "0")}:00:00\`);
  const dayEnd = windowEnd;
  const durationMinutes = quoteRouteDuration(job);
  const routeNow = dateKey === sydneyDateKey(now) ? now : new Date(\`${dateKey}T00:00:00\`);
  const existing = buildRemainingRun(tech, jobs.filter(item => item.id !== job.id), dateKey, routeNow);
  const jobPoint = routePoint(job);
  const travelMinutes = (from: RoutePoint, to: RoutePoint) => Math.max(10, Math.round(routeDistance(from, to) * 1.7));
  const active = dateKey === sydneyDateKey(now) ? currentBooking(tech.id, jobs, now) : null;
`,
"sameDayStandardSlot selected route date"
);

replaceOnce(
`  const activeStopIndex = existing.findIndex(stop =>
    stop.window.start.getTime() <= now.getTime() && stop.window.end.getTime() > now.getTime()
  );
`,
`  const activeStopIndex = existing.findIndex(stop =>
    stop.window.start.getTime() <= routeNow.getTime() && stop.window.end.getTime() > routeNow.getTime()
  );
`,
"active stop routeNow"
);

replaceOnce(
`      : new Date(Math.max(windowStart.getTime(), now.getTime()));
`,
`      : new Date(Math.max(windowStart.getTime(), routeNow.getTime()));
`,
"first insertion routeNow"
);

replaceOnce(
`    : new Date(Math.max(windowStart.getTime(), now.getTime()));
`,
`    : new Date(Math.max(windowStart.getTime(), routeNow.getTime()));
`,
"fallback insertion routeNow"
);

replaceOnce(
`      ? \`today after existing run; closest route fit was after ${bestInsertion.previousLabel}${bestInsertion.nextLabel ? \` before ${bestInsertion.nextLabel}\` : ""}, but that gap would make later work late\`
`,
`      ? \`after existing run; closest route fit was after ${bestInsertion.previousLabel}${bestInsertion.nextLabel ? \` before ${bestInsertion.nextLabel}\` : ""}, but that gap would make later work late\`
`,
"remove today-only fallback wording"
);

replaceOnce(
`  if (missingSkill || missingTool) return { eligible: false, score: 0, eta: 0, reason: missingTool ? \`Doesn’t carry ${job.requiredTool}\` : \`Missing ${job.requiredSkill} skill\`, requiresMove: false, moveJob: null as Job | null };
  const sameDayStandard = job.priority !== "Urgent"
    && (options.sameDayRequested === true || jobDateKey(job) === sydneyDateKey());
  const routeDateKey = sameDayStandard ? sydneyDateKey() : jobDateKey(job);
  const dayJobs = jobs.filter(j => j.techId === tech.id && jobDateKey(j) === routeDateKey);
  const assigned = dayJobs.length;
  const sameDaySlot = sameDayStandard ? sameDayStandardSlot(tech, job, dayJobs) : null;
`,
`  if (missingSkill || missingTool) return { eligible: false, score: 0, eta: 0, reason: missingTool ? \`Doesn’t carry ${job.requiredTool}\` : \`Missing ${job.requiredSkill} skill\`, requiresMove: false, moveJob: null as Job | null };
  const requestedDateKey = options.requestedDateKey || "";
  const sameDayStandard = job.priority !== "Urgent"
    && (options.sameDayRequested === true || Boolean(requestedDateKey) || jobDateKey(job) === sydneyDateKey());
  const routeDateKey = requestedDateKey || (sameDayStandard ? sydneyDateKey() : jobDateKey(job));
  const dayJobs = jobs.filter(j => j.techId === tech.id && jobDateKey(j) === routeDateKey);
  const assigned = dayJobs.length;
  const sameDaySlot = sameDayStandard ? sameDayStandardSlot(tech, job, dayJobs, routeDateKey) : null;
`,
"recommendation requested date"
);

replaceOnce(
`    const sameDayRequested = options.sameDayRequested === true
      || (job.priority !== "Urgent" && jobDateKey(job) === sydneyDateKey());
    const routeCheck = recommendation(tech, job, jobs.filter(j => j.id !== job.id), { ...options, sameDayRequested });
`,
`    const requestedDateKey = options.requestedDateKey || "";
    const sameDayRequested = options.sameDayRequested === true
      || Boolean(requestedDateKey)
      || (job.priority !== "Urgent" && jobDateKey(job) === sydneyDateKey());
    const routeDateKey = requestedDateKey || (sameDayRequested ? sydneyDateKey() : jobDateKey(job));
    const routeCheck = recommendation(tech, job, jobs.filter(j => j.id !== job.id), { ...options, sameDayRequested, requestedDateKey: routeDateKey });
`,
"assign requested route date"
);

replaceOnce(
`    const routeDateKey = sameDayRequested ? sydneyDateKey() : jobDateKey(job);
    const sameDay = jobs.filter(j => j.techId === techId && jobDateKey(j) === routeDateKey && j.id !== job.id);
`,
`    const sameDay = jobs.filter(j => j.techId === techId && jobDateKey(j) === routeDateKey && j.id !== job.id);
`,
"remove duplicate routeDateKey"
);

replaceOnce(
`      return j.id === job.id ? { ...j, techId, order, duration: bookingDuration, scheduledStart: startDate, scheduledEnd: endDate, routeReason: job.routeReason } : j;
`,
`      return j.id === job.id ? { ...j, techId, order, duration: bookingDuration, scheduledDate: routeDateKey, scheduledStart: startDate, scheduledEnd: endDate, routeReason: job.routeReason } : j;
`,
"persist scheduledDate"
);

replaceOnce(
`    showToast(options.deferCommit ? \`Saving job #${job.id} with ${tech.name} in ServiceM8…\` : sameDayRequested ? \`Same-day job inserted into ${tech.name}’s run at ${timeLabel(start)}.\` : respectAllocation ? \`Booking job #${job.id} in its ${job.holdingWindow} allocation with ${tech.name}.\` : job.priority === "Urgent" ? shiftActivities.length ? \`Urgent job sent to ${tech.name}; ${shiftActivities.length} conflicting booking${shiftActivities.length === 1 ? "" : "s"} moved one hour.\` : \`Urgent job fits on ${tech.name}’s run without moving later bookings.\` : \`Booking job #${job.id} with ${tech.name} in ServiceM8…\`);
`,
`    showToast(options.deferCommit ? \`Saving job #${job.id} with ${tech.name} in ServiceM8…\` : sameDayRequested ? \`Job inserted into ${tech.name}’s ${routeDateKey} run at ${timeLabel(start)}.\` : respectAllocation ? \`Booking job #${job.id} in its ${job.holdingWindow} allocation with ${tech.name}.\` : job.priority === "Urgent" ? shiftActivities.length ? \`Urgent job sent to ${tech.name}; ${shiftActivities.length} conflicting booking${shiftActivities.length === 1 ? "" : "s"} moved one hour.\` : \`Urgent job fits on ${tech.name}’s run without moving later bookings.\` : \`Booking job #${job.id} with ${tech.name} in ServiceM8…\`);
`,
"requested-date toast"
);

replaceOnce(
`  const [sameDayRequested, setSameDayRequested] = useState(false);
  const [reassignMode, setReassignMode] = useState(false);
  const scores = useMemo(() => job
    ? techs
        .filter(tech => !reassignMode || tech.id !== job.techId)
        .map(tech => ({ tech, ...recommendation(tech, job, jobs.filter(item => item.id !== job.id), { sameDayRequested: sameDayRequested || reassignMode }) }))
        .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score)
    : [], [techs, job, jobs, sameDayRequested, reassignMode]);
  const best = sameDayRequested ? scores[0] : scores.find(score => score.eligible);
  const [choice, setChoice] = useState("");
`,
`  const todayKey = sydneyDateKey();
  const tomorrowKey = addSydneyDays(todayKey, 1);
  const [sameDayRequested, setSameDayRequested] = useState(false);
  const [requestedDateKey, setRequestedDateKey] = useState(todayKey);
  const [reassignMode, setReassignMode] = useState(false);
  const scores = useMemo(() => job
    ? techs
        .filter(tech => !reassignMode || tech.id !== job.techId)
        .map(tech => ({ tech, ...recommendation(tech, job, jobs.filter(item => item.id !== job.id), { sameDayRequested: sameDayRequested || reassignMode, requestedDateKey: sameDayRequested ? requestedDateKey : undefined }) }))
        .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score)
    : [], [techs, job, jobs, sameDayRequested, requestedDateKey, reassignMode]);
  const best = sameDayRequested ? scores[0] : scores.find(score => score.eligible);
  const [choice, setChoice] = useState("");
  const requestedDateLabel = requestedDateKey === todayKey
    ? "today"
    : requestedDateKey === tomorrowKey
    ? "tomorrow"
    : new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" }).format(new Date(\`${requestedDateKey}T12:00:00\`));
`,
"JobCardDecision requested date state"
);

replaceOnce(
`    setSameDayRequested(false);
    setReassignMode(false);
`,
`    setSameDayRequested(false);
    setRequestedDateKey(sydneyDateKey());
    setReassignMode(false);
`,
"reset requested date"
);

replaceOnce(
`      {job.priority !== "Urgent" && !assignedTech && <section className={\`same-day-request ${sameDayRequested ? "active" : ""}\`}><div><small>STANDARD JOB — OPTIONAL SAME-DAY REQUEST</small><b>Did the customer ask to be booked today?</b><p>Analyse each technician’s live location and full remaining run, then insert this job where it adds the least travel and avoids unnecessary backtracking.</p></div><button onClick={() => setSameDayRequested(value => !value)}>{sameDayRequested ? "✓ Customer requested today" : "Customer requested today"}</button></section>}
`,
`      {job.priority !== "Urgent" && !assignedTech && <section className={\`same-day-request ${sameDayRequested ? "active" : ""}\`}><div><small>STANDARD JOB — REQUESTED DATE INSERTION</small><b>Select the date the customer wants.</b><p>Auto Route scans every sales rep’s run on that date and inserts this job where it creates the best whole-day route, shifting later standard jobs if needed.</p></div><div className="date-request-controls"><input type="date" min={todayKey} value={requestedDateKey} onChange={(event) => { setRequestedDateKey(event.target.value || todayKey); setSameDayRequested(true); }} /><button type="button" onClick={() => { setRequestedDateKey(todayKey); setSameDayRequested(true); }}>Today</button><button type="button" onClick={() => { setRequestedDateKey(tomorrowKey); setSameDayRequested(true); }}>Tomorrow</button><button type="button" onClick={() => setSameDayRequested(value => !value)}>{sameDayRequested ? \`✓ Finding best spot ${requestedDateLabel}\` : "Find best spot"}</button></div></section>}
`,
"requested date selector"
);

replaceOnce(
`          <header><div><small>RECOMMENDATION</small><h2>{reassignMode ? "Closest replacement technicians" : job.priority === "Urgent" ? "Closest practical technicians" : sameDayRequested ? "Best whole-day insertion" : "Best technicians for this route"}</h2><p>{reassignMode ? \`${assignedTech?.name || "The current technician"} is excluded. Ranked by live location and the earliest realistic non-overlapping gap.\` : job.priority === "Urgent" ? "Ranked by the closest realistic arrival after checking live location, current-job duration, skills, tools and a non-overlapping gap." : sameDayRequested ? "Ranked by testing the job at every reasonable position in each technician’s remaining run, then choosing the lowest added travel that still works today." : "Ranked using live location, current bookings, skills, tools, travel and daily capacity."}</p></div><span>{sameDayRequested ? scores.length : scores.filter(score => score.eligible).length} eligible</span></header>
`,
`          <header><div><small>RECOMMENDATION</small><h2>{reassignMode ? "Closest replacement technicians" : job.priority === "Urgent" ? "Closest practical technicians" : sameDayRequested ? "Best requested-date insertion" : "Best technicians for this route"}</h2><p>{reassignMode ? \`${assignedTech?.name || "The current technician"} is excluded. Ranked by live location and the earliest realistic non-overlapping gap.\` : job.priority === "Urgent" ? "Ranked by the closest realistic arrival after checking live location, current-job duration, skills, tools and a non-overlapping gap." : sameDayRequested ? \`Ranked by testing the job at every reasonable position in each technician’s ${requestedDateLabel} run, then choosing the lowest added travel inside business hours.\` : "Ranked using live location, current bookings, skills, tools, travel and daily capacity."}</p></div><span>{sameDayRequested ? scores.length : scores.filter(score => score.eligible).length} eligible</span></header>
`,
"requested date recommendation wording"
);

replaceOnce(
`            <div><small>BOOKING RULE</small><b>{job.priority === "Urgent" ? "Same day — next realistic slot" : sameDayRequested ? "Customer requested today · whole-day route insertion" : job.holdingWindow || job.bookingDay}</b></div>
`,
`            <div><small>BOOKING RULE</small><b>{job.priority === "Urgent" ? "Same day — next realistic slot" : sameDayRequested ? \`Customer requested ${requestedDateLabel} · whole-day route insertion\` : job.holdingWindow || job.bookingDay}</b></div>
`,
"requested date booking rule"
);

replaceOnce(
`            const routeDateKey = sameDayRequested ? sydneyDateKey() : jobDateKey(job);
`,
`            const routeDateKey = sameDayRequested ? requestedDateKey : jobDateKey(job);
`,
"tech-list route date"
);

replaceOnce(
`    <footer className="decision-footer"><div>{chosen ? <><small>{reassignMode ? "RECOMMENDED REPLACEMENT" : sameDayRequested ? "BEST SAME-DAY INSERTION" : "SELECTED TECHNICIAN"}</small><b>{chosen.tech.name}</b><span>{chosen.reason}{reassignMode ? " · closest practical route selected" : sameDayRequested ? " · whole-day insertion selected" : \` · estimated ${chosen.eta} minute travel\`}</span></> : <><small>NO TECHNICIAN SELECTED</small><b>{reassignMode || sameDayRequested ? "No practical same-day route is available" : "Review the requirements above"}</b></>}</div><button className="decision-secondary" onClick={openDashboard}>View full dispatch board</button><button className="decision-assign" disabled={!choice || outside || (Boolean(assignedTech) && !reassignMode)} onClick={() => assign(job, choice, { sameDayRequested: sameDayRequested || reassignMode })}>{reassignMode && assignedTech ? \`Move from ${assignedTech.name} to ${techs.find(tech => tech.id === choice)?.name || "replacement"} in ServiceM8\` : assignedTech ? \`Booked to ${assignedTech.name}\` : choice ? \`${sameDayRequested ? "Book same-day with" : "Book with"} ${techs.find(tech => tech.id === choice)?.name || "technician"} in ServiceM8\` : "No eligible technician"}</button></footer>
`,
`    <footer className="decision-footer"><div>{chosen ? <><small>{reassignMode ? "RECOMMENDED REPLACEMENT" : sameDayRequested ? "BEST REQUESTED-DATE INSERTION" : "SELECTED TECHNICIAN"}</small><b>{chosen.tech.name}</b><span>{chosen.reason}{reassignMode ? " · closest practical route selected" : sameDayRequested ? \` · ${requestedDateLabel} insertion selected\` : \` · estimated ${chosen.eta} minute travel\`}</span></> : <><small>NO TECHNICIAN SELECTED</small><b>{reassignMode || sameDayRequested ? \`No practical route is available for ${requestedDateLabel}\` : "Review the requirements above"}</b></>}</div><button className="decision-secondary" onClick={openDashboard}>View full dispatch board</button><button className="decision-assign" disabled={!choice || outside || (Boolean(assignedTech) && !reassignMode)} onClick={() => assign(job, choice, { sameDayRequested: sameDayRequested || reassignMode, requestedDateKey: sameDayRequested ? requestedDateKey : undefined })}>{reassignMode && assignedTech ? \`Move from ${assignedTech.name} to ${techs.find(tech => tech.id === choice)?.name || "replacement"} in ServiceM8\` : assignedTech ? \`Booked to ${assignedTech.name}\` : choice ? \`${sameDayRequested ? \`Book ${requestedDateLabel} with\` : "Book with"} ${techs.find(tech => tech.id === choice)?.name || "technician"} in ServiceM8\` : "No eligible technician"}</button></footer>
`,
"requested date footer"
);

fs.writeFileSync(pagePath, source);
console.log("Applied requested-date Auto Route insertion patch.");