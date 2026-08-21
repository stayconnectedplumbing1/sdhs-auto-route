"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { optimiseWholeDayRoutes, type OptimizerJob } from "./global-route-optimizer";
import "./status-colors.css";

type TechStatus = "Available" | "On Site" | "Driving" | "Off";
type Technician = {
  id: string; name: string; home: string; vehicle: string; status: TechStatus;
  skills: string[]; tools: string[]; color: string; x: number; y: number;
  latitude?: number | null; longitude?: number | null;
  holding?: boolean;
};
type Priority = "Urgent" | "High" | "Standard";
type BookingDay = "Today" | "Tomorrow" | "Day After";
type Job = {
  id: number; customer: string; phone: string; suburb: string; address: string;
  service: string; issue: string; value: number; duration: number; priority: Priority;
  requiredSkill: string; requiredTool: string; techId: string | null; order: number; bookingDay: BookingDay;
  latitude?: number | null; longitude?: number | null; scheduledStart?: string;
  scheduledEnd?: string; activityUUID?: string | null; allocationUUID?: string | null; holdingWindow?: string | null;
  isActionRequired?: boolean; queueName?: string | null; jobStatus?: string; scheduledDate?: string; serviceM8UUID?: string | null;
  routeReason?: string; plannedOrder?: number;
};

const DEFAULT_TOOLS = [
  "High-pressure jetter", "CCTV drain camera", "Leak detection equipment",
  "Gas testing equipment", "Roofing equipment", "Electrical testing equipment",
  "Hot water tools", "Ladders", "Drain locator", "Wet vacuum"
];
const SKILLS = ["General Plumbing", "Blocked Drains", "Hot Water", "Gas", "Roofing", "Leak Detection", "Electrical", "Waterproofing"];
const SERVICES: Record<string, { skill: string; tool: string; duration: number; urgent: boolean }> = {
  "Blocked drain or toilet": { skill: "Blocked Drains", tool: "High-pressure jetter", duration: 90, urgent: true },
  "Hot water replacement or repair": { skill: "Hot Water", tool: "Hot water tools", duration: 90, urgent: true },
  "Burst pipe": { skill: "General Plumbing", tool: "", duration: 90, urgent: true },
  "Gas leak": { skill: "Gas", tool: "Gas testing equipment", duration: 90, urgent: true },
  "Roof repair": { skill: "Roofing", tool: "Roofing equipment", duration: 120, urgent: false },
  "Shower regrout": { skill: "Waterproofing", tool: "", duration: 180, urgent: false },
  "Shower leaking": { skill: "Leak Detection", tool: "Leak detection equipment", duration: 120, urgent: false },
  "Gas heater service": { skill: "Gas", tool: "Gas testing equipment", duration: 90, urgent: false },
  "General enquiry": { skill: "General Plumbing", tool: "", duration: 60, urgent: false },
  "Balcony regrout": { skill: "Waterproofing", tool: "", duration: 240, urgent: false }
};
const EMERGENCY_RULES = [
  { pattern: /(?:blocked|blockage|block).{0,28}(?:drain|toilet)|(?:drain|toilet).{0,28}(?:blocked|blockage)/i, skill: "Blocked Drains", tool: "High-pressure jetter", duration: 90 },
  { pattern: /(?:no hot water|hot water).{0,36}(?:replace|replacement|repair|not working|leak|system)|(?:replace|replacement|repair).{0,36}hot water/i, skill: "Hot Water", tool: "Hot water tools", duration: 90 },
  { pattern: /burst.{0,24}(?:pipe|water|line)|(?:pipe|water|line).{0,24}burst/i, skill: "General Plumbing", tool: "", duration: 90 },
  { pattern: /gas.{0,24}leak|leak.{0,24}gas/i, skill: "Gas", tool: "Gas testing equipment", duration: 90 }
];
const SUBURBS: Record<string, { x: number; y: number }> = {
  "Baulkham Hills": { x: 55, y: 25 }, Northmead: { x: 51, y: 35 }, Parramatta: { x: 48, y: 45 },
  Merrylands: { x: 43, y: 57 }, Guildford: { x: 39, y: 61 }, Granville: { x: 46, y: 53 },
  Gladesville: { x: 70, y: 43 }, Ryde: { x: 67, y: 35 }, Chatswood: { x: 72, y: 20 },
  Blacktown: { x: 31, y: 34 }, Penrith: { x: 12, y: 40 }, Liverpool: { x: 36, y: 77 },
  Auburn: { x: 51, y: 54 }, Strathfield: { x: 58, y: 55 }, "Sydney CBD": { x: 80, y: 65 },
  "Hunters Hill": { x: 73, y: 47 }, Westmead: { x: 44, y: 38 }, Wentworthville: { x: 41, y: 38 },
  Toongabbie: { x: 39, y: 34 }, Pendle: { x: 42, y: 41 }, "Castle Hill": { x: 50, y: 17 }
};
const HOME: Record<string, { x: number; y: number }> = { Merrylands: SUBURBS.Merrylands, "Baulkham Hills": SUBURBS["Baulkham Hills"], Gladesville: SUBURBS.Gladesville };
const INITIAL_TECHS: Technician[] = [
  { id: "kerem", name: "Kerem", home: "Merrylands", vehicle: "Toyota HiAce", status: "Available", skills: ["General Plumbing", "Hot Water", "Gas", "Leak Detection"], tools: ["Leak detection equipment", "Gas testing equipment", "Hot water tools", "Ladders"], color: "#1677ff", ...HOME.Merrylands },
  { id: "tom", name: "Tom", home: "Baulkham Hills", vehicle: "Ford Ranger", status: "Available", skills: ["General Plumbing", "Blocked Drains", "Hot Water", "Gas"], tools: ["High-pressure jetter", "CCTV drain camera", "Drain locator", "Hot water tools", "Gas testing equipment"], color: "#f04438", ...HOME["Baulkham Hills"] },
  { id: "raf", name: "Raf", home: "Gladesville", vehicle: "Isuzu D-Max", status: "Available", skills: ["General Plumbing", "Roofing", "Leak Detection", "Waterproofing"], tools: ["Roofing equipment", "Leak detection equipment", "Ladders"], color: "#7a5af8", ...HOME.Gladesville }
];
const STORAGE = "sdhs-auto-route-v5";
const CENTRAL_COAST_SETTING = "sdhs-central-coast-enabled";
const SETTINGS_API = "/api/settings";
const DISPATCH_START_HOUR = 6;
const DISPATCH_END_HOUR = 18;
const DISPATCH_MINUTES = (DISPATCH_END_HOUR - DISPATCH_START_HOUR) * 60;

type SharedTechnicianOverride = {
  id: string; name: string; home: string; vehicle: string;
  skills: string[]; tools: string[]; color: string; x: number; y: number;
  holding?: boolean;
};
type SharedSettings = {
  version: number;
  centralCoastEnabled: boolean;
  centralCoastRoutingEnabled?: boolean;
  tools: string[];
  technicianOverrides: SharedTechnicianOverride[];
  updatedAt?: string;
};

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map(value => String(value || "").trim()).filter(Boolean)));
}

function normaliseSharedSettings(settings?: Partial<SharedSettings> | null): SharedSettings {
  const tools = uniqueList(settings?.tools || DEFAULT_TOOLS);
  const centralCoastValue = typeof settings?.centralCoastRoutingEnabled === "boolean"
    ? settings.centralCoastRoutingEnabled
    : settings?.centralCoastEnabled;
  return {
    version: 1,
    centralCoastEnabled: centralCoastValue !== false,
    tools: tools.length ? tools : DEFAULT_TOOLS,
    technicianOverrides: Array.isArray(settings?.technicianOverrides)
      ? settings.technicianOverrides.map(tech => ({
          id: String(tech.id || tech.name || "").trim(),
          name: String(tech.name || tech.id || "").trim(),
          home: String(tech.home || "Sydney").trim(),
          vehicle: String(tech.vehicle || "Service vehicle").trim(),
          skills: uniqueList(tech.skills || ["General Plumbing"]),
          tools: uniqueList(tech.tools || []),
          color: String(tech.color || "#1677ff"),
          x: Number.isFinite(Number(tech.x)) ? Number(tech.x) : 50,
          y: Number.isFinite(Number(tech.y)) ? Number(tech.y) : 50,
          holding: Boolean(tech.holding)
        })).filter(tech => tech.id && tech.name)
      : INITIAL_TECHS.map(tech => ({
          id: tech.id, name: tech.name, home: tech.home, vehicle: tech.vehicle,
          skills: tech.skills, tools: tech.tools, color: tech.color, x: tech.x, y: tech.y, holding: tech.holding
        })),
    updatedAt: settings?.updatedAt
  };
}

function mergeSharedSettingsIntoTechs(techs: Technician[], settings: SharedSettings | null) {
  if (!settings) return techs;
  return techs.map(tech => {
    const override = settings.technicianOverrides.find(item => item.id === tech.id || item.name.toLowerCase() === tech.name.toLowerCase());
    if (!override) return tech;
    return {
      ...tech,
      home: override.home || tech.home,
      vehicle: override.vehicle || tech.vehicle,
      skills: override.skills.length ? override.skills : tech.skills,
      tools: override.tools,
      color: override.color || tech.color,
      x: Number.isFinite(override.x) ? override.x : tech.x,
      y: Number.isFinite(override.y) ? override.y : tech.y,
      holding: tech.holding || override.holding
    };
  });
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
function liveDistance(tech: Technician, job: Job, fallback: number) {
  if (tech.latitude == null || tech.longitude == null || job.latitude == null || job.longitude == null) return fallback;
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(Number(job.latitude) - Number(tech.latitude));
  const dLng = rad(Number(job.longitude) - Number(tech.longitude));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(Number(tech.latitude))) * Math.cos(rad(Number(job.latitude))) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CENTRAL_COAST_SUBURBS = [
  "Gosford", "West Gosford", "East Gosford", "North Gosford", "Wyong", "Tuggerah", "Erina", "Terrigal",
  "Woy Woy", "Umina", "Ettalong", "The Entrance", "Bateau Bay", "Toukley", "Lake Haven", "Charmhaven",
  "Kanwal", "Kincumber", "Avoca Beach", "Copacabana", "Saratoga", "Green Point", "Kariong", "Lisarow",
  "Ourimbah", "Berkeley Vale", "Killarney Vale", "Long Jetty", "Shelly Beach", "Blue Bay", "Norah Head",
  "Lake Munmorah", "Budgewoi", "Gorokan", "Wadalba", "Hamlyn Terrace"
];

function isJoel(tech: Technician) {
  return /\bjoel\b/i.test(tech.name);
}

function isCentralCoastJob(job: Job) {
  const locationText = `${job.suburb || ""} ${job.address || ""}`.toLowerCase();
  if (CENTRAL_COAST_SUBURBS.some(suburb => locationText.includes(suburb.toLowerCase()))) return true;
  const lat = Number(job.latitude);
  const lng = Number(job.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
    && lat >= -33.58 && lat <= -32.85 && lng >= 150.75 && lng <= 152.00;
}

function centralCoastRoutingEnabled() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(CENTRAL_COAST_SETTING) !== "false";
}

function isOutsideServiceArea(job: Job) {
  if (isCentralCoastJob(job)) return !centralCoastRoutingEnabled();
  const lat = Number(job.latitude);
  const lng = Number(job.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return false;
  const inSydney = lat >= -34.25 && lat <= -33.35 && lng >= 150.10 && lng <= 151.65;
  // Camden/Macarthur is the south-west edge of the normal Sydney service area.
  // Keep Sydney's southern/eastern corridor separate, but reject locations
  // farther south-west than Camden (for example Picton, Tahmoor and Bargo).
  const beyondCamdenSouthWest = lng <= 150.95 && lat < -34.10;
  return !inSydney || beyondCamdenSouthWest;
}

function scheduledWindow(job: Job) {
  if (!job.scheduledStart) return null;
  const start = new Date(String(job.scheduledStart).replace(" ", "T"));
  const end = job.scheduledEnd
    ? new Date(String(job.scheduledEnd).replace(" ", "T"))
    : new Date(start.getTime() + Math.max(30, job.duration || 60) * 60000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  return { start, end };
}

function currentBooking(techId: string, jobs: Job[], now = new Date()) {
  return jobs
    .filter(job => job.techId === techId && !String(job.jobStatus || "").toLowerCase().includes("complete"))
    .map(job => ({ job, window: scheduledWindow(job) }))
    .filter(item => item.window && item.window.start.getTime() <= now.getTime() && item.window.end.getTime() > now.getTime())
    .sort((a, b) => (b.window?.end.getTime() || 0) - (a.window?.end.getTime() || 0))[0] || null;
}

function timeLabel(date: Date) {
  return new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function roundUpToQuarterHour(date: Date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % 15;
  if (remainder !== 0) rounded.setMinutes(rounded.getMinutes() + (15 - remainder));
  return rounded;
}

function roundDurationToQuarterMinutes(minutes: number) {
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
  return Math.max(15, Math.ceil(safeMinutes / 15) * 15);
}

function parseServiceM8Date(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(String(value).replace(" ", "T"));
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function bookingEnd(start: Date, requestedEnd: Date | null, durationMinutes: number) {
  const duration = roundDurationToQuarterMinutes(durationMinutes);
  const fallbackEnd = new Date(start.getTime() + duration * 60000);
  if (!requestedEnd || !Number.isFinite(requestedEnd.getTime())) return fallbackEnd;
  const roundedEnd = roundUpToQuarterHour(requestedEnd);
  return roundedEnd.getTime() >= fallbackEnd.getTime() ? roundedEnd : fallbackEnd;
}

function sydneyDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function jobDateKey(job: Job) {
  if (job.scheduledDate) return job.scheduledDate;
  if (job.scheduledStart) return String(job.scheduledStart).slice(0, 10);
  const offset = job.bookingDay === "Tomorrow" ? 1 : job.bookingDay === "Day After" ? 2 : 0;
  return sydneyDateKey(new Date(Date.now() + offset * 86400000));
}

function normaliseRoutingJob(job: Job): Job {
  const text = `${job.service || ""} ${job.issue || ""}`;
  const emergency = EMERGENCY_RULES.find(rule => rule.pattern.test(text));
  return {
    ...job,
    priority: emergency ? "Urgent" : job.priority || "Standard",
    requiredSkill: emergency?.skill || job.requiredSkill || "General Plumbing",
    requiredTool: emergency?.tool ?? job.requiredTool ?? "",
    duration: Math.max(30, roundDurationToQuarterMinutes(Number(job.duration) || emergency?.duration || 60))
  };
}

function serviceStatus(job: Job) {
  const status = String(job.jobStatus || "Quote").toLowerCase();
  return status.includes("complete") ? "completed" : status.includes("work") ? "work-order" : "quote";
}

function planningWindowName(job: Job) {
  if (job.holdingWindow === "AM 8-11" || job.holdingWindow === "PM 12-4") return job.holdingWindow;
  const start = parseServiceM8Date(job.scheduledStart);
  return start && start.getHours() >= 12 ? "PM 12-4" : "AM 8-11";
}

function isFutureStandardReplanCandidate(job: Job, dateKey: string) {
  return dateKey > sydneyDateKey()
    && Boolean(job.techId)
    && job.priority !== "Urgent"
    && serviceStatus(job) !== "completed";
}

function priorityClass(job: Job) {
  return job.priority === "Urgent" ? "priority-urgent" : "priority-standard";
}

function priorityLabel(job: Job) {
  return job.priority === "Urgent" ? "URGENT - BOOK NOW" : "STANDARD JOB";
}

type RecommendationOptions = { sameDayRequested?: boolean; plannedRoute?: boolean; deferCommit?: boolean; reloadAfterBooking?: boolean };
type PendingBookingCommit = { jobId: number; jobUUID: string; techName: string; commit: () => void };
type BookingResult = { status: "success" | "error"; jobUUID: string; message: string; nonce: number };

function customerRequestedWindow(job: Job) {
  const text = `${job.holdingWindow || ""} ${job.issue || ""} ${job.service || ""}`.toLowerCase();
  if (job.holdingWindow === "AM 8-11" || /\b8\s*(?:-|–|to)\s*11\b|\b8\s*am.{0,12}11\s*am\b/i.test(text)) return { startHour: 8, endHour: 11, label: "8–11 AM" };
  if (job.holdingWindow === "12-4 PM" || /\b12\s*(?:-|–|to)\s*4\b|\b12\s*pm.{0,12}4\s*pm\b/i.test(text)) return { startHour: 12, endHour: 16, label: "12–4 PM" };
  const afterMatch = text.match(/after\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (afterMatch) {
    let hour = Number(afterMatch[1]);
    if (String(afterMatch[3] || "").toLowerCase() === "pm" && hour < 12) hour += 12;
    return { startHour: Math.max(8, Math.min(16, hour)), endHour: 17, label: `After ${afterMatch[1]}${afterMatch[3] ? ` ${String(afterMatch[3]).toUpperCase()}` : ""}` };
  }
  return { startHour: 8, endHour: 17, label: "Today" };
}

type RemainingRunStop = {
  job: Job;
  window: { start: Date; end: Date };
  synthetic: boolean;
};

function stopSortValue(job: Job) {
  const start = parseServiceM8Date(job.scheduledStart);
  if (start) return start.getTime();
  return Number(job.order || 999) * 60000;
}

function buildRemainingRun(tech: Technician, jobs: Job[], dateKey: string, now: Date) {
  const travelMinutes = (from: RoutePoint, to: RoutePoint) => Math.max(10, Math.round(routeDistance(from, to) * 1.7));
  const raw = jobs
    .filter(item =>
      item.techId === tech.id
      && item.id
      && jobDateKey(item) === dateKey
      && !String(item.jobStatus || "").toLowerCase().includes("complete")
    )
    .sort((a, b) => stopSortValue(a) - stopSortValue(b));

  const liveStartPoint = routePoint(tech);
  let previousPoint = liveStartPoint;
  let previousEnd = new Date(now);

  return raw
    .map((runJob): RemainingRunStop => {
      const fixedWindow = scheduledWindow(runJob);
      if (fixedWindow) {
        previousPoint = routePoint(runJob);
        previousEnd = fixedWindow.end;
        return { job: runJob, window: fixedWindow, synthetic: false };
      }

      const start = roundUpToQuarterHour(new Date(previousEnd.getTime() + (15 + travelMinutes(previousPoint, routePoint(runJob))) * 60000));
      const end = new Date(start.getTime() + Math.max(30, runJob.duration || 60) * 60000);
      previousPoint = routePoint(runJob);
      previousEnd = end;
      return { job: runJob, window: { start, end }, synthetic: true };
    })
    .filter(stop => stop.window.end.getTime() > now.getTime());
}

function sameDayStandardSlot(tech: Technician, job: Job, jobs: Job[], now = new Date()) {
  const requested = customerRequestedWindow(job);
  const dateKey = sydneyDateKey(now);
  const windowStart = new Date(`${dateKey}T${String(requested.startHour).padStart(2, "0")}:00:00`);
  const windowEnd = new Date(`${dateKey}T${String(requested.endHour).padStart(2, "0")}:00:00`);
  const dayEnd = new Date(`${dateKey}T20:00:00`);
  const durationMinutes = Math.max(30, job.duration || 30);
  const existing = buildRemainingRun(tech, jobs.filter(item => item.id !== job.id), dateKey, now);
  const jobPoint = routePoint(job);
  const travelMinutes = (from: RoutePoint, to: RoutePoint) => Math.max(10, Math.round(routeDistance(from, to) * 1.7));
  const active = currentBooking(tech.id, jobs, now);
  const startPoint = tech.latitude != null && tech.longitude != null
    ? routePoint(tech)
    : active?.job
      ? routePoint(active.job)
      : routePoint(tech);
  const routeInsertions: Array<{
    plannedOrder: number;
    addedTravel: number;
    previousLabel: string;
    nextLabel: string | null;
    previousReady: Date;
    previousPoint: RoutePoint;
  }> = [];
  const candidates: Array<{
    start: Date;
    end: Date;
    requested: ReturnType<typeof customerRequestedWindow>;
    plannedOrder: number;
    addedTravel: number;
    movedCount: number;
    previousLabel: string;
    nextLabel: string | null;
  }> = [];

  const activeStopIndex = existing.findIndex(stop =>
    stop.window.start.getTime() <= now.getTime() && stop.window.end.getTime() > now.getTime()
  );
  const firstInsertionIndex = activeStopIndex >= 0 ? activeStopIndex + 1 : 0;

  for (let index = firstInsertionIndex; index <= existing.length; index += 1) {
    const previous = existing[index - 1] || null;
    const next = existing[index] || null;
    const previousPoint = previous ? routePoint(previous.job) : startPoint;
    const nextPoint = next ? routePoint(next.job) : undefined;
    const previousReady = previous
      ? new Date(previous.window.end.getTime() + 15 * 60000)
      : new Date(Math.max(windowStart.getTime(), now.getTime()));
    const directTravel = nextPoint ? travelMinutes(previousPoint, nextPoint) : 0;
    const insertedTravel = travelMinutes(previousPoint, jobPoint) + (nextPoint ? travelMinutes(jobPoint, nextPoint) : 0);
    routeInsertions.push({
      plannedOrder: index + 1,
      addedTravel: Math.max(0, insertedTravel - directTravel),
      previousLabel: previous ? `job #${previous.job.id} (${previous.job.suburb})` : "live current location",
      nextLabel: next ? `job #${next.job.id} (${next.job.suburb})` : null,
      previousReady,
      previousPoint
    });
    const earliestStart = roundUpToQuarterHour(new Date(previousReady.getTime() + travelMinutes(previousPoint, jobPoint) * 60000));
    const end = new Date(earliestStart.getTime() + durationMinutes * 60000);
    if (end.getTime() > dayEnd.getTime()) continue;

    let cascadeFeasible = true;
    let cascadeEnd = end;
    let cascadePoint = jobPoint;
    let movedCount = 0;
    let maxDelayMinutes = 0;
    for (const futureStop of existing.slice(index)) {
      const futurePoint = routePoint(futureStop.job);
      const earliestFutureStart = roundUpToQuarterHour(new Date(cascadeEnd.getTime() + (15 + travelMinutes(cascadePoint, futurePoint)) * 60000));
      const originalStart = futureStop.window.start;
      const futureStart = earliestFutureStart.getTime() > originalStart.getTime() ? earliestFutureStart : originalStart;
      const futureEnd = new Date(futureStart.getTime() + Math.max(30, futureStop.job.duration || 60) * 60000);
      const delayMinutes = Math.max(0, Math.round((futureStart.getTime() - originalStart.getTime()) / 60000));

      // Urgent work keeps its time. Standard/non-urgent work can be pushed back
      // when that avoids sending the technician away from a geographically
      // sensible route and then backtracking.
      if (futureStop.job.priority === "Urgent" && delayMinutes > 0) {
        cascadeFeasible = false;
        break;
      }
      if (futureEnd.getTime() > dayEnd.getTime()) {
        cascadeFeasible = false;
        break;
      }
      if (delayMinutes > 0) {
        movedCount += 1;
        maxDelayMinutes = Math.max(maxDelayMinutes, delayMinutes);
      }
      cascadeEnd = futureEnd;
      cascadePoint = futurePoint;
    }
    if (!cascadeFeasible) continue;

    const requestedPenalty = earliestStart.getTime() > windowEnd.getTime() ? 8 : 0;
    const movePenalty = movedCount * 2 + Math.min(12, maxDelayMinutes / 15);
    candidates.push({
      start: earliestStart,
      end,
      requested,
      plannedOrder: index + 1,
      addedTravel: Math.max(0, insertedTravel - directTravel) + requestedPenalty + movePenalty,
      movedCount,
      previousLabel: previous ? `job #${previous.job.id} (${previous.job.suburb})` : "live current location",
      nextLabel: next ? `job #${next.job.id} (${next.job.suburb})` : null
    });
  }

  if (candidates.length) {
    return candidates.sort((a, b) => a.addedTravel - b.addedTravel || a.start.getTime() - b.start.getTime())[0];
  }

  const bestInsertion = routeInsertions.sort((a, b) => a.addedTravel - b.addedTravel || a.plannedOrder - b.plannedOrder)[0];
  const last = existing[existing.length - 1] || null;
  const previousPoint = last ? routePoint(last.job) : startPoint;
  const previousReady = last
    ? new Date(last.window.end.getTime() + 15 * 60000)
    : new Date(Math.max(windowStart.getTime(), now.getTime()));
  const start = roundUpToQuarterHour(new Date(previousReady.getTime() + travelMinutes(previousPoint, jobPoint) * 60000));
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return {
    start,
    end,
    requested,
    plannedOrder: existing.length + 1,
    addedTravel: (bestInsertion?.addedTravel ?? travelMinutes(previousPoint, jobPoint)) + 20,
    previousLabel: bestInsertion
      ? `today after existing run; closest route fit was after ${bestInsertion.previousLabel}${bestInsertion.nextLabel ? ` before ${bestInsertion.nextLabel}` : ""}, but that gap would make later work late`
      : last ? `job #${last.job.id} (${last.job.suburb})` : "live current location",
    nextLabel: null
  };
}

function isActionRequiredJob(job: Job) {
  const queue = String(job.queueName || "").trim().toLowerCase();
  if (job.isActionRequired === true || queue === "action required") return true;
  // ServiceM8 phone-created jobs can arrive without the queue label. An active
  // job with no booking or allocation is the same unscheduled Action Required state.
  return !job.techId && !job.holdingWindow && !job.scheduledStart;
}

type PlannedAllocation = { jobId: number; techId: string; startDate: string; endDate: string; order: number; reason: string };

function serviceM8Time(date: Date) {
  const safeDate = roundUpToQuarterHour(date);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(safeDate);
  const get = (type: string) => parts.find(part => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

type RoutePoint = { x: number; y: number };

function sydneyGridPoint(latitude?: number | null, longitude?: number | null): RoutePoint | null {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { x: (lng - 150.45) * 100, y: (-33.35 - lat) * 100 };
}

function routePoint(item: Job | Technician): RoutePoint {
  if ("suburb" in item) return sydneyGridPoint(item.latitude, item.longitude) || SUBURBS[item.suburb] || { x: 50, y: 50 };
  return sydneyGridPoint(item.latitude, item.longitude) || HOME[item.home] || item;
}

function routeDistance(from: RoutePoint, to: RoutePoint) {
  return distance(from, to);
}

function insertionRouteCost(previous: RoutePoint, candidate: RoutePoint, next?: RoutePoint) {
  const inbound = routeDistance(previous, candidate);
  if (!next) return inbound;
  const onward = routeDistance(candidate, next);
  const direct = Math.max(0.1, routeDistance(previous, next));
  const extraDistance = Math.max(0, inbound + onward - direct);
  const vectorX = next.x - previous.x;
  const vectorY = next.y - previous.y;
  const lengthSquared = Math.max(0.01, vectorX ** 2 + vectorY ** 2);
  const progress = ((candidate.x - previous.x) * vectorX + (candidate.y - previous.y) * vectorY) / lengthSquared;
  const reverseDistance = progress < 0 ? Math.abs(progress) * direct : progress > 1 ? (progress - 1) * direct : 0;
  return extraDistance * 2.2 + reverseDistance * 4 + inbound * .2;
}

function routeContinuityCost(tech: Technician, job: Job, route: Job[]) {
  const ordered = [...route].sort((a, b) => {
    const aStart = parseServiceM8Date(a.scheduledStart)?.getTime() || a.order;
    const bStart = parseServiceM8Date(b.scheduledStart)?.getTime() || b.order;
    return aStart - bStart;
  });
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= ordered.length; index += 1) {
    const previous = index === 0 ? routePoint(tech) : routePoint(ordered[index - 1]);
    const next = ordered[index] ? routePoint(ordered[index]) : undefined;
    best = Math.min(best, insertionRouteCost(previous, routePoint(job), next));
  }
  return Number.isFinite(best) ? best : routeDistance(routePoint(tech), routePoint(job));
}

function optimiseWaitingAllocations(dateKey: string, waiting: Job[], technicians: Technician[], allJobs: Job[]) {
  const priorityRank = (job: Job) =>
    job.priority === "Urgent" ? 0 : job.priority === "High" ? 1 : 2;

  const eligibleTechnicians = (job: Job) => technicians
    .filter(tech => {
      if (isCentralCoastJob(job) && !isJoel(tech)) return false;
      // These are sales/quote appointments. Standard jobs must remain routable
      // even when ServiceM8 has not stored trade skills against a salesperson.
      // Urgent work still requires both the correct skill and truck equipment.
      if (job.priority !== "Urgent") return true;
      return tech.skills.includes(job.requiredSkill)
        && (!job.requiredTool || tech.tools.includes(job.requiredTool));
    })
    .map(tech => tech.id);

  const toOptimizerJob = (job: Job, fixed: boolean): OptimizerJob => {
    const start = parseServiceM8Date(job.scheduledStart);
    const end = parseServiceM8Date(job.scheduledEnd);
    const startMinute = start ? start.getHours() * 60 + start.getMinutes() : null;
    const endMinute = end ? end.getHours() * 60 + end.getMinutes() : null;
    return {
      id: job.id,
      label: job.suburb || `Job #${job.id}`,
      point: routePoint(job),
      window: planningWindowName(job) === "AM 8-11" ? "AM" : "PM",
      priority: priorityRank(job),
      durationMinutes: fixed && startMinute != null && endMinute != null
        ? Math.max(30, endMinute - startMinute)
        : 30,
      eligibleTechIds: eligibleTechnicians(job),
      fixed,
      techId: fixed ? job.techId : null,
      fixedStartMinute: fixed ? startMinute : null,
      fixedEndMinute: fixed ? endMinute : null
    };
  };

  const plannerTechnicians = technicians.map(tech => ({
    id: tech.id,
    name: tech.name,
    start: routePoint(tech)
  }));
  const movableJobs = waiting
    .filter(job => !isOutsideServiceArea(job))
    .map(job => toOptimizerJob(job, false));
  const fixedJobs = allJobs
    .filter(job => Boolean(job.techId) && jobDateKey(job) === dateKey)
    .map(job => toOptimizerJob(job, true));
  const result = optimiseWholeDayRoutes({
    technicians: plannerTechnicians,
    movableJobs,
    fixedJobs,
    // Job count is a safety guard only. Real capacity is controlled by the
    // available booking windows, travel and whether the run can be scheduled.
    maxJobs: 12
  });

  const dateAtMinute = (minute: number) => {
    const date = new Date(`${dateKey}T00:00:00`);
    date.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    return date;
  };

  return result.plans.map(plan => ({
    jobId: plan.jobId,
    techId: plan.techId,
    startDate: serviceM8Time(dateAtMinute(plan.startMinute)),
    endDate: serviceM8Time(dateAtMinute(plan.endMinute)),
    order: plan.order,
    reason: plan.reason
  }));
}

function recommendation(tech: Technician, job: Job, jobs: Job[], options: RecommendationOptions = {}) {
  if (isOutsideServiceArea(job)) return { eligible: false, score: 0, eta: 0, reason: "Outside Sydney / Central Coast — manual review required", requiresMove: false, moveJob: null as Job | null };
  if (isCentralCoastJob(job) && !isJoel(tech)) return { eligible: false, score: 0, eta: 0, reason: "Central Coast jobs are assigned to Joel only", requiresMove: false, moveJob: null as Job | null };
  const enforceCapability = job.priority === "Urgent";
  const knownSkills = Array.isArray(tech.skills) && tech.skills.length > 0;
  const knownTools = Array.isArray(tech.tools) && tech.tools.length > 0;
  const missingSkill = enforceCapability && knownSkills && !tech.skills.includes(job.requiredSkill);
  const missingTool = enforceCapability && !!job.requiredTool && knownTools && !tech.tools.includes(job.requiredTool);
  if (missingSkill || missingTool) return { eligible: false, score: 0, eta: 0, reason: missingTool ? `Doesn’t carry ${job.requiredTool}` : `Missing ${job.requiredSkill} skill`, requiresMove: false, moveJob: null as Job | null };
  const sameDayStandard = job.priority !== "Urgent"
    && (options.sameDayRequested === true || jobDateKey(job) === sydneyDateKey());
  const routeDateKey = sameDayStandard ? sydneyDateKey() : jobDateKey(job);
  const dayJobs = jobs.filter(j => j.techId === tech.id && jobDateKey(j) === routeDateKey);
  const assigned = dayJobs.length;
  const sameDaySlot = sameDayStandard ? sameDayStandardSlot(tech, job, dayJobs) : null;
  const moveJob = null as Job | null;
  const previous = [...dayJobs].sort((a, b) => b.order - a.order)[0];
  const sameDayFrom = tech.latitude != null && tech.longitude != null
    ? tech
    : currentBooking(tech.id, dayJobs)?.job
      ? SUBURBS[currentBooking(tech.id, dayJobs)!.job.suburb] || tech
      : HOME[tech.home] || tech;
  const from = sameDayStandard ? sameDayFrom : previous ? SUBURBS[previous.suburb] || tech : HOME[tech.home] || tech;
  const to = SUBURBS[job.suburb] || { x: 50, y: 50 };
  const travel = liveDistance(tech, job, distance(from, to));
  const routeInsertCost = sameDaySlot && "addedTravel" in sameDaySlot ? sameDaySlot.addedTravel : routeContinuityCost(tech, job, dayJobs);
  const travelMinutes = Math.max(12, Math.round(10 + travel * 1.7));
  const activeBooking = job.priority === "Urgent" || sameDayStandard ? currentBooking(tech.id, dayJobs) : null;
  const remainingMinutes = activeBooking?.window ? Math.max(0, Math.ceil((activeBooking.window.end.getTime() - Date.now()) / 60000)) : 0;
  if (job.priority === "Urgent" && remainingMinutes > 60) {
    return { eligible: false, score: 0, eta: remainingMinutes + travelMinutes, reason: `Busy on job #${activeBooking?.job.id} until ${timeLabel(activeBooking!.window!.end)}`, requiresMove: false, moveJob: null as Job | null };
  }
  const urgency = job.priority === "Urgent" ? 22 : job.priority === "High" ? 12 : 5;
  const continuity = routeContinuityCost(tech, job, dayJobs);
  const consolidation = Math.min(14, assigned * 3);
  const score = job.priority === "Urgent"
    ? Math.max(35, Math.min(99, Math.round(99 - travel * 1.8 - remainingMinutes * .65)))
    : sameDayStandard
      ? Math.max(35, Math.min(99, Math.round(99 - routeInsertCost * 2.4 - remainingMinutes * .04)))
      : Math.max(35, Math.min(98, Math.round(97 - continuity * 1.6 + urgency + consolidation - 12)));
  const urgentReason = activeBooking?.window
    ? `Available after job #${activeBooking.job.id} finishes at ${timeLabel(activeBooking.window.end)}`
    : "Available now — closest realistic arrival";
  const requestedWindowEnd = sameDaySlot ? new Date(`${routeDateKey}T${String(sameDaySlot.requested.endHour).padStart(2, "0")}:00:00`) : null;
  const sameDayMoveNote = sameDaySlot && "movedCount" in sameDaySlot && sameDaySlot.movedCount
    ? ` · pushes ${sameDaySlot.movedCount} standard job${sameDaySlot.movedCount === 1 ? "" : "s"} back`
    : "";
  const sameDayGapReason = sameDaySlot
    ? sameDaySlot.start.getTime() <= (requestedWindowEnd?.getTime() || 0)
      ? `Whole-day insertion after ${sameDaySlot.previousLabel}${sameDaySlot.nextLabel ? ` before ${sameDaySlot.nextLabel}` : ""} · ${timeLabel(sameDaySlot.start)}–${timeLabel(sameDaySlot.end)}${sameDayMoveNote} · lowest added travel`
      : `Whole-day insertion after ${sameDaySlot.previousLabel}${sameDaySlot.nextLabel ? ` before ${sameDaySlot.nextLabel}` : ""} · after ${sameDaySlot.requested.label}: ${timeLabel(sameDaySlot.start)}–${timeLabel(sameDaySlot.end)}${sameDayMoveNote} · lowest added travel`
    : "";
  const reason = sameDaySlot
    ? sameDayGapReason
    : assigned === 0
        ? sameDayStandard
          ? `Whole-day route checked · available after travel from ${tech.home}`
          : `Starts from ${tech.home}`
        : job.priority === "Urgent"
          ? `${urgentReason} · ${assigned} job${assigned === 1 ? "" : "s"} already booked`
          : sameDayStandard
            ? `Whole-day route checked · next available after current run · ${assigned} job${assigned === 1 ? "" : "s"} already booked`
          : `${assigned} booked · adds to the existing run without backtracking`;
  const slotEta = sameDaySlot ? Math.max(0, Math.ceil((sameDaySlot.start.getTime() - Date.now()) / 60000)) : remainingMinutes + travelMinutes;
  return { eligible: true, score, eta: slotEta, reason, requiresMove: !!moveJob, moveJob, plannedStart: sameDaySlot?.start || null, plannedEnd: sameDaySlot?.end || null, plannedOrder: sameDaySlot?.plannedOrder || null };
}

export default function Home() {
  const [page, setPage] = useState<"Routes" | "Runs" | "Jobs" | "Settings">("Routes");
  const [techs, setTechs] = useState<Technician[]>(INITIAL_TECHS);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tools, setTools] = useState<string[]>(DEFAULT_TOOLS);
  const [centralCoastEnabled, setCentralCoastEnabled] = useState(true);
  const [newJob, setNewJob] = useState(false);
  const [review, setReview] = useState<Job | null>(null);
  const [editTech, setEditTech] = useState<Technician | null>(null);
  const [addTech, setAddTech] = useState(false);
  const [toast, setToast] = useState("");
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [mapsKey, setMapsKey] = useState("");
  const [boardTechIds, setBoardTechIds] = useState<string[]>([]);
  const [manageBoard, setManageBoard] = useState(false);
  const [lastSynced, setLastSynced] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [boardView, setBoardView] = useState<"dispatch" | "map">("dispatch");
  const [queueWorkspace, setQueueWorkspace] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => sydneyDateKey());
  const [autoRouteQueue, setAutoRouteQueue] = useState<PlannedAllocation[]>([]);
  const [activeAutoRoutePlan, setActiveAutoRoutePlan] = useState<PlannedAllocation | null>(null);
  const [autoRouteTotal, setAutoRouteTotal] = useState(0);
  const [autoRouteCompleted, setAutoRouteCompleted] = useState(0);
  const [routeBookingError, setRouteBookingError] = useState("");
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const pendingBookingRef = useRef<PendingBookingCommit | null>(null);
  const [jobCardMode, setJobCardMode] = useState(false);
  const focusedJobUUID = useRef<string | null>(null);
  const focusedJobOpened = useRef(false);
  const [settingsPin, setSettingsPin] = useState("");
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState("Shared settings loading…");
  const sharedSettingsRef = useRef<SharedSettings | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setEmbedded(window.self !== window.top || params.get("servicem8") === "1");
      focusedJobUUID.current = params.get("jobUUID") || params.get("job_uuid");
      setJobCardMode(Boolean(focusedJobUUID.current));
    } catch {}
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) {
        const d = JSON.parse(saved);
        const savedTechs = d.techs || INITIAL_TECHS;
        setTechs(mergeSharedSettingsIntoTechs(savedTechs, sharedSettingsRef.current));
        setJobs((d.jobs || []).map(normaliseRoutingJob));
        setTools(d.tools || DEFAULT_TOOLS);
        setBoardTechIds(d.boardTechIds || []);
        const coastEnabled = d.centralCoastEnabled !== false;
        setCentralCoastEnabled(coastEnabled);
        localStorage.setItem(CENTRAL_COAST_SETTING, String(coastEnabled));
      }
    } catch {}
    void loadSharedSettings();
    setLoaded(true);
  }, []);
  useEffect(() => {
    const receiveServiceM8 = (message: MessageEvent) => {
      if (message.source !== window.parent) return;
      const data = message.data;
      if (!data) return;
      if (data.source === "auto-route-booked") {
        setBookingResult({ status: "success", jobUUID: String(data.jobUUID || ""), message: "", nonce: Date.now() });
        return;
      }
      if (data.source === "auto-route-booking-error") {
        setBookingResult({ status: "error", jobUUID: String(data.jobUUID || ""), message: String(data.message || "ServiceM8 rejected the booking"), nonce: Date.now() });
        return;
      }
      if (data.source !== "servicem8-auto-route" || !Array.isArray(data.jobs)) return;
      const incomingJobs = data.jobs.map(normaliseRoutingJob);
      setJobs(incomingJobs);
      const requestedJobUUID = String(data.focusJobUUID || focusedJobUUID.current || "").trim();
      if (requestedJobUUID && !focusedJobOpened.current) {
        const selectedJob = incomingJobs.find((job: Job) => String(job.serviceM8UUID || "") === requestedJobUUID);
        if (selectedJob) {
          focusedJobOpened.current = true;
          setJobCardMode(true);
          setSelectedDate(jobDateKey(selectedJob));
        }
      }
      if (typeof data.syncedAt === "string") setLastSynced(data.syncedAt);
      setSyncing(false);
      if (typeof data.googleMapsKey === "string") setMapsKey(data.googleMapsKey);
      if (Array.isArray(data.technicians) && data.technicians.length) {
        setTechs(current => {
          const colors = ["#1677ff", "#ef4444", "#7c3aed", "#0f9f6e", "#f59e0b", "#0891b2", "#db2777", "#475569"];
          const liveTechs = data.technicians.map((person: any, index: number) => {
            const latitude = Number(person.latitude);
            const longitude = Number(person.longitude);
            const validGps = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 && !(latitude === 0 && longitude === 0);
            const existing = current.find(t => t.id === person.id || t.name.toLowerCase() === String(person.name).toLowerCase());
            return {
              id: person.id,
              name: person.name,
              home: existing?.home || person.home || "Sydney",
              vehicle: existing?.vehicle || "Service vehicle",
              status: person.status || "Available",
              skills: existing?.skills || ["General Plumbing"],
              tools: existing?.tools || [],
              color: existing?.color || colors[index % colors.length],
              x: existing?.x || 50,
              y: existing?.y || 50,
              latitude: validGps ? latitude : null,
              longitude: validGps ? longitude : null
              ,holding: Boolean(person.holding)
            } as Technician;
          });
          return mergeSharedSettingsIntoTechs(liveTechs, sharedSettingsRef.current);
        });
        setBoardTechIds(current => current.length ? current : data.technicians.filter((person: any) => !person.holding).map((person: any) => person.id));
      }
      setLiveConnected(true);
      setLoaded(true);
    };
    window.addEventListener("message", receiveServiceM8);
    window.parent?.postMessage({ source: "auto-route-ready" }, "*");
    return () => window.removeEventListener("message", receiveServiceM8);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem(STORAGE, JSON.stringify({ techs, jobs, tools, boardTechIds, centralCoastEnabled })); }, [techs, jobs, tools, boardTechIds, centralCoastEnabled, loaded]);
  const boardTechs = techs.filter(t => !t.holding && (boardTechIds.length === 0 || boardTechIds.includes(t.id)));
  const boardJobs = jobs.filter(j => !j.techId || boardTechIds.length === 0 || boardTechIds.includes(j.techId));
  const visibleBoardJobs = boardJobs.filter(job => jobDateKey(job) === selectedDate);
  const urgentCount = visibleBoardJobs.filter(j => j.priority === "Urgent").length;
  const assignedCount = boardJobs.filter(j => j.techId).length;
  const showToast = (text: string) => { setToast(text); window.setTimeout(() => setToast(""), 2500); };
  const applySharedSettings = (settings: SharedSettings) => {
    const normalised = normaliseSharedSettings(settings);
    const updatedAt = normalised.updatedAt ? new Date(normalised.updatedAt) : null;
    sharedSettingsRef.current = normalised;
    setTools(normalised.tools);
    setCentralCoastEnabled(normalised.centralCoastEnabled);
    localStorage.setItem(CENTRAL_COAST_SETTING, String(normalised.centralCoastEnabled));
    setTechs(current => mergeSharedSettingsIntoTechs(current.length ? current : INITIAL_TECHS, normalised));
    setSettingsStatus(updatedAt && Number.isFinite(updatedAt.getTime()) ? `Shared settings loaded · ${timeLabel(updatedAt)}` : "Shared settings loaded");
  };
  const loadSharedSettings = async () => {
    try {
      const response = await fetch(SETTINGS_API, { cache: "no-store" });
      if (!response.ok) throw new Error("Settings unavailable");
      applySharedSettings(await response.json());
    } catch {
      setSettingsStatus("Shared settings unavailable · using this browser until Railway is fixed");
    }
  };
  const buildSharedSettings = (nextTechs = techs, nextTools = tools, nextCentralCoastEnabled = centralCoastEnabled): SharedSettings => normaliseSharedSettings({
    version: 1,
    centralCoastEnabled: nextCentralCoastEnabled,
    tools: nextTools,
    technicianOverrides: nextTechs.filter(tech => !tech.holding).map(tech => ({
      id: tech.id,
      name: tech.name,
      home: tech.home,
      vehicle: tech.vehicle,
      skills: tech.skills,
      tools: tech.tools,
      color: tech.color,
      x: tech.x,
      y: tech.y,
      holding: tech.holding
    }))
  });
  const saveSharedSettings = async (nextTechs: Technician[], nextTools: string[], nextCentralCoastEnabled: boolean, message: string) => {
    if (!settingsUnlocked) {
      showToast("Unlock Settings with the owner PIN first");
      return;
    }
    const settings = buildSharedSettings(nextTechs, nextTools, nextCentralCoastEnabled);
    try {
      const response = await fetch(SETTINGS_API, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-admin-pin": settingsPin },
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error(await response.text());
      applySharedSettings(await response.json());
      showToast(message);
    } catch {
      showToast("Shared settings did not save. Check Railway variables and PIN.");
      setSettingsStatus("Save failed · shared settings unchanged");
    }
  };
  const unlockSettings = async () => {
    try {
      const response = await fetch(SETTINGS_API, { method: "POST", headers: { "x-admin-pin": settingsPin } });
      if (!response.ok) throw new Error("Wrong PIN");
      setSettingsUnlocked(true);
      applySharedSettings(await response.json());
      showToast("Owner settings unlocked");
    } catch {
      setSettingsUnlocked(false);
      showToast("Wrong admin PIN");
    }
  };
  const syncServiceM8 = () => {
    setSyncing(true);
    window.parent?.postMessage({ source: "auto-route-refresh" }, "*");
    window.setTimeout(() => setSyncing(false), 12000);
  };
  const startAutoRouteQueue = (plans: PlannedAllocation[]) => {
    pendingBookingRef.current = null;
    setActiveAutoRoutePlan(null);
    setBookingResult(null);
    setRouteBookingError("");
    setAutoRouteCompleted(0);
    setAutoRouteTotal(plans.length);
    setAutoRouteQueue(plans);
  };
  const routeAllocationWindow = (windowName: string) => {
    const waiting = visibleBoardJobs.filter(job => job.holdingWindow === windowName && !job.techId);
    const plans = optimiseWaitingAllocations(selectedDate, waiting, boardTechs, visibleBoardJobs);
    startAutoRouteQueue(plans);
    if (!plans.length) showToast(`No suitable ${windowName} route fits today`);
  };
  const selectedDayRouteCandidates = visibleBoardJobs.filter(job =>
    (!job.techId && Boolean(job.holdingWindow)) || isFutureStandardReplanCandidate(job, selectedDate)
  );
  const autoRouteSelectedDay = () => {
    const candidateIds = new Set(selectedDayRouteCandidates.map(job => job.id));
    const planningJobs = selectedDayRouteCandidates.map(job => ({
      ...job,
      holdingWindow: planningWindowName(job)
    }));
    const fixedJobs = visibleBoardJobs.filter(job => !candidateIds.has(job.id));
    const plans = optimiseWaitingAllocations(selectedDate, planningJobs, boardTechs, fixedJobs);
    startAutoRouteQueue(plans);
    if (!plans.length) showToast("No suitable route fits the selected allocation windows");
  };
  const allocateWaitingJob = (jobId: number, windowName: string) => {
    const job = jobs.find(item => item.id === jobId);
    if (!job) return;
    if (isOutsideServiceArea(job)) {
      showToast(`Job #${job.id} is outside Sydney / Central Coast and cannot be allocated`);
      return;
    }
    const holdingTech = techs.find(tech => {
      if (!tech.holding) return false;
      const digits = tech.name.replace(/[^0-9]/g, "");
      return windowName === "AM 8-11" ? digits.includes("811") : digits.includes("124");
    });
    if (!holdingTech) {
      showToast(`Sync ServiceM8 again so the ${windowName === "AM 8-11" ? "8–11" : "12–4"} allocation lane is available`);
      return;
    }
    const hour = windowName === "AM 8-11" ? 8 : 12;
    const start = new Date(`${selectedDate}T${String(hour).padStart(2, "0")}:00:00`);
    const end = new Date(start.getTime() + 30 * 60000);
    const startDate = serviceM8Time(start);
    const endDate = serviceM8Time(end);
    window.parent?.postMessage({
      source: "auto-route-book",
      jobUUID: job.serviceM8UUID || null,
      staffUUID: holdingTech.id,
      startDate,
      endDate,
      activityUUID: job.activityUUID || null,
      allocationUUID: job.allocationUUID || null,
      shiftActivities: []
    }, "*");
    setJobs(current => current.map(item => item.id === jobId ? {
      ...item,
      techId: null,
      holdingWindow: windowName,
      scheduledDate: selectedDate,
      scheduledStart: startDate,
      scheduledEnd: endDate,
      isActionRequired: false,
      queueName: "Allocation"
    } : item));
    showToast(`Job #${job.id} moved to ${windowName === "AM 8-11" ? "8–11 AM" : "12–4 PM"} on ${new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" }).format(start)}`);
  };
  const returnWaitingJob = (jobId: number) => {
    const job = jobs.find(item => item.id === jobId);
    if (!job || job.techId || !job.holdingWindow) return;
    window.parent?.postMessage({
      source: "auto-route-unallocate",
      jobUUID: job.serviceM8UUID || null,
      activityUUID: job.activityUUID || null,
      allocationUUID: job.allocationUUID || null
    }, "*");
    setJobs(current => current.map(item => item.id === jobId ? {
      ...item,
      holdingWindow: null,
      scheduledDate: undefined,
      scheduledStart: undefined,
      scheduledEnd: undefined,
      isActionRequired: true,
      queueName: "Action Required"
    } : item));
    showToast(`Job #${job.id} returned to Jobs Waiting to Book`);
  };
  const assign = (job: Job, techId: string, options: RecommendationOptions = {}): PendingBookingCommit | null => {
    const tech = techs.find(t => t.id === techId)!;
    if (isOutsideServiceArea(job)) {
      showToast(isCentralCoastJob(job) && !centralCoastRoutingEnabled() ? "Central Coast routing is switched off in Settings" : "This job is outside the active service area");
      return null;
    }
    if (job.techId && job.techId !== techId && !job.activityUUID) {
      showToast("This booking cannot be moved safely because its ServiceM8 activity is missing. Sync ServiceM8 and try again.");
      return null;
    }
    if (isCentralCoastJob(job) && !isJoel(tech)) {
      showToast("Central Coast jobs can only be booked to Joel");
      return null;
    }
    const sameDayRequested = options.sameDayRequested === true
      || (job.priority !== "Urgent" && jobDateKey(job) === sydneyDateKey());
    const routeCheck = recommendation(tech, job, jobs.filter(j => j.id !== job.id), { ...options, sameDayRequested });
    if (sameDayRequested && !routeCheck.eligible) {
      showToast(routeCheck.reason || "No practical same-day route is available");
      return null;
    }
    const routeDateKey = sameDayRequested ? sydneyDateKey() : jobDateKey(job);
    const sameDay = jobs.filter(j => j.techId === techId && jobDateKey(j) === routeDateKey && j.id !== job.id);
    const sameDayOrder = "plannedOrder" in routeCheck ? routeCheck.plannedOrder : null;
    const order = sameDayRequested && sameDayOrder
      ? sameDayOrder
      : options.plannedRoute && job.plannedOrder
      ? job.plannedOrder
      : job.priority === "Urgent" ? 1 : sameDay.length + 1;
    const respectAllocation = Boolean(job.holdingWindow) && !sameDayRequested;
    const allocationStart = job.holdingWindow ? new Date(`${jobDateKey(job)}T${job.holdingWindow === "AM 8-11" ? "08:00:00" : "12:00:00"}`) : null;
    const plannedStart = parseServiceM8Date(job.scheduledStart);
    const plannedEnd = parseServiceM8Date(job.scheduledEnd);
    const sameDayStart = "plannedStart" in routeCheck ? routeCheck.plannedStart : null;
    const sameDayEnd = "plannedEnd" in routeCheck ? routeCheck.plannedEnd : null;
    let start = sameDayRequested && sameDayStart
      ? sameDayStart
      : respectAllocation
      ? roundUpToQuarterHour(plannedStart || allocationStart!)
      : (job.priority === "Urgent" || sameDayRequested || !job.scheduledStart)
      ? roundUpToQuarterHour(new Date(Date.now() + ((job.priority === "Urgent" || sameDayRequested) ? routeCheck.eta : 5) * 60000))
      : roundUpToQuarterHour(plannedStart || new Date());
    const bookingDuration = Math.max(30, job.duration || 30);
    let end = sameDayRequested && sameDayEnd
      ? sameDayEnd
      : bookingEnd(start, (respectAllocation || (job.priority !== "Urgent" && job.scheduledEnd)) ? plannedEnd : null, bookingDuration);
    if (job.priority === "Urgent" && !respectAllocation) {
      const buffer = 15 * 60000;
      const pinnedUrgentJobs = sameDay
        .filter(existing => existing.priority === "Urgent" && !String(existing.jobStatus || "").toLowerCase().includes("complete"))
        .map(existing => scheduledWindow(existing))
        .filter((window): window is { start: Date; end: Date } => Boolean(window))
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      for (const window of pinnedUrgentJobs) {
        const clashes = window.start.getTime() < end.getTime() + buffer && window.end.getTime() > start.getTime() - buffer;
        if (clashes) {
          start = roundUpToQuarterHour(new Date(window.end.getTime() + buffer));
          end = bookingEnd(start, null, bookingDuration);
        }
      }
    }
    const shiftActivities = (() => {
      const shifts: Array<{ activityUUID: string; jobUUID: string; staffUUID: string; startDate: string; endDate: string }> = [];
      if (sameDayRequested && !respectAllocation) {
        let occupiedUntil = end.getTime();
        let previousPoint = routePoint(job);
        const activeJobId = currentBooking(techId, sameDay)?.job.id;
        const future = sameDay
          .filter(existing => {
            const window = scheduledWindow(existing);
            return existing.id !== activeJobId
              && existing.priority !== "Urgent"
              && existing.activityUUID
              && window
              && window.end.getTime() > start.getTime();
          })
          .sort((a, b) => {
            const aWindow = scheduledWindow(a);
            const bWindow = scheduledWindow(b);
            return (aWindow?.start.getTime() || Number(a.order || 999)) - (bWindow?.start.getTime() || Number(b.order || 999));
          });

        for (const existing of future) {
          const window = scheduledWindow(existing);
          if (!window) continue;
          const travelMinutesToNext = Math.max(10, Math.round(routeDistance(previousPoint, routePoint(existing)) * 1.7));
          const earliestStart = roundUpToQuarterHour(new Date(occupiedUntil + (15 + travelMinutesToNext) * 60000));
          const shiftedStart = earliestStart.getTime() > window.start.getTime() ? earliestStart : window.start;
          const shiftedEnd = bookingEnd(
            shiftedStart,
            new Date(window.end.getTime() + Math.max(0, shiftedStart.getTime() - window.start.getTime())),
            existing.duration
          );

          if (shiftedStart.getTime() > window.start.getTime()) {
            shifts.push({
              activityUUID: existing.activityUUID!,
              jobUUID: existing.serviceM8UUID || "",
              staffUUID: techId,
              startDate: serviceM8Time(shiftedStart),
              endDate: serviceM8Time(shiftedEnd)
            });
          }
          occupiedUntil = shiftedEnd.getTime();
          previousPoint = routePoint(existing);
        }
        return shifts;
      }
      if (job.priority !== "Urgent" || respectAllocation) return [];
      const travelBuffer = 15 * 60000;
      let occupiedUntil = end.getTime() + travelBuffer;
      const activeJobId = currentBooking(techId, sameDay)?.job.id;
      const future = sameDay
        .filter(existing => {
          const window = scheduledWindow(existing);
          return existing.id !== activeJobId && existing.priority !== "Urgent" && existing.activityUUID && window && window.end.getTime() > start.getTime();
        })
        .sort((a, b) => (scheduledWindow(a)?.start.getTime() || 0) - (scheduledWindow(b)?.start.getTime() || 0));
      for (const existing of future) {
        const window = scheduledWindow(existing);
        if (!window || window.start.getTime() >= occupiedUntil) continue;
        const shiftedStart = roundUpToQuarterHour(new Date(window.start.getTime() + 60 * 60000));
        const shiftedEnd = bookingEnd(shiftedStart, new Date(window.end.getTime() + 60 * 60000), existing.duration);
        shifts.push({
          activityUUID: existing.activityUUID!,
          jobUUID: existing.serviceM8UUID || "",
          staffUUID: techId,
          startDate: serviceM8Time(shiftedStart),
          endDate: serviceM8Time(shiftedEnd)
        });
        occupiedUntil = shiftedEnd.getTime() + travelBuffer;
      }
      return shifts;
    })();
    const shiftedActivities = new Map(shiftActivities.map(activity => [activity.activityUUID, activity]));
    const startDate = serviceM8Time(start);
    const endDate = serviceM8Time(end);
    window.parent?.postMessage({ source: "auto-route-book", jobUUID: job.serviceM8UUID || null, staffUUID: techId, startDate, endDate, activityUUID: job.activityUUID || null, allocationUUID: job.allocationUUID || null, shiftActivities, reloadAfterBooking: options.reloadAfterBooking !== false }, "*");
    const commit = () => setJobs(all => all.map(j => {
      if (routeCheck.moveJob && j.id === routeCheck.moveJob.id) return { ...j, bookingDay: "Tomorrow" as BookingDay, order: jobs.filter(x => x.techId === techId && x.bookingDay === "Tomorrow").length + 1 };
      if (sameDayRequested && j.id !== job.id && j.techId === techId && jobDateKey(j) === routeDateKey && Number(j.order || 0) >= order) {
        const shifted = shiftedActivities.get(j.activityUUID || "");
        return { ...j, order: Number(j.order || 0) + 1, scheduledStart: shifted?.startDate || j.scheduledStart, scheduledEnd: shifted?.endDate || j.scheduledEnd };
      }
      if (job.priority === "Urgent" && !respectAllocation && j.techId === techId && jobDateKey(j) === jobDateKey(job) && j.id !== job.id) {
        const shifted = shiftedActivities.get(j.activityUUID || "");
        return { ...j, order: j.order + 1, scheduledStart: shifted?.startDate || j.scheduledStart, scheduledEnd: shifted?.endDate || j.scheduledEnd };
      }
      return j.id === job.id ? { ...j, techId, order, duration: bookingDuration, scheduledStart: startDate, scheduledEnd: endDate, routeReason: job.routeReason } : j;
    }));
    if (!options.deferCommit) commit();
    setReview(null); setPage("Routes");
    showToast(options.deferCommit ? `Saving job #${job.id} with ${tech.name} in ServiceM8…` : sameDayRequested ? `Same-day job inserted into ${tech.name}’s run at ${timeLabel(start)}.` : respectAllocation ? `Booking job #${job.id} in its ${job.holdingWindow} allocation with ${tech.name}.` : job.priority === "Urgent" ? shiftActivities.length ? `Urgent job sent to ${tech.name}; ${shiftActivities.length} conflicting booking${shiftActivities.length === 1 ? "" : "s"} moved one hour.` : `Urgent job fits on ${tech.name}’s run without moving later bookings.` : `Booking job #${job.id} with ${tech.name} in ServiceM8…`);
    return { jobId: job.id, jobUUID: String(job.serviceM8UUID || ""), techName: tech.name, commit };
  };
  useEffect(() => {
    if (activeAutoRoutePlan || !autoRouteQueue.length) return;
    const plan = autoRouteQueue[0];
    const routedJob = jobs.find(item => item.id === plan.jobId);
    if (!routedJob) {
      setRouteBookingError(`Job #${plan.jobId} disappeared during routing. Sync ServiceM8 and try again.`);
      setAutoRouteQueue([]);
      return;
    }
    setActiveAutoRoutePlan(plan);
    const pending = assign({ ...routedJob, scheduledStart: plan.startDate, scheduledEnd: plan.endDate, plannedOrder: plan.order, routeReason: plan.reason }, plan.techId, { plannedRoute: true, deferCommit: true, reloadAfterBooking: autoRouteQueue.length === 1 });
    if (!pending) {
      setRouteBookingError(`Job #${plan.jobId} could not be sent to ServiceM8.`);
      setAutoRouteQueue([]);
      setActiveAutoRoutePlan(null);
      return;
    }
    pendingBookingRef.current = pending;
  }, [autoRouteQueue, activeAutoRoutePlan]);
  useEffect(() => {
    if (!bookingResult || !activeAutoRoutePlan) return;
    const pending = pendingBookingRef.current;
    if (!pending) return;
    if (bookingResult.status === "success") {
      if (bookingResult.jobUUID && pending.jobUUID && bookingResult.jobUUID !== pending.jobUUID) return;
      pending.commit();
      const completed = autoRouteCompleted + 1;
      setAutoRouteCompleted(completed);
      setAutoRouteQueue(current => current[0]?.jobId === pending.jobId ? current.slice(1) : current.filter(plan => plan.jobId !== pending.jobId));
      setActiveAutoRoutePlan(null);
      pendingBookingRef.current = null;
      setBookingResult(null);
      showToast(completed === autoRouteTotal ? `All ${autoRouteTotal} jobs saved in ServiceM8.` : `Saved job #${pending.jobId}. Booking ${completed + 1} of ${autoRouteTotal}…`);
      return;
    }
    setRouteBookingError(`Stopped after job #${pending.jobId}: ${bookingResult.message}. No later jobs were sent.`);
    setAutoRouteQueue([]);
    setActiveAutoRoutePlan(null);
    pendingBookingRef.current = null;
    setBookingResult(null);
  }, [bookingResult, activeAutoRoutePlan, autoRouteCompleted, autoRouteTotal]);
  useEffect(() => {
    if (!activeAutoRoutePlan) return;
    const timer = window.setTimeout(() => {
      const pending = pendingBookingRef.current;
      if (!pending || pending.jobId !== activeAutoRoutePlan.jobId) return;
      setRouteBookingError(`ServiceM8 did not confirm job #${pending.jobId}. The queue was stopped to prevent duplicate bookings. Press Sync ServiceM8 before retrying.`);
      setAutoRouteQueue([]);
      setActiveAutoRoutePlan(null);
      pendingBookingRef.current = null;
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [activeAutoRoutePlan]);
  const removeAllJobs = () => { setJobs([]); setSelectedTech(null); showToast("All test jobs cleared") };

  const jobCardJob = focusedJobUUID.current
    ? boardJobs.find(job => String(job.serviceM8UUID || "") === focusedJobUUID.current)
    : null;

  if (jobCardMode) {
    return <JobCardDecision
      job={jobCardJob || null}
      jobs={boardJobs}
      techs={boardTechs}
      mapsKey={mapsKey}
      connected={liveConnected}
      syncing={syncing}
      sync={syncServiceM8}
      assign={assign}
      openDashboard={() => setJobCardMode(false)}
      toast={toast}
    />;
  }

  return <div className="desktop-app">
    {toast && <div className="toast">✓ {toast}</div>}
    <aside className="sidebar">
      <div className="brand">
        <img className="brand-logo" src="/sdhs-brand-logo.jpeg" alt="Same Day Home Services" width="48" height="48" />
        <div><b>SAME DAY</b><small>HOME SERVICES</small></div>
      </div>
      <div className="nav-label">ADMIN TOOLS</div>
      <nav>
        <button className={page === "Routes" ? "active" : ""} onClick={() => setPage("Routes")}><span>Auto Route</span></button>
        <button className={page === "Runs" ? "active" : ""} onClick={() => setPage("Runs")}><span>Technician Runs</span></button>
        <button className={page === "Jobs" ? "active" : ""} onClick={() => setPage("Jobs")}><span>Today’s Jobs</span><em>{jobs.length}</em></button>
        <button className={page === "Settings" ? "active" : ""} onClick={() => {
          setSettingsUnlocked(false);
          setSettingsPin("");
          setPage("Settings");
        }}><span>Settings</span></button>
      </nav>
      <div className="sidebar-help"><b>{liveConnected ? "Manual dispatch sync" : "Connecting"}</b><p>{liveConnected ? "Press Sync ServiceM8 whenever you want to refresh jobs and technician locations." : "Waiting for live ServiceM8 data."}</p></div>
      <div className="admin-user"><span>AM</span><div><b>Ayman</b><small>Administrator</small></div></div>
    </aside>

    <main className="content">
      <header className="topbar">
        <div><span className="today">{new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase()}</span><h1>{page === "Routes" ? "Auto Route" : page === "Runs" ? "Technician Runs" : page === "Jobs" ? "Today’s Jobs" : "Technicians & Tools"}</h1><p>{page === "Routes" ? "Plan waiting jobs around real bookings, travel time and technician skills." : page === "Runs" ? "View each technician’s complete daily route separately." : page === "Jobs" ? "Review every job added for today." : "Control exactly what each technician can do and carries in their truck."}</p></div>
        <div className="top-actions">{page === "Routes" && <><button className="sync-button" onClick={syncServiceM8} disabled={syncing}>{syncing ? "Syncing…" : "↻ Sync ServiceM8"}</button><button className="board-button" onClick={() => setManageBoard(true)}>Manage live board <b>{boardTechs.length}</b></button></>}{page !== "Settings" && page !== "Routes" ? <button className="add-job" onClick={() => setNewJob(true)}>＋ Add New Job</button> : page === "Settings" && settingsUnlocked ? <button className="add-job" onClick={() => setAddTech(true)}>＋ Add Technician</button> : null}</div>
      </header>
      <section className="connection-banner" aria-label="ServiceM8 connection status">
        <span className="connection-icon">S8</span>
        <div><b>{liveConnected ? "Live ServiceM8 jobs connected" : embedded ? "Opened from ServiceM8" : "ServiceM8 add-on ready"}</b><p>{liveConnected ? `${jobs.length} appointment${jobs.length === 1 ? "" : "s"} loaded across Quotes and Work Orders · Last synced ${lastSynced ? new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(lastSynced)) : "just now"}` : "Waiting for ServiceM8 to send the complete sales runs."}</p></div>
        <em>{liveConnected ? "LIVE DATA" : "CONNECTING"}</em>
      </section>

      {page === "Routes" && <section className="dispatch-shell">
        <DatePlanner selectedDate={selectedDate} select={setSelectedDate} live={liveConnected} />
        <div className="dispatch-toolbar">
          <div><button className={boardView === "dispatch" ? "active" : ""} onClick={() => setBoardView("dispatch")}>Dispatch Board</button><button className={boardView === "map" ? "active" : ""} onClick={() => setBoardView("map")}>Live Map</button></div>
          <div className="day-actions"><p><b>{visibleBoardJobs.length}</b> booked <span>•</span> <b>{visibleBoardJobs.filter(j => !j.techId).length}</b> waiting <span>•</span> <strong>{urgentCount} urgent</strong></p><button className="queue-workspace-button" onClick={() => setQueueWorkspace(true)}>Open booking workspace</button><button className="auto-route-day" disabled={autoRouteQueue.length > 0 || selectedDayRouteCandidates.length === 0} onClick={autoRouteSelectedDay}>{autoRouteQueue.length ? `Saving ${Math.min(autoRouteCompleted + 1, autoRouteTotal)} of ${autoRouteTotal}…` : "Auto Route This Day"}</button></div>
        </div>
        {routeBookingError && <div className="route-booking-error" role="alert"><div><b>ServiceM8 booking stopped</b><span>{routeBookingError}</span></div><button onClick={() => { setRouteBookingError(""); syncServiceM8(); }}>Sync ServiceM8</button></div>}
        {boardView === "dispatch" ? <ServiceM8DispatchBoard techs={boardTechs} jobs={visibleBoardJobs} waitingJobs={boardJobs} review={setReview} selectedDate={selectedDate} routing={autoRouteQueue.length > 0} routeAllocationWindow={routeAllocationWindow} allocateWaitingJob={allocateWaitingJob} returnWaitingJob={returnWaitingJob} /> : <div className="dispatch-map"><GoogleRouteMap apiKey={mapsKey} techs={boardTechs} jobs={visibleBoardJobs} review={setReview} /></div>}
      </section>}

      {page === "Jobs" && <JobsPage jobs={boardJobs} techs={boardTechs} add={() => setNewJob(true)} review={setReview} remove={id => { setJobs(x => x.filter(j => j.id !== id)); showToast(`Job #${id} removed`) }} />}
      {page === "Runs" && <RunsPage techs={boardTechs} jobs={boardJobs} add={() => setNewJob(true)} review={setReview} />}
      {page === "Settings" && <Settings
        techs={techs}
        tools={tools}
        centralCoastEnabled={centralCoastEnabled}
        settingsUnlocked={settingsUnlocked}
        settingsPin={settingsPin}
        settingsStatus={settingsStatus}
        setSettingsPin={setSettingsPin}
        unlockSettings={unlockSettings}
        toggleCentralCoast={() => {
          const enabled = !centralCoastEnabled;
          localStorage.setItem(CENTRAL_COAST_SETTING, String(enabled));
          setCentralCoastEnabled(enabled);
          void saveSharedSettings(techs, tools, enabled, `Central Coast routing switched ${enabled ? "on" : "off"} for everyone`);
        }}
        edit={setEditTech}
        addTech={() => setAddTech(true)}
        addTool={tool => {
          const cleaned = tool.trim();
          if (cleaned && !tools.includes(cleaned)) {
            const nextTools = [...tools, cleaned];
            setTools(nextTools);
            void saveSharedSettings(techs, nextTools, centralCoastEnabled, `${cleaned} added to shared tools list`);
          }
        }}
        removeTool={tool => {
          const nextTools = tools.filter(x => x !== tool);
          const nextTechs = techs.map(t => ({ ...t, tools: t.tools.filter(x => x !== tool) }));
          setTools(nextTools);
          setTechs(nextTechs);
          void saveSharedSettings(nextTechs, nextTools, centralCoastEnabled, `${tool} removed from shared tools list`);
        }}
      />}
    </main>

    {newJob && <JobForm close={() => setNewJob(false)} create={job => { setJobs(x => [...x, job]); setNewJob(false); setReview(job); }} />}
    {review && <Allocation job={review} jobs={boardJobs} techs={boardTechs} close={() => setReview(null)} assign={assign} />}
    {editTech && <TechnicianForm tech={editTech} tools={tools} close={() => setEditTech(null)} save={tech => { const nextTechs = techs.map(t => t.id === tech.id ? tech : t); setTechs(nextTechs); setEditTech(null); void saveSharedSettings(nextTechs, tools, centralCoastEnabled, `${tech.name}’s truck setup saved for everyone`); }} />}
    {addTech && <TechnicianForm tools={tools} close={() => setAddTech(false)} save={tech => { const nextTechs = [...techs, tech]; setTechs(nextTechs); setBoardTechIds(ids => ids.length ? [...ids, tech.id] : ids); setAddTech(false); void saveSharedSettings(nextTechs, tools, centralCoastEnabled, `${tech.name} added to shared live board settings`); }} />}
    {manageBoard && <div className="modal-overlay"><section className="board-modal"><header><div><h2>Select sales technicians</h2><p>Only the technicians switched on here can receive Auto Route bookings.</p></div><button onClick={() => setManageBoard(false)}>×</button></header><div>{techs.filter(t => !t.holding).map(t => { const on = boardTechIds.length === 0 || boardTechIds.includes(t.id); return <button className={on ? "selected" : ""} key={t.id} onClick={() => setBoardTechIds(ids => on ? (ids.length === 0 ? techs.filter(x => !x.holding).map(x => x.id).filter(id => id !== t.id) : ids.filter(id => id !== t.id)) : [...ids, t.id])}><span style={{background:t.color}}>{t.name[0]}</span><div><b>{t.name}</b><small>{jobs.filter(j => j.techId === t.id).length} quote appointments today</small></div><em>{on ? "✓ On board" : "Add"}</em></button>})}</div><footer><button onClick={() => setBoardTechIds(techs.filter(t => !t.holding).map(t => t.id))}>Show all staff</button><button onClick={() => setManageBoard(false)}>Save selection</button></footer></section></div>}
    {queueWorkspace && <div className="queue-workspace-overlay" role="dialog" aria-modal="true" aria-label="Booking workspace"><section className="queue-workspace"><header><div><span>BOOKING WORKSPACE</span><h2>Dispatch board & jobs waiting to book</h2><p>Drag jobs onto an allocation lane, or drag an allocated job back into Jobs Waiting to Book.</p></div><button onClick={() => setQueueWorkspace(false)} aria-label="Close booking workspace">×</button></header><ServiceM8DispatchBoard techs={boardTechs} jobs={visibleBoardJobs} waitingJobs={boardJobs} review={setReview} selectedDate={selectedDate} routing={autoRouteQueue.length > 0} routeAllocationWindow={routeAllocationWindow} allocateWaitingJob={allocateWaitingJob} returnWaitingJob={returnWaitingJob} focus /></section></div>}
    <div className="desktop-only">This dashboard is designed for an admin desktop screen. Please open it on a larger display.</div>
  </div>
}

function DatePlanner({ selectedDate, select, live }: { selectedDate: string; select: (date: string) => void; live: boolean }) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(Date.now() + index * 86400000);
    return { key: sydneyDateKey(date), date };
  });
  return <div className="date-planner"><div><b>SELECT DAY</b><span>View and route jobs up to two weeks ahead</span></div><nav>{days.map(({ key, date }, index) => {
    const dayLabel = index === 0 ? "TODAY" : new Intl.DateTimeFormat("en-AU", { weekday: "short" }).format(date).toUpperCase();
    const month = new Intl.DateTimeFormat("en-AU", { month: "short" }).format(date).toUpperCase();
    return <button key={key} className={selectedDate === key ? "selected" : ""} onClick={() => select(key)} aria-label={`${dayLabel} ${new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long" }).format(date)}${index === 0 ? ` — ${live ? "live ServiceM8 data" : "ServiceM8 sync required"}` : ""}`}><small>{dayLabel} · {month}</small><b>{new Intl.DateTimeFormat("en-AU", { day: "numeric" }).format(date)}</b>{index === 0 && <span className={`date-live ${live ? "connected" : ""}`}><i />{live ? "LIVE" : "SYNC"}</span>}</button>;
  })}</nav></div>;
}

function Summary({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) { return <div className="summary-item"><span className={`summary-icon ${color}`}>{color === "blue" ? "▦" : color === "green" ? "✓" : color === "red" ? "!" : "♙"}</span><div><small>{label}</small><b>{value}</b><p>{detail}</p></div></div> }

function BookingRules() { return <section className="booking-rules"><article className="urgent-rule"><span>!</span><div><h3>Urgent — Book Today</h3><p>Blocked drains or toilets · Hot water replacement or repair · Burst pipes · Gas leaks</p><b>Place on the closest eligible technician’s run as the next job.</b></div></article><article className="standard-rule"><span>◷</span><div><h3>Standard — Tomorrow or Day After</h3><p>Roof repairs · Shower regrouts or leaks · Gas heater services · General enquiries · Balcony regrouts</p><b>Plan 4 jobs per technician and protect 2 spaces for urgent work.</b></div></article><aside><strong>6</strong><span>MAXIMUM JOBS<br />PER TECH / DAY</span></aside></section> }

function EmptyDay({ add, techs }: { add: () => void; techs: Technician[] }) { return <section className="empty-dashboard"><article className="empty-route"><div className="empty-visual"><span className="home-dot h1">K</span><span className="home-dot h2">T</span><span className="home-dot h3">R</span><div className="empty-road r1" /><div className="empty-road r2" /></div><div className="empty-copy"><span className="empty-icon">⌖</span><h2>No jobs added yet</h2><p>Start with an empty day. Add your first job and the system will check every technician’s location, skills, truck tools and workload before recommending the best route.</p><button className="add-job" onClick={add}>＋ Add Your First Job</button></div></article><aside className="ready-team"><div className="panel-heading"><div><h2>Technicians Ready</h2><p>Set up in Settings</p></div></div>{techs.map(t => <div className="ready-row" key={t.id}><span style={{ background: t.color }}>{t.name.slice(0, 1)}</span><div><b>{t.name}</b><small>Starts from {t.home}</small></div><em>{t.status}</em></div>)}<button onClick={add}>Add a job to begin routing →</button></aside></section> }

function ServiceM8DispatchBoard({ techs, jobs, waitingJobs, review, selectedDate, routing = false, routeAllocationWindow, allocateWaitingJob, returnWaitingJob, focus = false }: { techs: Technician[]; jobs: Job[]; waitingJobs?: Job[]; review: (job: Job) => void; selectedDate?: string; routing?: boolean; routeAllocationWindow?: (windowName: string) => void; allocateWaitingJob?: (jobId: number, windowName: string) => void; returnWaitingJob?: (jobId: number) => void; focus?: boolean }) {
  const [draggedJobId, setDraggedJobId] = useState<number | null>(null);
  const [dropWindow, setDropWindow] = useState<string | null>(null);
  const waiting = (waitingJobs || jobs).filter(isActionRequiredJob).sort((a, b) => Number(b.priority === "Urgent") - Number(a.priority === "Urgent") || Number(serviceStatus(a) === "work-order") - Number(serviceStatus(b) === "work-order"));
  const allocationJobs = jobs.filter(job => Boolean(job.holdingWindow) && !job.techId);
  const todaySelected = selectedDate === sydneyDateKey();
  const hours = Array.from({ length: DISPATCH_END_HOUR - DISPATCH_START_HOUR + 1 }, (_, i) => i + DISPATCH_START_HOUR);
  const position = (value?: string) => {
    if (!value) return 25;
    const match = String(value).match(/(\d{2}):(\d{2})/);
    if (!match) return 25;
    const minutes = (Number(match[1]) - DISPATCH_START_HOUR) * 60 + Number(match[2]);
    return Math.max(0, Math.min(100, minutes / DISPATCH_MINUTES * 100));
  };
  const minuteOfDay = (value?: string) => {
    const match = String(value || "").match(/(\d{2}):(\d{2})/);
    return match ? (Number(match[1]) - DISPATCH_START_HOUR) * 60 + Number(match[2]) : 0;
  };
  const width = (job: Job) => Math.max(4.2, Math.min(18, job.duration / DISPATCH_MINUTES * 100));
  const layoutTechnicianJobs = (techJobs: Job[]) => {
    const laneEnds: number[] = [];
    const cards = [...techJobs]
      .sort((a, b) => minuteOfDay(a.scheduledStart) - minuteOfDay(b.scheduledStart))
      .map(job => {
        const start = minuteOfDay(job.scheduledStart);
        const scheduledEnd = minuteOfDay(job.scheduledEnd);
        const end = scheduledEnd > start ? scheduledEnd : start + Math.max(30, job.duration || 30);
        let lane = laneEnds.findIndex(laneEnd => laneEnd <= start);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = end;
        return { job, lane };
      });
    return { cards, laneCount: Math.max(1, laneEnds.length) };
  };
  const HoldingLane = ({ label, window }: { label: string; window: string }) => {
    const laneJobs = allocationJobs.filter(job => job.holdingWindow === window).sort((a, b) => (a.priority === "Urgent" ? 0 : a.priority === "High" ? 1 : 2) - (b.priority === "Urgent" ? 0 : b.priority === "High" ? 1 : 2));
    const dropActive = draggedJobId !== null && dropWindow === window;
    return <div
      className={`dispatch-row holding-row ${window === "PM 12-4" ? "allocation-divider" : ""} ${dropActive ? "drop-active" : ""}`}
      onDragEnter={event => { if (draggedJobId !== null) { event.preventDefault(); setDropWindow(window); } }}
      onDragOver={event => { if (draggedJobId !== null) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropWindow(window); } }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropWindow(null); }}
      onDrop={event => { event.preventDefault(); const jobId = draggedJobId ?? Number(event.dataTransfer.getData("text/plain")); setDropWindow(null); setDraggedJobId(null); if (jobId && allocateWaitingJob) allocateWaitingJob(jobId, window); }}
    ><div className="staff-cell holding-staff-cell"><span className="holding-avatar">Q</span><div><b>{label}</b><small>{draggedJobId !== null ? "Drop job here" : "Waiting allocation"}</small>{todaySelected && routeAllocationWindow && <button className="holding-book-today" disabled={routing || laneJobs.length === 0} onClick={() => routeAllocationWindow(window)}>{routing ? "Routing…" : "Book today"}</button>}</div></div><div className="timeline-cell">{draggedJobId !== null && <span className="allocation-drop-hint">DROP INTO {label}</span>}{laneJobs.map((job, index) => { const statusClass = `status-${serviceStatus(job)}`; const urgent = job.priority === "Urgent"; return <button key={job.id} draggable className={`schedule-card holding-card ${statusClass} ${priorityClass(job)} ${urgent ? "urgent-allocation" : ""}`} style={{ left: `${window.includes("8") ? 16.6667 + index * 5 : 50 + index * 5}%`, width: `${30 / DISPATCH_MINUTES * 100}%` }} onDragStart={event => { setDraggedJobId(job.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(job.id)); }} onDragEnd={() => { setDraggedJobId(null); setDropWindow(null); }} onClick={() => review(job)}><b>{urgent ? "URGENT - " : ""}#{job.id} · {job.suburb}</b><small>{job.issue}</small><em className={urgent ? "urgent-priority" : "standard-priority"}>{priorityLabel(job)}</em><span className="priority-strip" aria-hidden="true" /></button>; })}</div></div>;
  };
  return <div className={`servicem8-board ${focus ? "booking-workspace-board" : ""}`}>
    <div className="board-main">
      <div className="time-header"><div className="staff-heading">Sales team</div><div className="time-axis">{hours.map((hour, index) => <span className={index === 0 ? "axis-start" : index === hours.length - 1 ? "axis-end" : ""} style={{ left: `${index / (hours.length - 1) * 100}%` }} key={hour}>{hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? "pm" : "am"}</span>)}</div></div>
      <HoldingLane label="8 – 11 AM" window="AM 8-11" />
      <HoldingLane label="12 – 4 PM" window="PM 12-4" />
      {techs.map(tech => {
        const techJobs = jobs.filter(job => job.techId === tech.id);
        const layout = layoutTechnicianJobs(techJobs);
        const stacked = layout.laneCount > 1;
        return <div className={`dispatch-row ${stacked ? "stacked-row" : ""}`} style={{ height: stacked ? `${layout.laneCount * 62 + 6}px` : undefined }} key={tech.id}><div className="staff-cell"><span style={{ background: tech.color }}>{tech.name.slice(0, 1)}</span><div><b>{tech.name}</b><small>{tech.latitude ? "● Live location" : "Location unavailable"} · {techJobs.length}/6 jobs</small></div></div><div className="timeline-cell">{layout.cards.map(({ job, lane }) => { const statusClass = `status-${serviceStatus(job)}`; const outside = isOutsideServiceArea(job); return <button key={job.id} className={`schedule-card ${stacked ? "stacked-card" : ""} ${statusClass} ${priorityClass(job)} ${outside ? "outside-area" : ""}`} style={{ left: `${position(job.scheduledStart)}%`, width: `${width(job)}%`, top: stacked ? `${5 + lane * 62}px` : undefined }} onClick={() => review(job)}><b>{job.scheduledStart ? String(job.scheduledStart).slice(11, 16) : "Quote"} · #{job.id}</b><small>{job.customer}</small><em>{job.suburb}</em>{outside && <i>OUTSIDE AREA</i>}<span className="priority-strip" aria-hidden="true" /></button>; })}</div></div>;
      })}
    </div>
    <aside className={`waiting-panel ${draggedJobId !== null ? "waiting-drop-ready" : ""}`}
      onDragOver={event => { if (draggedJobId !== null) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
      onDrop={event => { event.preventDefault(); const jobId = draggedJobId ?? Number(event.dataTransfer.getData("text/plain")); setDraggedJobId(null); setDropWindow(null); if (jobId && returnWaitingJob) returnWaitingJob(jobId); }}>
      <header><div><h2>Jobs Waiting to Book</h2><p>ServiceM8 — Action Required</p></div><b>{waiting.length}</b></header>
      <div className="waiting-legend"><span><i className="quote-key" />Quote</span><span><i className="work-order-key" />Work Order</span><span><i className="blocked-key">×</i>Outside area</span></div>
      <div className="waiting-list">{waiting.length === 0 ? <section className="waiting-empty"><span>✓</span><b>Nothing waiting</b><p>Save phone jobs in ServiceM8 as Action Required, then press Sync ServiceM8.</p></section> : waiting.map(job => {
        const outside = isOutsideServiceArea(job);
        const centralCoast = isCentralCoastJob(job) && centralCoastRoutingEnabled();
        const status = serviceStatus(job);
        return <button key={job.id} draggable={!outside} title={outside ? "Outside service area — cannot allocate" : centralCoast ? "Central Coast — Joel only" : "Drag onto an allocation lane, or click to review"} onDragStart={event => { if (outside) { event.preventDefault(); return; } setDraggedJobId(job.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(job.id)); }} onDragEnd={() => { setDraggedJobId(null); setDropWindow(null); }} aria-label={`${outside ? "Outside service area. " : centralCoast ? "Central Coast, Joel only. " : ""}${job.priority} ${status} job ${job.id} for ${job.customer} in ${job.suburb}`} className={`waiting-${status} ${priorityClass(job)} ${outside ? "outside-area" : ""} ${centralCoast ? "central-coast-job" : ""} ${draggedJobId === job.id ? "is-dragging" : ""}`} onClick={() => review(job)}>
          <span className="waiting-icon">{outside ? "×" : status === "work-order" ? "W" : status === "completed" ? "✓" : "Q"}</span>
          <div className="waiting-copy">
            {outside && <strong className="outside-banner"><span>×</span><span>OUTSIDE SYDNEY / CENTRAL COAST<small>DO NOT AUTO-ROUTE</small></span></strong>}
            {centralCoast && <strong className="central-coast-banner">CENTRAL COAST <small>JOEL ONLY</small></strong>}
            <b>{job.customer}</b>
            <small>Job #{job.id} <span>•</span> {job.suburb || "Address required"}</small>
            <p>{job.issue || job.service}</p>
            <em className={job.priority === "Urgent" ? "urgent-priority" : "standard-priority"}>{priorityLabel(job)}</em>
          </div>
          <span className="priority-strip" aria-hidden="true" />
        </button>;
      })}</div>
    </aside>
  </div>;
}

function GoogleRouteMap({ apiKey, techs, jobs, review }: { apiKey: string; techs: Technician[]; jobs: Job[]; review: (job: Job) => void }) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const [mapError, setMapError] = useState("");
  useEffect(() => {
    if (!apiKey || !mapNode.current) return;
    let cancelled = false;
    const boot = () => {
      if (cancelled || !mapNode.current || !(window as any).google?.maps) return;
      const google = (window as any).google;
      const map = new google.maps.Map(mapNode.current, { center: { lat: -33.82, lng: 151.03 }, zoom: 10, mapTypeControl: false, streetViewControl: false, fullscreenControl: true, clickableIcons: false, styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }] });
      const bounds = new google.maps.LatLngBounds();
      const geocoder = new google.maps.Geocoder();
      const locate = async (job: Job) => {
        if (job.latitude && job.longitude) return { lat: Number(job.latitude), lng: Number(job.longitude) };
        if (!job.address) return null;
        try { const result = await geocoder.geocode({ address: `${job.address}, NSW, Australia`, region: "AU" }); return result.results[0]?.geometry.location || null; } catch { return null; }
      };
      Promise.all(jobs.map(locate)).then(locations => {
        if (cancelled) return;
        const byTech: Record<string, any[]> = {};
        locations.forEach((position, index) => {
          if (!position) return;
          const job = jobs[index]; bounds.extend(position);
          const centralCoast = isCentralCoastJob(job) && centralCoastRoutingEnabled();
          const marker = new google.maps.Marker({ map, position, label: { text: centralCoast ? "CC" : String(job.order || index + 1), color: "#fff", fontWeight: "700", fontSize: centralCoast ? "9px" : "12px" }, title: `${centralCoast ? "CENTRAL COAST · JOEL ONLY · " : ""}#${job.id} · ${job.suburb}`, icon: { path: google.maps.SymbolPath.CIRCLE, scale: centralCoast ? 17 : 14, fillColor: centralCoast ? "#087f8c" : job.priority === "Urgent" ? "#dc3545" : "#2563eb", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 } });
          marker.addListener("click", () => review(job));
          if (job.techId) (byTech[job.techId] ||= []).push({ job, position });
        });
        techs.forEach(tech => {
          if (tech.latitude != null && tech.longitude != null) {
            const current = { lat: Number(tech.latitude), lng: Number(tech.longitude) };
            bounds.extend(current);
            new google.maps.Marker({ map, position: current, title: `${tech.name} · current ServiceM8 location`, zIndex: 20, label: { text: tech.name.slice(0, 1), color: "#fff", fontWeight: "800" }, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 17, fillColor: tech.color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 4 } });
          }
          const route = (byTech[tech.id] || []).sort((a, b) => a.job.order - b.job.order);
          const start = tech.latitude != null && tech.longitude != null ? [{ lat: Number(tech.latitude), lng: Number(tech.longitude) }] : [];
          if (route.length) new google.maps.Polyline({ map, path: [...start, ...route.map(item => item.position)], strokeColor: tech.color, strokeOpacity: .9, strokeWeight: 5, geodesic: true });
        });
        if (!bounds.isEmpty()) map.fitBounds(bounds, 55);
      }).catch(() => setMapError("Google Maps could not locate the scheduled addresses."));
    };
    if ((window as any).google?.maps) boot();
    else {
      const existing = document.getElementById("google-maps-auto-route") as HTMLScriptElement | null;
      if (existing) existing.addEventListener("load", boot, { once: true });
      else { const script = document.createElement("script"); script.id = "google-maps-auto-route"; script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`; script.async = true; script.onload = boot; script.onerror = () => setMapError("Google Maps key is missing or restricted incorrectly."); document.head.appendChild(script); }
    }
    return () => { cancelled = true; };
  }, [apiKey, techs, jobs, review]);
  if (!apiKey) return <div className="map-setup"><span>G</span><h3>Google Maps connection required</h3><p>Add the restricted Maps key to the ServiceM8 function to turn this into a live Sydney road map.</p></div>;
  const hasCentralCoastJob = jobs.some(isCentralCoastJob);
  return <div className="google-map-wrap"><div ref={mapNode} className="google-map" />{mapError && <div className="map-error">{mapError}</div>}{hasCentralCoastJob && <div className="central-coast-map-badge">CENTRAL COAST JOB · JOEL ONLY</div>}<div className="map-legend real"><span><i className="job-key" />Scheduled job</span><span><i className="urgent-key" />Urgent</span><span><i className="tech-key" />Technician route</span></div></div>;
}

function RouteMap({ techs, jobs, select, selected, review }: { techs: Technician[]; jobs: Job[]; select: (id: string) => void; selected: string | null; review: (j: Job) => void }) {
  return <div className="route-map"><svg viewBox="0 0 100 100" preserveAspectRatio="none">{techs.map(t => { const pts = jobs.filter(j => j.techId === t.id).sort((a, b) => a.order - b.order).map(j => SUBURBS[j.suburb] || { x: 50, y: 50 }); const all = [{ x: t.x, y: t.y }, ...pts]; return all.length > 1 ? <polyline key={t.id} points={all.map(p => `${p.x},${p.y}`).join(" ")} style={{ stroke: t.color }} /> : null })}</svg>
    {Object.entries(SUBURBS).filter(([, p]) => p.x > 30 && p.x < 83 && p.y > 15 && p.y < 80).slice(0, 12).map(([s, p]) => <span className="map-suburb" style={{ left: `${p.x}%`, top: `${p.y}%` }} key={s}>{s.toUpperCase()}</span>)}
    {techs.map(t => <button className={`map-tech ${selected === t.id ? "selected" : ""}`} style={{ left: `${t.x}%`, top: `${t.y}%`, borderColor: t.color }} onClick={() => select(t.id)} key={t.id}><i style={{ background: t.color }}>{t.name[0]}</i><span><b>{t.name}</b><small>Home: {t.home}</small></span></button>)}
    {jobs.map(j => { const p = SUBURBS[j.suburb] || { x: 50, y: 50 }; return <button className={`map-job ${j.priority.toLowerCase()}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => review(j)} key={j.id}><b>#{j.id}</b><small>{j.bookingDay} · {j.suburb}</small></button> })}
    <div className="map-legend"><span><i className="tech-key" />Technician home</span><span><i className="job-key" />Job</span><span><i className="urgent-key" />Urgent</span></div>
  </div>
}

function TechRun({ tech, jobs, review }: { tech: Technician; jobs: Job[]; review: (j: Job) => void }) { const ordered = [...jobs].sort((a, b) => a.order - b.order); return <section className="tech-run"><header><span style={{ background: tech.color }}>{tech.name[0]}</span><div><b>{tech.name}</b><small>{tech.home} · {tech.vehicle}</small></div><em>{ordered.length} jobs</em></header><div className="run-start"><i style={{ borderColor: tech.color }} />Start from {tech.home}</div>{ordered.length === 0 ? <div className="run-empty">No jobs assigned</div> : ordered.map((j, i) => <button className="run-job" onClick={() => review(j)} key={j.id}><span style={{ background: tech.color }}>{i + 1}</span><div><b>{j.suburb} · #{j.id}</b><small>{j.service} · {j.duration} min</small>{j.routeReason && <small className="run-route-reason">Why: {j.routeReason}</small>}</div><em className={j.priority.toLowerCase()}>{j.priority}</em></button>)}</section> }

function JobsPage({ jobs, techs, add, review, remove }: { jobs: Job[]; techs: Technician[]; add: () => void; review: (j: Job) => void; remove: (id: number) => void }) {
  if (!jobs.length) return <section className="jobs-empty"><span>▦</span><h2>No jobs added for today</h2><p>Add jobs one by one to test how the auto router assigns them.</p><button className="add-job" onClick={add}>＋ Add First Job</button></section>;
  return <section className="jobs-table"><div className="table-head"><span>JOB</span><span>CUSTOMER & ISSUE</span><span>BOOKING DAY</span><span>PRIORITY</span><span>RECOMMENDED RUN</span><span>ACTIONS</span></div>{jobs.map(j => <div className={`table-row ${j.priority === "Urgent" ? "urgent-row" : ""}`} key={j.id}><b>#{j.id}<small>{j.service}</small></b><div><b>{j.customer}</b><small>{j.issue}</small></div><div><b>{j.bookingDay}</b><small>{j.suburb} · {j.address || "Address not entered"}</small></div><em className={j.priority.toLowerCase()}>{j.priority}</em><div><b>{techs.find(t => t.id === j.techId)?.name || "Not assigned"}</b><small>{j.techId ? `Position ${j.order} of 6` : "Recommendation ready"}</small></div><div className="row-actions"><button onClick={() => review(j)}>Review Route</button><button className="delete" onClick={() => remove(j.id)}>×</button></div></div>)}</section>
}

function RunsPage({ techs, jobs, add, review }: { techs: Technician[]; jobs: Job[]; add: () => void; review: (j: Job) => void }) {
  const [day, setDay] = useState<BookingDay>("Today");
  const dayJobs = jobs.filter(j => j.bookingDay === day);
  return <section className="separate-runs">
    <div className="runs-overview">
      <div><b>{dayJobs.filter(j => j.techId).length}</b><span>Jobs routed</span></div>
      <div><b>{dayJobs.filter(j => !j.techId).length}</b><span>Waiting for allocation</span></div>
      <div><b>{dayJobs.reduce((total, j) => total + j.duration, 0) / 60 || 0}</b><span>Total on-site hours</span></div>
      <nav>{(["Today", "Tomorrow", "Day After"] as BookingDay[]).map(d => <button className={day === d ? "active" : ""} onClick={() => setDay(d)} key={d}>{d}</button>)}</nav>
      <button onClick={add}>＋ Add Another Job</button>
    </div>
    <div className="run-columns">
      {techs.map(tech => {
        const route = dayJobs.filter(j => j.techId === tech.id).sort((a, b) => a.order - b.order);
        const minutes = route.reduce((total, job) => total + job.duration, 0);
        return <article className="run-column" style={{ "--tech-color": tech.color } as React.CSSProperties} key={tech.id}>
          <header>
            <span style={{ background: tech.color }}>{tech.name.slice(0, 1)}</span>
            <div><h2>{tech.name}</h2><p>{tech.vehicle}</p></div>
            <em>{tech.status}</em>
          </header>
          <div className="run-column-summary">
            <div><small>STARTS FROM</small><b>{tech.home}</b></div>
            <div><small>TOTAL JOBS</small><b>{route.length} / 6</b></div>
            <div><small>ON-SITE TIME</small><b>{Math.floor(minutes / 60)}h {minutes % 60}m</b></div>
          </div>
          <div className="run-timeline">
            <div className="timeline-start"><i /><span><small>START OF DAY</small><b>{tech.home}</b></span></div>
            {route.length === 0 ? <div className="column-empty"><span>☷</span><b>No jobs on this {day.toLowerCase()} run</b><p>Add jobs and the auto router will place them here.</p></div> : route.map((job, index) => <button onClick={() => review(job)} className="timeline-job" key={job.id}>
              <span className="job-number" style={{ background: tech.color }}>{index + 1}</span>
              <div><small>JOB #{job.id} · {job.duration} MIN</small><h3>{job.suburb}</h3><p>{job.customer} — {job.service}</p>{job.routeReason && <small className="route-explanation">WHY THIS STOP: {job.routeReason}</small>}<em className={job.priority.toLowerCase()}>{job.priority}</em></div>
              <strong>›</strong>
            </button>)}
          </div>
          <footer><span><b>{route.length}</b> of 6 slots</span><span><b>{Math.max(0, 6 - route.length)}</b> spaces left</span><span className={route.length <= 3 ? "capacity-warning" : ""}><b>{route.length <= 3 && day === "Tomorrow" ? "Lighter run ready for same-day work" : route.length < 6 ? "Route can accept nearby work" : "Run at 6-job capacity"}</b></span></footer>
        </article>
      })}
    </div>
  </section>
}

function Settings({ techs, tools, centralCoastEnabled, settingsUnlocked, settingsPin, settingsStatus, setSettingsPin, unlockSettings, toggleCentralCoast, edit, addTech, addTool, removeTool }: {
  techs: Technician[];
  tools: string[];
  centralCoastEnabled: boolean;
  settingsUnlocked: boolean;
  settingsPin: string;
  settingsStatus: string;
  setSettingsPin: (value: string) => void;
  unlockSettings: () => void;
  toggleCentralCoast: () => void;
  edit: (t: Technician) => void;
  addTech: () => void;
  addTool: (s: string) => void;
  removeTool: (s: string) => void;
}) {
  const [tool, setTool] = useState("");
  if (!settingsUnlocked) {
    return <div className="settings-grid">
      <section className="settings-lock">
        <small>OWNER SETTINGS</small>
        <h2>Admin PIN required</h2>
        <p>These settings control every ServiceM8 user who opens Auto Route: technician skills, truck equipment, live-board rules and Central Coast routing.</p>
        <form onSubmit={event => { event.preventDefault(); void unlockSettings(); }}>
          <input type="password" value={settingsPin} onChange={event => setSettingsPin(event.target.value)} placeholder="Enter admin PIN" autoComplete="off" />
          <button type="submit">Unlock Settings</button>
        </form>
        <div className="settings-status">{settingsStatus}</div>
      </section>
      <aside className="settings-note-panel">
        <h2>What this controls</h2>
        <ul>
          <li>Skills and truck tools used for urgent job eligibility.</li>
          <li>Standard same-day jobs rank by whole-day route insertion.</li>
          <li>Central Coast can be switched on or off for every admin.</li>
        </ul>
      </aside>
    </div>;
  }

  return <div className="settings-grid">
    <section className="settings-main">
      <div className="settings-admin-banner">
        <div><small>SHARED SETTINGS UNLOCKED</small><b>Changes save to Railway and load for every admin using ServiceM8.</b></div>
        <span>{settingsStatus}</span>
      </div>
      <div className={`service-area-setting ${centralCoastEnabled ? "enabled" : "disabled"}`}>
        <div><small>SERVICE AREA CONTROL</small><h2>Central Coast routing is {centralCoastEnabled ? "ON" : "OFF"}</h2><p>{centralCoastEnabled ? "Central Coast jobs can auto-route under the Joel-only rule." : "Central Coast jobs stay visible but are treated as outside the active service area."}</p></div>
        <button className="area-toggle" role="switch" aria-checked={centralCoastEnabled} onClick={toggleCentralCoast}><span />{centralCoastEnabled ? "ON" : "OFF"}</button>
      </div>
      <div className="settings-title"><div><h2>Technician Skills & Truck Equipment</h2><p>This is the shared truth used by the ServiceM8 job card and full dispatch board.</p></div><button onClick={addTech}>＋ Add Technician</button></div>
      {techs.filter(t => !t.holding).map(t => <article className="technician-setting" key={t.id}><span className="setting-avatar" style={{ background: t.color }}>{t.name.slice(0, 2).toUpperCase()}</span><div className="setting-info"><h3>{t.name}</h3><p>{t.home} · {t.vehicle} · {t.status}</p><small>SKILLS</small><div className="tag-list">{t.skills.length ? t.skills.map(s => <i key={s}>{s}</i>) : <em>No skills configured</em>}</div><small>TOOLS IN TRUCK</small><div className="tag-list tools">{t.tools.length ? t.tools.map(s => <i key={s}>✓ {s}</i>) : <em>No special tools assigned</em>}</div></div><button className="edit-button" onClick={() => edit(t)}>Edit Technician & Truck</button></article>)}
    </section>
    <aside className="tools-library">
      <h2>Master Tools List</h2>
      <p>Add every tool or piece of equipment your technicians may carry. Assign tools individually to each truck.</p>
      <form onSubmit={event => { event.preventDefault(); addTool(tool.trim()); setTool(""); }}>
        <input value={tool} onChange={event => setTool(event.target.value)} placeholder="e.g. Pipe freeze kit" />
        <button>＋ Add</button>
      </form>
      <div className="tool-list">{tools.map(t => <div key={t}><span>🧰</span><b>{t}</b><em>{techs.filter(x => x.tools.includes(t)).length} trucks</em><button onClick={() => removeTool(t)}>×</button></div>)}</div>
      <div className="settings-note"><b>Important</b><p>If an urgent job requires a tool and no technician has it selected, the job will remain unassigned and warn the admin. Standard quote jobs do not require special tools.</p></div>
    </aside>
  </div>;
}

function JobForm({ close, create }: { close: () => void; create: (j: Job) => void }) {
  const [f, setF] = useState({ customer: "", phone: "", suburb: "Parramatta", address: "", service: "Blocked drain or toilet", issue: "", value: "", duration: "90", bookingDay: "Tomorrow" as BookingDay });
  const rule = SERVICES[f.service]; const urgent = rule.urgent;
  useEffect(() => setF(v => ({ ...v, duration: String(rule.duration) })), [f.service, rule.duration]);
  return <div className="overlay" onMouseDown={close}><form className="job-modal" onMouseDown={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); create({ id: Math.floor(5000 + Math.random() * 4000), customer: f.customer, phone: f.phone, suburb: f.suburb, address: f.address, service: f.service, issue: f.issue, value: +f.value || 0, duration: +f.duration, priority: urgent ? "Urgent" : "Standard", requiredSkill: rule.skill, requiredTool: rule.tool, techId: null, order: 0, bookingDay: urgent ? "Today" : f.bookingDay }) }}><ModalHeader title="Add New Job" subtitle="The system will apply the booking-day and capacity rules automatically." close={close} /><div className="form-section"><h3>Customer</h3><div className="two"><label>Customer name<input required value={f.customer} onChange={e => setF({ ...f, customer: e.target.value })} placeholder="Full name" /></label><label>Phone number<input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="04xx xxx xxx" /></label></div><label>Street address<input value={f.address} onChange={e => setF({ ...f, address: e.target.value })} placeholder="House number and street" /></label><label>Suburb<select value={f.suburb} onChange={e => setF({ ...f, suburb: e.target.value })}>{Object.keys(SUBURBS).map(s => <option key={s}>{s}</option>)}</select></label></div><div className="form-section"><h3>Job Details</h3><div className="two"><label>Service type<select value={f.service} onChange={e => setF({ ...f, service: e.target.value })}>{Object.keys(SERVICES).map(s => <option key={s}>{s}</option>)}</select></label><label>Estimated duration<select value={f.duration} onChange={e => setF({ ...f, duration: e.target.value })}><option value="30">30 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option></select></label></div><label>Customer’s exact wording<textarea required value={f.issue} onChange={e => setF({ ...f, issue: e.target.value })} placeholder="Type exactly what the customer said..." /></label><div className="two"><label>Estimated job value ($)<input type="number" value={f.value} onChange={e => setF({ ...f, value: e.target.value })} placeholder="Optional" /></label><label>Booking day<select disabled={urgent} value={urgent ? "Today" : f.bookingDay} onChange={e => setF({ ...f, bookingDay: e.target.value as BookingDay })}>{urgent ? <option>Today</option> : <><option>Tomorrow</option><option>Day After</option></>}</select></label></div><div className={`detection ${urgent ? "urgent-detect" : ""}`}><span>{urgent ? "!" : "◷"}</span><div><b>{urgent ? "URGENT — Must be booked today as the next job" : `STANDARD — Book for ${f.bookingDay.toLowerCase()}`}</b><small>{urgent ? "Closest eligible technician · urgent capacity may be used" : "Up to 6 jobs per technician · one lighter run may be kept for same-day work"}</small></div></div></div><footer><button type="button" onClick={close}>Cancel</button><button className="save-job">Save Job & Apply Booking Rules →</button></footer></form></div>
}

function JobCardDecision({ job, jobs, techs, mapsKey, connected, syncing, sync, assign, openDashboard, toast }: {
  job: Job | null;
  jobs: Job[];
  techs: Technician[];
  mapsKey: string;
  connected: boolean;
  syncing: boolean;
  sync: () => void;
  assign: (job: Job, techId: string, options?: RecommendationOptions) => void;
  openDashboard: () => void;
  toast: string;
}) {
  const [sameDayRequested, setSameDayRequested] = useState(false);
  const [reassignMode, setReassignMode] = useState(false);
  const scores = useMemo(() => job
    ? techs
        .filter(tech => !reassignMode || tech.id !== job.techId)
        .map(tech => ({ tech, ...recommendation(tech, job, jobs.filter(item => item.id !== job.id), { sameDayRequested: sameDayRequested || reassignMode }) }))
        .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score)
    : [], [techs, job, jobs, sameDayRequested, reassignMode]);
  const best = sameDayRequested ? scores[0] : scores.find(score => score.eligible);
  const [choice, setChoice] = useState("");

  useEffect(() => {
    if (!choice || !scores.some(score => score.tech.id === choice && (score.eligible || sameDayRequested))) {
      setChoice(best?.tech.id || "");
    }
  }, [best?.tech.id, choice, scores, sameDayRequested]);

  useEffect(() => {
    setSameDayRequested(false);
    setReassignMode(false);
  }, [job?.id]);

  if (!connected || !job) {
    return <div className="job-decision-app">
      <header className="decision-topbar">
        <div className="decision-brand"><img src="/sdhs-brand-logo.jpeg" alt="Same Day Home Services" /><div><b>AUTO ROUTE</b><span>JOB DECISION</span></div></div>
        <button className="decision-secondary" onClick={openDashboard}>Open full dashboard</button>
      </header>
      <main className="decision-loading"><span className="decision-spinner" /><h1>{connected ? "Finding this ServiceM8 job…" : "Loading live ServiceM8 data…"}</h1><p>{connected ? "The job may still be saving. Wait a moment, then refresh the live data." : "Auto Route is loading the current job, selected sales technicians and their live runs."}</p><button onClick={sync} disabled={syncing}>{syncing ? "Refreshing…" : "Refresh ServiceM8 data"}</button></main>
    </div>;
  }

  const assignedTech = job.techId ? techs.find(tech => tech.id === job.techId) : null;
  const chosen = scores.find(score => score.tech.id === choice);
  const outside = isOutsideServiceArea(job);
  const centralCoast = isCentralCoastJob(job) && centralCoastRoutingEnabled();
  const joelScore = scores.find(score => isJoel(score.tech));

  return <div className="job-decision-app">
    {toast && <div className="toast">✓ {toast}</div>}
    <header className="decision-topbar">
      <div className="decision-brand"><img src="/sdhs-brand-logo.jpeg" alt="Same Day Home Services" /><div><b>AUTO ROUTE</b><span>LIVE JOB DECISION</span></div></div>
      <div className="decision-actions"><span className="decision-live"><i />LIVE SERVICEM8 DATA</span><button className="decision-secondary" onClick={openDashboard}>Open full dashboard</button><button className="decision-close" onClick={() => window.close()}>Close</button></div>
    </header>

    <main className="decision-content">
      <section className={`decision-job ${job.priority === "Urgent" ? "urgent" : ""}`}>
        <div className="decision-job-number"><small>CURRENT SERVICEM8 JOB</small><h1>Job #{job.id}</h1><p>{job.customer} · {job.phone || "No phone entered"}</p></div>
        <div className="decision-address"><small>JOB ADDRESS</small><b>{job.address || job.suburb || "Address required"}</b><span>{job.suburb}</span>{centralCoast && <em className="central-coast-chip">CENTRAL COAST</em>}</div>
        <div className="decision-description"><small>CUSTOMER REQUEST</small><b>{job.service}</b><p>{job.issue || "No job description entered"}</p></div>
        <div className="decision-priority"><span className={job.priority === "Urgent" ? "urgent" : "standard"}>{priorityLabel(job)}</span><small>{serviceStatus(job) === "work-order" ? "WORK ORDER" : serviceStatus(job) === "completed" ? "COMPLETED" : "QUOTE"}</small></div>
      </section>

      {outside && <section className="decision-warning"><b>OUTSIDE SYDNEY / CENTRAL COAST</b><p>This job requires manual review and will not be auto-assigned.</p></section>}
      {centralCoast && <section className="decision-coast-rule"><b>CENTRAL COAST — JOEL ONLY</b><p>{joelScore?.eligible ? "Joel is the only technician who can be selected for this job." : "Joel is unavailable or does not meet the job requirements. Manual review is required."}</p></section>}
      {assignedTech && <section className={`decision-booked ${reassignMode ? "reassigning" : ""}`}><span>{reassignMode ? "↔" : "✓"}</span><div><b>{reassignMode ? `Find the closest replacement for ${assignedTech.name}` : `Already booked to ${assignedTech.name}`}</b><p>{reassignMode ? "The delayed technician is excluded. Select the closest available sales technician with a realistic gap." : "If this technician is delayed, Auto Route can safely move the existing ServiceM8 booking to someone closer."}</p></div><button disabled={!job.activityUUID} onClick={() => setReassignMode(value => !value)}>{!job.activityUUID ? "Sync required before moving" : reassignMode ? "Cancel reassignment" : "Technician delayed — find replacement"}</button></section>}
      {job.priority !== "Urgent" && !assignedTech && <section className={`same-day-request ${sameDayRequested ? "active" : ""}`}><div><small>STANDARD JOB — OPTIONAL SAME-DAY REQUEST</small><b>Did the customer ask to be booked today?</b><p>Analyse each technician’s live location and full remaining run, then insert this job where it adds the least travel and avoids unnecessary backtracking.</p></div><button onClick={() => setSameDayRequested(value => !value)}>{sameDayRequested ? "✓ Customer requested today" : "Customer requested today"}</button></section>}

      <div className="decision-grid">
        <section className="decision-ranking">
          <header><div><small>RECOMMENDATION</small><h2>{reassignMode ? "Closest replacement technicians" : job.priority === "Urgent" ? "Closest practical technicians" : sameDayRequested ? "Best whole-day insertion" : "Best technicians for this route"}</h2><p>{reassignMode ? `${assignedTech?.name || "The current technician"} is excluded. Ranked by live location and the earliest realistic non-overlapping gap.` : job.priority === "Urgent" ? "Ranked by the closest realistic arrival after checking live location, current-job duration, skills, tools and a non-overlapping gap." : sameDayRequested ? "Ranked by testing the job at every reasonable position in each technician’s remaining run, then choosing the lowest added travel that still works today." : "Ranked using live location, current bookings, skills, tools, travel and daily capacity."}</p></div><span>{sameDayRequested ? scores.length : scores.filter(score => score.eligible).length} eligible</span></header>
          <div className="decision-requirements">
            <div><small>REQUIRED SKILL</small><b>{job.requiredSkill}</b></div>
            <div><small>REQUIRED TOOL</small><b>{job.requiredTool || "No special tool"}</b></div>
            <div><small>JOB DURATION</small><b>{job.duration} minutes</b></div>
            <div><small>BOOKING RULE</small><b>{job.priority === "Urgent" ? "Same day — next realistic slot" : sameDayRequested ? "Customer requested today · whole-day route insertion" : job.holdingWindow || job.bookingDay}</b></div>
          </div>
          <div className="decision-tech-list">{scores.map((score, index) => {
            const routeDateKey = sameDayRequested ? sydneyDateKey() : jobDateKey(job);
            const dayJobs = jobs.filter(item => item.techId === score.tech.id && item.id !== job.id && jobDateKey(item) === routeDateKey);
            const active = currentBooking(score.tech.id, dayJobs);
            const gpsDistance = score.tech.latitude != null && score.tech.longitude != null && job.latitude != null && job.longitude != null
              ? liveDistance(score.tech, job, 0)
              : null;
            const capabilityRequired = job.priority === "Urgent";
            const knownSkills = Array.isArray(score.tech.skills) && score.tech.skills.length > 0;
            const knownTools = Array.isArray(score.tech.tools) && score.tech.tools.length > 0;
            const hasSkill = !capabilityRequired || !knownSkills || score.tech.skills.includes(job.requiredSkill);
            const hasTool = !capabilityRequired || !job.requiredTool || !knownTools || score.tech.tools.includes(job.requiredTool);
            const skillLabel = capabilityRequired ? (knownSkills ? job.requiredSkill : `${job.requiredSkill} not configured`) : `${job.requiredSkill} quote`;
            const toolLabel = capabilityRequired ? (job.requiredTool ? (knownTools ? job.requiredTool : `${job.requiredTool} not configured`) : "No special tool") : "Standard quote — tool not required";
            return <label className={`decision-tech ${choice === score.tech.id ? "selected" : ""} ${(!sameDayRequested && !score.eligible) ? "disabled" : ""}`} key={score.tech.id}>
              <input type="radio" name="technician" disabled={outside || (Boolean(assignedTech) && !reassignMode) || (!sameDayRequested && !score.eligible)} checked={choice === score.tech.id} onChange={() => setChoice(score.tech.id)} />
              <span className="decision-rank">{index + 1}</span>
              <span className="decision-avatar" style={{ background: score.tech.color }}>{score.tech.name.slice(0, 1)}</span>
              <div className="decision-tech-main"><div><h3>{score.tech.name}</h3>{index === 0 && (score.eligible || sameDayRequested) && <em>RECOMMENDED</em>}</div><p>{score.reason}</p><div className="decision-match-tags"><span className={hasSkill ? "pass" : "fail"}>{hasSkill ? "✓" : "×"} {skillLabel}</span><span className={hasTool ? "pass" : "fail"}>{hasTool ? "✓" : "×"} {toolLabel}</span></div></div>
              <div className="decision-tech-status"><strong>{score.eligible || sameDayRequested ? `${score.eta} min` : "Not eligible"}</strong><small>{gpsDistance == null ? "Route-based estimate" : `${gpsDistance.toFixed(1)} km away`}</small><small>{active?.window ? `On job until ${timeLabel(active.window.end)}` : score.tech.latitude ? "Live location available" : "Location unavailable"}</small><small>{dayJobs.length} jobs booked{sameDayRequested && dayJobs.length >= 6 ? " · same-day overtime allowed" : ""}</small></div>
            </label>;
          })}</div>
        </section>

        <aside className="decision-map-panel"><header><div><small>LIVE ROUTE VIEW</small><h2>{centralCoast ? "Central Coast job and Joel’s location" : "Technicians and job location"}</h2></div><button onClick={sync} disabled={syncing}>{syncing ? "Refreshing…" : "↻ Refresh"}</button></header><GoogleRouteMap apiKey={mapsKey} techs={centralCoast ? techs.filter(isJoel) : techs} jobs={[job]} review={() => {}} /></aside>
      </div>
    </main>

    <footer className="decision-footer"><div>{chosen ? <><small>{reassignMode ? "RECOMMENDED REPLACEMENT" : sameDayRequested ? "BEST SAME-DAY INSERTION" : "SELECTED TECHNICIAN"}</small><b>{chosen.tech.name}</b><span>{chosen.reason}{reassignMode ? " · closest practical route selected" : sameDayRequested ? " · whole-day insertion selected" : ` · estimated ${chosen.eta} minute travel`}</span></> : <><small>NO TECHNICIAN SELECTED</small><b>{reassignMode || sameDayRequested ? "No practical same-day route is available" : "Review the requirements above"}</b></>}</div><button className="decision-secondary" onClick={openDashboard}>View full dispatch board</button><button className="decision-assign" disabled={!choice || outside || (Boolean(assignedTech) && !reassignMode)} onClick={() => assign(job, choice, { sameDayRequested: sameDayRequested || reassignMode })}>{reassignMode && assignedTech ? `Move from ${assignedTech.name} to ${techs.find(tech => tech.id === choice)?.name || "replacement"} in ServiceM8` : assignedTech ? `Booked to ${assignedTech.name}` : choice ? `${sameDayRequested ? "Book same-day with" : "Book with"} ${techs.find(tech => tech.id === choice)?.name || "technician"} in ServiceM8` : "No eligible technician"}</button></footer>
  </div>;
}

function Allocation({ job, jobs, techs, close, assign }: { job: Job; jobs: Job[]; techs: Technician[]; close: () => void; assign: (j: Job, id: string) => void }) {
  const currentTech = job.techId ? techs.find(tech => tech.id === job.techId) : null;
  const scores = useMemo(() => techs
    .filter(tech => tech.id !== job.techId)
    .map(tech => ({ tech, ...recommendation(tech, job, jobs.filter(item => item.id !== job.id), { sameDayRequested: Boolean(job.techId) }) }))
    .sort((a, b) => b.score - a.score), [techs, job, jobs]);
  const best = scores.find(x => x.eligible); const [choice, setChoice] = useState(best?.tech.id || "");
  const chosenScore = scores.find(s => s.tech.id === choice);
  return <div className="overlay drawer-overlay" onMouseDown={close}><aside className="allocation-drawer" onMouseDown={e => e.stopPropagation()}><ModalHeader title={`Route Job #${job.id}`} subtitle={`${job.customer} · ${job.suburb}`} close={close} /><div className="job-summary"><span className={job.priority.toLowerCase()}>{job.priority}</span><div><b>{job.service}</b><p>{job.issue}</p></div><strong>{jobDateKey(job)}</strong></div><div className="requirements four"><div><small>BOOKING RULE</small><b>{job.priority === "Urgent" ? "Same day — closest practical technician" : `${job.holdingWindow || job.bookingDay} — planned`}</b></div><div><small>REQUIRED SKILL</small><b>{job.requiredSkill}</b></div><div><small>REQUIRED TOOL</small><b>{job.requiredTool || "No special tool"}</b></div><div><small>EST. TIME</small><b>{job.duration} minutes</b></div></div>{best ? <div className="best-match"><span>✦</span><div><small>{job.priority === "Urgent" ? "CLOSEST ELIGIBLE TECHNICIAN" : "BEST PLANNED ROUTE MATCH"}</small><h2>{best.tech.name}</h2><p>{best.reason} · estimated {best.eta} minute travel</p></div><em>{best.score}% match</em></div> : <div className="no-match"><b>No realistic booking gap available</b><p>The router checked travel, fixed appointments, skills and tools. Choose another time only if every run is genuinely full.</p></div>}<div className="score-heading"><h3>All Technicians</h3><p>Six jobs is a planning target, not a hard limit. Same-day work prioritises the closest realistic route.</p></div><div className="score-cards">{scores.map(s => { const count = jobs.filter(j => j.techId === s.tech.id && j.id !== job.id && jobDateKey(j) === jobDateKey(job)).length; return <label className={`${!s.eligible ? "disabled" : ""} ${choice === s.tech.id ? "chosen" : ""}`} key={s.tech.id}><input type="radio" disabled={!s.eligible} checked={choice === s.tech.id} onChange={() => setChoice(s.tech.id)} /><span style={{ background: s.tech.color }}>{s.tech.name[0]}</span><div><b>{s.tech.name}</b><small>{s.reason}</small><p>{count} jobs booked · route capacity based on time and travel</p></div><strong>{s.eligible ? `${s.score}%` : "Not eligible"}</strong></label>})}</div><footer><button onClick={close}>Cancel</button><button disabled={!choice} onClick={() => assign(job, choice)}>{`Assign to ${techs.find(t => t.id === choice)?.name || "Technician"} & Update Routes`}</button></footer></aside></div>
}

function TechnicianForm({ tech, tools, close, save }: { tech?: Technician; tools: string[]; close: () => void; save: (t: Technician) => void }) {
  const [f, setF] = useState<Technician>(tech || { id: `tech-${Date.now()}`, name: "", home: "Merrylands", vehicle: "", status: "Available", skills: [], tools: [], color: "#12b76a", ...HOME.Merrylands });
  const toggle = (key: "skills" | "tools", value: string) => setF({ ...f, [key]: f[key].includes(value) ? f[key].filter(x => x !== value) : [...f[key], value] });
  return <div className="overlay" onMouseDown={close}><form className="tech-modal" onMouseDown={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); const p = HOME[f.home] || SUBURBS[f.home] || { x: 50, y: 50 }; save({ ...f, ...p }) }}><ModalHeader title={tech ? `Edit ${tech.name}` : "Add Technician"} subtitle="Set their starting point, skills and exact truck equipment." close={close} /><div className="tech-form-grid"><label>Technician name<input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label><label>Status<select value={f.status} onChange={e => setF({ ...f, status: e.target.value as TechStatus })}><option>Available</option><option>On Site</option><option>Driving</option><option>Off</option></select></label><label>Home base<select value={f.home} onChange={e => setF({ ...f, home: e.target.value })}>{Object.keys(SUBURBS).map(s => <option key={s}>{s}</option>)}</select></label><label>Vehicle<input value={f.vehicle} onChange={e => setF({ ...f, vehicle: e.target.value })} placeholder="Vehicle model or registration" /></label></div><div className="selection-group"><h3>Skills</h3><p>Only select work this technician is qualified and approved to attend.</p><div>{SKILLS.map(s => <button type="button" className={f.skills.includes(s) ? "selected" : ""} onClick={() => toggle("skills", s)} key={s}><span>✓</span>{s}</button>)}</div></div><div className="selection-group"><h3>Specific Tools in This Truck</h3><p>Select the actual equipment currently carried in this technician’s vehicle.</p><div>{tools.map(s => <button type="button" className={f.tools.includes(s) ? "selected" : ""} onClick={() => toggle("tools", s)} key={s}><span>✓</span>{s}</button>)}</div></div><footer><button type="button" onClick={close}>Cancel</button><button>Save Technician & Truck</button></footer></form></div>
}

function ModalHeader({ title, subtitle, close }: { title: string; subtitle: string; close: () => void }) { return <header className="modal-header"><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" onClick={close}>×</button></header> }
