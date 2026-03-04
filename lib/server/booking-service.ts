import "server-only";

import { withClient, withTransaction } from "@/lib/db";
import type { PoolClient } from "pg";

type BookingView = "day" | "week" | "month";
type BookingStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
type BookingPaymentMethod = "kaspi_transfer" | "kaspi_qr" | "cash" | "bank_transfer";
type BookingPaymentStatus = "awaiting_payment" | "prepaid" | "paid" | "cancelled";
type BookingExpenseStatus = "unpaid" | "paid";
type BookingCompensationType = "percent" | "fixed";
type BookingPaymentKind = "prepaid" | "payment" | "adjustment";
type BookingAppointmentType = "primary" | "secondary" | "other";

type BookingEmployee = {
  id: string;
  companyId: string;
  name: string;
  specialty?: string | null;
  photoUrl?: string | null;
  description?: string | null;
  color?: string | null;
  timezone: string;
  slotDurationMin: number;
  compensationType: BookingCompensationType | string;
  compensationValue: number;
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

type BookingWorkdayOverride = {
  id: string;
  companyId: string;
  employeeId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
  breakTitle?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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
  clientId?: string | null;
  serviceId?: string | null;
  serviceNameSnapshot?: string | null;
  serviceTypeSnapshot?: BookingAppointmentType | string | null;
  serviceDurationMinSnapshot?: number | null;
  startsAt: string;
  endsAt: string;
  durationMin?: number | null;
  status: BookingStatus | string;
  appointmentType?: BookingAppointmentType | string | null;
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
  serviceAmount: number;
  prepaidAmount: number;
  prepaidPaymentMethod?: BookingPaymentMethod | string | null;
  settlementAmount: number;
  settlementPaymentMethod?: BookingPaymentMethod | string | null;
  paymentStatus: BookingPaymentStatus | string;
};

type BookingClient = {
  id: string;
  companyId: string;
  fullName: string;
  phone?: string | null;
  iin?: string | null;
  birthDate?: string | null;
  gender?: "male" | "female" | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type BookingServicePrice = {
  id: string;
  companyId: string;
  serviceId: string;
  employeeId: string;
  price: number;
  compensationType: BookingCompensationType | string;
  compensationValue: number;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type BookingService = {
  id: string;
  companyId: string;
  name: string;
  basePrice: number;
  durationMin: number;
  category?: string | null;
  direction?: string | null;
  serviceType?: string | null;
  description?: string | null;
  isActive: boolean;
  prices: BookingServicePrice[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

type BookingExpense = {
  id: string;
  companyId: string;
  appointmentId: string;
  employeeId: string;
  amount: number;
  status: BookingExpenseStatus | string;
  paidAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type BookingPayment = {
  id: string;
  companyId: string;
  appointmentId: string;
  amount: number;
  paymentMethod: BookingPaymentMethod | string;
  paymentKind: BookingPaymentKind | string;
  createdAt?: string | null;
  updatedAt?: string | null;
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
  workdayOverrides: BookingWorkdayOverride[];
  timeOff: BookingTimeOff[];
  appointments: BookingAppointment[];
  payments: BookingPayment[];
  expenses: BookingExpense[];
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
  photoUrl?: string;
  description?: string;
  color?: string;
  timezone?: string;
  slotDurationMin?: number;
  compensationType?: BookingCompensationType | string;
  compensationValue?: number;
};

type UpdateEmployeeInput = {
  name?: string;
  specialty?: string | null;
  photoUrl?: string | null;
  description?: string | null;
  color?: string | null;
  slotDurationMin?: number;
  compensationType?: BookingCompensationType | string;
  compensationValue?: number;
  isActive?: boolean;
};

type ClientInput = {
  fullName: string;
  phone?: string;
  iin?: string;
  birthDate?: string | null;
  gender?: string | null;
};

type UpdateClientInput = {
  fullName?: string;
  phone?: string | null;
  iin?: string | null;
  birthDate?: string | null;
  gender?: string | null;
};

type ServicePriceInput = {
  employeeId: string;
  price?: number;
  compensationType?: BookingCompensationType | string;
  compensationValue?: number;
  isActive?: boolean;
};

type ServiceInput = {
  name: string;
  basePrice?: number;
  durationMin?: number;
  category?: string;
  direction?: string;
  serviceType?: string;
  description?: string;
  isActive?: boolean;
  employeePrices?: ServicePriceInput[];
};

type UpdateServiceInput = {
  name?: string;
  basePrice?: number;
  durationMin?: number;
  category?: string | null;
  direction?: string | null;
  serviceType?: string | null;
  description?: string | null;
  isActive?: boolean;
  employeePrices?: ServicePriceInput[];
};

type CreateAppointmentInput = {
  employeeId: string;
  clientId?: string | null;
  serviceId?: string | null;
  startsAt: string;
  endsAt: string;
  durationMin?: number;
  appointmentType?: BookingAppointmentType | string;
  clientName: string;
  clientPhone?: string;
  clientIin?: string;
  clientBirthDate?: string | null;
  clientGender?: string | null;
  clientComment?: string;
  source?: string;
  externalRef?: string;
  idempotencyKey?: string;
  createdByUserId?: string;
  serviceAmount?: number;
  prepaidAmount?: number;
  prepaidPaymentMethod?: BookingPaymentMethod | string;
  settlementAmount?: number;
  settlementPaymentMethod?: BookingPaymentMethod | string;
  paymentStatus?: BookingPaymentStatus | string;
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

type UpdateHolidayInput = {
  date?: string;
  title?: string;
  isRecurringYearly?: boolean;
  isWorkingDayOverride?: boolean;
};

type CreateWorkdayOverrideInput = {
  employeeId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  breakStartMinute?: number | null;
  breakEndMinute?: number | null;
  breakTitle?: string | null;
};

type UpdateWorkdayOverrideInput = {
  employeeId?: string;
  date?: string;
  startMinute?: number;
  endMinute?: number;
  breakStartMinute?: number | null;
  breakEndMinute?: number | null;
  breakTitle?: string | null;
};

type CreateTimeOffInput = {
  employeeId?: string | null;
  type: string;
  startsAt: string;
  endsAt: string;
  title?: string;
  notes?: string;
};

type UpdateTimeOffInput = {
  employeeId?: string | null;
  type?: string;
  startsAt?: string;
  endsAt?: string;
  title?: string | null;
  notes?: string | null;
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

type ServicesListParams = {
  includeInactive?: boolean;
};

type ClientsListParams = {
  search?: string;
  limit?: number;
};

type HolidaysListParams = {
  year?: number;
  from?: string;
  to?: string;
};

type WorkdayOverridesListParams = {
  employeeId?: string;
  from?: string;
  to?: string;
  limit?: number;
};

type EmployeeRow = {
  id: string;
  company_id: string;
  name: string;
  specialty: string | null;
  photo_url: string | null;
  description: string | null;
  color: string | null;
  timezone: string;
  slot_duration_min: number;
  is_active: boolean;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type EmployeeCompensationRow = {
  employee_id: string;
  company_id: string;
  compensation_type: BookingCompensationType | string;
  compensation_value: number;
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

type WorkdayOverrideRow = {
  id: string;
  company_id: string;
  employee_id: string;
  date: string | Date;
  start_minute: number;
  end_minute: number;
  break_start_minute: number | null;
  break_end_minute: number | null;
  break_title: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
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
  client_id: string | null;
  service_id: string | null;
  service_name_snapshot: string | null;
  service_type_snapshot: string | null;
  service_duration_min_snapshot: number | null;
  starts_at: Date | string;
  ends_at: Date | string;
  duration_min: number | null;
  status: BookingStatus | string;
  appointment_type: BookingAppointmentType | string | null;
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

type ClientRow = {
  id: string;
  company_id: string;
  full_name: string;
  phone: string | null;
  iin: string | null;
  birth_date: string | null;
  gender: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type ServiceRow = {
  id: string;
  company_id: string;
  name: string;
  base_price: number;
  duration_min: number;
  category: string | null;
  direction: string | null;
  service_type: string | null;
  description: string | null;
  is_active: boolean;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type ServicePriceRow = {
  id: string;
  company_id: string;
  service_id: string;
  employee_id: string;
  price: number;
  compensation_type: BookingCompensationType | string;
  compensation_value: number;
  is_active: boolean;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type AppointmentFinanceRow = {
  appointment_id: string;
  company_id: string;
  service_amount: number;
  compensation_type_snapshot: BookingCompensationType | string | null;
  compensation_value_snapshot: number | null;
  prepaid_amount: number;
  prepaid_payment_method: BookingPaymentMethod | string | null;
  settlement_amount: number;
  settlement_payment_method: BookingPaymentMethod | string | null;
  payment_status: BookingPaymentStatus | string;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type AppointmentExpenseRow = {
  id: string;
  company_id: string;
  appointment_id: string;
  employee_id: string;
  amount: number;
  status: BookingExpenseStatus | string;
  paid_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type AppointmentPaymentRow = {
  id: string;
  company_id: string;
  appointment_id: string;
  amount: number;
  payment_method: BookingPaymentMethod | string;
  payment_kind: BookingPaymentKind | string;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

const DEFAULT_TIMEZONE = "Asia/Almaty";
const DEFAULT_SLOT_STEP_MIN = 5;
const DEFAULT_SERVICE_DURATION_MIN = 30;
const DEFAULT_WORKDAY_WEEKDAYS = [1, 2, 3, 4, 5] as const;
const DEFAULT_WORKDAY_START_MINUTE = 9 * 60;
const DEFAULT_WORKDAY_END_MINUTE = 18 * 60;
const ACTIVE_APPOINTMENT_STATUS_SQL = "status <> 'cancelled'";
const BOOKING_STATUSES: BookingStatus[] = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];
const BOOKING_APPOINTMENT_TYPES: BookingAppointmentType[] = ["primary", "secondary", "other"];
const BOOKING_PAYMENT_METHODS: BookingPaymentMethod[] = ["kaspi_transfer", "kaspi_qr", "cash", "bank_transfer"];
const BOOKING_PAYMENT_STATUSES: BookingPaymentStatus[] = ["awaiting_payment", "prepaid", "paid", "cancelled"];
const BOOKING_EXPENSE_STATUSES: BookingExpenseStatus[] = ["unpaid", "paid"];
const BOOKING_COMPENSATION_TYPES: BookingCompensationType[] = ["percent", "fixed"];
const BOOKING_PAYMENT_KINDS: BookingPaymentKind[] = ["prepaid", "payment", "adjustment"];

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

function parseAppointmentType(value: unknown, fallback: BookingAppointmentType = "primary"): BookingAppointmentType {
  const appointmentType = normalizeOptionalText(value);
  if (!appointmentType) return fallback;
  const normalized = appointmentType.toLowerCase() as BookingAppointmentType;
  if (!BOOKING_APPOINTMENT_TYPES.includes(normalized)) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", `Unsupported appointmentType '${normalized}'`);
  }
  return normalized;
}

function normalizeAppointmentPhone(value: unknown): string | null {
  const phone = normalizeOptionalText(value);
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11) return `7${digits}`;
  if (digits.length === 12 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `7${digits.slice(1)}`;
  }

  throw new BookingServiceError(400, "VALIDATION_ERROR", "clientPhone must contain 11 digits after +7");
}

function clampMoney(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return Math.max(0, Math.round(fallback));
  return Math.max(0, Math.round(n));
}

function parsePaymentMethod(value: unknown, fieldName = "paymentMethod"): BookingPaymentMethod | null {
  const method = normalizeOptionalText(value);
  if (!method) return null;
  const normalized = method.toLowerCase() as BookingPaymentMethod;
  if (!BOOKING_PAYMENT_METHODS.includes(normalized)) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", `Unsupported ${fieldName} '${normalized}'`);
  }
  return normalized;
}

function parsePaymentStatus(value: unknown): BookingPaymentStatus {
  const status = normalizeRequiredText(value, "paymentStatus").toLowerCase() as BookingPaymentStatus;
  if (!BOOKING_PAYMENT_STATUSES.includes(status)) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", `Unsupported paymentStatus '${status}'`);
  }
  return status;
}

function parseExpenseStatus(value: unknown): BookingExpenseStatus {
  const status = normalizeRequiredText(value, "expenseStatus").toLowerCase() as BookingExpenseStatus;
  if (!BOOKING_EXPENSE_STATUSES.includes(status)) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", `Unsupported expenseStatus '${status}'`);
  }
  return status;
}

function parseCompensationType(value: unknown): BookingCompensationType {
  const type = normalizeRequiredText(value, "compensationType").toLowerCase() as BookingCompensationType;
  if (!BOOKING_COMPENSATION_TYPES.includes(type)) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", `Unsupported compensationType '${type}'`);
  }
  return type;
}

function derivePaymentStatus(
  serviceAmount: number,
  prepaidAmount: number,
  settlementAmount: number,
  requestedStatus?: BookingPaymentStatus | null,
): BookingPaymentStatus {
  if (requestedStatus === "cancelled") return "cancelled";

  const totalReceived = prepaidAmount + settlementAmount;
  if (totalReceived <= 0) return "awaiting_payment";
  if (serviceAmount <= 0 || totalReceived >= serviceAmount) return "paid";
  return "prepaid";
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
    const parts = getTzParts(value, DEFAULT_TIMEZONE);
    return toDateKey(parts.year, parts.month, parts.day);
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = getTzParts(parsed, DEFAULT_TIMEZONE);
  return toDateKey(parts.year, parts.month, parts.day);
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

function mapEmployee(row: EmployeeRow, compensation?: EmployeeCompensationRow | null): BookingEmployee {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    specialty: row.specialty,
    photoUrl: row.photo_url,
    description: row.description,
    color: row.color,
    timezone: row.timezone || DEFAULT_TIMEZONE,
    slotDurationMin: row.slot_duration_min,
    compensationType: compensation?.compensation_type || "percent",
    compensationValue: compensation?.compensation_value ?? 0,
    isActive: row.is_active,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapServicePrice(row: ServicePriceRow): BookingServicePrice {
  return {
    id: row.id,
    companyId: row.company_id,
    serviceId: row.service_id,
    employeeId: row.employee_id,
    price: row.price,
    compensationType: row.compensation_type || "percent",
    compensationValue: row.compensation_value ?? 0,
    isActive: row.is_active,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapService(row: ServiceRow, prices: ServicePriceRow[] = []): BookingService {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    basePrice: row.base_price ?? 0,
    durationMin: row.duration_min,
    category: row.category,
    direction: row.direction,
    serviceType: row.service_type,
    description: row.description,
    isActive: row.is_active,
    prices: prices.map(mapServicePrice),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapClient(row: ClientRow): BookingClient {
  return {
    id: row.id,
    companyId: row.company_id,
    fullName: row.full_name,
    phone: row.phone,
    iin: row.iin,
    birthDate: row.birth_date,
    gender: row.gender,
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

function mapWorkdayOverride(row: WorkdayOverrideRow): BookingWorkdayOverride {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    date: normalizeDateOnly(row.date),
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    breakStartMinute: row.break_start_minute,
    breakEndMinute: row.break_end_minute,
    breakTitle: row.break_title,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
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

function mapAppointment(row: AppointmentRow, finance?: AppointmentFinanceRow | null): BookingAppointment {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    clientId: row.client_id,
    serviceId: row.service_id,
    serviceNameSnapshot: row.service_name_snapshot,
    serviceTypeSnapshot: row.service_type_snapshot,
    serviceDurationMinSnapshot: row.service_duration_min_snapshot,
    startsAt: toIso(row.starts_at) || "",
    endsAt: toIso(row.ends_at) || "",
    durationMin: row.duration_min,
    status: row.status,
    appointmentType: row.appointment_type || "primary",
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
    serviceAmount: finance?.service_amount ?? 0,
    prepaidAmount: finance?.prepaid_amount ?? 0,
    prepaidPaymentMethod: finance?.prepaid_payment_method ?? null,
    settlementAmount: finance?.settlement_amount ?? 0,
    settlementPaymentMethod: finance?.settlement_payment_method ?? null,
    paymentStatus: finance?.payment_status || "awaiting_payment",
  };
}

function mapExpense(row: AppointmentExpenseRow): BookingExpense {
  return {
    id: row.id,
    companyId: row.company_id,
    appointmentId: row.appointment_id,
    employeeId: row.employee_id,
    amount: row.amount,
    status: row.status,
    paidAt: toIso(row.paid_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapPayment(row: AppointmentPaymentRow): BookingPayment {
  return {
    id: row.id,
    companyId: row.company_id,
    appointmentId: row.appointment_id,
    amount: row.amount,
    paymentMethod: row.payment_method,
    paymentKind: BOOKING_PAYMENT_KINDS.includes(row.payment_kind as BookingPaymentKind)
      ? (row.payment_kind as BookingPaymentKind)
      : "payment",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
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
          photo_url TEXT,
          description TEXT,
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

        CREATE TABLE IF NOT EXISTS calendar.workday_overrides (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          employee_id TEXT NOT NULL REFERENCES calendar.employees(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
          end_minute INTEGER NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
          break_start_minute INTEGER CHECK (break_start_minute BETWEEN 0 AND 1439),
          break_end_minute INTEGER CHECK (break_end_minute BETWEEN 1 AND 1440),
          break_title TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT chk_calendar_workday_overrides_range CHECK (end_minute > start_minute),
          CONSTRAINT uq_calendar_workday_overrides_employee_date UNIQUE (employee_id, date)
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

        CREATE TABLE IF NOT EXISTS calendar.clients (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          full_name TEXT NOT NULL,
          phone TEXT,
          iin TEXT,
          birth_date DATE,
          gender TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS calendar.appointments (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          employee_id TEXT NOT NULL REFERENCES calendar.employees(id) ON DELETE CASCADE,
          client_id TEXT REFERENCES calendar.clients(id) ON DELETE SET NULL,
          service_name_snapshot TEXT,
          service_type_snapshot TEXT,
          service_duration_min_snapshot INTEGER,
          starts_at TIMESTAMPTZ NOT NULL,
          ends_at TIMESTAMPTZ NOT NULL,
          duration_min INTEGER,
          status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
          appointment_type TEXT NOT NULL DEFAULT 'primary',
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

        CREATE TABLE IF NOT EXISTS calendar.employee_compensation (
          employee_id TEXT PRIMARY KEY REFERENCES calendar.employees(id) ON DELETE CASCADE,
          company_id TEXT NOT NULL,
          compensation_type TEXT NOT NULL DEFAULT 'percent',
          compensation_value INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS calendar.appointment_finance (
          appointment_id TEXT PRIMARY KEY REFERENCES calendar.appointments(id) ON DELETE CASCADE,
          company_id TEXT NOT NULL,
          service_amount INTEGER NOT NULL DEFAULT 0,
          compensation_type_snapshot TEXT,
          compensation_value_snapshot INTEGER,
          prepaid_amount INTEGER NOT NULL DEFAULT 0,
          prepaid_payment_method TEXT,
          settlement_amount INTEGER NOT NULL DEFAULT 0,
          settlement_payment_method TEXT,
          payment_status TEXT NOT NULL DEFAULT 'awaiting_payment',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS calendar.appointment_expenses (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          appointment_id TEXT NOT NULL UNIQUE REFERENCES calendar.appointments(id) ON DELETE CASCADE,
          employee_id TEXT NOT NULL REFERENCES calendar.employees(id) ON DELETE CASCADE,
          amount INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'unpaid',
          paid_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS calendar.appointment_payments (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          appointment_id TEXT NOT NULL REFERENCES calendar.appointments(id) ON DELETE CASCADE,
          amount INTEGER NOT NULL DEFAULT 0,
          payment_method TEXT NOT NULL,
          payment_kind TEXT NOT NULL DEFAULT 'payment',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS calendar.services (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          name TEXT NOT NULL,
          base_price INTEGER NOT NULL DEFAULT 0,
          duration_min INTEGER NOT NULL DEFAULT 30,
          category TEXT,
          direction TEXT,
          service_type TEXT,
          description TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS calendar.service_prices (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          service_id TEXT NOT NULL REFERENCES calendar.services(id) ON DELETE CASCADE,
          employee_id TEXT NOT NULL REFERENCES calendar.employees(id) ON DELETE CASCADE,
          price INTEGER NOT NULL DEFAULT 0,
          compensation_type TEXT NOT NULL DEFAULT 'percent',
          compensation_value INTEGER NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_calendar_service_prices_service_employee UNIQUE (service_id, employee_id)
        );

        CREATE INDEX IF NOT EXISTS idx_calendar_employees_company_active
          ON calendar.employees (company_id, is_active);

        CREATE INDEX IF NOT EXISTS idx_calendar_work_rules_employee_weekday
          ON calendar.work_rules (company_id, employee_id, weekday, is_active);

        CREATE INDEX IF NOT EXISTS idx_calendar_break_rules_employee_weekday
          ON calendar.break_rules (company_id, employee_id, weekday, is_active);

        CREATE INDEX IF NOT EXISTS idx_calendar_holidays_company_date
          ON calendar.holidays (company_id, date);

        CREATE INDEX IF NOT EXISTS idx_calendar_workday_overrides_company_employee_date
          ON calendar.workday_overrides (company_id, employee_id, date);

        CREATE INDEX IF NOT EXISTS idx_calendar_time_off_company_employee_range
          ON calendar.time_off (company_id, employee_id, starts_at, ends_at);

        CREATE INDEX IF NOT EXISTS idx_calendar_clients_company_created
          ON calendar.clients (company_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_calendar_clients_company_name
          ON calendar.clients (company_id, full_name);

        CREATE INDEX IF NOT EXISTS idx_calendar_clients_company_phone
          ON calendar.clients (company_id, phone);

        CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_clients_company_iin
          ON calendar.clients (company_id, iin)
          WHERE iin IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_calendar_appointments_company_employee_range
          ON calendar.appointments (company_id, employee_id, starts_at, ends_at);

        CREATE INDEX IF NOT EXISTS idx_calendar_employee_compensation_company_employee
          ON calendar.employee_compensation (company_id, employee_id);

        CREATE INDEX IF NOT EXISTS idx_calendar_services_company_active
          ON calendar.services (company_id, is_active, created_at);

        CREATE INDEX IF NOT EXISTS idx_calendar_service_prices_company_service_employee
          ON calendar.service_prices (company_id, service_id, employee_id, is_active);

        CREATE INDEX IF NOT EXISTS idx_calendar_appointment_finance_company_status
          ON calendar.appointment_finance (company_id, payment_status);

        CREATE INDEX IF NOT EXISTS idx_calendar_appointment_expenses_company_status
          ON calendar.appointment_expenses (company_id, status);

        CREATE INDEX IF NOT EXISTS idx_calendar_appointment_payments_company_appointment_created
          ON calendar.appointment_payments (company_id, appointment_id, created_at);

        CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_appointment_payments_prepaid
          ON calendar.appointment_payments (appointment_id, payment_kind)
          WHERE payment_kind = 'prepaid';

        CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_appointment_payments_adjustment
          ON calendar.appointment_payments (appointment_id, payment_kind)
          WHERE payment_kind = 'adjustment';

        CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_appointments_external_ref
          ON calendar.appointments (company_id, external_ref)
          WHERE external_ref IS NOT NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS uq_calendar_appointments_idempotency
          ON calendar.appointments (company_id, idempotency_key)
          WHERE idempotency_key IS NOT NULL;
      `);

      await client.query(`
        ALTER TABLE calendar.services
        ADD COLUMN IF NOT EXISTS base_price INTEGER NOT NULL DEFAULT 0
      `);

      await client.query(`
        ALTER TABLE calendar.services
        ADD COLUMN IF NOT EXISTS duration_min INTEGER NOT NULL DEFAULT 30
      `);

      await client.query(`
        ALTER TABLE calendar.service_prices
        ADD COLUMN IF NOT EXISTS compensation_type TEXT NOT NULL DEFAULT 'percent'
      `);

      await client.query(`
        ALTER TABLE calendar.service_prices
        ADD COLUMN IF NOT EXISTS compensation_value INTEGER NOT NULL DEFAULT 0
      `);

      await client.query(`
        ALTER TABLE calendar.employees
        ADD COLUMN IF NOT EXISTS photo_url TEXT
      `);

      await client.query(`
        ALTER TABLE calendar.employees
        ADD COLUMN IF NOT EXISTS description TEXT
      `);

      await client.query(`
        ALTER TABLE calendar.appointments
        ADD COLUMN IF NOT EXISTS appointment_type TEXT NOT NULL DEFAULT 'primary'
      `);

      await client.query(`
        ALTER TABLE calendar.appointments
        ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES calendar.clients(id) ON DELETE SET NULL
      `);

      await client.query(`
        ALTER TABLE calendar.appointments
        ADD COLUMN IF NOT EXISTS service_id TEXT REFERENCES calendar.services(id) ON DELETE SET NULL
      `);

      await client.query(`
        ALTER TABLE calendar.appointments
        ADD COLUMN IF NOT EXISTS service_name_snapshot TEXT
      `);

      await client.query(`
        ALTER TABLE calendar.appointments
        ADD COLUMN IF NOT EXISTS service_type_snapshot TEXT
      `);

      await client.query(`
        ALTER TABLE calendar.appointments
        ADD COLUMN IF NOT EXISTS service_duration_min_snapshot INTEGER
      `);

      await client.query(`
        ALTER TABLE calendar.appointment_finance
        ADD COLUMN IF NOT EXISTS compensation_type_snapshot TEXT
      `);

      await client.query(`
        ALTER TABLE calendar.appointment_finance
        ADD COLUMN IF NOT EXISTS compensation_value_snapshot INTEGER
      `);

      await client.query(`
        ALTER TABLE calendar.workday_overrides
        ADD COLUMN IF NOT EXISTS break_start_minute INTEGER
      `);

      await client.query(`
        ALTER TABLE calendar.workday_overrides
        ADD COLUMN IF NOT EXISTS break_end_minute INTEGER
      `);

      await client.query(`
        ALTER TABLE calendar.workday_overrides
        ADD COLUMN IF NOT EXISTS break_title TEXT
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_calendar_appointments_company_service
          ON calendar.appointments (company_id, service_id)
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

async function loadClientTx(client: PoolClient, companyId: string, clientId: string) {
  const { rows } = await client.query<ClientRow>(
    `
      SELECT *
      FROM calendar.clients
      WHERE company_id = $1 AND id = $2
      LIMIT 1
    `,
    [companyId, clientId],
  );
  const bookingClient = rows[0];
  if (!bookingClient) {
    throw new BookingServiceError(404, "CLIENT_NOT_FOUND", "Client not found");
  }
  return bookingClient;
}

async function loadEmployeeCompensationTx(client: PoolClient, companyId: string, employeeId: string) {
  const { rows } = await client.query<EmployeeCompensationRow>(
    `
      SELECT *
      FROM calendar.employee_compensation
      WHERE company_id = $1 AND employee_id = $2
      LIMIT 1
    `,
    [companyId, employeeId],
  );
  return rows[0] || null;
}

async function loadServiceTx(client: PoolClient, companyId: string, serviceId: string) {
  const { rows } = await client.query<ServiceRow>(
    `
      SELECT *
      FROM calendar.services
      WHERE company_id = $1 AND id = $2
      LIMIT 1
    `,
    [companyId, serviceId],
  );
  const service = rows[0];
  if (!service) {
    throw new BookingServiceError(404, "SERVICE_NOT_FOUND", "Service not found");
  }
  return service;
}

async function loadServicePricesByServiceIdsTx(client: PoolClient, companyId: string, serviceIds: string[]) {
  if (!serviceIds.length) return [] as ServicePriceRow[];
  const { rows } = await client.query<ServicePriceRow>(
    `
      SELECT *
      FROM calendar.service_prices
      WHERE company_id = $1
        AND service_id = ANY($2::text[])
      ORDER BY employee_id ASC, created_at ASC
    `,
    [companyId, serviceIds],
  );
  return rows;
}

async function loadServicePriceForEmployeeTx(
  client: PoolClient,
  companyId: string,
  serviceId: string,
  employeeId: string,
) {
  const { rows } = await client.query<ServicePriceRow>(
    `
      SELECT *
      FROM calendar.service_prices
      WHERE company_id = $1
        AND service_id = $2
        AND employee_id = $3
      LIMIT 1
    `,
    [companyId, serviceId, employeeId],
  );
  return rows[0] || null;
}

function normalizeServiceType(value: unknown, fallback: BookingAppointmentType = "primary") {
  const raw = normalizeOptionalText(value);
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();
  if (normalized === "primary" || normalized.includes("первич")) return "primary";
  if (normalized === "secondary" || normalized.includes("вторич") || normalized.includes("повтор")) return "secondary";
  if (normalized === "other" || normalized.includes("друг")) return "other";
  throw new BookingServiceError(400, "VALIDATION_ERROR", `Unsupported serviceType '${normalized}'`);
}

function resolveServicePriceForEmployee(service: { base_price: number }, servicePrice?: ServicePriceRow | null) {
  if (servicePrice?.is_active && servicePrice.price > 0) {
    return servicePrice.price;
  }
  return clampMoney(service.base_price, 0);
}

async function resolveAppointmentConfigSnapshotTx(
  client: PoolClient,
  params: {
    companyId: string;
    employeeId: string;
    serviceId?: string | null;
    validateServiceAvailability?: boolean;
  },
) {
  const validateServiceAvailability = parseBool(params.validateServiceAvailability, true);
  const serviceId = normalizeOptionalText(params.serviceId);

  if (!serviceId) {
    const employeeCompensation = await loadEmployeeCompensationTx(client, params.companyId, params.employeeId);
    return {
      resolvedServicePrice: null as number | null,
      serviceNameSnapshot: null as string | null,
      serviceTypeSnapshot: null as BookingAppointmentType | string | null,
      serviceDurationMinSnapshot: null as number | null,
      compensationTypeSnapshot: employeeCompensation?.compensation_type || null,
      compensationValueSnapshot: employeeCompensation ? clampMoney(employeeCompensation.compensation_value) : 0,
    };
  }

  const service = await loadServiceTx(client, params.companyId, serviceId);
  const servicePrice = await loadServicePriceForEmployeeTx(client, params.companyId, serviceId, params.employeeId);
  const resolvedServicePrice = resolveServicePriceForEmployee(service, servicePrice);

  if (validateServiceAvailability && (!service.is_active || resolvedServicePrice <= 0)) {
    throw new BookingServiceError(
      400,
      "SERVICE_NOT_AVAILABLE_FOR_EMPLOYEE",
      "Service is not available for the selected employee",
    );
  }

  let compensationTypeSnapshot: BookingCompensationType | string | null = null;
  let compensationValueSnapshot = 0;

  if (servicePrice?.is_active && servicePrice.price > 0) {
    compensationTypeSnapshot = servicePrice.compensation_type || "percent";
    compensationValueSnapshot = clampMoney(servicePrice.compensation_value);
  } else {
    const employeeCompensation = await loadEmployeeCompensationTx(client, params.companyId, params.employeeId);
    compensationTypeSnapshot = employeeCompensation?.compensation_type || null;
    compensationValueSnapshot = employeeCompensation ? clampMoney(employeeCompensation.compensation_value) : 0;
  }

  return {
    resolvedServicePrice,
    serviceNameSnapshot: service.name,
    serviceTypeSnapshot: service.service_type || null,
    serviceDurationMinSnapshot: service.duration_min ?? null,
    compensationTypeSnapshot,
    compensationValueSnapshot,
  };
}

function normalizeServicePriceInputs(employeePrices: ServicePriceInput[] | undefined) {
  const byEmployeeId = new Map<
    string,
    {
      employeeId: string;
      price: number;
      compensationType: BookingCompensationType;
      compensationValue: number;
      isActive: boolean;
    }
  >();

  for (const item of employeePrices || []) {
    const employeeId = normalizeRequiredText(item?.employeeId, "employeePrices.employeeId");
    const price = clampMoney(item?.price, 0);
    const compensationType = parseCompensationType(item?.compensationType || "percent");
    const compensationValueRaw = clampMoney(item?.compensationValue, 0);
    const compensationValue =
      compensationType === "percent" ? Math.max(0, Math.min(100, compensationValueRaw)) : compensationValueRaw;
    const isActive = parseBool(item?.isActive, price > 0);

    if (isActive && price <= 0) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", "Active employee service price must be greater than 0");
    }

    byEmployeeId.set(employeeId, {
      employeeId,
      price,
      compensationType,
      compensationValue,
      isActive,
    });
  }

  return Array.from(byEmployeeId.values());
}

async function upsertEmployeeCompensationTx(
  client: PoolClient,
  params: {
    companyId: string;
    employeeId: string;
    compensationType: BookingCompensationType | string;
    compensationValue: number;
  },
) {
  const compensationType = parseCompensationType(params.compensationType);
  const compensationValue = clampMoney(params.compensationValue);

  const { rows } = await client.query<EmployeeCompensationRow>(
    `
      INSERT INTO calendar.employee_compensation (
        employee_id, company_id, compensation_type, compensation_value, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (employee_id)
      DO UPDATE SET
        company_id = EXCLUDED.company_id,
        compensation_type = EXCLUDED.compensation_type,
        compensation_value = EXCLUDED.compensation_value,
        updated_at = NOW()
      RETURNING *
    `,
    [params.employeeId, params.companyId, compensationType, compensationValue],
  );

  return rows[0] || null;
}

async function loadAppointmentFinanceTx(client: PoolClient, companyId: string, appointmentId: string) {
  const { rows } = await client.query<AppointmentFinanceRow>(
    `
      SELECT *
      FROM calendar.appointment_finance
      WHERE company_id = $1 AND appointment_id = $2
      LIMIT 1
    `,
    [companyId, appointmentId],
  );
  return rows[0] || null;
}

async function loadAppointmentExpenseByAppointmentTx(client: PoolClient, companyId: string, appointmentId: string) {
  const { rows } = await client.query<AppointmentExpenseRow>(
    `
      SELECT *
      FROM calendar.appointment_expenses
      WHERE company_id = $1 AND appointment_id = $2
      LIMIT 1
    `,
    [companyId, appointmentId],
  );
  return rows[0] || null;
}

async function loadAppointmentPaymentsTx(client: PoolClient, companyId: string, appointmentIds: string[]) {
  if (!appointmentIds.length) return [];

  const { rows } = await client.query<AppointmentPaymentRow>(
    `
      SELECT *
      FROM calendar.appointment_payments
      WHERE company_id = $1
        AND appointment_id = ANY($2::text[])
      ORDER BY created_at ASC, id ASC
    `,
    [companyId, appointmentIds],
  );

  return rows;
}

async function loadAppointmentPaymentByKindTx(
  client: PoolClient,
  companyId: string,
  appointmentId: string,
  paymentKind: BookingPaymentKind,
) {
  const { rows } = await client.query<AppointmentPaymentRow>(
    `
      SELECT *
      FROM calendar.appointment_payments
      WHERE company_id = $1
        AND appointment_id = $2
        AND payment_kind = $3
      LIMIT 1
    `,
    [companyId, appointmentId, paymentKind],
  );

  return rows[0] || null;
}

async function upsertAppointmentPaymentByKindTx(
  client: PoolClient,
  params: {
    companyId: string;
    appointmentId: string;
    amount: number;
    paymentMethod: BookingPaymentMethod | string | null;
    paymentKind: BookingPaymentKind;
  },
) {
  const amount = clampMoney(params.amount);
  const existing = await loadAppointmentPaymentByKindTx(
    client,
    params.companyId,
    params.appointmentId,
    params.paymentKind,
  );

  if (amount <= 0 || !params.paymentMethod) {
    if (existing) {
      await client.query(
        `
          DELETE FROM calendar.appointment_payments
          WHERE company_id = $1
            AND appointment_id = $2
            AND payment_kind = $3
        `,
        [params.companyId, params.appointmentId, params.paymentKind],
      );
    }
    return null;
  }

  if (existing) {
    const { rows } = await client.query<AppointmentPaymentRow>(
      `
        UPDATE calendar.appointment_payments
        SET
          amount = $4,
          payment_method = $5,
          updated_at = NOW()
        WHERE company_id = $1
          AND appointment_id = $2
          AND payment_kind = $3
        RETURNING *
      `,
      [params.companyId, params.appointmentId, params.paymentKind, amount, params.paymentMethod],
    );
    return rows[0] || existing;
  }

  const { rows } = await client.query<AppointmentPaymentRow>(
    `
      INSERT INTO calendar.appointment_payments (
        id,
        company_id,
        appointment_id,
        amount,
        payment_method,
        payment_kind,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `,
    [randomId(), params.companyId, params.appointmentId, amount, params.paymentMethod, params.paymentKind],
  );

  return rows[0] || null;
}

async function insertAppointmentPaymentTx(
  client: PoolClient,
  params: {
    companyId: string;
    appointmentId: string;
    amount: number;
    paymentMethod: BookingPaymentMethod | string;
    paymentKind: BookingPaymentKind;
  },
) {
  const amount = clampMoney(params.amount);
  if (amount <= 0) return null;

  const { rows } = await client.query<AppointmentPaymentRow>(
    `
      INSERT INTO calendar.appointment_payments (
        id,
        company_id,
        appointment_id,
        amount,
        payment_method,
        payment_kind,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `,
    [randomId(), params.companyId, params.appointmentId, amount, params.paymentMethod, params.paymentKind],
  );

  return rows[0] || null;
}

async function syncAppointmentPaymentJournalTx(
  client: PoolClient,
  params: {
    companyId: string;
    appointmentId: string;
    prepaidAmount: number;
    prepaidPaymentMethod: BookingPaymentMethod | string | null;
    settlementAmount: number;
    settlementPaymentMethod: BookingPaymentMethod | string | null;
  },
) {
  const prepaidAmount = clampMoney(params.prepaidAmount);
  await upsertAppointmentPaymentByKindTx(client, {
    companyId: params.companyId,
    appointmentId: params.appointmentId,
    amount: prepaidAmount,
    paymentMethod: params.prepaidPaymentMethod,
    paymentKind: "prepaid",
  });

  const { rows } = await client.query<{ total: string | number | null }>(
    `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM calendar.appointment_payments
      WHERE company_id = $1
        AND appointment_id = $2
        AND payment_kind = 'payment'
    `,
    [params.companyId, params.appointmentId],
  );
  const manualPaymentTotal = clampMoney(rows[0]?.total ?? 0);
  const settlementAmount = clampMoney(params.settlementAmount);

  if (settlementAmount < manualPaymentTotal) {
    throw new BookingServiceError(
      400,
      "VALIDATION_ERROR",
      "settlementAmount cannot be less than the total of recorded payments",
    );
  }

  const adjustmentAmount = settlementAmount - manualPaymentTotal;
  await upsertAppointmentPaymentByKindTx(client, {
    companyId: params.companyId,
    appointmentId: params.appointmentId,
    amount: adjustmentAmount,
    paymentMethod: params.settlementPaymentMethod,
    paymentKind: "adjustment",
  });
}

function computeExpenseAmount(
  finance: Pick<AppointmentFinanceRow, "service_amount">,
  compensation: Pick<EmployeeCompensationRow, "compensation_type" | "compensation_value"> | null,
) {
  if (!compensation) return 0;
  if (compensation.compensation_type === "fixed") {
    return clampMoney(compensation.compensation_value);
  }
  return Math.max(0, Math.round((clampMoney(finance.service_amount) * clampMoney(compensation.compensation_value)) / 100));
}

async function upsertAppointmentFinanceTx(
  client: PoolClient,
  params: {
    companyId: string;
    appointmentId: string;
    serviceAmount: number;
    compensationTypeSnapshot?: BookingCompensationType | string | null;
    compensationValueSnapshot?: number | null;
    prepaidAmount: number;
    prepaidPaymentMethod: BookingPaymentMethod | string | null;
    settlementAmount: number;
    settlementPaymentMethod: BookingPaymentMethod | string | null;
    paymentStatus: BookingPaymentStatus;
  },
) {
  const { rows } = await client.query<AppointmentFinanceRow>(
    `
      INSERT INTO calendar.appointment_finance (
        appointment_id,
        company_id,
        service_amount,
        compensation_type_snapshot,
        compensation_value_snapshot,
        prepaid_amount,
        prepaid_payment_method,
        settlement_amount,
        settlement_payment_method,
        payment_status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (appointment_id)
      DO UPDATE SET
        company_id = EXCLUDED.company_id,
        service_amount = EXCLUDED.service_amount,
        compensation_type_snapshot = COALESCE(EXCLUDED.compensation_type_snapshot, calendar.appointment_finance.compensation_type_snapshot),
        compensation_value_snapshot = COALESCE(EXCLUDED.compensation_value_snapshot, calendar.appointment_finance.compensation_value_snapshot),
        prepaid_amount = EXCLUDED.prepaid_amount,
        prepaid_payment_method = EXCLUDED.prepaid_payment_method,
        settlement_amount = EXCLUDED.settlement_amount,
        settlement_payment_method = EXCLUDED.settlement_payment_method,
        payment_status = EXCLUDED.payment_status,
        updated_at = NOW()
      RETURNING *
    `,
    [
      params.appointmentId,
      params.companyId,
      clampMoney(params.serviceAmount),
      normalizeOptionalText(params.compensationTypeSnapshot),
      params.compensationValueSnapshot === undefined || params.compensationValueSnapshot === null
        ? null
        : clampMoney(params.compensationValueSnapshot),
      clampMoney(params.prepaidAmount),
      params.prepaidPaymentMethod,
      clampMoney(params.settlementAmount),
      params.settlementPaymentMethod,
      params.paymentStatus,
    ],
  );

  return rows[0];
}

async function syncExpenseForAppointmentTx(
  client: PoolClient,
  params: {
    companyId: string;
    appointment: AppointmentRow;
    finance: AppointmentFinanceRow;
  },
) {
  const existingExpense = await loadAppointmentExpenseByAppointmentTx(client, params.companyId, params.appointment.id);

  if (params.finance.payment_status !== "paid") {
    if (existingExpense && existingExpense.status !== "paid") {
      await client.query(
        `
          DELETE FROM calendar.appointment_expenses
          WHERE company_id = $1 AND appointment_id = $2
        `,
        [params.companyId, params.appointment.id],
      );
    }
    return existingExpense;
  }

  let compensation: Pick<EmployeeCompensationRow, "compensation_type" | "compensation_value"> | null = null;
  if (params.finance.compensation_type_snapshot) {
    compensation = {
      compensation_type: params.finance.compensation_type_snapshot,
      compensation_value: params.finance.compensation_value_snapshot ?? 0,
    };
  } else {
    const resolvedSnapshot = await resolveAppointmentConfigSnapshotTx(client, {
      companyId: params.companyId,
      employeeId: params.appointment.employee_id,
      serviceId: params.appointment.service_id,
      validateServiceAvailability: false,
    });
    if (resolvedSnapshot.compensationTypeSnapshot) {
      compensation = {
        compensation_type: resolvedSnapshot.compensationTypeSnapshot,
        compensation_value: resolvedSnapshot.compensationValueSnapshot ?? 0,
      };
    }
  }
  const amount = computeExpenseAmount(params.finance, compensation);

  if (existingExpense) {
    if (existingExpense.status === "paid") {
      return existingExpense;
    }

    const { rows } = await client.query<AppointmentExpenseRow>(
      `
        UPDATE calendar.appointment_expenses
        SET
          employee_id = $3,
          amount = $4,
          status = 'unpaid',
          updated_at = NOW()
        WHERE company_id = $1 AND appointment_id = $2
        RETURNING *
      `,
      [params.companyId, params.appointment.id, params.appointment.employee_id, amount],
    );
    return rows[0] || existingExpense;
  }

  const { rows } = await client.query<AppointmentExpenseRow>(
    `
      INSERT INTO calendar.appointment_expenses (
        id, company_id, appointment_id, employee_id, amount, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'unpaid', NOW(), NOW())
      RETURNING *
    `,
    [randomId(), params.companyId, params.appointment.id, params.appointment.employee_id, amount],
  );
  return rows[0] || null;
}

async function loadHolidayTx(client: PoolClient, companyId: string, holidayId: string) {
  const { rows } = await client.query<HolidayRow>(
    `
      SELECT *
      FROM calendar.holidays
      WHERE company_id = $1 AND id = $2
      LIMIT 1
    `,
    [companyId, holidayId],
  );
  const holiday = rows[0];
  if (!holiday) {
    throw new BookingServiceError(404, "HOLIDAY_NOT_FOUND", "Holiday not found");
  }
  return holiday;
}

async function assertHolidayUniquenessTx(
  client: PoolClient,
  params: {
    companyId: string;
    date: string;
    isRecurringYearly: boolean;
    ignoreHolidayId?: string | null;
  },
) {
  const { companyId, date, isRecurringYearly, ignoreHolidayId } = params;

  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext($1 || ':holiday:' || to_char($2::date, 'MM-DD'))::bigint)`,
    [companyId, date],
  );

  const { rows } = await client.query<{ id: string }>(
    `
      SELECT id
      FROM calendar.holidays
      WHERE company_id = $1
        AND ($4::text IS NULL OR id <> $4)
        AND (
          (is_recurring_yearly = FALSE AND date = $2::date)
          OR (is_recurring_yearly = TRUE AND to_char(date, 'MM-DD') = to_char($2::date, 'MM-DD'))
          OR (
            $3::boolean = TRUE
            AND is_recurring_yearly = FALSE
            AND to_char(date, 'MM-DD') = to_char($2::date, 'MM-DD')
          )
        )
      LIMIT 1
    `,
    [companyId, date, isRecurringYearly, ignoreHolidayId || null],
  );

  if (rows.length) {
    throw new BookingServiceError(
      409,
      "HOLIDAY_CONFLICT",
      "Holiday already exists for this company on this day",
    );
  }
}

async function loadWorkdayOverrideTx(client: PoolClient, companyId: string, workdayOverrideId: string) {
  const { rows } = await client.query<WorkdayOverrideRow>(
    `
      SELECT *
      FROM calendar.workday_overrides
      WHERE company_id = $1 AND id = $2
      LIMIT 1
    `,
    [companyId, workdayOverrideId],
  );
  const item = rows[0];
  if (!item) {
    throw new BookingServiceError(404, "WORKDAY_OVERRIDE_NOT_FOUND", "Workday override not found");
  }
  return item;
}

async function loadWorkdayOverrideByEmployeeDateTx(
  client: PoolClient,
  companyId: string,
  employeeId: string,
  date: string,
) {
  const { rows } = await client.query<WorkdayOverrideRow>(
    `
      SELECT *
      FROM calendar.workday_overrides
      WHERE company_id = $1
        AND employee_id = $2
        AND date = $3::date
      LIMIT 1
    `,
    [companyId, employeeId, date],
  );
  return rows[0] || null;
}

async function loadTimeOffTx(client: PoolClient, companyId: string, timeOffId: string) {
  const { rows } = await client.query<TimeOffRow>(
    `
      SELECT *
      FROM calendar.time_off
      WHERE company_id = $1 AND id = $2
      LIMIT 1
    `,
    [companyId, timeOffId],
  );
  const item = rows[0];
  if (!item) {
    throw new BookingServiceError(404, "TIME_OFF_NOT_FOUND", "Time off not found");
  }
  return item;
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

function normalizeWorkdayOverrideRangeInput(startMinuteRaw: unknown, endMinuteRaw: unknown) {
  const startMinute = clampInt(startMinuteRaw, 0, 1439, -1);
  const endMinute = clampInt(endMinuteRaw, 1, 1440, -1);
  if (startMinute < 0 || endMinute < 1 || endMinute <= startMinute) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "Invalid specific workday range");
  }
  return { startMinute, endMinute };
}

function normalizeWorkdayOverrideBreakInput(params: {
  breakStartMinuteRaw: unknown;
  breakEndMinuteRaw: unknown;
  breakTitleRaw: unknown;
  startMinute: number;
  endMinute: number;
}) {
  const hasBreakStart = params.breakStartMinuteRaw !== undefined && params.breakStartMinuteRaw !== null && params.breakStartMinuteRaw !== "";
  const hasBreakEnd = params.breakEndMinuteRaw !== undefined && params.breakEndMinuteRaw !== null && params.breakEndMinuteRaw !== "";

  if (!hasBreakStart && !hasBreakEnd) {
    return {
      breakStartMinute: null,
      breakEndMinute: null,
      breakTitle: null,
    };
  }

  if (!hasBreakStart || !hasBreakEnd) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "Specific workday break requires both start and end");
  }

  const breakStartMinute = clampInt(params.breakStartMinuteRaw, 0, 1439, -1);
  const breakEndMinute = clampInt(params.breakEndMinuteRaw, 1, 1440, -1);
  if (breakStartMinute < 0 || breakEndMinute < 1 || breakEndMinute <= breakStartMinute) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "Invalid specific workday break");
  }
  if (breakStartMinute < params.startMinute || breakEndMinute > params.endMinute) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "Specific workday break must fit into working hours");
  }

  return {
    breakStartMinute,
    breakEndMinute,
    breakTitle: normalizeOptionalText(params.breakTitleRaw),
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

  const workdayOverride = await loadWorkdayOverrideByEmployeeDateTx(client, companyId, employeeId, startDateKey);
  const hasHolidayWorkOverride = holidayRows.some((holiday) => holiday.is_working_day_override);
  if (holidayRows.some((holiday) => !holiday.is_working_day_override) && !hasHolidayWorkOverride && !workdayOverride) {
    throw new BookingServiceError(409, "BLOCKED_BY_HOLIDAY", "Date is blocked by holiday");
  }

  let insideWorkingHours = false;
  if (workdayOverride) {
    insideWorkingHours = startMinute >= workdayOverride.start_minute && endMinute <= workdayOverride.end_minute;
  } else {
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

    insideWorkingHours = workRules.some(
      (rule) => startMinute >= rule.start_minute && endMinute <= rule.end_minute,
    );
  }

  if (!insideWorkingHours) {
    throw new BookingServiceError(409, "OUTSIDE_WORKING_HOURS", "Appointment is outside working hours");
  }

  const breakRanges = workdayOverride
    ? workdayOverride.break_start_minute !== null && workdayOverride.break_end_minute !== null
      ? [
          {
            start_minute: workdayOverride.break_start_minute,
            end_minute: workdayOverride.break_end_minute,
          },
        ]
      : []
    : (
        await client.query<Pick<BreakRuleRow, "start_minute" | "end_minute">>(
          `
            SELECT start_minute, end_minute
            FROM calendar.break_rules
            WHERE company_id = $1
              AND employee_id = $2
              AND weekday = $3
              AND is_active = TRUE
          `,
          [companyId, employeeId, weekday],
        )
      ).rows;

  const overlapsBreak = breakRanges.some(
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
  workdayOverrides: BookingWorkdayOverride[];
  timeOff: BookingTimeOff[];
  appointments: BookingAppointment[];
  durationMin?: number;
}) {
  const workByEmployee = new Map<string, BookingWorkRule[]>();
  const breakByEmployee = new Map<string, BookingBreakRule[]>();
  const workdayOverridesByEmployeeDate = new Map<string, BookingWorkdayOverride>();
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
  for (const item of params.workdayOverrides) {
    workdayOverridesByEmployeeDate.set(`${item.employeeId}|${item.date}`, item);
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
    const hasHolidayWorkOverride = dayHoliday.some((holiday) => holiday.isWorkingDayOverride);

    for (const employee of params.employees) {
      const employeeDurationMin = clampInt(employee.slotDurationMin, DEFAULT_SLOT_STEP_MIN, 720, DEFAULT_SLOT_STEP_MIN);
      const durationMin =
        params.durationMin === undefined
          ? employeeDurationMin
          : clampInt(params.durationMin, DEFAULT_SLOT_STEP_MIN, 720, employeeDurationMin);
      const workdayOverride = workdayOverridesByEmployeeDate.get(`${employee.id}|${dateKey}`);
      const rules = workdayOverride
        ? [
          {
            startMinute: workdayOverride.startMinute,
            endMinute: workdayOverride.endMinute,
          },
        ]
        : (workByEmployee.get(employee.id) || [])
            .filter((rule) => rule.isActive && rule.weekday === weekday)
            .sort((a, b) => a.startMinute - b.startMinute);
      if (!rules.length) continue;
      if (blockedByHoliday && !hasHolidayWorkOverride && !workdayOverride) continue;

      const breaks: Array<{ startMinute: number; endMinute: number }> = workdayOverride
        ? workdayOverride.breakStartMinute !== null && workdayOverride.breakEndMinute !== null
          ? [
              {
                startMinute: workdayOverride.breakStartMinute,
                endMinute: workdayOverride.breakEndMinute,
              },
            ]
          : []
        : (breakByEmployee.get(employee.id) || [])
            .filter((rule) => rule.isActive && rule.weekday === weekday)
            .map((rule) => ({
              startMinute: rule.startMinute,
              endMinute: rule.endMinute,
            }));
      const employeeTimeOff = [...globalTimeOff, ...(timeOffByEmployee.get(employee.id) || [])];
      const employeeAppointments = appointmentsByEmployee.get(employee.id) || [];

      for (const work of rules) {
        for (
          let startMinute = work.startMinute;
          startMinute + durationMin <= work.endMinute;
          startMinute += DEFAULT_SLOT_STEP_MIN
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
    const employeeIds = rows.map((row) => row.id);
    const compensationRows = employeeIds.length
      ? (
          await client.query<EmployeeCompensationRow>(
            `
              SELECT *
              FROM calendar.employee_compensation
              WHERE company_id = $1
                AND employee_id = ANY($2::text[])
            `,
            [companyId, employeeIds],
          )
        ).rows
      : [];
    const compensationByEmployeeId = new Map(compensationRows.map((row) => [row.employee_id, row] as const));

    return { employees: rows.map((row) => mapEmployee(row, compensationByEmployeeId.get(row.id) || null)) };
  });
}

export async function createBookingEmployee(companyIdRaw: string, payload: EmployeeInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const name = normalizeRequiredText(payload.name, "name");
  const specialty = normalizeOptionalText(payload.specialty);
  const photoUrl = normalizeOptionalText(payload.photoUrl);
  const description = normalizeOptionalText(payload.description);
  const color = normalizeOptionalText(payload.color);
  const timezone = DEFAULT_TIMEZONE;
  const compensationType = payload.compensationType ? parseCompensationType(payload.compensationType) : "percent";
  const compensationValue = clampMoney(payload.compensationValue, 0);
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
          id, company_id, name, specialty, photo_url, description, color, timezone, slot_duration_min, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW(), NOW())
        RETURNING *
      `,
      [id, companyId, name, specialty, photoUrl, description, color, timezone, slotDurationMin],
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

    const compensation = await upsertEmployeeCompensationTx(client, {
      companyId,
      employeeId: id,
      compensationType,
      compensationValue,
    });

    return { employee: mapEmployee(rows[0], compensation) };
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
    const existingCompensation = await loadEmployeeCompensationTx(client, companyId, employeeIdNormalized);
    const name = payload.name !== undefined ? normalizeRequiredText(payload.name, "name") : existing.name;
    const specialty = payload.specialty !== undefined ? normalizeOptionalText(payload.specialty) : existing.specialty;
    const photoUrl = payload.photoUrl !== undefined ? normalizeOptionalText(payload.photoUrl) : existing.photo_url;
    const description =
      payload.description !== undefined ? normalizeOptionalText(payload.description) : existing.description;
    const color = payload.color !== undefined ? normalizeOptionalText(payload.color) : existing.color;
    const slotDurationMin =
      payload.slotDurationMin !== undefined
        ? clampInt(payload.slotDurationMin, DEFAULT_SLOT_STEP_MIN, 720, existing.slot_duration_min || DEFAULT_SLOT_STEP_MIN)
        : existing.slot_duration_min;
    const isActive =
      payload.isActive !== undefined ? parseBool(payload.isActive, existing.is_active) : existing.is_active;
    const compensationType =
      payload.compensationType !== undefined
        ? parseCompensationType(payload.compensationType)
        : existingCompensation?.compensation_type || "percent";
    const compensationValue =
      payload.compensationValue !== undefined
        ? clampMoney(payload.compensationValue)
        : existingCompensation?.compensation_value ?? 0;

    const { rows } = await client.query<EmployeeRow>(
      `
        UPDATE calendar.employees
        SET
          name = $3,
          specialty = $4,
          photo_url = $5,
          description = $6,
          color = $7,
          slot_duration_min = $8,
          is_active = $9,
          updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [companyId, employeeIdNormalized, name, specialty, photoUrl, description, color, slotDurationMin, isActive],
    );

    const compensation = await upsertEmployeeCompensationTx(client, {
      companyId,
      employeeId: employeeIdNormalized,
      compensationType,
      compensationValue,
    });

    return { employee: mapEmployee(rows[0], compensation) };
  });
}

export async function listBookingClients(companyIdRaw: string, params: ClientsListParams = {}) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const search = normalizeOptionalText(params.search);
  const limit = clampInt(params.limit, 1, 1000, 300);

  return withClient(async (client) => {
    const { rows } = await client.query<ClientRow>(
      `
        SELECT *
        FROM calendar.clients
        WHERE company_id = $1
          AND (
            $2::text IS NULL
            OR full_name ILIKE $3
            OR phone ILIKE $3
            OR iin ILIKE $3
          )
        ORDER BY updated_at DESC, created_at DESC
        LIMIT $4
      `,
      [companyId, search, search ? `%${search}%` : null, limit],
    );

    return { clients: rows.map(mapClient) };
  });
}

export async function createBookingClient(companyIdRaw: string, payload: ClientInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const fullName = normalizeRequiredText(payload.fullName, "fullName");
  const phone = normalizeAppointmentPhone(payload.phone);
  const iin = normalizeIin(normalizeOptionalText(payload.iin));
  const birthDate = payload.birthDate ? parseDateOnly(payload.birthDate, "birthDate") : null;
  const gender = normalizeOptionalText(payload.gender);

  if (iin && !isValidIin(iin)) {
    throw new BookingServiceError(400, "INVALID_IIN", "Invalid IIN");
  }

  return withTransaction(async (client) => {
    const id = randomId();
    const { rows } = await client.query<ClientRow>(
      `
        INSERT INTO calendar.clients (
          id, company_id, full_name, phone, iin, birth_date, gender, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `,
      [id, companyId, fullName, phone, iin, birthDate, gender],
    );

    return { client: mapClient(rows[0]) };
  });
}

export async function updateBookingClient(companyIdRaw: string, clientId: string, payload: UpdateClientInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const clientIdNormalized = normalizeRequiredText(clientId, "clientId");

  return withTransaction(async (client) => {
    const existing = await loadClientTx(client, companyId, clientIdNormalized);
    const fullName = payload.fullName !== undefined ? normalizeRequiredText(payload.fullName, "fullName") : existing.full_name;
    const phone = payload.phone !== undefined ? normalizeAppointmentPhone(payload.phone) : existing.phone;
    const iinRaw = payload.iin !== undefined ? normalizeOptionalText(payload.iin) : existing.iin;
    const iin = normalizeIin(iinRaw);
    const birthDate =
      payload.birthDate !== undefined
        ? payload.birthDate
          ? parseDateOnly(payload.birthDate, "birthDate")
          : null
        : existing.birth_date;
    const gender = payload.gender !== undefined ? normalizeOptionalText(payload.gender) : existing.gender;

    if (iin && !isValidIin(iin)) {
      throw new BookingServiceError(400, "INVALID_IIN", "Invalid IIN");
    }

    const { rows } = await client.query<ClientRow>(
      `
        UPDATE calendar.clients
        SET
          full_name = $3,
          phone = $4,
          iin = $5,
          birth_date = $6,
          gender = $7,
          updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [companyId, clientIdNormalized, fullName, phone, iin, birthDate, gender],
    );

    return { client: mapClient(rows[0]) };
  });
}

export async function listBookingServices(companyIdRaw: string, params: ServicesListParams = {}) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  return withClient(async (client) => {
    const { rows } = await client.query<ServiceRow>(
      `
        SELECT *
        FROM calendar.services
        WHERE company_id = $1
          AND ($2::boolean = TRUE OR is_active = TRUE)
        ORDER BY created_at ASC
      `,
      [companyId, parseBool(params.includeInactive, false)],
    );

    const serviceIds = rows.map((row) => row.id);
    const priceRows = await loadServicePricesByServiceIdsTx(client, companyId, serviceIds);
    const pricesByServiceId = new Map<string, ServicePriceRow[]>();

    for (const row of priceRows) {
      const list = pricesByServiceId.get(row.service_id) || [];
      list.push(row);
      pricesByServiceId.set(row.service_id, list);
    }

    return {
      services: rows.map((row) => mapService(row, pricesByServiceId.get(row.id) || [])),
    };
  });
}

export async function createBookingService(companyIdRaw: string, payload: ServiceInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const name = normalizeRequiredText(payload.name, "name");
  const basePrice = clampMoney(payload.basePrice, 0);
  const rawDurationMin = Number(payload.durationMin);
  if (
    payload.durationMin !== undefined &&
    (!Number.isFinite(rawDurationMin) ||
      rawDurationMin < DEFAULT_SLOT_STEP_MIN ||
      rawDurationMin > 720 ||
      rawDurationMin % DEFAULT_SLOT_STEP_MIN !== 0)
  ) {
    throw new BookingServiceError(
      400,
      "VALIDATION_ERROR",
      `Field 'durationMin' must be between ${DEFAULT_SLOT_STEP_MIN} and 720 and multiple of ${DEFAULT_SLOT_STEP_MIN}`,
    );
  }
  const durationMin = clampInt(payload.durationMin, DEFAULT_SLOT_STEP_MIN, 720, DEFAULT_SERVICE_DURATION_MIN);
  const category = normalizeOptionalText(payload.category);
  const direction = normalizeOptionalText(payload.direction);
  const serviceType = normalizeServiceType(payload.serviceType);
  const description = normalizeOptionalText(payload.description);
  const isActive = parseBool(payload.isActive, true);
  const normalizedPrices = normalizeServicePriceInputs(payload.employeePrices);

  if (isActive && basePrice <= 0 && !normalizedPrices.some((item) => item.isActive && item.price > 0)) {
    throw new BookingServiceError(
      400,
      "VALIDATION_ERROR",
      "Active service must have a base price or at least one active custom employee price greater than 0",
    );
  }

  return withTransaction(async (client) => {
    for (const item of normalizedPrices) {
      await loadEmployeeTx(client, companyId, item.employeeId);
    }

    const id = randomId();
    const { rows } = await client.query<ServiceRow>(
      `
        INSERT INTO calendar.services (
          id, company_id, name, base_price, duration_min, category, direction, service_type, description, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *
      `,
      [id, companyId, name, basePrice, durationMin, category, direction, serviceType, description, isActive],
    );

    for (const item of normalizedPrices) {
      await client.query(
        `
          INSERT INTO calendar.service_prices (
            id, company_id, service_id, employee_id, price, compensation_type, compensation_value, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        `,
        [
          randomId(),
          companyId,
          id,
          item.employeeId,
          item.price,
          item.compensationType,
          item.compensationValue,
          item.isActive,
        ],
      );
    }

    const priceRows = await loadServicePricesByServiceIdsTx(client, companyId, [id]);
    return { service: mapService(rows[0], priceRows) };
  });
}

export async function updateBookingService(companyIdRaw: string, serviceId: string, payload: UpdateServiceInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const serviceIdNormalized = normalizeRequiredText(serviceId, "serviceId");

  return withTransaction(async (client) => {
    const existing = await loadServiceTx(client, companyId, serviceIdNormalized);
    const existingPriceRows = await loadServicePricesByServiceIdsTx(client, companyId, [serviceIdNormalized]);
    const normalizedPrices = payload.employeePrices ? normalizeServicePriceInputs(payload.employeePrices) : [];

    for (const item of normalizedPrices) {
      await loadEmployeeTx(client, companyId, item.employeeId);
    }

    const name = payload.name !== undefined ? normalizeRequiredText(payload.name, "name") : existing.name;
    const basePrice =
      payload.basePrice !== undefined ? clampMoney(payload.basePrice, 0) : clampMoney(existing.base_price, 0);
    const rawDurationMin = Number(payload.durationMin);
    if (
      payload.durationMin !== undefined &&
      (!Number.isFinite(rawDurationMin) ||
        rawDurationMin < DEFAULT_SLOT_STEP_MIN ||
        rawDurationMin > 720 ||
        rawDurationMin % DEFAULT_SLOT_STEP_MIN !== 0)
    ) {
      throw new BookingServiceError(
        400,
        "VALIDATION_ERROR",
        `Field 'durationMin' must be between ${DEFAULT_SLOT_STEP_MIN} and 720 and multiple of ${DEFAULT_SLOT_STEP_MIN}`,
      );
    }
    const durationMin =
      payload.durationMin !== undefined
        ? clampInt(payload.durationMin, DEFAULT_SLOT_STEP_MIN, 720, existing.duration_min || DEFAULT_SERVICE_DURATION_MIN)
        : existing.duration_min;
    const category = payload.category !== undefined ? normalizeOptionalText(payload.category) : existing.category;
    const direction = payload.direction !== undefined ? normalizeOptionalText(payload.direction) : existing.direction;
    const serviceType =
      payload.serviceType !== undefined
        ? normalizeServiceType(payload.serviceType)
        : normalizeServiceType(existing.service_type, "primary");
    const description =
      payload.description !== undefined ? normalizeOptionalText(payload.description) : existing.description;
    const isActive = payload.isActive !== undefined ? parseBool(payload.isActive, existing.is_active) : existing.is_active;

    const finalPricesByEmployeeId = new Map<
      string,
      { price: number; compensationType: BookingCompensationType; compensationValue: number; isActive: boolean }
    >();
    for (const row of existingPriceRows) {
      finalPricesByEmployeeId.set(row.employee_id, {
        price: row.price,
        compensationType: parseCompensationType(row.compensation_type || "percent"),
        compensationValue: row.compensation_value ?? 0,
        isActive: row.is_active,
      });
    }
    for (const item of normalizedPrices) {
      finalPricesByEmployeeId.set(item.employeeId, {
        price: item.price,
        compensationType: item.compensationType,
        compensationValue: item.compensationValue,
        isActive: item.isActive,
      });
    }

    if (
      isActive &&
      basePrice <= 0 &&
      !Array.from(finalPricesByEmployeeId.values()).some((item) => item.isActive && item.price > 0)
    ) {
      throw new BookingServiceError(
        400,
        "VALIDATION_ERROR",
        "Active service must have a base price or at least one active custom employee price greater than 0",
      );
    }

    const { rows } = await client.query<ServiceRow>(
      `
        UPDATE calendar.services
        SET
          name = $3,
          base_price = $4,
          duration_min = $5,
          category = $6,
          direction = $7,
          service_type = $8,
          description = $9,
          is_active = $10,
          updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [companyId, serviceIdNormalized, name, basePrice, durationMin, category, direction, serviceType, description, isActive],
    );

    for (const item of normalizedPrices) {
      await client.query(
        `
          INSERT INTO calendar.service_prices (
            id, company_id, service_id, employee_id, price, compensation_type, compensation_value, is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          ON CONFLICT (service_id, employee_id)
          DO UPDATE SET
            price = EXCLUDED.price,
            compensation_type = EXCLUDED.compensation_type,
            compensation_value = EXCLUDED.compensation_value,
            is_active = EXCLUDED.is_active,
            updated_at = NOW()
        `,
        [
          randomId(),
          companyId,
          serviceIdNormalized,
          item.employeeId,
          item.price,
          item.compensationType,
          item.compensationValue,
          item.isActive,
        ],
      );
    }

    const priceRows = await loadServicePricesByServiceIdsTx(client, companyId, [serviceIdNormalized]);
    return { service: mapService(rows[0], priceRows) };
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

    const compensationRows = employeeRows.length
      ? (
          await client.query<EmployeeCompensationRow>(
            `
              SELECT *
              FROM calendar.employee_compensation
              WHERE company_id = $1
                AND employee_id = ANY($2::text[])
            `,
            [companyId, employeeRows.map((row) => row.id)],
          )
        ).rows
      : [];
    const compensationByEmployeeId = new Map(compensationRows.map((row) => [row.employee_id, row] as const));
    const employees = employeeRows.map((row) => mapEmployee(row, compensationByEmployeeId.get(row.id) || null));
    if (!employees.length) {
      return {
        view,
        range: { from: from.toISOString(), to: to.toISOString() },
        employees: [],
        workRules: [],
        breakRules: [],
        holidays: [],
        workdayOverrides: [],
        timeOff: [],
        appointments: [],
        payments: [],
        expenses: [],
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

    const { rows: workdayOverrideRows } = await client.query<WorkdayOverrideRow>(
      `
        SELECT *
        FROM calendar.workday_overrides
        WHERE company_id = $1
          AND employee_id = ANY($2::text[])
          AND date >= $3::date
          AND date <= $4::date
        ORDER BY date ASC, start_minute ASC, created_at ASC
      `,
      [companyId, targetEmployeeIds, startDateKey, endDateKey],
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

    const financeRows = appointmentRows.length
      ? (
          await client.query<AppointmentFinanceRow>(
            `
              SELECT *
              FROM calendar.appointment_finance
              WHERE company_id = $1
                AND appointment_id = ANY($2::text[])
            `,
            [companyId, appointmentRows.map((row) => row.id)],
          )
        ).rows
      : [];
    const financeByAppointmentId = new Map(financeRows.map((row) => [row.appointment_id, row] as const));
    const paymentRows = await loadAppointmentPaymentsTx(client, companyId, appointmentRows.map((row) => row.id));

    const expenseRows = appointmentRows.length
      ? (
          await client.query<AppointmentExpenseRow>(
            `
              SELECT expense.*
              FROM calendar.appointment_expenses AS expense
              WHERE expense.company_id = $1
                AND expense.appointment_id = ANY($2::text[])
              ORDER BY expense.created_at ASC
            `,
            [companyId, appointmentRows.map((row) => row.id)],
          )
        ).rows
      : [];

    const workRules = workRuleRows.map(mapWorkRule);
    const breakRules = breakRuleRows.map(mapBreakRule);
    const holidays = holidayRows.map(mapHoliday);
    const workdayOverrides = workdayOverrideRows.map(mapWorkdayOverride);
    const timeOff = timeOffRows.map(mapTimeOff);
    const appointments = appointmentRows.map((row) => mapAppointment(row, financeByAppointmentId.get(row.id) || null));
    const payments = paymentRows.map(mapPayment);
    const expenses = expenseRows.map(mapExpense);
    const slots = includeSlots
      ? buildSlots({
          from,
          to,
          employees,
          workRules,
          breakRules,
          holidays,
          workdayOverrides,
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
      workdayOverrides,
      timeOff,
      appointments,
      payments,
      expenses,
      slots,
    };
  });
}

export async function createBookingAppointment(companyIdRaw: string, payload: CreateAppointmentInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const employeeId = normalizeRequiredText(payload.employeeId, "employeeId");
  const clientId = normalizeOptionalText(payload.clientId);
  const serviceId = normalizeOptionalText(payload.serviceId);
  const startsAt = parseIsoDateTime(payload.startsAt, "startsAt");
  const endsAt = parseIsoDateTime(payload.endsAt, "endsAt");
  const appointmentType = parseAppointmentType(payload.appointmentType);
  const clientName = normalizeRequiredText(payload.clientName, "clientName");
  const clientPhone = normalizeAppointmentPhone(payload.clientPhone);
  const clientIin = normalizeIin(normalizeOptionalText(payload.clientIin));
  const clientBirthDate =
    payload.clientBirthDate !== undefined
      ? payload.clientBirthDate
        ? parseDateOnly(payload.clientBirthDate, "clientBirthDate")
        : null
      : null;
  const clientGender = normalizeOptionalText(payload.clientGender);
  const clientComment = normalizeOptionalText(payload.clientComment);
  const source = normalizeOptionalText(payload.source) || "manual";
  const externalRef = normalizeOptionalText(payload.externalRef);
  const idempotencyKey = normalizeOptionalText(payload.idempotencyKey);
  const createdByUserId = normalizeOptionalText(payload.createdByUserId);
  let serviceAmount = clampMoney(payload.serviceAmount, 0);
  const prepaidAmount = clampMoney(payload.prepaidAmount, 0);
  const prepaidPaymentMethod = parsePaymentMethod(payload.prepaidPaymentMethod, "prepaidPaymentMethod");
  const settlementAmount = clampMoney(payload.settlementAmount, 0);
  const settlementPaymentMethod = parsePaymentMethod(payload.settlementPaymentMethod, "settlementPaymentMethod");
  const requestedPaymentStatus = payload.paymentStatus ? parsePaymentStatus(payload.paymentStatus) : null;
  const durationMin = clampInt(payload.durationMin, 5, 720, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000));
  let paymentStatus = derivePaymentStatus(serviceAmount, prepaidAmount, settlementAmount, requestedPaymentStatus);
  let serviceNameSnapshot: string | null = null;
  let serviceTypeSnapshot: BookingAppointmentType | string | null = null;
  let serviceDurationMinSnapshot: number | null = null;
  let compensationTypeSnapshot: BookingCompensationType | string | null = null;
  let compensationValueSnapshot: number | null = null;

  if (clientIin && !isValidIin(clientIin)) {
    throw new BookingServiceError(400, "INVALID_IIN", "Invalid IIN");
  }
  if (endsAt <= startsAt) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "End date must be greater than start date");
  }
  if (serviceAmount <= 0 && !serviceId) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "serviceAmount is required and must be greater than 0");
  }
  if (prepaidAmount > 0 && !prepaidPaymentMethod) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "prepaidPaymentMethod is required when prepaidAmount is greater than 0");
  }
  if (settlementAmount > 0 && !settlementPaymentMethod) {
    throw new BookingServiceError(
      400,
      "VALIDATION_ERROR",
      "settlementPaymentMethod is required when settlementAmount is greater than 0",
    );
  }
  if (serviceAmount > 0 && prepaidAmount + settlementAmount > serviceAmount) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "Total received amount cannot exceed serviceAmount");
  }

  return withTransaction(async (client) => {
    if (clientId) {
      await loadClientTx(client, companyId, clientId);
    }

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
        const existingFinance = await loadAppointmentFinanceTx(client, companyId, existingByIdempotency[0].id);
        return { appointment: mapAppointment(existingByIdempotency[0], existingFinance) };
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

    const appointmentConfigSnapshot = await resolveAppointmentConfigSnapshotTx(client, {
      companyId,
      employeeId,
      serviceId,
    });
    serviceNameSnapshot = appointmentConfigSnapshot.serviceNameSnapshot;
    serviceTypeSnapshot = appointmentConfigSnapshot.serviceTypeSnapshot;
    serviceDurationMinSnapshot = appointmentConfigSnapshot.serviceDurationMinSnapshot;
    compensationTypeSnapshot = appointmentConfigSnapshot.compensationTypeSnapshot;
    compensationValueSnapshot = appointmentConfigSnapshot.compensationValueSnapshot;

    if (serviceId && payload.serviceAmount === undefined && appointmentConfigSnapshot.resolvedServicePrice !== null) {
      serviceAmount = appointmentConfigSnapshot.resolvedServicePrice;
    }
    if (serviceAmount <= 0) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", "serviceAmount is required and must be greater than 0");
    }
    if (prepaidAmount + settlementAmount > serviceAmount) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", "Total received amount cannot exceed serviceAmount");
    }
    paymentStatus = derivePaymentStatus(serviceAmount, prepaidAmount, settlementAmount, requestedPaymentStatus);

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
          client_id,
          service_id,
          service_name_snapshot,
          service_type_snapshot,
          service_duration_min_snapshot,
          starts_at,
          ends_at,
          duration_min,
          status,
          appointment_type,
          client_name,
          client_phone,
          client_iin,
          client_birth_date,
          client_gender,
          client_comment,
          source,
          external_ref,
          idempotency_key,
          created_by_user_id,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'scheduled', $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW()
        )
        RETURNING *
      `,
      [
        id,
        companyId,
        employeeId,
        clientId,
        serviceId,
        serviceNameSnapshot,
        serviceTypeSnapshot,
        serviceDurationMinSnapshot,
        startsAt.toISOString(),
        endsAt.toISOString(),
        durationMin,
        appointmentType,
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

    const finance = await upsertAppointmentFinanceTx(client, {
      companyId,
      appointmentId: id,
      serviceAmount,
      compensationTypeSnapshot,
      compensationValueSnapshot,
      prepaidAmount,
      prepaidPaymentMethod,
      settlementAmount,
      settlementPaymentMethod,
      paymentStatus,
    });
    await syncAppointmentPaymentJournalTx(client, {
      companyId,
      appointmentId: id,
      prepaidAmount,
      prepaidPaymentMethod,
      settlementAmount,
      settlementPaymentMethod,
    });
    await syncExpenseForAppointmentTx(client, {
      companyId,
      appointment: rows[0],
      finance,
    });

    return { appointment: mapAppointment(rows[0], finance) };
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
    const existingFinance = await loadAppointmentFinanceTx(client, companyId, id);

    const employeeId = normalizeOptionalText(payload.employeeId) || existing.employee_id;
    const clientId = payload.clientId !== undefined ? normalizeOptionalText(payload.clientId) : existing.client_id;
    const serviceId = payload.serviceId !== undefined ? normalizeOptionalText(payload.serviceId) : existing.service_id;
    const pricingLinkChanged = payload.serviceId !== undefined || payload.employeeId !== undefined;
    const startsAt = payload.startsAt ? parseIsoDateTime(payload.startsAt, "startsAt") : new Date(existing.starts_at);
    const endsAt = payload.endsAt ? parseIsoDateTime(payload.endsAt, "endsAt") : new Date(existing.ends_at);
    const durationMin = clampInt(
      payload.durationMin,
      5,
      720,
      Math.max(5, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)),
    );
    const status = payload.status ? parseStatus(payload.status) : (existing.status as BookingStatus);
    const appointmentType =
      payload.appointmentType !== undefined
        ? parseAppointmentType(payload.appointmentType)
        : parseAppointmentType(existing.appointment_type);
    const clientName = payload.clientName ? normalizeRequiredText(payload.clientName, "clientName") : existing.client_name;
    const clientPhone =
      payload.clientPhone !== undefined ? normalizeAppointmentPhone(payload.clientPhone) : existing.client_phone;
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
    let serviceAmount =
      payload.serviceAmount !== undefined ? clampMoney(payload.serviceAmount) : existingFinance?.service_amount ?? 0;
    const prepaidAmount =
      payload.prepaidAmount !== undefined ? clampMoney(payload.prepaidAmount) : existingFinance?.prepaid_amount ?? 0;
    const prepaidPaymentMethod =
      payload.prepaidPaymentMethod !== undefined
        ? parsePaymentMethod(payload.prepaidPaymentMethod, "prepaidPaymentMethod")
        : existingFinance?.prepaid_payment_method ?? null;
    const settlementAmount =
      payload.settlementAmount !== undefined ? clampMoney(payload.settlementAmount) : existingFinance?.settlement_amount ?? 0;
    const settlementPaymentMethod =
      payload.settlementPaymentMethod !== undefined
        ? parsePaymentMethod(payload.settlementPaymentMethod, "settlementPaymentMethod")
        : existingFinance?.settlement_payment_method ?? null;
    const requestedPaymentStatus =
      payload.paymentStatus !== undefined
        ? parsePaymentStatus(payload.paymentStatus)
        : ((existingFinance?.payment_status as BookingPaymentStatus | string | undefined) || null);
    let paymentStatus = derivePaymentStatus(
      serviceAmount,
      prepaidAmount,
      settlementAmount,
      requestedPaymentStatus && BOOKING_PAYMENT_STATUSES.includes(requestedPaymentStatus as BookingPaymentStatus)
        ? (requestedPaymentStatus as BookingPaymentStatus)
        : null,
    );
    let serviceNameSnapshot =
      payload.serviceId !== undefined && !serviceId ? null : existing.service_name_snapshot;
    let serviceTypeSnapshot =
      payload.serviceId !== undefined && !serviceId ? null : existing.service_type_snapshot;
    let serviceDurationMinSnapshot =
      payload.serviceId !== undefined && !serviceId ? null : existing.service_duration_min_snapshot;
    let compensationTypeSnapshot = existingFinance?.compensation_type_snapshot ?? null;
    let compensationValueSnapshot = existingFinance?.compensation_value_snapshot ?? null;
    const clientBirthDate =
      payload.clientBirthDate !== undefined
        ? payload.clientBirthDate
          ? parseDateOnly(payload.clientBirthDate, "clientBirthDate")
          : null
        : existing.client_birth_date;
    const clientGender =
      payload.clientGender !== undefined ? normalizeOptionalText(payload.clientGender) : existing.client_gender;

    let appointmentConfigSnapshot:
      | Awaited<ReturnType<typeof resolveAppointmentConfigSnapshotTx>>
      | null = null;

    if (pricingLinkChanged) {
      appointmentConfigSnapshot = await resolveAppointmentConfigSnapshotTx(client, {
        companyId,
        employeeId,
        serviceId,
      });

      if (serviceId && payload.serviceAmount === undefined && appointmentConfigSnapshot.resolvedServicePrice !== null) {
        serviceAmount = appointmentConfigSnapshot.resolvedServicePrice;
      }

      compensationTypeSnapshot = appointmentConfigSnapshot.compensationTypeSnapshot;
      compensationValueSnapshot = appointmentConfigSnapshot.compensationValueSnapshot;

      if (payload.serviceId !== undefined) {
        serviceNameSnapshot = appointmentConfigSnapshot.serviceNameSnapshot;
        serviceTypeSnapshot = appointmentConfigSnapshot.serviceTypeSnapshot;
        serviceDurationMinSnapshot = appointmentConfigSnapshot.serviceDurationMinSnapshot;
      }
    }
    paymentStatus = derivePaymentStatus(
      serviceAmount,
      prepaidAmount,
      settlementAmount,
      requestedPaymentStatus && BOOKING_PAYMENT_STATUSES.includes(requestedPaymentStatus as BookingPaymentStatus)
        ? (requestedPaymentStatus as BookingPaymentStatus)
        : null,
    );

    if (endsAt <= startsAt) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", "End date must be greater than start date");
    }
    if (clientId) {
      await loadClientTx(client, companyId, clientId);
    }
    if (clientIin && !isValidIin(clientIin)) {
      throw new BookingServiceError(400, "INVALID_IIN", "Invalid IIN");
    }
    if (payload.serviceAmount !== undefined && serviceAmount <= 0) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", "serviceAmount is required and must be greater than 0");
    }
    if (prepaidAmount > 0 && !prepaidPaymentMethod) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", "prepaidPaymentMethod is required when prepaidAmount is greater than 0");
    }
    if (settlementAmount > 0 && !settlementPaymentMethod) {
      throw new BookingServiceError(
        400,
        "VALIDATION_ERROR",
        "settlementPaymentMethod is required when settlementAmount is greater than 0",
      );
    }
    if (serviceAmount > 0 && prepaidAmount + settlementAmount > serviceAmount) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", "Total received amount cannot exceed serviceAmount");
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
          client_id = $4,
          service_id = $5,
          service_name_snapshot = $6,
          service_type_snapshot = $7,
          service_duration_min_snapshot = $8,
          starts_at = $9,
          ends_at = $10,
          duration_min = $11,
          status = $12,
          appointment_type = $13,
          client_name = $14,
          client_phone = $15,
          client_iin = $16,
          client_birth_date = $17,
          client_gender = $18,
          client_comment = $19,
          source = $20,
          external_ref = $21,
          idempotency_key = $22,
          created_by_user_id = $23,
          updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [
        companyId,
        id,
        employeeId,
        clientId,
        serviceId,
        serviceNameSnapshot,
        serviceTypeSnapshot,
        serviceDurationMinSnapshot,
        startsAt.toISOString(),
        endsAt.toISOString(),
        durationMin,
        status,
        appointmentType,
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

    const finance = await upsertAppointmentFinanceTx(client, {
      companyId,
      appointmentId: id,
      serviceAmount,
      compensationTypeSnapshot,
      compensationValueSnapshot,
      prepaidAmount,
      prepaidPaymentMethod,
      settlementAmount,
      settlementPaymentMethod,
      paymentStatus,
    });
    await syncAppointmentPaymentJournalTx(client, {
      companyId,
      appointmentId: id,
      prepaidAmount,
      prepaidPaymentMethod,
      settlementAmount,
      settlementPaymentMethod,
    });
    await syncExpenseForAppointmentTx(client, {
      companyId,
      appointment: updatedRows[0],
      finance,
    });

    return { appointment: mapAppointment(updatedRows[0], finance) };
  });
}

export async function cancelBookingAppointment(companyIdRaw: string, appointmentId: string) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const id = normalizeRequiredText(appointmentId, "appointmentId");

  return withTransaction(async (client) => {
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
    const existingFinance = await loadAppointmentFinanceTx(client, companyId, id);
    const finance = await upsertAppointmentFinanceTx(client, {
      companyId,
      appointmentId: id,
      serviceAmount: existingFinance?.service_amount ?? 0,
      compensationTypeSnapshot: existingFinance?.compensation_type_snapshot ?? null,
      compensationValueSnapshot: existingFinance?.compensation_value_snapshot ?? null,
      prepaidAmount: existingFinance?.prepaid_amount ?? 0,
      prepaidPaymentMethod: existingFinance?.prepaid_payment_method ?? null,
      settlementAmount: existingFinance?.settlement_amount ?? 0,
      settlementPaymentMethod: existingFinance?.settlement_payment_method ?? null,
      paymentStatus: "cancelled",
    });
    await syncExpenseForAppointmentTx(client, {
      companyId,
      appointment: rows[0],
      finance,
    });

    return { appointment: mapAppointment(rows[0], finance) };
  });
}

export async function addBookingAppointmentPayment(
  companyIdRaw: string,
  appointmentId: string,
  payload: {
    amount?: number;
    paymentMethod: BookingPaymentMethod | string;
  },
) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const id = normalizeRequiredText(appointmentId, "appointmentId");
  const paymentMethod = parsePaymentMethod(payload.paymentMethod) as BookingPaymentMethod;

  return withTransaction(async (client) => {
    const { rows } = await client.query<AppointmentRow>(
      `
        SELECT *
        FROM calendar.appointments
        WHERE company_id = $1 AND id = $2
        LIMIT 1
      `,
      [companyId, id],
    );
    const appointment = rows[0];
    if (!appointment) {
      throw new BookingServiceError(404, "APPOINTMENT_NOT_FOUND", "Appointment not found");
    }

    const existingFinance = await loadAppointmentFinanceTx(client, companyId, id);
    const serviceAmount = existingFinance?.service_amount ?? 0;
    const prepaidAmount = existingFinance?.prepaid_amount ?? 0;
    const settlementAmount = existingFinance?.settlement_amount ?? 0;
    if (serviceAmount <= 0) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", "Set serviceAmount before adding payment");
    }
    if (existingFinance?.payment_status === "cancelled") {
      throw new BookingServiceError(400, "VALIDATION_ERROR", "Cancelled payments cannot be updated");
    }

    const alreadyReceived = prepaidAmount + settlementAmount;
    const remaining = Math.max(serviceAmount - alreadyReceived, 0);
    const amount = payload.amount !== undefined ? clampMoney(payload.amount) : remaining;
    if (amount <= 0) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", "Payment amount must be greater than 0");
    }
    if (alreadyReceived + amount > serviceAmount) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", "Payment amount exceeds remaining balance");
    }

    let compensationTypeSnapshot = existingFinance?.compensation_type_snapshot ?? null;
    let compensationValueSnapshot = existingFinance?.compensation_value_snapshot ?? null;
    if (compensationTypeSnapshot === null || compensationValueSnapshot === null) {
      const snapshot = await resolveAppointmentConfigSnapshotTx(client, {
        companyId,
        employeeId: appointment.employee_id,
        serviceId: appointment.service_id,
        validateServiceAvailability: false,
      });
      compensationTypeSnapshot = snapshot.compensationTypeSnapshot;
      compensationValueSnapshot = snapshot.compensationValueSnapshot;
    }

    const finance = await upsertAppointmentFinanceTx(client, {
      companyId,
      appointmentId: id,
      serviceAmount,
      compensationTypeSnapshot,
      compensationValueSnapshot,
      prepaidAmount,
      prepaidPaymentMethod: existingFinance?.prepaid_payment_method ?? null,
      settlementAmount: settlementAmount + amount,
      settlementPaymentMethod: paymentMethod,
      paymentStatus: derivePaymentStatus(
        serviceAmount,
        prepaidAmount,
        settlementAmount + amount,
        existingFinance?.payment_status === "cancelled" ? "cancelled" : null,
      ),
    });
    await insertAppointmentPaymentTx(client, {
      companyId,
      appointmentId: id,
      amount,
      paymentMethod,
      paymentKind: "payment",
    });

    await syncExpenseForAppointmentTx(client, {
      companyId,
      appointment,
      finance,
    });

    return { appointment: mapAppointment(appointment, finance) };
  });
}

export async function cancelBookingAppointmentPayment(companyIdRaw: string, appointmentId: string) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const id = normalizeRequiredText(appointmentId, "appointmentId");

  return withTransaction(async (client) => {
    const { rows } = await client.query<AppointmentRow>(
      `
        SELECT *
        FROM calendar.appointments
        WHERE company_id = $1 AND id = $2
        LIMIT 1
      `,
      [companyId, id],
    );
    const appointment = rows[0];
    if (!appointment) {
      throw new BookingServiceError(404, "APPOINTMENT_NOT_FOUND", "Appointment not found");
    }

    const existingExpense = await loadAppointmentExpenseByAppointmentTx(client, companyId, id);
    if (existingExpense?.status === "paid") {
      throw new BookingServiceError(
        400,
        "VALIDATION_ERROR",
        "Cannot cancel payment after the doctor's expense has been paid",
      );
    }

    const existingFinance = await loadAppointmentFinanceTx(client, companyId, id);

    await client.query(
      `
        DELETE FROM calendar.appointment_payments
        WHERE company_id = $1
          AND appointment_id = $2
      `,
      [companyId, id],
    );

    const finance = await upsertAppointmentFinanceTx(client, {
      companyId,
      appointmentId: id,
      serviceAmount: existingFinance?.service_amount ?? 0,
      compensationTypeSnapshot: existingFinance?.compensation_type_snapshot ?? null,
      compensationValueSnapshot: existingFinance?.compensation_value_snapshot ?? null,
      prepaidAmount: 0,
      prepaidPaymentMethod: null,
      settlementAmount: 0,
      settlementPaymentMethod: null,
      paymentStatus: "cancelled",
    });

    await syncExpenseForAppointmentTx(client, {
      companyId,
      appointment,
      finance,
    });

    return { appointment: mapAppointment(appointment, finance) };
  });
}

export async function markBookingExpensePaid(companyIdRaw: string, expenseId: string) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const id = normalizeRequiredText(expenseId, "expenseId");

  return withClient(async (client) => {
    const { rows } = await client.query<AppointmentExpenseRow>(
      `
        UPDATE calendar.appointment_expenses
        SET
          status = 'paid',
          paid_at = COALESCE(paid_at, NOW()),
          updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [companyId, id],
    );

    if (!rows.length) {
      throw new BookingServiceError(404, "EXPENSE_NOT_FOUND", "Expense not found");
    }

    return { expense: mapExpense(rows[0]) };
  });
}

export async function payAllBookingExpenses(
  companyIdRaw: string,
  params: {
    from?: string;
    to?: string;
    employeeIds?: string[];
  } = {},
) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const from = params.from ? parseIsoDateTime(params.from, "from") : null;
  const to = params.to ? parseIsoDateTime(params.to, "to") : null;
  if (from && to && to <= from) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "Field 'to' must be greater than 'from'");
  }
  const employeeIds =
    params.employeeIds
      ?.map((item) => normalizeOptionalText(item))
      .filter((item): item is string => Boolean(item)) || [];

  return withClient(async (client) => {
    const { rows } = await client.query<AppointmentExpenseRow>(
      `
        UPDATE calendar.appointment_expenses AS expense
        SET
          status = 'paid',
          paid_at = COALESCE(expense.paid_at, NOW()),
          updated_at = NOW()
        FROM calendar.appointments AS appointment
        WHERE expense.company_id = $1
          AND expense.status = 'unpaid'
          AND expense.appointment_id = appointment.id
          AND appointment.company_id = $1
          AND ($2::timestamptz IS NULL OR appointment.starts_at >= $2)
          AND ($3::timestamptz IS NULL OR appointment.starts_at < $3)
          AND (
            coalesce(array_length($4::text[], 1), 0) = 0
            OR appointment.employee_id = ANY($4::text[])
          )
        RETURNING expense.*
      `,
      [companyId, from ? from.toISOString() : null, to ? to.toISOString() : null, employeeIds],
    );

    return { expenses: rows.map(mapExpense) };
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

  return withTransaction(async (client) => {
    await assertHolidayUniquenessTx(client, {
      companyId,
      date,
      isRecurringYearly,
    });

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

export async function updateBookingHoliday(companyIdRaw: string, holidayId: string, payload: UpdateHolidayInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const id = normalizeRequiredText(holidayId, "holidayId");

  return withTransaction(async (client) => {
    const existing = await loadHolidayTx(client, companyId, id);
    const date =
      payload.date !== undefined ? parseDateOnly(payload.date, "date") : normalizeDateOnly(existing.date);
    const title = payload.title !== undefined ? normalizeRequiredText(payload.title, "title") : existing.title;
    const isRecurringYearly =
      payload.isRecurringYearly !== undefined
        ? parseBool(payload.isRecurringYearly, existing.is_recurring_yearly)
        : existing.is_recurring_yearly;
    const isWorkingDayOverride =
      payload.isWorkingDayOverride !== undefined
        ? parseBool(payload.isWorkingDayOverride, existing.is_working_day_override)
        : existing.is_working_day_override;

    await assertHolidayUniquenessTx(client, {
      companyId,
      date,
      isRecurringYearly,
      ignoreHolidayId: id,
    });

    const { rows } = await client.query<HolidayRow>(
      `
        UPDATE calendar.holidays
        SET
          date = $3::date,
          title = $4,
          is_recurring_yearly = $5,
          is_working_day_override = $6,
          updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [companyId, id, date, title, isRecurringYearly, isWorkingDayOverride],
    );

    return { holiday: mapHoliday(rows[0]) };
  });
}

export async function deleteBookingHoliday(companyIdRaw: string, holidayId: string) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const id = normalizeRequiredText(holidayId, "holidayId");

  return withClient(async (client) => {
    const { rows } = await client.query<HolidayRow>(
      `
        DELETE FROM calendar.holidays
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [companyId, id],
    );
    if (!rows.length) {
      throw new BookingServiceError(404, "HOLIDAY_NOT_FOUND", "Holiday not found");
    }
    return { holiday: mapHoliday(rows[0]) };
  });
}

export async function listBookingWorkdayOverrides(companyIdRaw: string, params: WorkdayOverridesListParams = {}) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const employeeId = normalizeOptionalText(params.employeeId);
  const fromDate = params.from ? parseDateOnly(params.from, "from") : null;
  const toDate = params.to ? parseDateOnly(params.to, "to") : null;
  const limit = clampInt(params.limit, 1, 500, 60);

  if (fromDate && toDate && toDate < fromDate) {
    throw new BookingServiceError(400, "VALIDATION_ERROR", "Field 'to' must be greater than or equal to 'from'");
  }

  return withClient(async (client) => {
    if (employeeId) {
      await loadEmployeeTx(client, companyId, employeeId);
    }

    const { rows } = await client.query<WorkdayOverrideRow>(
      `
        SELECT *
        FROM calendar.workday_overrides
        WHERE company_id = $1
          AND ($2::text IS NULL OR employee_id = $2)
          AND ($3::date IS NULL OR date >= $3::date)
          AND ($4::date IS NULL OR date <= $4::date)
        ORDER BY date ASC, start_minute ASC, created_at ASC
        LIMIT $5
      `,
      [companyId, employeeId, fromDate, toDate, limit],
    );

    return { workdayOverrides: rows.map(mapWorkdayOverride) };
  });
}

export async function createBookingWorkdayOverride(companyIdRaw: string, payload: CreateWorkdayOverrideInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const employeeId = normalizeRequiredText(payload.employeeId, "employeeId");
  const date = parseDateOnly(payload.date, "date");
  const { startMinute, endMinute } = normalizeWorkdayOverrideRangeInput(payload.startMinute, payload.endMinute);
  const { breakStartMinute, breakEndMinute, breakTitle } = normalizeWorkdayOverrideBreakInput({
    breakStartMinuteRaw: payload.breakStartMinute,
    breakEndMinuteRaw: payload.breakEndMinute,
    breakTitleRaw: payload.breakTitle,
    startMinute,
    endMinute,
  });

  return withTransaction(async (client) => {
    await loadEmployeeTx(client, companyId, employeeId);

    const { rows } = await client.query<WorkdayOverrideRow>(
      `
        INSERT INTO calendar.workday_overrides (
          id, company_id, employee_id, date, start_minute, end_minute, break_start_minute, break_end_minute, break_title, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      `,
      [randomId(), companyId, employeeId, date, startMinute, endMinute, breakStartMinute, breakEndMinute, breakTitle],
    );

    return { workdayOverride: mapWorkdayOverride(rows[0]) };
  });
}

export async function updateBookingWorkdayOverride(
  companyIdRaw: string,
  workdayOverrideId: string,
  payload: UpdateWorkdayOverrideInput,
) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const id = normalizeRequiredText(workdayOverrideId, "workdayOverrideId");

  return withTransaction(async (client) => {
    const existing = await loadWorkdayOverrideTx(client, companyId, id);
    const employeeId =
      payload.employeeId !== undefined ? normalizeRequiredText(payload.employeeId, "employeeId") : existing.employee_id;
    const date = payload.date !== undefined ? parseDateOnly(payload.date, "date") : normalizeDateOnly(existing.date);
    const { startMinute, endMinute } = normalizeWorkdayOverrideRangeInput(
      payload.startMinute !== undefined ? payload.startMinute : existing.start_minute,
      payload.endMinute !== undefined ? payload.endMinute : existing.end_minute,
    );
    const { breakStartMinute, breakEndMinute, breakTitle } = normalizeWorkdayOverrideBreakInput({
      breakStartMinuteRaw:
        payload.breakStartMinute !== undefined ? payload.breakStartMinute : existing.break_start_minute,
      breakEndMinuteRaw: payload.breakEndMinute !== undefined ? payload.breakEndMinute : existing.break_end_minute,
      breakTitleRaw: payload.breakTitle !== undefined ? payload.breakTitle : existing.break_title,
      startMinute,
      endMinute,
    });

    await loadEmployeeTx(client, companyId, employeeId);

    const { rows } = await client.query<WorkdayOverrideRow>(
      `
        UPDATE calendar.workday_overrides
        SET
          employee_id = $3,
          date = $4::date,
          start_minute = $5,
          end_minute = $6,
          break_start_minute = $7,
          break_end_minute = $8,
          break_title = $9,
          updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [companyId, id, employeeId, date, startMinute, endMinute, breakStartMinute, breakEndMinute, breakTitle],
    );

    return { workdayOverride: mapWorkdayOverride(rows[0]) };
  });
}

export async function deleteBookingWorkdayOverride(companyIdRaw: string, workdayOverrideId: string) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const id = normalizeRequiredText(workdayOverrideId, "workdayOverrideId");

  return withClient(async (client) => {
    const { rows } = await client.query<WorkdayOverrideRow>(
      `
        DELETE FROM calendar.workday_overrides
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [companyId, id],
    );
    if (!rows.length) {
      throw new BookingServiceError(404, "WORKDAY_OVERRIDE_NOT_FOUND", "Workday override not found");
    }
    return { workdayOverride: mapWorkdayOverride(rows[0]) };
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

export async function updateBookingTimeOff(companyIdRaw: string, timeOffId: string, payload: UpdateTimeOffInput) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const id = normalizeRequiredText(timeOffId, "timeOffId");

  return withTransaction(async (client) => {
    const existing = await loadTimeOffTx(client, companyId, id);
    const employeeId =
      payload.employeeId !== undefined ? normalizeOptionalText(payload.employeeId) : existing.employee_id;
    if (employeeId) {
      await loadEmployeeTx(client, companyId, employeeId);
    }

    const type = payload.type !== undefined ? normalizeRequiredText(payload.type, "type") : existing.type;
    const startsAt =
      payload.startsAt !== undefined ? parseIsoDateTime(payload.startsAt, "startsAt") : new Date(existing.starts_at);
    const endsAt =
      payload.endsAt !== undefined ? parseIsoDateTime(payload.endsAt, "endsAt") : new Date(existing.ends_at);
    const title = payload.title !== undefined ? normalizeOptionalText(payload.title) : existing.title;
    const notes = payload.notes !== undefined ? normalizeOptionalText(payload.notes) : existing.notes;

    if (endsAt <= startsAt) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", "End date must be greater than start date");
    }

    const { rows } = await client.query<TimeOffRow>(
      `
        UPDATE calendar.time_off
        SET
          employee_id = $3,
          type = $4,
          starts_at = $5,
          ends_at = $6,
          title = $7,
          notes = $8,
          updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [companyId, id, employeeId, type, startsAt.toISOString(), endsAt.toISOString(), title, notes],
    );

    return { item: mapTimeOff(rows[0]) };
  });
}

export async function deleteBookingTimeOff(companyIdRaw: string, timeOffId: string) {
  await ensureBookingSchema();
  const companyId = normalizeCompanyId(companyIdRaw);
  const id = normalizeRequiredText(timeOffId, "timeOffId");

  return withClient(async (client) => {
    const { rows } = await client.query<TimeOffRow>(
      `
        DELETE FROM calendar.time_off
        WHERE company_id = $1 AND id = $2
        RETURNING *
      `,
      [companyId, id],
    );
    if (!rows.length) {
      throw new BookingServiceError(404, "TIME_OFF_NOT_FOUND", "Time off not found");
    }
    return { item: mapTimeOff(rows[0]) };
  });
}
