export type OptimizerWindow = "AM" | "PM";

export type OptimizerPoint = {
  x: number;
  y: number;
};

export type OptimizerTechnician = {
  id: string;
  name: string;
  start: OptimizerPoint;
};

export type OptimizerJob = {
  id: number;
  label: string;
  point: OptimizerPoint;
  window: OptimizerWindow;
  priority: number;
  durationMinutes: number;
  eligibleTechIds: string[];
  fixed?: boolean;
  techId?: string | null;
  fixedStartMinute?: number | null;
  fixedEndMinute?: number | null;
};

export type OptimizerPlan = {
  jobId: number;
  techId: string;
  startMinute: number;
  endMinute: number;
  order: number;
  reason: string;
};

export type OptimizerResult = {
  plans: OptimizerPlan[];
  unassignedJobIds: number[];
  counts: Record<string, number>;
  totalDistance: number;
  backtracking: number;
  objective: number;
};

type TechnicianRoute = {
  AM: OptimizerJob[];
  PM: OptimizerJob[];
};

type RouteState = Map<string, TechnicianRoute>;

type ScheduledJob = {
  job: OptimizerJob;
  startMinute: number;
  endMinute: number;
};

type RouteAssessment = {
  feasible: boolean;
  objective: number;
  totalDistance: number;
  backtracking: number;
  counts: Record<string, number>;
  schedules: Map<string, ScheduledJob[]>;
};

const WINDOW_BOUNDS: Record<OptimizerWindow, { start: number; end: number }> = {
  AM: { start: 8 * 60, end: 11 * 60 },
  PM: { start: 12 * 60, end: 16 * 60 }
};

function pointDistance(a: OptimizerPoint, b: OptimizerPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function travelMinutes(a: OptimizerPoint, b: OptimizerPoint) {
  return Math.max(10, Math.round(pointDistance(a, b) * 1.7));
}

function roundUpQuarter(minutes: number) {
  return Math.ceil(minutes / 15) * 15;
}

function cloneRoutes(routes: RouteState): RouteState {
  const copy: RouteState = new Map();
  routes.forEach((route, techId) => {
    copy.set(techId, { AM: [...route.AM], PM: [...route.PM] });
  });
  return copy;
}

function priorityOrderIsValid(sequence: OptimizerJob[]) {
  const movable = sequence.filter(job => !job.fixed);
  for (let index = 1; index < movable.length; index += 1) {
    if (movable[index].priority < movable[index - 1].priority) return false;
  }
  return true;
}

function scheduleWindow(
  sequence: OptimizerJob[],
  startPoint: OptimizerPoint,
  window: OptimizerWindow,
  previousWindowEnd: number | null = null
) {
  if (!priorityOrderIsValid(sequence)) return null;
  const bounds = WINDOW_BOUNDS[window];
  const scheduled: ScheduledJob[] = [];
  let previousPoint = startPoint;
  const earliestFixedStart = sequence
    .filter(job => job.fixed && Number.isFinite(Number(job.fixedStartMinute)))
    .reduce((earliest, job) => Math.min(earliest, Number(job.fixedStartMinute)), bounds.start);
  let previousEnd = earliestFixedStart;

  for (let index = 0; index < sequence.length; index += 1) {
    const job = sequence[index];
    const travel = index === 0 && previousWindowEnd == null ? 0 : travelMinutes(previousPoint, job.point);
    const earliest = index === 0
      ? previousWindowEnd == null
        ? job.fixed ? earliestFixedStart : bounds.start
        : roundUpQuarter(Math.max(bounds.start, previousWindowEnd + 15 + travel))
      : roundUpQuarter(previousEnd + 15 + travel);
    const fixedStart = Number(job.fixedStartMinute);
    const fixedEnd = Number(job.fixedEndMinute);
    const startMinute = job.fixed && Number.isFinite(fixedStart)
      ? fixedStart
      : earliest;
    const endMinute = job.fixed && Number.isFinite(fixedEnd) && fixedEnd > startMinute
      ? fixedEnd
      : startMinute + Math.max(30, job.durationMinutes);

    const outsideAllocationWindow = !job.fixed && (startMinute < bounds.start || endMinute > bounds.end);
    if (outsideAllocationWindow || startMinute < earliest) return null;

    scheduled.push({ job, startMinute, endMinute });
    previousPoint = job.point;
    previousEnd = endMinute;
  }

  return scheduled;
}

function pathBacktracking(points: OptimizerPoint[]) {
  let penalty = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const firstLeg = pointDistance(previous, current);
    const secondLeg = pointDistance(current, next);
    const direct = pointDistance(previous, next);
    const detour = Math.max(0, firstLeg + secondLeg - direct);
    const firstVector = { x: current.x - previous.x, y: current.y - previous.y };
    const secondVector = { x: next.x - current.x, y: next.y - current.y };
    const denominator = Math.max(.01, firstLeg * secondLeg);
    const cosine = (firstVector.x * secondVector.x + firstVector.y * secondVector.y) / denominator;
    const reversal = cosine < 0 ? Math.min(firstLeg, secondLeg) * Math.abs(cosine) : 0;
    penalty += detour * .8 + reversal * 2.5;
  }
  return penalty;
}

function assessRoutes(
  routes: RouteState,
  technicians: OptimizerTechnician[],
  maxJobs: number
): RouteAssessment {
  const counts: Record<string, number> = {};
  const schedules = new Map<string, ScheduledJob[]>();
  let totalDistance = 0;
  let backtracking = 0;

  for (const tech of technicians) {
    const route = routes.get(tech.id) || { AM: [], PM: [] };
    const count = route.AM.length + route.PM.length;
    counts[tech.id] = count;
    if (count > maxJobs) {
      return { feasible: false, objective: Number.POSITIVE_INFINITY, totalDistance, backtracking, counts, schedules };
    }

    const amSchedule = scheduleWindow(route.AM, tech.start, "AM");
    if (!amSchedule) {
      return { feasible: false, objective: Number.POSITIVE_INFINITY, totalDistance, backtracking, counts, schedules };
    }
    const amEndPoint = route.AM.length ? route.AM[route.AM.length - 1].point : tech.start;
    const amLastEnd = amSchedule.length ? amSchedule[amSchedule.length - 1].endMinute : null;
    const pmSchedule = scheduleWindow(route.PM, amEndPoint, "PM", amLastEnd);
    if (!pmSchedule) {
      return { feasible: false, objective: Number.POSITIVE_INFINITY, totalDistance, backtracking, counts, schedules };
    }

    const schedule = [...amSchedule, ...pmSchedule];
    schedules.set(tech.id, schedule);
    const points = [tech.start, ...schedule.map(item => item.job.point)];
    for (let index = 1; index < points.length; index += 1) {
      totalDistance += pointDistance(points[index - 1], points[index]);
    }
    backtracking += pathBacktracking(points);
  }

  const allCounts = technicians.map(tech => counts[tech.id] || 0);
  const totalJobs = allCounts.reduce((sum, count) => sum + count, 0);
  let workloadPenalty = 0;
  if (technicians.length >= 3 && totalJobs >= technicians.length * 3) {
    const minimum = Math.min(...allCounts);
    const maximum = Math.max(...allCounts);
    if (minimum < 3) workloadPenalty += (3 - minimum) * 28;
    if (minimum > 3) workloadPenalty += (minimum - 3) * 120;
    if (maximum - minimum > 3) workloadPenalty += (maximum - minimum - 3) * 16;
  }

  const objective = totalDistance + backtracking * 3.5 + workloadPenalty;
  return { feasible: true, objective, totalDistance, backtracking, counts, schedules };
}

function createInitialRoutes(
  technicians: OptimizerTechnician[],
  fixedJobs: OptimizerJob[]
) {
  const routes: RouteState = new Map();
  technicians.forEach(tech => routes.set(tech.id, { AM: [], PM: [] }));
  fixedJobs.forEach(job => {
    if (!job.techId || !routes.has(job.techId)) return;
    routes.get(job.techId)![job.window].push(job);
  });
  routes.forEach(route => {
    route.AM.sort((a, b) => Number(a.fixedStartMinute || 0) - Number(b.fixedStartMinute || 0));
    route.PM.sort((a, b) => Number(a.fixedStartMinute || 0) - Number(b.fixedStartMinute || 0));
  });
  return routes;
}

function eligible(job: OptimizerJob, techId: string) {
  return job.eligibleTechIds.includes(techId);
}

function insertJob(
  routes: RouteState,
  techId: string,
  job: OptimizerJob,
  index: number
) {
  const route = routes.get(techId)!;
  route[job.window].splice(index, 0, job);
}

function locateMovableJobs(routes: RouteState) {
  const locations: Array<{ techId: string; window: OptimizerWindow; index: number; job: OptimizerJob }> = [];
  routes.forEach((route, techId) => {
    (["AM", "PM"] as OptimizerWindow[]).forEach(window => {
      route[window].forEach((job, index) => {
        if (!job.fixed) locations.push({ techId, window, index, job });
      });
    });
  });
  return locations;
}

function improveRoutes(
  initial: RouteState,
  technicians: OptimizerTechnician[],
  maxJobs: number
) {
  let routes = initial;
  let assessment = assessRoutes(routes, technicians, maxJobs);

  for (let pass = 0; pass < 60; pass += 1) {
    let bestRoutes: RouteState | null = null;
    let bestAssessment = assessment;
    const locations = locateMovableJobs(routes);

    for (const location of locations) {
      for (const targetTech of technicians) {
        if (!eligible(location.job, targetTech.id)) continue;
        const without = cloneRoutes(routes);
        without.get(location.techId)![location.window].splice(location.index, 1);
        const targetSequence = without.get(targetTech.id)![location.window];
        for (let targetIndex = 0; targetIndex <= targetSequence.length; targetIndex += 1) {
          const candidate = cloneRoutes(without);
          insertJob(candidate, targetTech.id, location.job, targetIndex);
          const candidateAssessment = assessRoutes(candidate, technicians, maxJobs);
          if (candidateAssessment.objective + .05 < bestAssessment.objective) {
            bestRoutes = candidate;
            bestAssessment = candidateAssessment;
          }
        }
      }
    }

    for (let firstIndex = 0; firstIndex < locations.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < locations.length; secondIndex += 1) {
        const first = locations[firstIndex];
        const second = locations[secondIndex];
        if (first.techId === second.techId) continue;
        if (!eligible(first.job, second.techId) || !eligible(second.job, first.techId)) continue;

        const removed = cloneRoutes(routes);
        const firstRoute = removed.get(first.techId)![first.window];
        const secondRoute = removed.get(second.techId)![second.window];
        firstRoute.splice(firstRoute.findIndex(job => job.id === first.job.id), 1);
        secondRoute.splice(secondRoute.findIndex(job => job.id === second.job.id), 1);

        const firstTarget = removed.get(second.techId)![first.window];
        const secondTarget = removed.get(first.techId)![second.window];
        for (let firstPosition = 0; firstPosition <= firstTarget.length; firstPosition += 1) {
          for (let secondPosition = 0; secondPosition <= secondTarget.length; secondPosition += 1) {
            const candidate = cloneRoutes(removed);
            insertJob(candidate, second.techId, first.job, firstPosition);
            insertJob(candidate, first.techId, second.job, secondPosition);
            const candidateAssessment = assessRoutes(candidate, technicians, maxJobs);
            if (candidateAssessment.objective + .05 < bestAssessment.objective) {
              bestRoutes = candidate;
              bestAssessment = candidateAssessment;
            }
          }
        }
      }
    }

    if (!bestRoutes) break;
    routes = bestRoutes;
    assessment = bestAssessment;
  }

  return { routes, assessment };
}

function routeReason(
  tech: OptimizerTechnician,
  schedule: ScheduledJob[],
  index: number
) {
  const current = schedule[index];
  const previous = index > 0 ? schedule[index - 1].job : null;
  const next = index < schedule.length - 1 ? schedule[index + 1].job : null;
  if (current.job.priority === 0) return `Urgent ${current.job.window} booking placed ahead of standard work`;
  if (!previous) return `First stop from ${tech.name}’s starting area`;
  if (next) return `Placed between ${previous.label} and ${next.label} to minimise the complete run`;
  return `Finishes after ${previous.label} without sending the run back across Sydney`;
}

export function optimiseWholeDayRoutes(input: {
  technicians: OptimizerTechnician[];
  movableJobs: OptimizerJob[];
  fixedJobs?: OptimizerJob[];
  maxJobs?: number;
}): OptimizerResult {
  const technicians = input.technicians;
  const maxJobs = input.maxJobs || 6;
  let routes = createInitialRoutes(technicians, input.fixedJobs || []);
  const unassignedJobIds: number[] = [];
  const pending = [...input.movableJobs].sort((a, b) =>
    a.eligibleTechIds.length - b.eligibleTechIds.length
    || a.window.localeCompare(b.window)
    || a.priority - b.priority
  );

  for (const job of pending) {
    let bestRoutes: RouteState | null = null;
    let bestAssessment: RouteAssessment | null = null;
    for (const tech of technicians) {
      if (!eligible(job, tech.id)) continue;
      const sequence = routes.get(tech.id)![job.window];
      for (let index = 0; index <= sequence.length; index += 1) {
        const candidate = cloneRoutes(routes);
        insertJob(candidate, tech.id, job, index);
        const assessment = assessRoutes(candidate, technicians, maxJobs);
        if (!assessment.feasible) continue;
        if (!bestAssessment || assessment.objective < bestAssessment.objective) {
          bestRoutes = candidate;
          bestAssessment = assessment;
        }
      }
    }
    if (!bestRoutes) {
      unassignedJobIds.push(job.id);
      continue;
    }
    routes = bestRoutes;
  }

  const improved = improveRoutes(routes, technicians, maxJobs);
  routes = improved.routes;
  const assessment = improved.assessment;
  const plans: OptimizerPlan[] = [];

  technicians.forEach(tech => {
    const schedule = assessment.schedules.get(tech.id) || [];
    schedule.forEach((item, index) => {
      if (item.job.fixed) return;
      plans.push({
        jobId: item.job.id,
        techId: tech.id,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        order: index + 1,
        reason: routeReason(tech, schedule, index)
      });
    });
  });

  return {
    plans,
    unassignedJobIds,
    counts: assessment.counts,
    totalDistance: assessment.totalDistance,
    backtracking: assessment.backtracking,
    objective: assessment.objective
  };
}
