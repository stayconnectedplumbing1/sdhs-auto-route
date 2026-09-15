import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  servicem8CompanyUuid: text("servicem8_company_uuid").notNull().unique(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Australia/Sydney"),
  billingStatus: text("billing_status").notNull().default("trial"),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const servicem8Connections = pgTable("servicem8_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  accessTokenCiphertext: text("access_token_ciphertext").notNull(),
  refreshTokenCiphertext: text("refresh_token_ciphertext"),
  scopes: text("scopes"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
});

export const dispatchSettings = pgTable("dispatch_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  urgentKeywords: jsonb("urgent_keywords").$type<string[]>().notNull().default([]),
  standardKeywords: jsonb("standard_keywords").$type<string[]>().notNull().default([]),
  maxJobsPerTechnician: integer("max_jobs_per_technician").notNull().default(6),
  prebookedJobsPerTechnician: integer("prebooked_jobs_per_technician").notNull().default(4),
  reservedUrgentSlots: integer("reserved_urgent_slots").notNull().default(2),
  centralCoastOnlyTechnician: text("central_coast_only_technician"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  status: text("status").notNull().default("queued"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  summary: jsonb("summary").$type<Record<string, unknown>>(),
  error: text("error"),
});

export const bookingLogs = pgTable("booking_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  servicem8JobUuid: text("servicem8_job_uuid").notNull(),
  action: text("action").notNull(),
  technicianUuid: text("technician_uuid"),
  plannedStart: timestamp("planned_start", { withTimezone: true }),
  plannedEnd: timestamp("planned_end", { withTimezone: true }),
  requestPayload: jsonb("request_payload").$type<Record<string, unknown>>(),
  responsePayload: jsonb("response_payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
