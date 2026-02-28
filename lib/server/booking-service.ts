import "server-only";

import { withClient, withTransaction } from "@/lib/db";
import type { PoolClient } from "pg";

type BookingView = "day" | "week" | "month";
type BookingStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";

type BookingEmployee = {
  id: string;
  companyId: string;
  name: string;
  specialty?: string | null;
  color?: string | null;
  timezone: string;
  slotDurationMin: number;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type BookingWorkRule = {
  id: string;
  employeeId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
};

type BookingBreakRule = {
  id: string;
  companyId: string;
  employeeId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  title?: string | null;
  isActive: boolean;
};

type BookingHoliday = {
  id: string;
  companyId: string;
  date: string;
  title: string;
  isRecurringYearly: boolean;
  isWorkingDayOverride: boolean;
};

type BookingTimeOff = {
  id: string;
  companyId: string;
  employeeId?: string | null;
  type: string;
  startsAt: string;
  endsAt: string;
  title?: string | null;
  notes?: string | null;
};

type BookingAppointment = {
  id: string;
  companyId: string;
  employeeId: string;
  startsAt: string;
  endsAt: string;
  durationMin?: number | null;
  status: BookingStatus | string;
  clientName: string;
  clientPhone?: string | null;
  clientIin?: string | null;
  clientBirthDate?: string | null;
  clientGender?: "male" | "female" | string | null;
  clientComment?: string | null;
  source: string;
  externalRef?: string | null;
  idempotencyKey?: string | null;
  createdByUserId?: string | null;
};

type BookingSlot = {
  employeeId: string;
  startsAt: string;
  endsAt: string;
  status: "available";
};

type BookingCalendarViewResponse = {
  view: BookingView;
  range: { from: string; to: string };
  employees: BookingEmployee[];
  workRules: BookingWorkRule[];
  breakRules: BookingBreakRule[];
  holidays: BookingHoliday[];
  timeOff: BookingTimeOff[];
  appointments: BookingAppointment[];
  slots: BookingSlot[];
};

type BookingRuleRangeInput = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  isActive?: boolean;
  title?: string;
};

type EmployeeInput = {
  name: string;
  specialty?: string;
  color?: string;
  timezone?: string;
  slotDurationMin?: number;
};

type UpdateEmployeeInput = {
  name?: string;
  specialty?: string | null;
  color?: string | null;
  slotDurationMin?: number;
  isActive?: boolean;
};

type CreateAppointmentInput = {
  employeeId: string;
  startsAt: string;
  endsAt: string;
  durationMin?: number;
  clientName: string;
  clientPhone?: string;
  clientIin?: string;
  clientComment?: string;
  source?: string;
  externalRef?: string;
  idempotencyKey?: string;
  createdByUserId?: string;
};

type UpdateAppointmentInput = Partial<CreateAppointmentInput> & {
  status?: BookingStatus | string;
  clientBirthDate?: string | null;
  clientGender?: string | null;
};

type CreateHolidayInput = {
  date: string;
  title: string;
  isRecurringYearly?: boolean;
  isWorkingDayOverride?: boolean;
};

type CreateTimeOffInput = {
  employeeId?: string | null;
  type: string;
  startsAt: string;
  endsAt: string;
  title?: string;
  notes?: string;
};

type CalendarViewParams = {
  view: BookingView;
  from: string;
  to: string;
  employeeIds?: string[];
  includeSlots?: boolean;
  durationMin?: number;
};

type EmployeesListParams = {
  includeInactive?: boolean;
};

type HolidaysListParams = {
  year?: number;
  from?: string;
  to?: string;
};

type EmployeeRow = {
  id: string;
  company_id: string;
  name: string;
  specialty: string | null;
  color: string | null;
  timezone: string;
  slot_duration_min: number;
  is_active: boolean;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type WorkRuleRow = {
  id: string;
  company_id: string;
  employee_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  is_active: boolean;
};

type BreakRuleRow = {
  id: string;
  company_id: string;
  employee_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  title: string | null;
  is_active: boolean;
};

type HolidayRow = {
  id: string;
  company_id: string;
  date: string | Date;
  title: string;
  is_recurring_yearly: boolean;
  is_working_day_override: boolean;
};

type TimeOffRow = {
  id: string;
  company_id: string;
  employee_id: string | null;
  type: string;
  starts_at: Date | string;
  ends_at: Date | string;
  title: string | null;
  notes: string | null;
};

type AppointmentRow = {
  id: string;
  company_id: string;
  employee_id: string;
  starts_at: Date | string;
  ends_at: Date | string;
  duration_min: number | null;
  status: BookingStatus | string;
  client_name: string;
  client_phone: string | null;
  client_iin: string | null;
  client_birth_date: string | null;
  client_gender: string | null;
  client_comment: string | null;
  source: string;
  external_ref: string | null;
  idempotency_key: string | null;
  created_by_user_id: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

const DEFAULT_TIMEZONE = "Asia/Almaty";
const DEFAULT_SLOT_STEP_MIN = 10;
const DEFAULT_WORKDAY_WEEKDAYS = [1, 2, 3, 4, 5] as const;
const DEFAULT_WORKDAY_START_MINUTE = 9 * 60;
const DEFAULT_WORKDAY_END_MINUTE = 18 * 60;
const ACTIVE_APPOINTMENT_STATUS_SQL = "status <> 'cancelled'";
const BOOKING_STATUSES: BookingStatus[] = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];

let schemaReadyPromise: Promise<void> | null = null;
const HOLIDAY_REQUIRED_COLUMNS = ["is_recurring_yearly", "is_working_day_override"] as const;

export class BookingServiceError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeCompanyId(companyId: string | null | undefined): string {
  const value = String(companyId || "").trim();
  return value || "default";
}

function randomId() {
  return crypto.randomUUID();
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  return Math.max(min, Math.min(max, rounded));
}

function normalizeOptionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeRequiredText(value: unknown, fieldName: string): string {
  const text = normalizeOptionalText(value);
  if (!text) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", `Field '${fieldName}' is required`);
  }
  return text;
}

function parseIsoDateTime(value: unknown, fieldName: string): Date {
  const text = normalizeRequiredText(value, fieldName);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", `Field '${fieldName}' must be valid ISO datetime`);
  }
  return date;
}

function parseDateOnly(value: unknown, fieldName: string): string {
  const text = normalizeRequiredText(value, fieldName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", `Field '${fieldName}' must be YYYY-MM-DD`);
  }
  return text;
}

function parseBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function parseStatus(value: unknown): BookingStatus {
  const status = normalizeRequiredText(value, "status").toLowerCase() as BookingStatus;
  if (!BOOKING_STATUSES.includes(status)) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", `Unsupported status '${status}'`);
  }
  return status;
}

function normalizeIin(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

function isValidIin(iin: string): boolean {
  if (!/^\d{12}$/.test(iin)) return false;
  const digits = iin.split("").map((d) => Number(d));
  const first = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const second = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];
  let checksum = 0;
  for (let i = 0; i < 11; i += 1) checksum += digits[i] * first[i];
  checksum %= 11;
  if (checksum === 10) {
    checksum = 0;
    for (let i = 0; i < 11; i += 1) checksum += digits[i] * second[i];
    checksum %= 11;
    if (checksum === 10) checksum = 0;
  }
  return checksum === digits[11];
}

function overlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

function toDateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateKey(key: string) {
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new BookingServiceError(400, "VALIDATION_ERROR", `Invalid date key '${key}'`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();
const weekdayFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const key = `dt:${timeZone}`;
  const existing = dateTimeFormatterCache.get(key);
  if (existing) return existing;
  const created = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  dateTimeFormatterCache.set(key, created);
  return created;
}

function getWeekdayFormatter(timeZone: string): Intl.DateTimeFormat {
  const key = `wd:${timeZone}`;
  const existing = weekdayFormatterCache.get(key);
  if (existing) return existing;
  const created = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  weekdayFormatterCache.set(key, created);
  return created;
}

function getTzParts(date: Date, timeZone: string) {
  const parts = getDateTimeFormatter(timeZone).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function getTzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = getTzParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

function zonedDateTimeToUtc(
  input: { year: number; month: number; day: number; hour: number; minute: number; second?: number },
  timeZone: string,
): Date {
  const initialUtcMs = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, input.second || 0);
  const probe = new Date(initialUtcMs);
  const offsetMinutes = getTzOffsetMinutes(probe, timeZone);
  return new Date(initialUtcMs - offsetMinutes * 60_000);
}

function localDateKeyFromUtc(date: Date, timeZone: string): string {
  const parts = getTzParts(date, timeZone);
  return toDateKey(parts.year, parts.month, parts.day);
}

function minuteOfDayInTz(date: Date, timeZone: string): number {
  const parts = getTzParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
}

function weekdayFromDateKey(dateKey: string, timeZone: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  const noonUtc = zonedDateTimeToUtc({ year, month, day, hour: 12, minute: 0, second: 0 }, timeZone);
  const short = getWeekdayFormatter(timeZone).format(noonUtc);
  const mapping: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = mapping[short];
  if (weekday === undefined) {
    throw new BookingServiceError(500, "INTERNAL_ERROR", `Unsupported weekday '${short}'`);
  }
  return weekday;
}

function addDaysToDateKey(dateKey: string, diffDays: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + diffDays);
  return toDateKey(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());
}

function localDateKeysBetween(from: Date, toExclusive: Date, timeZone: string): string[] {
  if (toExclusive <= from) return [];
  const startKey = localDateKeyFromUtc(from, timeZone);
  const endKey = localDateKeyFromUtc(new Date(toExclusive.getTime() - 1), timeZone);
  const keys: string[] = [];
  let current = startKey;
  while (current <= endKey) {
    keys.push(current);
    current = addDaysToDateKey(current, 1);
  }
  return keys;
}

function dateKeyMinuteToUtc(dateKey: string, minuteOfDay: number, timeZone: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  return zonedDateTimeToUtc(
    {
      year,
      month,
      day,
      hour: Math.floor(minuteOfDay / 60),
      minute: minuteOfDay % 60,
      second: 0,
    },
    timeZone,
  );
}

function monthDay(dateKey: string) {
  const { month, day } = parseDateKey(dateKey);
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeDateOnly(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function holidayMatchesDate(
  holiday: Pick<HolidayRow, "date" | "is_recurring_yearly"> | Pick<BookingHoliday, "date" | "isRecurringYearly">,
  dateKey: string,
) {
  const holidayDate = normalizeDateOnly(holiday.date);
  if (!holidayDate) return false;
  const isRecurring =
    "isRecurringYearly" in holiday
      ? Boolean(holiday.isRecurringYearly)
      : Boolean(holiday.is_recurring_yearly);
  if (!isRecurring) return holidayDate === dateKey;
  return holidayDate.slice(5) === monthDay(dateKey);
}

function mapEmployee(row: EmployeeRow): BookingEmployee {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    specialty: row.specialty,
    color: row.color,
    timezone: row.timezone || DEFAULT_TIMEZONE,
    slotDurationMin: row.slot_duration_min,
    isActive: row.is_active,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapWorkRule(row: WorkRuleRow): BookingWorkRule {
  return {
    id: row.id,
    employeeId: row.employee_id,
    weekday: row.weekday,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    isActive: row.is_active,
  };
}

function mapBreakRule(row: BreakRuleRow): BookingBreakRule {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    weekday: row.weekday,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    title: row.title,
    isActive: row.is_active,
  };
}

function mapHoliday(row: HolidayRow): BookingHoliday {
  return {
    id: row.id,
    companyId: row.company_id,
    date: normalizeDateOnly(row.date),
    title: row.title,
    isRecurringYearly: row.is_recurring_yearly,
    isWorkingDayOverride: row.is_working_day_override,
  };
}

function mapTimeOff(row: TimeOffRow): BookingTimeOff {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    type: row.type,
    startsAt: toIso(row.starts_at) || "",
    endsAt: toIso(row.ends_at) || "",
    title: row.title,
    notes: row.notes,
  };
}

function mapAppointment(row: AppointmentRow): BookingAppointment {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    startsAt: toIso(row.starts_at) || "",
    endsAt: toIso(row.ends_at) || "",
    durationMin: row.duration_min,
    status: row.status,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientIin: row.client_iin,
    clientBirthDate: row.client_birth_date,
    clientGender: row.client_gender,
    clientComment: row.client_comment,
    source: row.source,
    externalRef: row.external_ref,
    idempotencyKey: row.idempotency_key,
    createdByUserId: row.created_by_user_id,
  };
}

async function ensureBookingSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = withClient(async (client) => {
      await client.query(`
        CREATE SCHEMA IF NOT EXISTS calendar;

        CREATE TABLE IF NOT EXISTS calendar.employees (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          name TEXT NOT NULL,
          specialty TEXT,
          color TEXT,
          timezone TEXT NOT NULL DEFAULT '${DEFAULT_TIMEZONE}',
          slot_duration_min INTEGER NOT NULL DEFAULT 30,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS calendar.work_rules (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          employee_id TEXT NOT NULL REFERENCES calendar.employees(id) ON DELETE CASCADE,
          weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
          start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
          end_minute INTEGER NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS calendar.break_rules (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          employee_id TEXT NOT NULL REFERENCES calendar.employees(id) ON DELETE CASCADE,
          weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
          start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
          end_minute INTEGER NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
          title TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS calendar.holidays (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          date DATE NOT NULL,
          title TEXT NOT NULL,
          is_recurring_yearly BOOLEAN NOT NULL DEFAULT FALSE,
          is_working_day_override BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS calendar.time_off (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          employee_id TEXT REFERENCES calendar.employees(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          starts_at TIMESTAMPTZ NOT NULL,
          ends_at TIMESTAMPTZ NOT NULL,
          title TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS calendar.appointments (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          employee_id TEXT NOT NULL REFERENCES calendar.employees(id) ON DELETE CASCADE,
          starts_at TIMESTAMPTZ NOT NULL,
          ends_at TIMESTAMPTZ NOT NULL,
          duration_min INTEGER,
          status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
          client_name TEXT NOT NULL,
          client_phone TEXT,
          client_iin TEXT,
          client_birth_date DATE,
          client_gender TEXT,
          client_comment TEXT,
          source TEXT NOT NULL DEFAULT 'manual',
          external_ref TEXT,
          idempotency_key TEXT,
          created_by_user_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_calendar_employees_company_active
          ON calendar.employees (company_id, is_active);

        CREATE INDEX IF NOT EXISTS idx_calendar_work_rules_employee_weekday
          ON calendar.work_rules (company_id, employee_id, weekday, is_active);

        CREATE INDEX IF NOT EXISTS idx_calendar_break_rules_employee_weekday
          ON calendar.break_rules (company_id, employee_id, weekday, is_active);

        CREATE INDEX IF NOT EXISTS idx_calendar_holidays_company_date
          ON calendar.holidays (company_id, date);

        CREATE INDEX IF NOT EXISTS idx_calendar_time_off_company_employee_range
          ON calendar.time_off (company_id, employee_id, starts_at, ends_at);

        CREATE INDEX IF NOT EXISTS idx_calendar_appointments_company_employee_range
          ON calendar.appointments (company_id, employee_id, starts_at, ends_at);

        CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_appointments_external_ref
          ON calendar.appointments (company_id, external_ref)
          WHERE external_ref IS NOT NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_appointments_idempotency
          ON calendar.appointments (company_id, idempotency_key)
          WHERE idempotency_key IS NOT NULL;
      `);

      const { rows: holidayColumns } = await client.query<{ column_name: string }>(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'calendar'
            AND table_name = 'holidays'
            AND column_name = ANY($1::text[])
        `,
        [HOLIDAY_REQUIRED_COLUMNS],
      );
      const existingHolidayColumns = new Set(holidayColumns.map((row) => row.column_name));
      const missingHolidayColumns = HOLIDAY_REQUIRED_COLUMNS.filter((column) => !existingHolidayColumns.has(column));

      for (const column of missingHolidayColumns) {
        try {
          await client.query(
            `ALTER TABLE calendar.holidays ADD COLUMN IF NOT EXISTS ${column} BOOLEAN NOT NULL DEFAULT FALSE`,
          );
        } catch (error) {
          const pgLike = error as { code?: string; message?: string };
          if (pgLike?.code === "42501") {
            throw new BookingServiceError(
              500,
              "SCHEMA_PERMISSION_ERROR",
              "Database role cannot alter calendar.holidays; run migration manually or grant ALTER privilege",
              { missingColumn: column },
            );
          }
          throw error;
        }
      }
    });
  }

  await schemaReadyPromise;
}

async function loadEmployeeTx(client: PoolClient, companyId: string, employeeId: string) {
  const { rows } = await client.query<EmployeeRow>(
    `
      SELECT *
      FROM calendar.employees
      WHERE company_id = $1 AND id = $2
      LIMIT 1
    `,
    [companyId, employeeId],
  );
  const employee = rows[0];
  if (!employee) {
    throw new BookingServiceError(404, "EMPLOYEE_NOT_FOUND", "Employee not found");
  }
  return employee;
}

function normalizeRuleInput(rule: BookingRuleRangeInput, allowTitle: boolean) {
  const weekday = clampInt(rule.weekday, 0, 6, -1);
  const startMinute = clampInt(rule.startMinute, 0, 1439, -1);
  const endMinute = clampInt(rule.endMinute, 1, 1440, -1);
  if (weekday < 0 || startMinute < 0 || endMinute < 1) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "Invalid rule range values");
  }
  if (endMinute <= startMinute) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "Rule endMinute must be greater than startMinute");
  }
  return {
    weekday,
    startMinute,
    endMinute,
    isActive: parseBool(rule.isActive, true),
    title: allowTitle ? normalizeOptionalText(rule.title) : null,
  };
}

async function assertAppointmentPoliciesTx(
  client: PoolClient,
  params: {
    companyId: string;
    employeeId: string;
    startsAt: Date;
    endsAt: Date;
    ignoreAppointmentId?: string | null;
  },
) {
  const { companyId, employeeId, startsAt, endsAt, ignoreAppointmentId } = params;
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2)::bigint)`, [companyId, employeeId]);
  await loadEmployeeTx(client, companyId, employeeId);

  if (endsAt <= startsAt) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "End date must be greater than start date");
  }

  const startDateKey = localDateKeyFromUtc(startsAt, DEFAULT_TIMEZONE);
  const endDateKey = localDateKeyFromUtc(new Date(endsAt.getTime() - 1), DEFAULT_TIMEZONE);
  if (startDateKey !== endDateKey) {
    throw new BookingServiceError(409, "OUTSIDE_WORKING_HOURS", "Appointment must fit into one local day");
  }
  const weekday = weekdayFromDateKey(startDateKey, DEFAULT_TIMEZONE);
  const startMinute = minuteOfDayInTz(startsAt, DEFAULT_TIMEZONE);
  const endMinute = minuteOfDayInTz(endsAt, DEFAULT_TIMEZONE);

  const { rows: holidayRows } = await client.query<HolidayRow>(
    `
      SELECT *
      FROM calendar.holidays
      WHERE company_id = $1
        AND (
          date = $2::date
          OR (is_recurring_yearly = TRUE AND to_char(date, 'MM-DD') = to_char($2::date, 'MM-DD'))
        )
    `,
    [companyId, startDateKey],
  );

  if (holidayRows.some((holiday) => !holiday.is_working_day_override)) {
    throw new BookingServiceError(409, "BLOCKED_BY_HOLIDAY", "Date is blocked by holiday");
  }

  const { rows: workRules } = await client.query<WorkRuleRow>(
    `
      SELECT *
      FROM calendar.work_rules
      WHERE company_id = $1
        AND employee_id = $2
        AND weekday = $3
        AND is_active = TRUE
      ORDER BY start_minute ASC
    `,
    [companyId, employeeId, weekday],
  );

  if (!workRules.length) {
    throw new BookingServiceError(409, "OUTSIDE_WORKING_HOURS", "No working rules configured for this day");
  }

  const insideWorkingHours = workRules.some(
    (rule) => startMinute >= rule.start_minute && endMinute <= rule.end_minute,
  );
  if (!insideWorkingHours) {
    throw new BookingServiceError(409, "OUTSIDE_WORKING_HOURS", "Appointment is outside working hours");
  }

  const { rows: breakRules } = await client.query<BreakRuleRow>(
    `
      SELECT *
      FROM calendar.break_rules
      WHERE company_id = $1
        AND employee_id = $2
        AND weekday = $3
        AND is_active = TRUE
    `,
    [companyId, employeeId, weekday],
  );

  const overlapsBreak = breakRules.some(
    (rule) => startMinute < rule.end_minute && rule.start_minute < endMinute,
  );
  if (overlapsBreak) {
    throw new BookingServiceError(409, "BLOCKED_BY_BREAK", "Appointment overlaps employee break");
  }

  const { rows: timeOffRows } = await client.query<TimeOffRow>(
    `
      SELECT *
      FROM calendar.time_off
      WHERE company_id = $1
        AND (employee_id IS NULL OR employee_id = $2)
        AND starts_at < $4
        AND ends_at > $3
      LIMIT 1
    `,
    [companyId, employeeId, startsAt.toISOString(), endsAt.toISOString()],
  );
  if (timeOffRows.length) {
    throw new BookingServiceError(409, "BLOCKED_BY_VACATION", "Appointment overlaps blocked time");
  }

  const { rows: overlaps } = await client.query<{ id: string }>(
    `
      SELECT id
      FROM calendar.appointments
      WHERE company_id = $1
        AND employee_id = $2
        AND ${ACTIVE_APPOINTMENT_STATUS_SQL}
        AND starts_at < $4
        AND ends_at > $3
        AND ($5::text IS NULL OR id <> $5)
      LIMIT 1
    `,
    [companyId, employeeId, startsAt.toISOString(), endsAt.toISOString(), ignoreAppointmentId || null],
  );
  if (overlaps.length) {
    throw new BookingServiceError(409, "SLOT_CONFLICT", "Slot is already occupied");
  }
}

function buildSlots(params: {
  from: Date;
  to: Date;
  employees: BookingEmployee[];
  workRules: BookingWorkRule[];
  breakRules: BookingBreakRule[];
  holidays: BookingHoliday[];
  timeOff: BookingTimeOff[];
  appointments: BookingAppointment[];
  durationMin?: number;
}) {
  const workByEmployee = new Map<string, BookingWorkRule[]>();
  const breakByEmployee = new Map<string, BookingBreakRule[]>();
  const holidaysList = params.holidays;
  const timeOffByEmployee = new Map<string, BookingTimeOff[]>();
  const globalTimeOff: BookingTimeOff[] = [];
  const appointmentsByEmployee = new Map<string, BookingAppointment[]>();
  const slots: BookingSlot[] = [];

  for (const rule of params.workRules) {
    const list = workByEmployee.get(rule.employeeId) || [];
    list.push(rule);
    workByEmployee.set(rule.employeeId, list);
  }
  for (const rule of params.breakRules) {
    const list = breakByEmployee.get(rule.employeeId) || [];
    list.push(rule);
    breakByEmployee.set(rule.employeeId, list);
  }
  for (const item of params.timeOff) {
    if (!item.employeeId) {
      globalTimeOff.push(item);
      continue;
    }
    const list = timeOffByEmployee.get(item.employeeId) || [];
    list.push(item);
    timeOffByEmployee.set(item.employeeId, list);
  }
  for (const item of params.appointments) {
    if (item.status === "cancelled") continue;
    const list = appointmentsByEmployee.get(item.employeeId) || [];
    list.push(item);
    appointmentsByEmployee.set(item.employeeId, list);
  }

  const dateKeys = localDateKeysBetween(params.from, params.to, DEFAULT_TIMEZONE);
  for (const dateKey of dateKeys) {
    const weekday = weekdayFromDateKey(dateKey, DEFAULT_TIMEZONE);
    const dayHoliday = holidaysList.filter((holiday) => holidayMatchesDate(holiday, dateKey));
    const blockedByHoliday = dayHoliday.some((holiday) => !holiday.isWorkingDayOverride);

    for (const employee of params.employees) {
      const employeeDurationMin = clampInt(employee.slotDurationMin, DEFAULT_SLOT_STEP_MIN, 720, DEFAULT_SLOT_STEP_MIN);
      const durationMin =
        params.durationMin === undefined
          ? employeeDurationMin
          : clampInt(params.durationMin, DEFAULT_SLOT_STEP_MIN, 720, employeeDurationMin);
      const rules = (workByEmployee.get(employee.id) || [])
        .filter((rule) => rule.isActive && rule.weekday === weekday)
        .sort((a, b) => a.startMinute - b.startMinute);
      if (!rules.length) continue;
      if (blockedByHoliday) continue;

      const breaks = (breakByEmployee.get(employee.id) || []).filter(
        (rule) => rule.isActive && rule.weekday === weekday,
      );
      const employeeTimeOff = [...globalTimeOff, ...(timeOffByEmployee.get(employee.id) || [])];
      const employeeAppointments = appointmentsByEmployee.get(employee.id) || [];

      for (const work of rules) {
        for (
          let startMinute = work.startMinute;
          startMinute + durationMin <= work.endMinute;
          startMinute += employeeDurationMin
        ) {
          const endMinute = startMinute + durationMin;
          const overlapsBreak = breaks.some(
            (rule) => startMinute < rule.endMinute && rule.startMinute < endMinute,
          );
          if (overlapsBreak) continue;

          const slotStart = dateKeyMinuteToUtc(dateKey, startMinute, DEFAULT_TIMEZONE);
          const slotEnd = dateKeyMinuteToUtc(dateKey, endMinute, DEFAULT_TIMEZONE);

          const overlapsTimeOff = employeeTimeOff.some((item) => {
            const startsAt = new Date(item.startsAt);
            const endsAt = new Date(item.endsAt);
            return overlap(slotStart, slotEnd, startsAt, endsAt);
          });
          if (overlapsTimeOff) continue;

          const overlapsAppointment = employeeAppointments.some((item) => {
            const startsAt = new Date(item.startsAt);
            const endsAt = new Date(item.endsAt);
            return overlap(slotStart, slotEnd, startsAt, endsAt);
          });
          if (overlapsAppointment) continue;

          if (slotEnd <= params.from || slotStart >= params.to) continue;

          slots.push({
            employeeId: employee.id,
            startsAt: slotStart.toISOString(),
            endsAt: slotEnd.toISOString(),
            status: "available",
          });
        }
      }
    }
  }

  slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return slots;
}

export async function listBookingEmployees(companyIdRaw: string, params: EmployeesListParams = {}) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  return withClient(async (client) => {
    const { rows } = await client.query<EmployeeRow>(
      `
        SELECT *
        FROM calendar.employees
        WHERE company_id = $1
          AND ($2::boolean = TRUE OR is_active = TRUE)
        ORDER BY created_at ASC
      `,
      [companyId, parseBool(params.includeInactive, false)],
    );
    return { employees: rows.map(mapEmployee) };
  });
}

export async function createBookingEmployee(companyIdRaw: string, payload: EmployeeInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const name = normalizeRequiredText(payload.name, "name");
  const specialty = normalizeOptionalText(payload.specialty);
  const color = normalizeOptionalText(payload.color);
  const timezone = DEFAULT_TIMEZONE;
  const rawSlotDuration = Number(payload.slotDurationMin);
  if (
    payload.slotDurationMin !== undefined &&
    (!Number.isFinite(rawSlotDuration) ||
      rawSlotDuration < DEFAULT_SLOT_STEP_MIN ||
      rawSlotDuration > 720 ||
      rawSlotDuration % DEFAULT_SLOT_STEP_MIN !== 0)
  ) {
    throw new BookingServiceError(
      400,
      "VALIDATION_ERROR",
      `Field 'slotDurationMin' must be between ${DEFAULT_SLOT_STEP_MIN} and 720 and multiple of ${DEFAULT_SLOT_STEP_MIN}`,
    );
  }
  const slotDurationMin = clampInt(payload.slotDurationMin, DEFAULT_SLOT_STEP_MIN, 720, DEFAULT_SLOT_STEP_MIN);
  const id = randomId();

  return withTransaction(async (client) => {
    const { rows } = await client.query<EmployeeRow>(
      `
        INSERT INTO calendar.employees (
          id, company_id, name, specialty, color, timezone, slot_duration_min, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())
        RETURNING *
      `,
      [id, companyId, name, specialty, color, timezone, slotDurationMin],
    );

    for (const weekday of DEFAULT_WORKDAY_WEEKDAYS) {
      await client.query(
        `
          INSERT INTO calendar.work_rules (
            id, company_id, employee_id, weekday, start_minute, end_minute, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
        `,
        [randomId(), companyId, id, weekday, DEFAULT_WORKDAY_START_MINUTE, DEFAULT_WORKDAY_END_MINUTE],
      );
    }

    return { employee: mapEmployee(rows[0]) };
  });
}

export async function updateBookingEmployee(companyIdRaw: string, employeeId: string, payload: UpdateEmployeeInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const employeeIdNormalized = normalizeRequiredText(employeeId, "employeeId");

  const rawSlotDuration = Number(payload.slotDurationMin);
  if (
    payload.slotDurationMin !== undefined &&
    (!Number.isFinite(rawSlotDuration) ||
      rawSlotDuration < DEFAULT_SLOT_STEP_MIN ||
      rawSlotDuration > 720 ||
      rawSlotDuration % DEFAULT_SLOT_STEP_MIN !== 0)
  ) {
    throw new BookingServiceError(
      400,
      "VALIDATION_ERROR",
      `Field 'slotDurationMin' must be between ${DEFAULT_SLOT_STEP_MIN} and 720 and multiple of ${DEFAULT_SLOT_STEP_MIN}`,
    );
  }

  return withClient(async (client) => {
    const existing = await loadEmployeeTx(client, companyId, employeeIdNormalized);
    const name = payload.name !== undefined ? normalizeRequiredText(payload.name, "name") : existing.name;
    const specialty = payload.specialty !== undefined ? normalizeOptionalText(payload.specialty) : existing.specialty;
    const color = payload.color !== undefined ? normalizeOptionalText(payload.color) : existing.color;
    const slotDurationMin =
      payload.slotDurationMin !== undefined
        ? clampInt(payload.slotDurationMin, DEFAULT_SLOT_STEP_MIN, 720, existing.slot_duration_min || DEFAULT_SLOT_STEP_MIN)
        : existing.slot_duration_min;
    const isActive =
      payload.isActive !== undefined ? parseBool(payload.isActive, existing.is_active) : existing.is_active;

    const { rows } = await client.query<EmployeeRow>(
      `
        UPDATE calendar.employees
        SET
          name = $3,
          specialty = $4,
          color = $5,
          slot_duration_min = $6,
          is_active = $7,
          updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [companyId, employeeIdNormalized, name, specialty, color, slotDurationMin, isActive],
    );

    return { employee: mapEmployee(rows[0]) };
  });
}

export async function replaceBookingEmployeeWorkRules(
  companyIdRaw: string,
  employeeId: string,
  workRulesInput: BookingRuleRangeInput[],
) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const employeeIdNormalized = normalizeRequiredText(employeeId, "employeeId");
  const rules = (workRulesInput || []).map((rule) => normalizeRuleInput(rule, false));

  return withTransaction(async (client) => {
    await loadEmployeeTx(client, companyId, employeeIdNormalized);
    await client.query(
      `DELETE FROM calendar.work_rules WHERE company_id = $1 AND employee_id = $2`,
      [companyId, employeeIdNormalized],
    );
    for (const rule of rules) {
      await client.query(
        `
          INSERT INTO calendar.work_rules (
            id, company_id, employee_id, weekday, start_minute, end_minute, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        `,
        [randomId(), companyId, employeeIdNormalized, rule.weekday, rule.startMinute, rule.endMinute, rule.isActive],
      );
    }
    const { rows } = await client.query<WorkRuleRow>(
      `
        SELECT *
        FROM calendar.work_rules
        WHERE company_id = $1 AND employee_id = $2
        ORDER BY weekday, start_minute
      `,
      [companyId, employeeIdNormalized],
    );
    return { workRules: rows.map(mapWorkRule) };
  });
}

export async function replaceBookingEmployeeBreakRules(
  companyIdRaw: string,
  employeeId: string,
  breakRulesInput: BookingRuleRangeInput[],
) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const employeeIdNormalized = normalizeRequiredText(employeeId, "employeeId");
  const rules = (breakRulesInput || []).map((rule) => normalizeRuleInput(rule, true));

  return withTransaction(async (client) => {
    await loadEmployeeTx(client, companyId, employeeIdNormalized);
    await client.query(
      `DELETE FROM calendar.break_rules WHERE company_id = $1 AND employee_id = $2`,
      [companyId, employeeIdNormalized],
    );
    for (const rule of rules) {
      await client.query(
        `
          INSERT INTO calendar.break_rules (
            id, company_id, employee_id, weekday, start_minute, end_minute, title, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        `,
        [
          randomId(),
          companyId,
          employeeIdNormalized,
          rule.weekday,
          rule.startMinute,
          rule.endMinute,
          rule.title,
          rule.isActive,
        ],
      );
    }
    const { rows } = await client.query<BreakRuleRow>(
      `
        SELECT *
        FROM calendar.break_rules
        WHERE company_id = $1 AND employee_id = $2
        ORDER BY weekday, start_minute
      `,
      [companyId, employeeIdNormalized],
    );
    return { breakRules: rows.map(mapBreakRule) };
  });
}

export async function fetchBookingCalendarView(companyIdRaw: string, params: CalendarViewParams): Promise<BookingCalendarViewResponse> {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const view = params.view;
  if (view !== "day" && view !== "week" && view !== "month") {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "Invalid view");
  }
  const from = parseIsoDateTime(params.from, "from");
  const to = parseIsoDateTime(params.to, "to");
  if (to <= from) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "Invalid range: 'to' must be greater than 'from'");
  }
  const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays > 93) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "Range is too large");
  }

  const employeeIds =
    params.employeeIds
      ?.map((id) => normalizeOptionalText(id))
      .filter((id): id is string => Boolean(id)) || [];
  const includeSlots = parseBool(params.includeSlots, false);
  const durationMin =
    params.durationMin === undefined || params.durationMin === null
      ? undefined
      : clampInt(params.durationMin, DEFAULT_SLOT_STEP_MIN, 720, DEFAULT_SLOT_STEP_MIN);

  return withClient(async (client) => {
    const { rows: employeeRows } = await client.query<EmployeeRow>(
      `
        SELECT *
        FROM calendar.employees
        WHERE company_id = $1
          AND is_active = TRUE
          AND (
            coalesce(array_length($2::text[], 1), 0) = 0
            OR id = ANY($2::text[])
          )
        ORDER BY created_at ASC
      `,
      [companyId, employeeIds],
    );

    const employees = employeeRows.map(mapEmployee);
    if (!employees.length) {
      return {
        view,
        range: { from: from.toISOString(), to: to.toISOString() },
        employees: [],
        workRules: [],
        breakRules: [],
        holidays: [],
        timeOff: [],
        appointments: [],
        slots: [],
      };
    }

    const targetEmployeeIds = employees.map((employee) => employee.id);
    const startDateKey = localDateKeyFromUtc(from, DEFAULT_TIMEZONE);
    const endDateKey = localDateKeyFromUtc(new Date(to.getTime() - 1), DEFAULT_TIMEZONE);

    const { rows: workRuleRows } = await client.query<WorkRuleRow>(
      `
        SELECT *
        FROM calendar.work_rules
        WHERE company_id = $1
          AND employee_id = ANY($2::text[])
      `,
      [companyId, targetEmployeeIds],
    );

    const { rows: breakRuleRows } = await client.query<BreakRuleRow>(
      `
        SELECT *
        FROM calendar.break_rules
        WHERE company_id = $1
          AND employee_id = ANY($2::text[])
      `,
      [companyId, targetEmployeeIds],
    );

    const { rows: holidayRows } = await client.query<HolidayRow>(
      `
        SELECT *
        FROM calendar.holidays
        WHERE company_id = $1
          AND (
            (is_recurring_yearly = FALSE AND date >= $2::date AND date <= $3::date)
            OR is_recurring_yearly = TRUE
          )
        ORDER BY date ASC
      `,
      [companyId, startDateKey, endDateKey],
    );

    const { rows: timeOffRows } = await client.query<TimeOffRow>(
      `
        SELECT *
        FROM calendar.time_off
        WHERE company_id = $1
          AND starts_at < $4
          AND ends_at > $3
          AND (
            employee_id IS NULL
            OR employee_id = ANY($2::text[])
          )
        ORDER BY starts_at ASC
      `,
      [companyId, targetEmployeeIds, from.toISOString(), to.toISOString()],
    );

    const { rows: appointmentRows } = await client.query<AppointmentRow>(
      `
        SELECT *
        FROM calendar.appointments
        WHERE company_id = $1
          AND employee_id = ANY($2::text[])
          AND starts_at < $4
          AND ends_at > $3
        ORDER BY starts_at ASC
      `,
      [companyId, targetEmployeeIds, from.toISOString(), to.toISOString()],
    );

    const workRules = workRuleRows.map(mapWorkRule);
    const breakRules = breakRuleRows.map(mapBreakRule);
    const holidays = holidayRows.map(mapHoliday);
    const timeOff = timeOffRows.map(mapTimeOff);
    const appointments = appointmentRows.map(mapAppointment);
    const slots = includeSlots
      ? buildSlots({
          from,
          to,
          employees,
          workRules,
          breakRules,
          holidays,
          timeOff,
          appointments,
          durationMin,
        })
      : [];

    return {
      view,
      range: { from: from.toISOString(), to: to.toISOString() },
      employees,
      workRules,
      breakRules,
      holidays,
      timeOff,
      appointments,
      slots,
    };
  });
}

export async function createBookingAppointment(companyIdRaw: string, payload: CreateAppointmentInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const employeeId = normalizeRequiredText(payload.employeeId, "employeeId");
  const startsAt = parseIsoDateTime(payload.startsAt, "startsAt");
  const endsAt = parseIsoDateTime(payload.endsAt, "endsAt");
  const clientName = normalizeRequiredText(payload.clientName, "clientName");
  const clientPhone = normalizeOptionalText(payload.clientPhone);
  const clientIin = normalizeIin(normalizeOptionalText(payload.clientIin));
  const clientComment = normalizeOptionalText(payload.clientComment);
  const source = normalizeOptionalText(payload.source) || "manual";
  const externalRef = normalizeOptionalText(payload.externalRef);
  const idempotencyKey = normalizeOptionalText(payload.idempotencyKey);
  const createdByUserId = normalizeOptionalText(payload.createdByUserId);
  const durationMin = clampInt(payload.durationMin, 5, 720, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000));

  if (clientIin && !isValidIin(clientIin)) {
    throw new BookingServiceError(400, "INVALID_IIN", "Invalid IIN");
  }
  if (endsAt <= startsAt) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "End date must be greater than start date");
  }

  return withTransaction(async (client) => {
    if (idempotencyKey) {
      const { rows: existingByIdempotency } = await client.query<AppointmentRow>(
        `
          SELECT *
          FROM calendar.appointments
          WHERE company_id = $1
            AND idempotency_key = $2
          LIMIT 1
        `,
        [companyId, idempotencyKey],
      );
      if (existingByIdempotency.length) {
        return { appointment: mapAppointment(existingByIdempotency[0]) };
      }
    }

    if (externalRef) {
      const { rows: existingByExternalRef } = await client.query<AppointmentRow>(
        `
          SELECT id
          FROM calendar.appointments
          WHERE company_id = $1
            AND external_ref = $2
          LIMIT 1
        `,
        [companyId, externalRef],
      );
      if (existingByExternalRef.length) {
        throw new BookingServiceError(409, "DUPLICATE_EXTERNAL_REF", "externalRef must be unique within company");
      }
    }

    await assertAppointmentPoliciesTx(client, {
      companyId,
      employeeId,
      startsAt,
      endsAt,
    });

    const id = randomId();
    const { rows } = await client.query<AppointmentRow>(
      `
        INSERT INTO calendar.appointments (
          id,
          company_id,
          employee_id,
          starts_at,
          ends_at,
          duration_min,
          status,
          client_name,
          client_phone,
          client_iin,
          client_comment,
          source,
          external_ref,
          idempotency_key,
          created_by_user_id,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, 'scheduled', $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
        )
        RETURNING *
      `,
      [
        id,
        companyId,
        employeeId,
        startsAt.toISOString(),
        endsAt.toISOString(),
        durationMin,
        clientName,
        clientPhone,
        clientIin,
        clientComment,
        source,
        externalRef,
        idempotencyKey,
        createdByUserId,
      ],
    );

    return { appointment: mapAppointment(rows[0]) };
  });
}

export async function updateBookingAppointment(companyIdRaw: string, appointmentId: string, payload: UpdateAppointmentInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const id = normalizeRequiredText(appointmentId, "appointmentId");

  return withTransaction(async (client) => {
    const { rows: existingRows } = await client.query<AppointmentRow>(
      `
        SELECT *
        FROM calendar.appointments
        WHERE company_id = $1 AND id = $2
        LIMIT 1
      `,
      [companyId, id],
    );
    const existing = existingRows[0];
    if (!existing) {
      throw new BookingServiceError(404, "APPOINTMENT_NOT_FOUND", "Appointment not found");
    }

    const employeeId = normalizeOptionalText(payload.employeeId) || existing.employee_id;
    const startsAt = payload.startsAt ? parseIsoDateTime(payload.startsAt, "startsAt") : new Date(existing.starts_at);
    const endsAt = payload.endsAt ? parseIsoDateTime(payload.endsAt, "endsAt") : new Date(existing.ends_at);
    const durationMin = clampInt(
      payload.durationMin,
      5,
      720,
      Math.max(5, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)),
    );
    const status = payload.status ? parseStatus(payload.status) : (existing.status as BookingStatus);
    const clientName = payload.clientName ? normalizeRequiredText(payload.clientName, "clientName") : existing.client_name;
    const clientPhone = payload.clientPhone !== undefined ? normalizeOptionalText(payload.clientPhone) : existing.client_phone;
    const clientIinRaw =
      payload.clientIin !== undefined ? normalizeOptionalText(payload.clientIin) : existing.client_iin;
    const clientIin = normalizeIin(clientIinRaw);
    const clientComment =
      payload.clientComment !== undefined ? normalizeOptionalText(payload.clientComment) : existing.client_comment;
    const source = payload.source !== undefined ? normalizeOptionalText(payload.source) || "manual" : existing.source;
    const externalRef =
      payload.externalRef !== undefined ? normalizeOptionalText(payload.externalRef) : existing.external_ref;
    const idempotencyKey =
      payload.idempotencyKey !== undefined ? normalizeOptionalText(payload.idempotencyKey) : existing.idempotency_key;
    const createdByUserId =
      payload.createdByUserId !== undefined ? normalizeOptionalText(payload.createdByUserId) : existing.created_by_user_id;
    const clientBirthDate =
      payload.clientBirthDate !== undefined
        ? payload.clientBirthDate
          ? parseDateOnly(payload.clientBirthDate, "clientBirthDate")
          : null
        : existing.client_birth_date;
    const clientGender =
      payload.clientGender !== undefined ? normalizeOptionalText(payload.clientGender) : existing.client_gender;

    if (endsAt <= startsAt) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", "End date must be greater than start date");
    }
    if (clientIin && !isValidIin(clientIin)) {
      throw new BookingServiceError(400, "INVALID_IIN", "Invalid IIN");
    }

    if (externalRef) {
      const { rows: duplicateRef } = await client.query<{ id: string }>(
        `
          SELECT id
          FROM calendar.appointments
          WHERE company_id = $1
            AND external_ref = $2
            AND id <> $3
          LIMIT 1
        `,
        [companyId, externalRef, id],
      );
      if (duplicateRef.length) {
        throw new BookingServiceError(409, "DUPLICATE_EXTERNAL_REF", "externalRef must be unique within company");
      }
    }

    if (idempotencyKey) {
      const { rows: duplicateIdempotency } = await client.query<{ id: string }>(
        `
          SELECT id
          FROM calendar.appointments
          WHERE company_id = $1
            AND idempotency_key = $2
            AND id <> $3
          LIMIT 1
        `,
        [companyId, idempotencyKey, id],
      );
      if (duplicateIdempotency.length) {
        throw new BookingServiceError(409, "DUPLICATE_IDEMPOTENCY_KEY", "idempotencyKey must be unique within company");
      }
    }

    if (status !== "cancelled") {
      await assertAppointmentPoliciesTx(client, {
        companyId,
        employeeId,
        startsAt,
        endsAt,
        ignoreAppointmentId: id,
      });
    }

    const { rows: updatedRows } = await client.query<AppointmentRow>(
      `
        UPDATE calendar.appointments
        SET
          employee_id = $3,
          starts_at = $4,
          ends_at = $5,
          duration_min = $6,
          status = $7,
          client_name = $8,
          client_phone = $9,
          client_iin = $10,
          client_birth_date = $11,
          client_gender = $12,
          client_comment = $13,
          source = $14,
          external_ref = $15,
          idempotency_key = $16,
          created_by_user_id = $17,
          updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [
        companyId,
        id,
        employeeId,
        startsAt.toISOString(),
        endsAt.toISOString(),
        durationMin,
        status,
        clientName,
        clientPhone,
        clientIin,
        clientBirthDate,
        clientGender,
        clientComment,
        source,
        externalRef,
        idempotencyKey,
        createdByUserId,
      ],
    );

    return { appointment: mapAppointment(updatedRows[0]) };
  });
}

export async function cancelBookingAppointment(companyIdRaw: string, appointmentId: string) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const id = normalizeRequiredText(appointmentId, "appointmentId");

  return withClient(async (client) => {
    const { rows } = await client.query<AppointmentRow>(
      `
        UPDATE calendar.appointments
        SET status = 'cancelled', updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [companyId, id],
    );
    if (!rows.length) {
      throw new BookingServiceError(404, "APPOINTMENT_NOT_FOUND", "Appointment not found");
    }
    return { appointment: mapAppointment(rows[0]) };
  });
}

export async function listBookingHolidays(companyIdRaw: string, params: HolidaysListParams = {}) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);

  let fromDate = normalizeOptionalText(params.from);
  let toDate = normalizeOptionalText(params.to);
  if (Number.isFinite(params.year)) {
    const year = Number(params.year);
    fromDate = `${year}-01-01`;
    toDate = `${year}-12-31`;
  }

  if (fromDate) fromDate = parseDateOnly(fromDate, "from");
  if (toDate) toDate = parseDateOnly(toDate, "to");

  return withClient(async (client) => {
    const { rows } = await client.query<HolidayRow>(
      `
        SELECT *
        FROM calendar.holidays
        WHERE company_id = $1
          AND (
            ($2::date IS NULL AND $3::date IS NULL)
            OR (
              (is_recurring_yearly = FALSE AND date >= COALESCE($2::date, date) AND date <= COALESCE($3::date, date))
              OR is_recurring_yearly = TRUE
            )
          )
        ORDER BY date ASC, created_at ASC
      `,
      [companyId, fromDate || null, toDate || null],
    );
    return { holidays: rows.map(mapHoliday) };
  });
}

export async function createBookingHoliday(companyIdRaw: string, payload: CreateHolidayInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const date = parseDateOnly(payload.date, "date");
  const title = normalizeRequiredText(payload.title, "title");
  const isRecurringYearly = parseBool(payload.isRecurringYearly, false);
  const isWorkingDayOverride = parseBool(payload.isWorkingDayOverride, false);

  return withClient(async (client) => {
    const { rows } = await client.query<HolidayRow>(
      `
        INSERT INTO calendar.holidays (
          id, company_id, date, title, is_recurring_yearly, is_working_day_override, created_at, updated_at
        )
        VALUES ($1, $2, $3::date, $4, $5, $6, NOW(), NOW())
        RETURNING *
      `,
      [randomId(), companyId, date, title, isRecurringYearly, isWorkingDayOverride],
    );
    return { holiday: mapHoliday(rows[0]) };
  });
}

export async function createBookingTimeOff(companyIdRaw: string, payload: CreateTimeOffInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const employeeId = normalizeOptionalText(payload.employeeId);
  const type = normalizeRequiredText(payload.type, "type");
  const startsAt = parseIsoDateTime(payload.startsAt, "startsAt");
  const endsAt = parseIsoDateTime(payload.endsAt, "endsAt");
  const title = normalizeOptionalText(payload.title);
  const notes = normalizeOptionalText(payload.notes);
  if (endsAt <= startsAt) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "End date must be greater than start date");
  }

  return withTransaction(async (client) => {
    if (employeeId) {
      await loadEmployeeTx(client, companyId, employeeId);
    }

    const { rows } = await client.query<TimeOffRow>(
      `
        INSERT INTO calendar.time_off (
          id, company_id, employee_id, type, starts_at, ends_at, title, notes, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `,
      [randomId(), companyId, employeeId, type, startsAt.toISOString(), endsAt.toISOString(), title, notes],
    );
    return { item: mapTimeOff(rows[0]) };
  });
}
