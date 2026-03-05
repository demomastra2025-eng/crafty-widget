"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  endOfMonth,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  CalendarPlus,
  Check,
  CheckCheck,
  Clock3,
  CornerDownRight,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePickerPopover } from "@/components/ui/date-picker-popover";
import { DateTimePicker24h } from "@/components/ui/date-time-picker-24h";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker24h } from "@/components/ui/time-picker-24h";
import { useToast } from "@/hooks/use-toast";
import {
  BookingApiError,
  BookingBreakRule,
  BookingCalendarViewResponse,
  BookingClient,
  BookingCompensationType,
  BookingEmployee,
  BookingAppointment,
  BookingAppointmentType,
  BookingHoliday,
  BookingPaymentMethod,
  BookingPaymentStatus,
  BookingRequestContext,
  BookingService,
  BookingTimeOff,
  BookingWorkdayOverride,
  BookingRuleRangeInput,
  BookingWorkRule,
  BookingView,
  cancelBookingAppointment,
  createBookingAppointment,
  createBookingClient,
  createBookingEmployee,
  createBookingService,
  createBookingHoliday,
  createBookingWorkdayOverride,
  createBookingTimeOff,
  deleteBookingHoliday,
  deleteBookingWorkdayOverride,
  deleteBookingTimeOff,
  fetchBookingCalendarView,
  listBookingClients,
  listBookingHolidays,
  listBookingServices,
  listBookingWorkdayOverrides,
  replaceBookingEmployeeBreakRules,
  replaceBookingEmployeeWorkRules,
  updateBookingHoliday,
  updateBookingWorkdayOverride,
  updateBookingTimeOff,
  updateBookingClient,
  updateBookingEmployee,
  updateBookingAppointment,
  updateBookingService,
} from "@/lib/booking-api";
import { cn } from "@/lib/utils";
import { useAppointmentsCalendarIndexes } from "./hooks/use-appointments-calendar-indexes";
import { useAppointmentsDirectoryData } from "./hooks/use-appointments-directory-data";
import { useAppointmentsTimelineGrid } from "./hooks/use-appointments-timeline-grid";
import { AppointmentDialog } from "./components/appointment-dialog";
import { DayTimeline } from "./components/day-timeline";
import { WeekTimeline } from "./components/week-timeline";

type SlotDraft = {
  employeeId: string | null;
  startsAt: string;
  endsAt: string;
  candidateSlots?: Array<{
    employeeId: string;
    startsAt: string;
    endsAt: string;
  }>;
};

type AvailableSlotCandidate = {
  employeeId: string;
  startsAt: string;
  endsAt: string;
};

type TimelineCollapsedRange = {
  isStart: boolean;
  endMinute: number;
};

type PendingCalendarAdjustment =
  | {
    kind: "move";
    appointmentId: string;
    clientName: string;
    currentEmployeeLabel: string;
    nextEmployeeLabel: string;
    currentStartsAt: string;
    currentEndsAt: string;
    nextStartsAt: string;
    nextEndsAt: string;
    payload: {
      employeeId: string;
      startsAt: string;
      endsAt: string;
    };
  }
  | {
    kind: "resize";
    appointmentId: string;
    clientName: string;
    employeeLabel: string;
    currentStartsAt: string;
    currentEndsAt: string;
    nextStartsAt: string;
    nextEndsAt: string;
    payload: {
      endsAt: string;
      durationMin: number;
    };
  };

type BuildCreateAppointmentCandidatesAtStartParams = {
  startsAtIso: string;
  durationMin: number;
  employees: BookingEmployee[];
  candidateEmployeeIds?: string[];
  ignoreAppointmentId?: string;
  workRulesByEmployee: Record<string, BookingWorkRule[]>;
  breakRulesByEmployee: Record<string, BookingBreakRule[]>;
  workdayOverrideByEmployeeDateKey: Map<string, BookingWorkdayOverride>;
  blockingHolidayByDateKey: Map<string, BookingHoliday>;
  holidayWorkOverrideDateKeys: Set<string>;
  timeOff: BookingTimeOff[];
  activeAppointments: BookingAppointment[];
};

const WEEKDAY_SHORT_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const WEEKDAY_LONG_RU = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const WEEKDAY_EDITOR_ORDER = [1, 2, 3, 4, 5, 6, 0];
const EMPLOYEE_SELECTION_STORAGE_KEY = "booking:selectedEmployeeIds";
const APPOINTMENT_VISIBILITY_STORAGE_KEY = "booking:appointmentVisibility";
const BOOKING_STEP_MIN = 5;
const TIMELINE_STEP_MIN = 30;
const FALLBACK_APPOINTMENT_DURATION_MIN = TIMELINE_STEP_MIN;
const CALENDAR_AVAILABILITY_DURATION_MIN = BOOKING_STEP_MIN;
const WEEK_SLOT_HEIGHT_PX = 40;
const WEEK_GRID_TARGET_WIDTH_PX = 920;
const WEEK_TIME_COLUMN_WIDTH_PX = 52;
const WEEK_DAY_MIN_COLUMN_WIDTH_PX = 92;
const WEEK_OVERLAY_LEFT_GUTTER_PX = 18;
const WEEK_OVERLAY_CASCADE_OFFSET_PX = 12;
const APPOINTMENT_PHONE_INPUT_LENGTH = 10;
const DAY_SLOT_HEIGHT_PX = 64;
const EMPLOYEE_NAME_MAX_LENGTH = 20;
const EMPLOYEE_SPECIALTY_MAX_LENGTH = 15;
const APPOINTMENT_DURATION_PRESET_BASE_MIN = [15, 30, 60, 120];
const EMPLOYEE_COLOR_POOL = [
  "#0EA5E9",
  "#06B6D4",
  "#10B981",
  "#22C55E",
  "#84CC16",
  "#EAB308",
  "#F59E0B",
  "#F97316",
  "#EF4444",
  "#F43F5E",
  "#EC4899",
  "#D946EF",
  "#A855F7",
  "#8B5CF6",
  "#6366F1",
  "#3B82F6",
  "#14B8A6",
  "#65A30D",
  "#EA580C",
  "#DC2626",
];
const STATUS_LABEL_RU: Record<string, string> = {
  scheduled: "Запланирован",
  confirmed: "Подтвержден",
  completed: "Завершен",
  cancelled: "Отменен",
  no_show: "Неявка",
};
const APPOINTMENT_STATUS_OPTIONS = [
  { value: "scheduled", label: STATUS_LABEL_RU.scheduled },
  { value: "confirmed", label: STATUS_LABEL_RU.confirmed },
  { value: "completed", label: STATUS_LABEL_RU.completed },
  { value: "no_show", label: STATUS_LABEL_RU.no_show },
];
const PAYMENT_STATUS_LABEL_RU: Record<BookingPaymentStatus | string, string> = {
  awaiting_payment: "Ожидает оплаты",
  prepaid: "Предоплачен",
  paid: "Оплачен",
  cancelled: "Отменен",
};
const PAYMENT_METHOD_LABEL_RU: Record<BookingPaymentMethod | string, string> = {
  kaspi_transfer: "Kaspi перевод",
  kaspi_qr: "Kaspi QR",
  cash: "Наличка",
  bank_transfer: "Безналичная оплата",
};
const PAYMENT_METHOD_OPTIONS: Array<{ value: BookingPaymentMethod; label: string }> = [
  { value: "kaspi_transfer", label: PAYMENT_METHOD_LABEL_RU.kaspi_transfer },
  { value: "kaspi_qr", label: PAYMENT_METHOD_LABEL_RU.kaspi_qr },
  { value: "cash", label: PAYMENT_METHOD_LABEL_RU.cash },
  { value: "bank_transfer", label: PAYMENT_METHOD_LABEL_RU.bank_transfer },
];
const COMPENSATION_TYPE_LABEL_RU: Record<BookingCompensationType | string, string> = {
  percent: "Процент",
  fixed: "Фикс",
};
const TIME_OFF_TYPE_RU: Record<string, string> = {
  vacation: "Отпуск",
  break: "Перерыв",
  manual_block: "Блокировка",
  sick_leave: "Больничный",
};
const GENDER_LABEL_RU: Record<string, string> = {
  male: "Мужской",
  female: "Женский",
};
const BOOKING_ERROR_LABEL_RU: Record<string, string> = {
  SLOT_CONFLICT: "Слот уже занят",
  BLOCKED_BY_BREAK: "Слот попадает в перерыв",
  BLOCKED_BY_VACATION: "Слот попадает в отпуск",
  BLOCKED_BY_HOLIDAY: "Слот попадает в праздник",
  OUTSIDE_WORKING_HOURS: "Слот вне рабочего времени",
  INVALID_IIN: "Некорректный ИИН",
  EMPLOYEE_NOT_FOUND: "Сотрудник не найден",
  CLIENT_NOT_FOUND: "Клиент не найден",
  SERVICE_NOT_FOUND: "Услуга не найдена",
  SERVICE_NOT_AVAILABLE_FOR_EMPLOYEE: "Услуга недоступна у выбранного сотрудника",
  ACCESS_DENIED: "Нет доступа",
};

type ScheduleDayRow = {
  weekday: number;
  workEnabled: boolean;
  workStart: string;
  workEnd: string;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
  breakTitle: string;
};

type DragAppointmentDraft = {
  id: string;
  employeeId: string;
  startsAt: string;
  endsAt: string;
  clientName: string;
  pointerOffsetMin: number;
};

type ResizeAppointmentDraft = {
  appointmentId: string;
  endsAt: string;
};

type ScheduleHolidayPreviewItem = {
  id: string;
  title: string;
  date: string;
  dateLabel: string;
  isRecurringYearly: boolean;
  isWorkingDayOverride: boolean;
};

type ScheduleTimeOffPreviewItem = {
  id: string;
  employeeId: string | null;
  employeeLabel: string;
  type: string;
  typeLabel: string;
  title: string | null;
  startsAt: string;
  endsAt: string;
  notes: string | null;
};

type ScheduleWorkdayOverridePreviewItem = {
  id: string;
  employeeId: string;
  employeeLabel: string;
  date: string;
  dateLabel: string;
  startMinute: number;
  endMinute: number;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
  breakTitle: string | null;
};

type ServicePriceEditorRow = {
  employeeId: string;
  enabled: boolean;
  price: number;
  priceInput: string;
  compensationType: BookingCompensationType;
  compensationValue: number;
  compensationValueInput: string;
};

type ServiceFormState = {
  name: string;
  basePrice: number;
  basePriceInput: string;
  durationMin: number;
  durationInput: string;
  category: string;
  direction: string;
  serviceType: BookingAppointmentType;
  description: string;
  isActive: boolean;
  employeePrices: ServicePriceEditorRow[];
};

export type AppointmentPrefill = {
  clientName?: string;
  clientPhone?: string;
  clientIin?: string;
  clientComment?: string;
  source?: string;
  externalRef?: string;
};

type AppointmentsPageClientProps = {
  prefill?: AppointmentPrefill;
  requestContext?: BookingRequestContext;
};

function getViewRange(anchorDate: Date, view: BookingView) {
  if (view === "day") {
    const start = startOfDay(anchorDate);
    return { from: start, to: addDays(start, 1) };
  }
  if (view === "week") {
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
    return { from: start, to: addDays(start, 7) };
  }
  const start = startOfMonth(anchorDate);
  const end = endOfMonth(anchorDate);
  return { from: start, to: addDays(end, 1) };
}

function toDateKeyLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKeyString(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formatHolidayDateLabelRu(value: string, isRecurringYearly: boolean) {
  const parsed = parseDateKeyString(value);
  if (!parsed) return value;

  const date = new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    ...(isRecurringYearly ? {} : { year: "numeric" }),
  });
}

function holidaySortKey(value: string, isRecurringYearly: boolean) {
  const parsed = parseDateKeyString(value);
  if (!parsed) return `${isRecurringYearly ? "1" : "0"}-${value}`;

  const month = String(parsed.month).padStart(2, "0");
  const day = String(parsed.day).padStart(2, "0");
  return isRecurringYearly
    ? `1-${month}-${day}`
    : `0-${toDateKey(parsed.year, parsed.month, parsed.day)}`;
}

function toDateKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function createCellDate(day: Date, minuteOfDay: number) {
  const result = new Date(day);
  result.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return result;
}

function slotKey(employeeId: string, startsAtIso: string) {
  return `${employeeId}|${startsAtIso}`;
}

function dayMinuteKeyLocal(dateKey: string, minuteOfDay: number) {
  return `${dateKey}|${minuteOfDay}`;
}

function employeeCellKeyLocal(employeeId: string, dateKey: string, minuteOfDay: number) {
  return `${employeeId}|${dateKey}|${minuteOfDay}`;
}

function workdayOverrideKeyLocal(employeeId: string, dateKey: string) {
  return `${employeeId}|${dateKey}`;
}

function buildWorkdayOverrideBreakRule(
  item: BookingWorkdayOverride | undefined,
  weekday: number,
): BookingBreakRule | null {
  if (!item || item.breakStartMinute === null || item.breakStartMinute === undefined) return null;
  if (item.breakEndMinute === null || item.breakEndMinute === undefined) return null;

  return {
    id: `${item.id}:override-break`,
    companyId: item.companyId,
    employeeId: item.employeeId,
    weekday,
    startMinute: item.breakStartMinute,
    endMinute: item.breakEndMinute,
    title: item.breakTitle || "Перерыв",
    isActive: true,
  };
}

function getEffectiveBreakRulesForDay(params: {
  employeeId: string;
  weekday: number;
  dayKey: string;
  breakRulesByEmployee: Record<string, BookingBreakRule[]>;
  workdayOverrideByEmployeeDateKey: Map<string, BookingWorkdayOverride>;
}) {
  const employeeWorkdayOverride = params.workdayOverrideByEmployeeDateKey.get(
    workdayOverrideKeyLocal(params.employeeId, params.dayKey),
  );
  if (employeeWorkdayOverride) {
    const overrideBreak = buildWorkdayOverrideBreakRule(employeeWorkdayOverride, params.weekday);
    return overrideBreak ? [overrideBreak] : [];
  }

  return ((params.breakRulesByEmployee[params.employeeId] || []) as BookingBreakRule[]).filter(
    (rule) => rule.isActive && rule.weekday === params.weekday,
  );
}

function formatMinuteLabel(minuteOfDay: number) {
  const h = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
  const m = String(minuteOfDay % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function minuteToInputTime(minuteOfDay: number) {
  const safe = Math.max(0, Math.min(24 * 60 - 1, minuteOfDay));
  const h = String(Math.floor(safe / 60)).padStart(2, "0");
  const m = String(safe % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function inputTimeToMinute(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function toInputDateTimeValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function fromInputDateTimeValue(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dateOnlyFromInputOrIso(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const directDate = raw.split("T")[0] || "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(directDate)) return directDate;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return toDateKeyLocal(parsed);
}

function toUtcStartOfDate(value: string) {
  const dateOnly = dateOnlyFromInputOrIso(value);
  if (!dateOnly) return null;
  return `${dateOnly}T00:00:00.000Z`;
}

function toUtcEndOfDate(value: string) {
  const dateOnly = dateOnlyFromInputOrIso(value);
  if (!dateOnly) return null;
  return `${dateOnly}T23:59:59.999Z`;
}

function clampAppointmentDurationMin(value: unknown, fallback = TIMELINE_STEP_MIN) {
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw)) return fallback;
  const rounded = Math.round(raw / BOOKING_STEP_MIN) * BOOKING_STEP_MIN;
  return Math.max(BOOKING_STEP_MIN, Math.min(12 * 60, rounded));
}

function normalizeDurationStepMin(value: unknown, fallback = BOOKING_STEP_MIN) {
  return clampAppointmentDurationMin(value, fallback);
}

function alignDurationToStep(value: unknown, stepMin: number, fallback = stepMin) {
  const safeStep = normalizeDurationStepMin(stepMin, BOOKING_STEP_MIN);
  const normalized = clampAppointmentDurationMin(value, fallback);
  const aligned = Math.round(normalized / safeStep) * safeStep;
  return Math.max(safeStep, Math.min(12 * 60, aligned));
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatOptionalMoneyInput(value: unknown) {
  const normalized = Math.max(0, Math.round(Number(value) || 0));
  return normalized > 0 ? String(normalized) : "";
}

function clampCompensationValue(
  value: unknown,
  compensationType: BookingCompensationType = "percent",
) {
  const normalized = Math.max(0, Math.round(Number(value) || 0));
  return compensationType === "percent" ? Math.min(100, normalized) : normalized;
}

function getNameInitials(value: string) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "??";
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("");
}

function buildServicePriceEditorRows(
  employees: BookingEmployee[],
  service?: BookingService | null,
): ServicePriceEditorRow[] {
  const priceByEmployeeId = new Map(service?.prices.map((item) => [item.employeeId, item] as const) || []);

  return employees.map((employee) => {
    const price = priceByEmployeeId.get(employee.id);
    const normalizedPrice = Math.max(0, Math.round(Number(price?.price) || 0));
    const enabled = Boolean(price?.isActive && normalizedPrice > 0);
    const fallbackCompensationType = ((employee.compensationType as BookingCompensationType) || "percent");
    const fallbackCompensationValue = clampCompensationValue(employee.compensationValue ?? 0, fallbackCompensationType);
    const compensationType = ((price?.compensationType as BookingCompensationType) || fallbackCompensationType);
    const compensationValue = clampCompensationValue(
      price?.compensationValue ?? fallbackCompensationValue,
      compensationType,
    );

    return {
      employeeId: employee.id,
      enabled,
      price: normalizedPrice,
      priceInput: normalizedPrice > 0 ? String(normalizedPrice) : "",
      compensationType,
      compensationValue,
      compensationValueInput: formatOptionalMoneyInput(compensationValue),
    };
  });
}

function buildDefaultServiceForm(employees: BookingEmployee[], service?: BookingService | null): ServiceFormState {
  const durationMin = clampAppointmentDurationMin(service?.durationMin, FALLBACK_APPOINTMENT_DURATION_MIN);
  const basePrice = Math.max(0, Math.round(Number(service?.basePrice) || 0));
  return {
    name: service?.name || "",
    basePrice,
    basePriceInput: formatOptionalMoneyInput(basePrice),
    durationMin,
    durationInput: String(durationMin),
    category: service?.category || "",
    direction: service?.direction || "",
    serviceType: inferAppointmentTypeFromServiceType(service?.serviceType) || "primary",
    description: service?.description || "",
    isActive: service?.isActive ?? true,
    employeePrices: buildServicePriceEditorRows(employees, service),
  };
}

function normalizeAppointmentPhoneInput(value: string) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.length > APPOINTMENT_PHONE_INPUT_LENGTH && (digits.startsWith("7") || digits.startsWith("8"))) {
    return digits.slice(1, APPOINTMENT_PHONE_INPUT_LENGTH + 1);
  }
  return digits.slice(0, APPOINTMENT_PHONE_INPUT_LENGTH);
}

function toAppointmentPhoneInputValue(value: string | null | undefined) {
  const digits = digitsOnly(String(value || ""));
  if (!digits) return "";
  if (digits.length >= APPOINTMENT_PHONE_INPUT_LENGTH + 1 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return digits.slice(1, APPOINTMENT_PHONE_INPUT_LENGTH + 1);
  }
  if (digits.length === APPOINTMENT_PHONE_INPUT_LENGTH) return digits;
  return digits.slice(0, APPOINTMENT_PHONE_INPUT_LENGTH);
}

function serializeAppointmentPhone(value: string) {
  const digits = normalizeAppointmentPhoneInput(value);
  if (!digits) return null;
  if (digits.length === APPOINTMENT_PHONE_INPUT_LENGTH) return `7${digits}`;
  return null;
}

function formatAppointmentPhoneDisplay(value: string | null | undefined) {
  const inputValue = toAppointmentPhoneInputValue(value);
  return inputValue ? `+7 ${inputValue}` : null;
}

function buildDurationPresets(stepMin: number, _currentDurationMin: number) {
  const safeStep = normalizeDurationStepMin(stepMin, BOOKING_STEP_MIN);
  const set = new Set<number>();
  for (const baseMin of APPOINTMENT_DURATION_PRESET_BASE_MIN) {
    const value = alignDurationToStep(baseMin, safeStep, safeStep);
    if (value >= safeStep && value <= 12 * 60) set.add(value);
  }
  return Array.from(set).sort((a, b) => a - b);
}

function getDurationMinBetween(startsAtIso: string, endsAtIso: string) {
  const start = new Date(startsAtIso);
  const end = new Date(endsAtIso);
  const diff = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
  return diff > 0 ? diff : TIMELINE_STEP_MIN;
}

function getTimelineBucketMinutes(minuteOfDay: number, durationMin: number, stepMin = TIMELINE_STEP_MIN) {
  const minutes: number[] = [];
  const endMinute = Math.min(24 * 60, minuteOfDay + durationMin);
  for (let bucketMinute = minuteOfDay; bucketMinute < endMinute; bucketMinute += stepMin) {
    minutes.push(bucketMinute);
  }
  return minutes;
}

function getMinuteOfDayFromIso(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function pickAvailableSlotCandidate(
  candidates: AvailableSlotCandidate[],
  rowDurationMin = TIMELINE_STEP_MIN,
  clientY?: number,
  containerEl?: HTMLElement | null,
) {
  if (!candidates.length) return null;
  if (clientY === undefined || !containerEl) return candidates[0]!;

  const rect = containerEl.getBoundingClientRect();
  if (rect.height <= 0) return candidates[0]!;

  const relativeY = Math.max(0, Math.min(rect.height, clientY - rect.top));
  const targetOffsetMin = Math.max(
    0,
    Math.min(
      rowDurationMin - BOOKING_STEP_MIN,
      Math.round(((relativeY / rect.height) * rowDurationMin) / BOOKING_STEP_MIN) * BOOKING_STEP_MIN,
    ),
  );

  let bestCandidate = candidates[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestMinute = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const startMinute = getMinuteOfDayFromIso(candidate.startsAt);
    if (startMinute === null) continue;
    const offsetMin = ((startMinute % rowDurationMin) + rowDurationMin) % rowDurationMin;
    const distance = Math.abs(offsetMin - targetOffsetMin);
    if (distance < bestDistance || (distance === bestDistance && startMinute < bestMinute)) {
      bestCandidate = candidate;
      bestDistance = distance;
      bestMinute = startMinute;
    }
  }

  return bestCandidate;
}

function getDaySubSlotOffsetMin(daySubSlotCount: number, clientY?: number, containerEl?: HTMLElement | null) {
  const subSlotIndex = getDaySubSlotIndex(daySubSlotCount, clientY, containerEl);
  return subSlotIndex * BOOKING_STEP_MIN;
}

function getDaySubSlotIndex(daySubSlotCount: number, clientY?: number, containerEl?: HTMLElement | null) {
  if (clientY === undefined || !containerEl) return 0;

  const rect = containerEl.getBoundingClientRect();
  if (rect.height <= 0) return 0;

  const relativeY = Math.max(0, Math.min(rect.height, clientY - rect.top));
  const normalizedPosition = Math.min(0.999999, relativeY / rect.height);
  return Math.max(0, Math.min(daySubSlotCount - 1, Math.floor(normalizedPosition * daySubSlotCount)));
}

function intervalsOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

function slotCandidatesMatch(
  current: SlotDraft["candidateSlots"] | undefined,
  next: AvailableSlotCandidate[],
) {
  if ((current?.length || 0) !== next.length) return false;

  return next.every((candidate, index) => {
    const currentCandidate = current?.[index];
    return (
      currentCandidate?.employeeId === candidate.employeeId &&
      currentCandidate?.startsAt === candidate.startsAt &&
      currentCandidate?.endsAt === candidate.endsAt
    );
  });
}

function buildCreateAppointmentCandidatesAtStart({
  startsAtIso,
  durationMin,
  employees,
  candidateEmployeeIds,
  ignoreAppointmentId,
  workRulesByEmployee,
  breakRulesByEmployee,
  workdayOverrideByEmployeeDateKey,
  blockingHolidayByDateKey,
  holidayWorkOverrideDateKeys,
  timeOff,
  activeAppointments,
}: BuildCreateAppointmentCandidatesAtStartParams): AvailableSlotCandidate[] {
  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) return [];

  const normalizedDurationMin = clampAppointmentDurationMin(durationMin, BOOKING_STEP_MIN);
  const startMinute = startsAt.getHours() * 60 + startsAt.getMinutes();
  const endMinute = startMinute + normalizedDurationMin;
  if (endMinute > 24 * 60) return [];

  const dayKey = toDateKeyLocal(startsAt);
  const holiday = blockingHolidayByDateKey.get(dayKey);
  const holidayWorkOverride = holidayWorkOverrideDateKeys.has(dayKey);

  const endsAt = new Date(startsAt);
  endsAt.setMinutes(endsAt.getMinutes() + normalizedDurationMin);
  const weekday = startsAt.getDay();
  const allowedEmployeeIds = candidateEmployeeIds?.length ? new Set(candidateEmployeeIds) : null;

  const candidates: AvailableSlotCandidate[] = [];

  for (const employee of employees) {
    if (allowedEmployeeIds && !allowedEmployeeIds.has(employee.id)) continue;

    const employeeWorkdayOverride = workdayOverrideByEmployeeDateKey.get(workdayOverrideKeyLocal(employee.id, dayKey));
    if (holiday && !holidayWorkOverride && !employeeWorkdayOverride) continue;

    const employeeWorkRules = workRulesByEmployee[employee.id] || [];
    const employeeBreakRules = getEffectiveBreakRulesForDay({
      employeeId: employee.id,
      weekday,
      dayKey,
      breakRulesByEmployee,
      workdayOverrideByEmployeeDateKey,
    });
    const fitsWorkRule = employeeWorkdayOverride
      ? startMinute >= employeeWorkdayOverride.startMinute && endMinute <= employeeWorkdayOverride.endMinute
      : employeeWorkRules.some(
        (rule) =>
          rule.isActive &&
          rule.weekday === weekday &&
          startMinute >= rule.startMinute &&
          endMinute <= rule.endMinute,
      );
    if (!fitsWorkRule) continue;

    const overlapsBreak = employeeBreakRules.some(
      (rule) => startMinute < rule.endMinute && endMinute > rule.startMinute,
    );
    if (overlapsBreak) continue;

    const overlapsTimeOff = timeOff.some((item) => {
      if (item.employeeId && item.employeeId !== employee.id) return false;
      const itemStartsAt = new Date(item.startsAt);
      const itemEndsAt = new Date(item.endsAt);
      if (Number.isNaN(itemStartsAt.getTime()) || Number.isNaN(itemEndsAt.getTime())) return false;
      return intervalsOverlap(startsAt, endsAt, itemStartsAt, itemEndsAt);
    });
    if (overlapsTimeOff) continue;

    const overlapsAppointment = activeAppointments.some((appointment) => {
      if (ignoreAppointmentId && appointment.id === ignoreAppointmentId) return false;
      if (appointment.employeeId !== employee.id) return false;
      const appointmentStartsAt = new Date(appointment.startsAt);
      const appointmentEndsAt = new Date(appointment.endsAt);
      if (Number.isNaN(appointmentStartsAt.getTime()) || Number.isNaN(appointmentEndsAt.getTime())) return false;
      return intervalsOverlap(startsAt, endsAt, appointmentStartsAt, appointmentEndsAt);
    });
    if (overlapsAppointment) continue;

    candidates.push({
      employeeId: employee.id,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
  }

  return candidates;
}

function addMinutesToIso(iso: string, minutes: number) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  date.setMinutes(date.getMinutes() + clampAppointmentDurationMin(minutes));
  return date.toISOString();
}

function formatDurationRu(durationMin: number) {
  const safe = Math.max(1, Math.round(durationMin));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

function formatDateTimeRangeRu(startsAtIso: string, endsAtIso: string) {
  const startsAt = new Date(startsAtIso);
  const endsAt = new Date(endsAtIso);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return `${startsAtIso} - ${endsAtIso}`;
  }

  return `${startsAt.toLocaleString("ru-RU")} - ${endsAt.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function appointmentIsActive(status: string) {
  return status !== "cancelled";
}

function getErrorMessage(error: unknown) {
  const err = error as BookingApiError;
  if (err?.code && BOOKING_ERROR_LABEL_RU[err.code]) return BOOKING_ERROR_LABEL_RU[err.code];
  if (err?.message) return err.message;
  return "Не удалось выполнить запрос";
}

function getBookingErrorTitleRu(code?: string | null) {
  if (!code) return null;
  return BOOKING_ERROR_LABEL_RU[code] || code;
}

function getStatusLabelRu(status?: string | null) {
  if (!status) return "Неизвестно";
  return STATUS_LABEL_RU[status] || status;
}

function getPaymentStatusLabelRu(status?: string | null) {
  if (!status) return PAYMENT_STATUS_LABEL_RU.awaiting_payment;
  return PAYMENT_STATUS_LABEL_RU[status] || status;
}

function deriveDialogPaymentStatus(
  serviceAmountRaw: number,
  prepaidAmountRaw: number,
  settlementAmountRaw: number,
  currentStatus?: string | null,
): BookingPaymentStatus {
  if (currentStatus === "cancelled") return "cancelled";

  const serviceAmount = Math.max(0, Math.round(Number(serviceAmountRaw) || 0));
  const prepaidAmount = Math.max(0, Math.round(Number(prepaidAmountRaw) || 0));
  const settlementAmount = Math.max(0, Math.round(Number(settlementAmountRaw) || 0));
  const totalReceived = prepaidAmount + settlementAmount;

  if (totalReceived <= 0) return "awaiting_payment";
  if (serviceAmount <= 0 || totalReceived >= serviceAmount) return "paid";
  return "prepaid";
}

function getNextAppointmentStatus(status?: string | null) {
  if (status === "scheduled") return "confirmed";
  if (status === "confirmed") return "completed";
  return null;
}

function getAdvanceStatusActionLabelRu(status?: string | null) {
  const nextStatus = getNextAppointmentStatus(status);
  if (nextStatus === "confirmed") return "Подтвердить";
  if (nextStatus === "completed") return "Завершить";
  return null;
}

function getEmployeeCountLabelRu(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const suffix =
    mod10 === 1 && mod100 !== 11
      ? "сотрудник"
      : mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)
        ? "сотрудника"
        : "сотрудников";
  return `${count} ${suffix}`;
}

function getWeekOfMonth(date: Date) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const monthGridStart = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const diffWeeks = Math.round((weekStart.getTime() - monthGridStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diffWeeks + 1);
}

function getAppointmentSurfaceClassName(status?: string | null) {
  if (status === "completed" || status === "no_show") {
    return "border-border bg-muted text-foreground hover:bg-muted/90 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";
  }
  return null;
}

function getAppointmentMutedTextClassName(status?: string | null) {
  if (status === "completed") return "text-muted-foreground dark:text-zinc-300";
  if (status === "no_show") return "text-rose-700 dark:text-rose-200";
  return "text-white/90";
}

function getAppointmentHandleClassName(status?: string | null) {
  if (status === "completed" || status === "no_show") return "bg-foreground/70";
  return "bg-white/65";
}

function AppointmentStatusInline({
  status,
  showLabel = true,
  className,
  iconClassName,
}: {
  status?: string | null;
  showLabel?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  const iconClass = cn("size-3 shrink-0", iconClassName);
  const icon =
    status === "confirmed" ? (
      <Check className={iconClass} />
    ) : status === "completed" ? (
      <CheckCheck className={iconClass} />
    ) : status === "cancelled" || status === "no_show" ? (
      <X className={iconClass} />
    ) : (
      <Clock3 className={iconClass} />
    );

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)} title={getStatusLabelRu(status)}>
      {icon}
      {showLabel ? <span className="truncate">{getStatusLabelRu(status)}</span> : null}
    </span>
  );
}

function getTimeOffTypeLabelRu(type?: string | null) {
  if (!type) return "Блок";
  return TIME_OFF_TYPE_RU[type] || type;
}

function isDateOnlyTimeOffType(type?: string | null) {
  return type === "vacation" || type === "sick_leave";
}

function formatTimeOffRangeRu(item: Pick<ScheduleTimeOffPreviewItem, "type" | "startsAt" | "endsAt">) {
  const startsAt = new Date(item.startsAt);
  const endsAt = new Date(item.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return `${item.startsAt} - ${item.endsAt}`;
  }

  if (isDateOnlyTimeOffType(item.type)) {
    const startLabel = startsAt.toLocaleDateString("ru-RU");
    const endLabel = endsAt.toLocaleDateString("ru-RU");
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  }

  return `${startsAt.toLocaleString("ru-RU")} - ${endsAt.toLocaleString("ru-RU")}`;
}

function getGenderLabelRu(value?: string | null) {
  if (!value) return "Неизвестно";
  return GENDER_LABEL_RU[value] || value;
}

function normalizeIin(value: string) {
  return value.replace(/\D/g, "");
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getEmployeeColorFallback(seed: string) {
  return EMPLOYEE_COLOR_POOL[hashString(seed) % EMPLOYEE_COLOR_POOL.length] || EMPLOYEE_COLOR_POOL[0]!;
}

function getNextEmployeeColor(employees: BookingEmployee[]) {
  const used = new Set(
    employees
      .map((employee) => (employee.color || "").trim().toUpperCase())
      .filter(Boolean),
  );
  const next = EMPLOYEE_COLOR_POOL.find((color) => !used.has(color.toUpperCase()));
  return next || EMPLOYEE_COLOR_POOL[employees.length % EMPLOYEE_COLOR_POOL.length] || EMPLOYEE_COLOR_POOL[0]!;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

function deriveIdentityFromIinClient(iinRaw: string) {
  const iin = normalizeIin(iinRaw);
  if (!iin) return null;
  if (!/^\d{12}$/.test(iin)) return { error: "ИИН должен содержать 12 цифр" } as const;

  const yy = Number(iin.slice(0, 2));
  const mm = Number(iin.slice(2, 4));
  const dd = Number(iin.slice(4, 6));
  const code = Number(iin[6]);
  const centuryBase = code <= 2 ? 1800 : code <= 4 ? 1900 : code <= 6 ? 2000 : null;
  if (!centuryBase) return { error: "Некорректный ИИН (7-я цифра)" } as const;
  const year = centuryBase + yy;
  const date = new Date(Date.UTC(year, mm - 1, dd));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) {
    return { error: "Некорректная дата рождения в ИИН" } as const;
  }

  return {
    iin,
    birthDate: `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
    gender: code % 2 === 1 ? "male" : "female",
  } as const;
}

function buildScheduleEditorRows(
  employeeId: string | null,
  workRules: BookingCalendarViewResponse["workRules"],
  breakRules: BookingCalendarViewResponse["breakRules"],
): ScheduleDayRow[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const work = workRules
      .filter((rule) => rule.employeeId === employeeId && rule.weekday === weekday && rule.isActive)
      .sort((a, b) => a.startMinute - b.startMinute)[0];
    const breakRule = breakRules
      .filter((rule) => rule.employeeId === employeeId && rule.weekday === weekday && rule.isActive)
      .sort((a, b) => a.startMinute - b.startMinute)[0];

    return {
      weekday,
      workEnabled: Boolean(work),
      workStart: minuteToInputTime(work?.startMinute ?? 9 * 60),
      workEnd: minuteToInputTime(work?.endMinute ?? 18 * 60),
      breakEnabled: Boolean(breakRule),
      breakStart: minuteToInputTime(breakRule?.startMinute ?? 13 * 60),
      breakEnd: minuteToInputTime(breakRule?.endMinute ?? 14 * 60),
      breakTitle: breakRule?.title || "Перерыв",
    };
  });
}

function buildDisabledScheduleRowPatch(): Partial<ScheduleDayRow> {
  return {
    workEnabled: false,
    breakEnabled: false,
    breakStart: minuteToInputTime(13 * 60),
    breakEnd: minuteToInputTime(14 * 60),
    breakTitle: "Перерыв",
  };
}

const SERVICE_APPOINTMENT_TYPE_OPTIONS: Array<{ value: BookingAppointmentType; label: string }> = [
  { value: "primary", label: "Первичная запись" },
  { value: "secondary", label: "Вторичная запись" },
  { value: "other", label: "Другое" },
];

function getServiceAppointmentTypeLabel(serviceType?: string | null) {
  return (
    SERVICE_APPOINTMENT_TYPE_OPTIONS.find((item) => item.value === inferAppointmentTypeFromServiceType(serviceType))
      ?.label || null
  );
}

function inferAppointmentTypeFromServiceType(serviceType?: string | null): BookingAppointmentType | null {
  const normalized = String(serviceType || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "primary" || normalized.includes("первич")) return "primary";
  if (normalized === "secondary" || normalized.includes("вторич") || normalized.includes("повтор")) return "secondary";
  if (normalized === "other" || normalized.includes("друг")) return "other";
  return null;
}

export default function AppointmentsPageClient({
  prefill,
  requestContext,
}: AppointmentsPageClientProps = {}) {
  const appointmentVisibilityHydratedRef = useRef(false);
  const { toast } = useToast();
  const [view, setView] = useState<BookingView>("week");
  const [directoryTab, setDirectoryTab] = useState<"employees" | "services">("employees");
  const [contentTab, setContentTab] = useState<"calendar" | "list">("calendar");
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [calendarData, setCalendarData] = useState<BookingCalendarViewResponse | null>(null);
  const [clientCatalog, setClientCatalog] = useState<BookingClient[]>([]);
  const [serviceCatalog, setServiceCatalog] = useState<BookingService[]>([]);
  const [holidayCatalog, setHolidayCatalog] = useState<BookingHoliday[]>([]);
  const [workdayOverrideCatalog, setWorkdayOverrideCatalog] = useState<BookingWorkdayOverride[]>([]);
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showCompletedAppointments, setShowCompletedAppointments] = useState(false);
  const [showNoShowAppointments, setShowNoShowAppointments] = useState(false);

  const [slotDraft, setSlotDraft] = useState<SlotDraft | null>(null);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [appointmentDialogMode, setAppointmentDialogMode] = useState<"create" | "view" | "edit">("create");
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  const [appointmentForm, setAppointmentForm] = useState({
    appointmentType: "primary" as BookingAppointmentType,
    clientId: null as string | null,
    serviceId: null as string | null,
    clientName: "",
    clientPhone: "",
    clientIin: "",
    clientComment: "",
    durationMin: FALLBACK_APPOINTMENT_DURATION_MIN,
    serviceAmount: 0,
    prepaidAmount: 0,
    prepaidPaymentMethod: "kaspi_transfer" as BookingPaymentMethod,
  });
  const [appointmentDurationInput, setAppointmentDurationInput] = useState(String(FALLBACK_APPOINTMENT_DURATION_MIN));
  const [appointmentServiceAmountInput, setAppointmentServiceAmountInput] = useState("");
  const [appointmentPrepaidAmountInput, setAppointmentPrepaidAmountInput] = useState("");
  const [appointmentStatusDraft, setAppointmentStatusDraft] = useState<string>("scheduled");
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [appointmentStatusSavingId, setAppointmentStatusSavingId] = useState<string | null>(null);
  const [slotAvailabilityDurationMin, setSlotAvailabilityDurationMin] = useState<number>(FALLBACK_APPOINTMENT_DURATION_MIN);
  const [appointmentClientDetailsOpen, setAppointmentClientDetailsOpen] = useState(false);

  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [employeeDialogMode, setEmployeeDialogMode] = useState<"create" | "edit">("create");
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    specialty: "",
    photoUrl: "",
    description: "",
    slotDurationMin: FALLBACK_APPOINTMENT_DURATION_MIN,
    color: EMPLOYEE_COLOR_POOL[0]!,
    compensationType: "percent" as BookingCompensationType,
    compensationValue: 0,
  });
  const [employeeSlotDurationInput, setEmployeeSlotDurationInput] = useState(String(FALLBACK_APPOINTMENT_DURATION_MIN));
  const [employeeCompensationValueInput, setEmployeeCompensationValueInput] = useState("");
  const [employeeSaving, setEmployeeSaving] = useState(false);

  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [serviceDialogMode, setServiceDialogMode] = useState<"create" | "edit">("create");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(() => buildDefaultServiceForm([]));
  const [serviceSaving, setServiceSaving] = useState(false);
  const [servicePriceDialogOpen, setServicePriceDialogOpen] = useState(false);

  const clampEmployeeCompensationValue = (
    value: number,
    compensationType: BookingCompensationType = employeeForm.compensationType,
  ) => clampCompensationValue(value, compensationType);

  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [holidayDialogMode, setHolidayDialogMode] = useState<"create" | "edit">("create");
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [holidayForm, setHolidayForm] = useState({
    date: toDateKeyLocal(new Date()),
    title: "Праздничный день",
    isRecurringYearly: false,
    isWorkingDayOverride: false,
  });
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [pendingHolidayDeletion, setPendingHolidayDeletion] = useState<ScheduleHolidayPreviewItem | null>(null);
  const [holidayDeleting, setHolidayDeleting] = useState(false);

  const [workdayOverrideDialogOpen, setWorkdayOverrideDialogOpen] = useState(false);
  const [workdayOverrideDialogMode, setWorkdayOverrideDialogMode] = useState<"create" | "edit">("create");
  const [editingWorkdayOverrideId, setEditingWorkdayOverrideId] = useState<string | null>(null);
  const [workdayOverrideForm, setWorkdayOverrideForm] = useState({
    employeeId: "",
    date: toDateKeyLocal(new Date()),
    startTime: minuteToInputTime(9 * 60),
    endTime: minuteToInputTime(18 * 60),
    breakEnabled: false,
    breakStartTime: minuteToInputTime(13 * 60),
    breakEndTime: minuteToInputTime(14 * 60),
    breakTitle: "Перерыв",
  });
  const [workdayOverrideSaving, setWorkdayOverrideSaving] = useState(false);
  const [pendingWorkdayOverrideDeletion, setPendingWorkdayOverrideDeletion] = useState<ScheduleWorkdayOverridePreviewItem | null>(null);
  const [workdayOverrideDeleting, setWorkdayOverrideDeleting] = useState(false);

  const [timeOffDialogOpen, setTimeOffDialogOpen] = useState(false);
  const [timeOffDialogMode, setTimeOffDialogMode] = useState<"create" | "edit">("create");
  const [editingTimeOffId, setEditingTimeOffId] = useState<string | null>(null);
  const [timeOffForm, setTimeOffForm] = useState({
    employeeId: "all",
    type: "vacation",
    startsAt: `${toDateKeyLocal(new Date())}T00:00`,
    endsAt: `${toDateKeyLocal(new Date())}T23:59`,
    title: "",
    notes: "",
  });
  const [timeOffEmployeeFilterId, setTimeOffEmployeeFilterId] = useState<string>("all");
  const [timeOffSaving, setTimeOffSaving] = useState(false);
  const [pendingTimeOffDeletion, setPendingTimeOffDeletion] = useState<ScheduleTimeOffPreviewItem | null>(null);
  const [timeOffDeleting, setTimeOffDeleting] = useState(false);

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleDialogTab, setScheduleDialogTab] = useState<"schedule" | "exceptions">("schedule");
  const [scheduleEmployeeId, setScheduleEmployeeId] = useState<string>("");
  const [scheduleRows, setScheduleRows] = useState<ScheduleDayRow[]>(() =>
    buildScheduleEditorRows(null, [], []),
  );
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const [draggingAppointment, setDraggingAppointment] = useState<DragAppointmentDraft | null>(null);
  const [dragHoverSlot, setDragHoverSlot] = useState<string | null>(null);
  const [dragPreviewSlot, setDragPreviewSlot] = useState<AvailableSlotCandidate | null>(null);
  const [hoveredDaySubSlotKey, setHoveredDaySubSlotKey] = useState<string | null>(null);
  const [movingAppointmentId, setMovingAppointmentId] = useState<string | null>(null);
  const [resizingAppointmentId, setResizingAppointmentId] = useState<string | null>(null);
  const [resizingAppointmentDraft, setResizingAppointmentDraft] = useState<ResizeAppointmentDraft | null>(null);
  const [pendingCalendarAdjustment, setPendingCalendarAdjustment] = useState<PendingCalendarAdjustment | null>(null);
  const [pendingCalendarAdjustmentSaving, setPendingCalendarAdjustmentSaving] = useState(false);
  const [pendingAppointmentCancellation, setPendingAppointmentCancellation] = useState<BookingAppointment | null>(null);
  const [pendingAppointmentCancellationSaving, setPendingAppointmentCancellationSaving] = useState(false);
  const suppressDayCellClickUntilRef = useRef(0);
  const suppressAppointmentOpenUntilRef = useRef(0);

  const appointmentIinPreview = deriveIdentityFromIinClient(appointmentForm.clientIin);
  const selectedAppointmentSlot =
    slotDraft
      ? slotDraft.candidateSlots?.find((item) => item.employeeId === slotDraft.employeeId) ||
      (slotDraft.employeeId
        ? { employeeId: slotDraft.employeeId, startsAt: slotDraft.startsAt, endsAt: slotDraft.endsAt }
        : null)
      : null;
  const appointmentPreviewStartIso = selectedAppointmentSlot?.startsAt || slotDraft?.startsAt || null;
  const normalizedPrefill = useMemo(
    () => {
      const rawPrefillComment = (prefill?.clientComment || "").trim();
      const clientComment =
        /^Chatwoot conversation #\d+$/i.test(rawPrefillComment) ? "" : rawPrefillComment;

      return {
        clientName: (prefill?.clientName || "").trim(),
        clientPhone: toAppointmentPhoneInputValue(prefill?.clientPhone),
        clientIin: normalizeIin(prefill?.clientIin || "").slice(0, 12),
        clientComment,
        source: (prefill?.source || "dashboard").trim() || "dashboard",
        externalRef: (prefill?.externalRef || "").trim() || undefined,
      };
    },
    [
      prefill?.clientComment,
      prefill?.clientIin,
      prefill?.clientName,
      prefill?.clientPhone,
      prefill?.externalRef,
      prefill?.source,
    ],
  );

  useEffect(() => {
    let active = true;
    const range = getViewRange(anchorDate, view);

    const load = async () => {
      try {
        const response = await fetchBookingCalendarView({
          view,
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          employeeIds: undefined,
          includeSlots: true,
          durationMin: CALENDAR_AVAILABILITY_DURATION_MIN,
        }, requestContext);
        if (!active) return;
        setCalendarData(response);
      } catch (error) {
        if (!active) return;
        toast({
          title: "Не удалось загрузить календарь",
          description: getErrorMessage(error),
        });
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [anchorDate.getTime(), view, refreshTick, requestContext?.companyId, requestContext?.agentId]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await listBookingServices(true, requestContext);
        if (!active) return;
        setServiceCatalog(response.services);
      } catch (error) {
        if (!active) return;
        toast({
          title: "Не удалось загрузить услуги",
          description: getErrorMessage(error),
        });
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [refreshTick, requestContext?.companyId, requestContext?.agentId, toast]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await listBookingClients(requestContext);
        if (!active) return;
        setClientCatalog(response.clients);
      } catch (error) {
        if (!active) return;
        toast({
          title: "Не удалось загрузить клиентов",
          description: getErrorMessage(error),
        });
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [refreshTick, requestContext?.companyId, requestContext?.agentId, toast]);

  useEffect(() => {
    if (!scheduleDialogOpen || scheduleDialogTab !== "exceptions") return;

    let active = true;

    const load = async () => {
      try {
        const response = await listBookingHolidays({}, requestContext);
        if (!active) return;
        setHolidayCatalog(response.holidays);
      } catch (error) {
        if (!active) return;
        toast({
          title: "Не удалось загрузить праздники",
          description: getErrorMessage(error),
        });
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [
    scheduleDialogOpen,
    scheduleDialogTab,
    refreshTick,
    requestContext?.companyId,
    requestContext?.agentId,
    toast,
  ]);

  useEffect(() => {
    if (!scheduleDialogOpen || !scheduleEmployeeId) return;

    let active = true;
    const from = toDateKeyLocal(startOfDay(anchorDate));

    const load = async () => {
      try {
        const response = await listBookingWorkdayOverrides({
          employeeId: scheduleEmployeeId,
          from,
          limit: 120,
        }, requestContext);
        if (!active) return;
        setWorkdayOverrideCatalog(response.workdayOverrides);
      } catch (error) {
        if (!active) return;
        toast({
          title: "Не удалось загрузить конкретные рабочие дни",
          description: getErrorMessage(error),
        });
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [
    scheduleDialogOpen,
    scheduleEmployeeId,
    anchorDate,
    refreshTick,
    requestContext?.companyId,
    requestContext?.agentId,
    toast,
  ]);

  const rawEmployees = calendarData?.employees || [];
  const selectedAppointmentEmployeeId = slotDraft?.employeeId || null;
  const {
    employees,
    employeesById,
    clients,
    clientsById,
    appointmentClientOptions,
    services,
    servicesById,
    appointmentServiceOptions,
  } = useAppointmentsDirectoryData({
    rawEmployees,
    clientCatalog,
    serviceCatalog,
    selectedServiceId: appointmentForm.serviceId,
    selectedEmployeeId: selectedAppointmentEmployeeId,
    getEmployeeColorFallback,
    formatAppointmentPhoneDisplay,
    getServiceAppointmentTypeLabel,
  });
  const getEmployeeDefaultDurationMin = (employeeId?: string | null) =>
    normalizeDurationStepMin(
      employeeId ? employeesById.get(employeeId)?.slotDurationMin : null,
      FALLBACK_APPOINTMENT_DURATION_MIN,
    );
  const appointmentDurationStepMin = BOOKING_STEP_MIN;
  const rawAppointmentDurationMin = clampAppointmentDurationMin(appointmentForm.durationMin, BOOKING_STEP_MIN);
  const appointmentDurationMin =
    appointmentDialogMode === "create"
      ? alignDurationToStep(rawAppointmentDurationMin, appointmentDurationStepMin, appointmentDurationStepMin)
      : rawAppointmentDurationMin;
  const appointmentDurationPresets = useMemo(
    () =>
      buildDurationPresets(appointmentDurationStepMin, appointmentDurationMin),
    [appointmentDurationStepMin, appointmentDurationMin],
  );
  const appointmentPreviewEndIso = appointmentPreviewStartIso
    ? addMinutesToIso(appointmentPreviewStartIso, appointmentDurationMin)
    : null;
  const selectedAppointmentClient = appointmentForm.clientId ? clientsById.get(appointmentForm.clientId) || null : null;
  const selectedAppointmentService = appointmentForm.serviceId ? servicesById.get(appointmentForm.serviceId) || null : null;
  const serviceHasCustomPrices = useMemo(
    () => serviceForm.employeePrices.some((row) => row.enabled),
    [serviceForm.employeePrices],
  );

  useEffect(() => {
    if (!calendarData || selectionInitialized) return;

    const availableIds = new Set(rawEmployees.map((employee) => employee.id));
    let nextSelectedEmployeeIds: string[] = [];

    try {
      const rawSavedValue = window.localStorage.getItem(EMPLOYEE_SELECTION_STORAGE_KEY);
      if (rawSavedValue) {
        const parsed = JSON.parse(rawSavedValue);
        if (Array.isArray(parsed)) {
          nextSelectedEmployeeIds = parsed.filter(
            (value): value is string => typeof value === "string" && availableIds.has(value),
          );
        }
      }
    } catch {
      nextSelectedEmployeeIds = [];
    }

    setSelectedEmployeeIds(nextSelectedEmployeeIds);
    setSelectionInitialized(true);
  }, [calendarData, rawEmployees, selectionInitialized]);

  useEffect(() => {
    if (!selectionInitialized) return;

    setSelectedEmployeeIds((prev) => {
      const next = prev.filter((employeeId) => employeesById.has(employeeId));
      return next.length === prev.length ? prev : next;
    });
  }, [employeesById, selectionInitialized]);

  useEffect(() => {
    if (!selectionInitialized) return;

    try {
      window.localStorage.setItem(EMPLOYEE_SELECTION_STORAGE_KEY, JSON.stringify(selectedEmployeeIds));
    } catch { }
  }, [selectedEmployeeIds, selectionInitialized]);

  useEffect(() => {
    try {
      const rawSavedValue = window.localStorage.getItem(APPOINTMENT_VISIBILITY_STORAGE_KEY);
      if (!rawSavedValue) {
        appointmentVisibilityHydratedRef.current = true;
        return;
      }

      const parsed = JSON.parse(rawSavedValue) as {
        showCompletedAppointments?: unknown;
        showNoShowAppointments?: unknown;
      };

      if (typeof parsed.showCompletedAppointments === "boolean") {
        setShowCompletedAppointments(parsed.showCompletedAppointments);
      }
      if (typeof parsed.showNoShowAppointments === "boolean") {
        setShowNoShowAppointments(parsed.showNoShowAppointments);
      }
    } catch {
      // Ignore malformed local storage.
    } finally {
      appointmentVisibilityHydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!appointmentVisibilityHydratedRef.current) return;

    try {
      window.localStorage.setItem(
        APPOINTMENT_VISIBILITY_STORAGE_KEY,
        JSON.stringify({
          showCompletedAppointments,
          showNoShowAppointments,
        }),
      );
    } catch {
      // Ignore storage write failures.
    }
  }, [showCompletedAppointments, showNoShowAppointments]);

  useEffect(() => {
    if (appointmentDialogMode !== "create" || !appointmentDialogOpen || !slotDraft?.employeeId) return;
    const alignedDuration = alignDurationToStep(
      appointmentForm.durationMin,
      appointmentDurationStepMin,
      appointmentDurationStepMin,
    );
    if (alignedDuration !== appointmentForm.durationMin) {
      setAppointmentForm((prev) => ({ ...prev, durationMin: alignedDuration }));
      setAppointmentDurationInput(String(alignedDuration));
    }
    if (slotAvailabilityDurationMin !== alignedDuration) {
      setSlotAvailabilityDurationMin(alignedDuration);
    }
  }, [
    appointmentDialogMode,
    appointmentDialogOpen,
    slotDraft?.employeeId,
    appointmentForm.durationMin,
    appointmentDurationStepMin,
    slotAvailabilityDurationMin,
  ]);

  const dayListForTimeline = useMemo(
    () =>
      view === "day"
        ? [startOfDay(anchorDate)]
        : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchorDate, { weekStartsOn: 1 }), index)),
    [view, anchorDate],
  );

  const monthDays = useMemo(() => {
    const monthGridStart = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index));
  }, [anchorDate]);

  const weekCascadeVisibleEmployees = useMemo(() => {
    const weekDaysCount = Math.max(dayListForTimeline.length, 1);
    const weekDayMinColumnWidth = Math.max(
      WEEK_DAY_MIN_COLUMN_WIDTH_PX,
      Math.floor((WEEK_GRID_TARGET_WIDTH_PX - WEEK_TIME_COLUMN_WIDTH_PX) / weekDaysCount),
    );
    const maxCascadeIndexByColumn = Math.floor(
      Math.max(0, weekDayMinColumnWidth - WEEK_OVERLAY_LEFT_GUTTER_PX - 1) / WEEK_OVERLAY_CASCADE_OFFSET_PX,
    );

    return Math.max(1, maxCascadeIndexByColumn + 1);
  }, [dayListForTimeline.length]);

  const activeAppointments = useMemo(
    () => (calendarData?.appointments || []).filter((appointment) => appointmentIsActive(appointment.status)),
    [calendarData?.appointments],
  );
  const {
    selectedSet,
    visibleEmployees,
    timelineStepMin,
    weekTimelineStepMin,
    daySubSlotCount,
    visibleEmployeeIdSet,
    visibleEmployeeIndexById,
    weekVisibleEmployeeCascadeCount,
    timelineRange,
    dayTimeRows,
    weekTimeRows,
    timeRowIndexByMinute,
    weekTimeRowIndexByMinute,
  } = useAppointmentsTimelineGrid({
    employees,
    selectionInitialized,
    selectedEmployeeIds,
    workRules: calendarData?.workRules || [],
    workdayOverrides: calendarData?.workdayOverrides || [],
    activeAppointments,
    baseTimelineStepMin: TIMELINE_STEP_MIN,
    bookingStepMin: BOOKING_STEP_MIN,
    weekCascadeVisibleEmployees,
  });
  const activeDialogAppointment = useMemo(
    () =>
      activeAppointmentId
        ? (calendarData?.appointments || []).find((appointment) => appointment.id === activeAppointmentId) || null
        : null,
    [activeAppointmentId, calendarData?.appointments],
  );
  const dialogPaymentStatus = useMemo(
    () =>
      deriveDialogPaymentStatus(
        appointmentForm.serviceAmount,
        appointmentForm.prepaidAmount,
        activeDialogAppointment?.settlementAmount || 0,
        activeDialogAppointment?.paymentStatus || null,
      ),
    [
      activeDialogAppointment?.paymentStatus,
      activeDialogAppointment?.settlementAmount,
      appointmentForm.prepaidAmount,
      appointmentForm.serviceAmount,
    ],
  );
  const isAppointmentVisible = (appointment?: BookingAppointment | null) => {
    if (!appointment) return false;
    if (appointment.status === "completed" && !showCompletedAppointments) return false;
    if (appointment.status === "no_show" && !showNoShowAppointments) return false;
    return true;
  };

  const {
    slotMap,
    workRulesByEmployee,
    breakRulesByEmployee,
    workdayOverrideByEmployeeDateKey,
    monthStats,
    holidaysByDateKey,
    blockedHolidaysByDateKey,
    blockingHolidayByDateKey,
    holidayWorkOverrideDateKeys,
    appointmentByEmployeeCellKey,
    appointmentStartByEmployeeCellKey,
    timeOffByEmployeeCellKey,
    globalTimeOffByCellKey,
    appointmentsOverlappingByDayMinuteKey,
    timeOffOverlappingByDayMinuteKey,
    availableCandidatesByDayMinuteKey,
  } = useAppointmentsCalendarIndexes({
    calendarData,
    activeAppointments,
    visibleEmployees,
    monthDays,
    timelineDays: dayListForTimeline,
    slotStepMin: BOOKING_STEP_MIN,
  });

  const createCandidateEmployeeIds = selectionInitialized ? selectedEmployeeIds : undefined;

  const appointmentStartTimeOptions = useMemo(() => {
    if (
      (appointmentDialogMode !== "create" && appointmentDialogMode !== "edit") ||
      !slotDraft?.employeeId
    ) {
      return [];
    }

    const selectedStartsAt = new Date(slotDraft.startsAt);
    if (Number.isNaN(selectedStartsAt.getTime())) return [];

    const targetDay = startOfDay(selectedStartsAt);
    const targetDayKey = toDateKeyLocal(targetDay);
    const weekday = targetDay.getDay();
    const employeeWorkRules = (workRulesByEmployee[slotDraft.employeeId] || []) as BookingWorkRule[];
    const employeeWorkdayOverride = workdayOverrideByEmployeeDateKey.get(
      workdayOverrideKeyLocal(slotDraft.employeeId, targetDayKey),
    );
    const optionMinutes = new Set<number>();

    if (employeeWorkdayOverride) {
      const latestStartMinute = employeeWorkdayOverride.endMinute - appointmentDurationMin;
      if (latestStartMinute >= employeeWorkdayOverride.startMinute) {
        for (
          let minute = employeeWorkdayOverride.startMinute;
          minute <= latestStartMinute;
          minute += BOOKING_STEP_MIN
        ) {
          optionMinutes.add(minute);
        }
      }
    } else {
      for (const rule of employeeWorkRules) {
        if (!rule.isActive || rule.weekday !== weekday) continue;
        const latestStartMinute = rule.endMinute - appointmentDurationMin;
        if (latestStartMinute < rule.startMinute) continue;
        for (let minute = rule.startMinute; minute <= latestStartMinute; minute += BOOKING_STEP_MIN) {
          optionMinutes.add(minute);
        }
      }
    }

    const rawOptions: Array<{
      value: string;
      label: string;
      disabled?: boolean;
      minuteOfDay: number;
    }> = [];
    const sortedOptionMinutes = Array.from(optionMinutes).sort((a, b) => a - b);

    for (const minute of sortedOptionMinutes) {
      const optionStartsAt = createCellDate(targetDay, minute).toISOString();
      const hasCandidate = buildCreateAppointmentCandidatesAtStart({
        startsAtIso: optionStartsAt,
        durationMin: appointmentDurationMin,
        employees,
        candidateEmployeeIds: [slotDraft.employeeId],
        ignoreAppointmentId: appointmentDialogMode === "edit" ? activeAppointmentId || undefined : undefined,
        workRulesByEmployee,
        breakRulesByEmployee,
        workdayOverrideByEmployeeDateKey,
        blockingHolidayByDateKey,
        holidayWorkOverrideDateKeys,
        timeOff: calendarData?.timeOff || [],
        activeAppointments,
      }).some((candidate) => candidate.employeeId === slotDraft.employeeId);

      rawOptions.push({
        value: optionStartsAt,
        label: formatMinuteLabel(minute),
        disabled: !hasCandidate && optionStartsAt !== slotDraft.startsAt,
        minuteOfDay: minute,
      });
    }

    const selectedMinuteOfDay = getMinuteOfDayFromIso(slotDraft.startsAt);
    if (selectedMinuteOfDay !== null && !rawOptions.some((option) => option.value === slotDraft.startsAt)) {
      rawOptions.push({
        value: slotDraft.startsAt,
        label: formatMinuteLabel(selectedMinuteOfDay),
        disabled: false,
        minuteOfDay: selectedMinuteOfDay,
      });
    }

    rawOptions.sort((a, b) => a.minuteOfDay - b.minuteOfDay);

    const collapsedOptions: Array<{ value: string; label: string; disabled?: boolean }> = [];

    for (let index = 0; index < rawOptions.length; index += 1) {
      const option = rawOptions[index];
      if (!option) continue;

      if (!option.disabled) {
        collapsedOptions.push({
          value: option.value,
          label: option.label,
          disabled: false,
        });
        continue;
      }

      let endIndex = index;
      while (endIndex + 1 < rawOptions.length) {
        const nextOption = rawOptions[endIndex + 1];
        const currentOption = rawOptions[endIndex];
        if (
          !nextOption ||
          !currentOption ||
          !nextOption.disabled ||
          nextOption.minuteOfDay !== currentOption.minuteOfDay + BOOKING_STEP_MIN
        ) {
          break;
        }
        endIndex += 1;
      }

      const rangeStart = option.minuteOfDay;
      const rangeEnd = Math.min(24 * 60, (rawOptions[endIndex]?.minuteOfDay ?? rangeStart) + BOOKING_STEP_MIN);
      collapsedOptions.push({
        value: `disabled:${option.value}:${rawOptions[endIndex]?.value || option.value}`,
        label: `Недоступно: ${formatMinuteLabel(rangeStart)} - ${formatMinuteLabel(rangeEnd)}`,
        disabled: true,
      });
      index = endIndex;
    }

    return collapsedOptions;
  }, [
    appointmentDialogMode,
    activeAppointmentId,
    slotDraft?.employeeId,
    slotDraft?.startsAt,
    appointmentDurationMin,
    employees,
    workRulesByEmployee,
    breakRulesByEmployee,
    workdayOverrideByEmployeeDateKey,
    blockingHolidayByDateKey,
    holidayWorkOverrideDateKeys,
    calendarData?.timeOff,
    activeAppointments,
  ]);

  const dragMoveCandidateBySlotKey = useMemo(() => {
    const candidatesByKey = new Map<string, AvailableSlotCandidate>();
    if (view !== "day" || !draggingAppointment) return candidatesByKey;

    const dragDurationMin = clampAppointmentDurationMin(
      getDurationMinBetween(draggingAppointment.startsAt, draggingAppointment.endsAt),
      BOOKING_STEP_MIN,
    );

    for (const day of dayListForTimeline) {
      const dayKey = toDateKeyLocal(day);
      const weekday = day.getDay();

      for (const employee of visibleEmployees) {
        const employeeWorkRules = (workRulesByEmployee[employee.id] || []) as BookingWorkRule[];
        const employeeWorkdayOverride = workdayOverrideByEmployeeDateKey.get(workdayOverrideKeyLocal(employee.id, dayKey));
        const sourceRanges = employeeWorkdayOverride
          ? [{ startMinute: employeeWorkdayOverride.startMinute, endMinute: employeeWorkdayOverride.endMinute }]
          : employeeWorkRules
              .filter((rule) => rule.isActive && rule.weekday === weekday)
              .map((rule) => ({ startMinute: rule.startMinute, endMinute: rule.endMinute }));

        for (const range of sourceRanges) {
          const latestStartMinute = range.endMinute - dragDurationMin;
          if (latestStartMinute < range.startMinute) continue;

          for (let minute = range.startMinute; minute <= latestStartMinute; minute += BOOKING_STEP_MIN) {
            const startsAtIso = createCellDate(day, minute).toISOString();
            const candidate = buildCreateAppointmentCandidatesAtStart({
              startsAtIso,
              durationMin: dragDurationMin,
              employees,
              candidateEmployeeIds: [employee.id],
              ignoreAppointmentId: draggingAppointment.id,
              workRulesByEmployee,
              breakRulesByEmployee,
              workdayOverrideByEmployeeDateKey,
              blockingHolidayByDateKey,
              holidayWorkOverrideDateKeys,
              timeOff: calendarData?.timeOff || [],
              activeAppointments,
            }).find((item) => item.employeeId === employee.id);

            if (candidate) {
              candidatesByKey.set(slotKey(employee.id, candidate.startsAt), candidate);
            }
          }
        }
      }
    }

    return candidatesByKey;
  }, [
    view,
    draggingAppointment,
    dayListForTimeline,
    visibleEmployees,
    employees,
    workRulesByEmployee,
    breakRulesByEmployee,
    workdayOverrideByEmployeeDateKey,
    blockingHolidayByDateKey,
    holidayWorkOverrideDateKeys,
    calendarData?.timeOff,
    activeAppointments,
  ]);

  useEffect(() => {
    if (appointmentDialogMode !== "create" || !appointmentDialogOpen || !slotDraft) return;

    const candidates = buildCreateAppointmentCandidatesAtStart({
      startsAtIso: slotDraft.startsAt,
      durationMin: appointmentDurationMin,
      employees,
      candidateEmployeeIds: createCandidateEmployeeIds,
      workRulesByEmployee,
      breakRulesByEmployee,
      workdayOverrideByEmployeeDateKey,
      blockingHolidayByDateKey,
      holidayWorkOverrideDateKeys,
      timeOff: calendarData?.timeOff || [],
      activeAppointments,
    });

    setSlotDraft((prev) => {
      if (!prev) return prev;

      const currentEmployeeId =
        prev.employeeId || candidates[0]?.employeeId || null;
      const currentCandidate =
        candidates.find((candidate) => candidate.employeeId === currentEmployeeId) || null;
      const nextEndsAt = currentCandidate?.endsAt || addMinutesToIso(prev.startsAt, appointmentDurationMin);
      const nextCandidateSlots = candidates.length ? candidates : [];

      if (
        prev.employeeId === currentEmployeeId &&
        prev.endsAt === nextEndsAt &&
        slotCandidatesMatch(prev.candidateSlots, nextCandidateSlots)
      ) {
        return prev;
      }

      return {
        ...prev,
        employeeId: currentEmployeeId,
        endsAt: nextEndsAt,
        candidateSlots: nextCandidateSlots,
      };
    });
  }, [
    appointmentDialogMode,
    appointmentDialogOpen,
    slotDraft?.startsAt,
    slotDraft?.employeeId,
    appointmentDurationMin,
    createCandidateEmployeeIds,
    employees,
    workRulesByEmployee,
    breakRulesByEmployee,
    workdayOverrideByEmployeeDateKey,
    blockingHolidayByDateKey,
    holidayWorkOverrideDateKeys,
    calendarData?.timeOff,
    activeAppointments,
  ]);

  const weekDaysCount = Math.max(dayListForTimeline.length, 1);
  const weekTimeColumnWidth = WEEK_TIME_COLUMN_WIDTH_PX;
  const weekDayMinColumnWidth = Math.max(
    WEEK_DAY_MIN_COLUMN_WIDTH_PX,
    Math.floor((WEEK_GRID_TARGET_WIDTH_PX - weekTimeColumnWidth) / weekDaysCount),
  );
  const weekGridMinWidth = weekTimeColumnWidth + weekDayMinColumnWidth * weekDaysCount;
  const weekHeaderTitle = `Неделя ${getWeekOfMonth(anchorDate)}`;
  const weekHeaderSubtitle = getEmployeeCountLabelRu(visibleEmployees.length);
  const dayCollapsedRangeByDayMinuteKey = useMemo(() => {
    const rangesByDayMinuteKey = new Map<string, TimelineCollapsedRange>();

    for (const day of dayListForTimeline) {
      const dayKey = toDateKeyLocal(day);
      let currentRangeKeys: string[] = [];

      const flushRange = () => {
        if (currentRangeKeys.length > 1) {
          const lastMinute = Number(currentRangeKeys[currentRangeKeys.length - 1]?.split("|").pop() || 0);
          const endMinute = lastMinute + timelineStepMin;
          currentRangeKeys.forEach((rowKey, index) => {
            rangesByDayMinuteKey.set(rowKey, {
              isStart: index === 0,
              endMinute,
            });
          });
        }
        currentRangeKeys = [];
      };

      for (const minuteOfDay of dayTimeRows) {
        const bucketMinutes = getTimelineBucketMinutes(minuteOfDay, timelineStepMin, BOOKING_STEP_MIN);
        let hasVisibleAppointment = false;
        let hasAvailableSlot = false;

        for (const bucketMinute of bucketMinutes) {
          const bucketDayMinuteKey = dayMinuteKeyLocal(dayKey, bucketMinute);
          const overlappingAppointments = appointmentsOverlappingByDayMinuteKey.get(bucketDayMinuteKey) || [];

          if (
            overlappingAppointments.some((appointment) => {
              if (appointment.status === "completed" && !showCompletedAppointments) return false;
              if (appointment.status === "no_show" && !showNoShowAppointments) return false;
              return true;
            })
          ) {
            hasVisibleAppointment = true;
            break;
          }

          if ((availableCandidatesByDayMinuteKey.get(bucketDayMinuteKey) || []).length > 0) {
            hasAvailableSlot = true;
          }
        }

        if (!hasVisibleAppointment && !hasAvailableSlot) {
          currentRangeKeys.push(dayMinuteKeyLocal(dayKey, minuteOfDay));
        } else {
          flushRange();
        }
      }

      flushRange();
    }

    return rangesByDayMinuteKey;
  }, [
    dayListForTimeline,
    dayTimeRows,
    timelineStepMin,
    appointmentsOverlappingByDayMinuteKey,
    availableCandidatesByDayMinuteKey,
    showCompletedAppointments,
    showNoShowAppointments,
  ]);
  const weekCollapsedRangeByMinute = useMemo(() => {
    const rangesByMinute = new Map<number, TimelineCollapsedRange>();
    let currentRangeMinutes: number[] = [];

    const flushRange = () => {
      if (currentRangeMinutes.length > 1) {
        const lastMinute = currentRangeMinutes[currentRangeMinutes.length - 1] ?? 0;
        const endMinute = lastMinute + weekTimelineStepMin;
        currentRangeMinutes.forEach((rowMinute, index) => {
          rangesByMinute.set(rowMinute, {
            isStart: index === 0,
            endMinute,
          });
        });
      }
      currentRangeMinutes = [];
    };

    for (const minuteOfDay of weekTimeRows) {
      let hasVisibleAppointment = false;
      let hasAvailableSlot = false;
      let hasInformationalState = false;

      for (const day of dayListForTimeline) {
        const dayKey = toDateKeyLocal(day);
        const bucketMinutes = getTimelineBucketMinutes(minuteOfDay, weekTimelineStepMin, BOOKING_STEP_MIN);

        if (blockingHolidayByDateKey.has(dayKey)) {
          hasInformationalState = true;
          break;
        }

        for (const bucketMinute of bucketMinutes) {
          const bucketDayMinuteKey = dayMinuteKeyLocal(dayKey, bucketMinute);
          const overlappingAppointments = appointmentsOverlappingByDayMinuteKey.get(bucketDayMinuteKey) || [];

          if (
            overlappingAppointments.some((appointment) => {
              if (appointment.status === "completed" && !showCompletedAppointments) return false;
              if (appointment.status === "no_show" && !showNoShowAppointments) return false;
              return true;
            })
          ) {
            hasVisibleAppointment = true;
            break;
          }

          if ((availableCandidatesByDayMinuteKey.get(bucketDayMinuteKey) || []).length > 0) {
            hasAvailableSlot = true;
          }

          if ((timeOffOverlappingByDayMinuteKey.get(bucketDayMinuteKey) || []).length > 0) {
            hasInformationalState = true;
            break;
          }
        }

        if (hasVisibleAppointment || hasAvailableSlot || hasInformationalState) break;
      }

      if (!hasVisibleAppointment && !hasAvailableSlot && !hasInformationalState) {
        currentRangeMinutes.push(minuteOfDay);
      } else {
        flushRange();
      }
    }

    flushRange();
    return rangesByMinute;
  }, [
    weekTimeRows,
    dayListForTimeline,
    weekTimelineStepMin,
    blockingHolidayByDateKey,
    appointmentsOverlappingByDayMinuteKey,
    availableCandidatesByDayMinuteKey,
    timeOffOverlappingByDayMinuteKey,
    showCompletedAppointments,
    showNoShowAppointments,
  ]);
  const weekDayEmployeeLabelByDateKey = useMemo(() => {
    const labelsByDateKey = new Map<string, string>();

    for (const day of dayListForTimeline) {
      const dayKey = toDateKeyLocal(day);
      const employeeIds = new Set<string>();

      for (const minuteOfDay of weekTimeRows) {
          const bucketMinutes = getTimelineBucketMinutes(minuteOfDay, weekTimelineStepMin, BOOKING_STEP_MIN);
        for (const bucketMinute of bucketMinutes) {
          const bucketDayMinuteKey = dayMinuteKeyLocal(dayKey, bucketMinute);

          for (const appointment of appointmentsOverlappingByDayMinuteKey.get(bucketDayMinuteKey) || []) {
            if (appointment.status === "completed" && !showCompletedAppointments) continue;
            if (appointment.status === "no_show" && !showNoShowAppointments) continue;
            employeeIds.add(appointment.employeeId);
          }

          for (const candidate of availableCandidatesByDayMinuteKey.get(bucketDayMinuteKey) || []) {
            employeeIds.add(candidate.employeeId);
          }
        }
      }

      labelsByDateKey.set(dayKey, getEmployeeCountLabelRu(employeeIds.size));
    }

    return labelsByDateKey;
  }, [
    dayListForTimeline,
    weekTimeRows,
    weekTimelineStepMin,
    appointmentsOverlappingByDayMinuteKey,
    availableCandidatesByDayMinuteKey,
    showCompletedAppointments,
    showNoShowAppointments,
  ]);
  const dayTimeColumnWidth = 60;
  const dayEmployeeMinColumnWidth = visibleEmployees.length >= 4 ? 132 : 148;

  const selectedDayAppointments = useMemo(
    () =>
      activeAppointments
        .filter((appointment) => {
          if (!visibleEmployeeIdSet.has(appointment.employeeId)) return false;
          const start = new Date(appointment.startsAt);
          return view === "day" ? toDateKeyLocal(start) === toDateKeyLocal(anchorDate) : true;
        })
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [activeAppointments, visibleEmployeeIdSet, view, anchorDate],
  );
  const visibleSelectedDayAppointments = useMemo(
    () =>
      selectedDayAppointments.filter((appointment) => {
        if (appointment.status === "completed" && !showCompletedAppointments) return false;
        if (appointment.status === "no_show" && !showNoShowAppointments) return false;
        return true;
      }),
    [selectedDayAppointments, showCompletedAppointments, showNoShowAppointments],
  );

  const renderAppointmentVisibilityToggles = (className?: string) => (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <span className="text-muted-foreground text-xs font-medium">Показать:</span>
      <label className="text-muted-foreground inline-flex cursor-pointer items-center gap-2 text-xs">
        <Checkbox
          checked={showCompletedAppointments}
          onCheckedChange={(checked) => setShowCompletedAppointments(checked === true)}
        />
        завершены
      </label>
      <label className="text-muted-foreground inline-flex cursor-pointer items-center gap-2 text-xs">
        <Checkbox
          checked={showNoShowAppointments}
          onCheckedChange={(checked) => setShowNoShowAppointments(checked === true)}
        />
        неявка
      </label>
    </div>
  );

  const scheduleHolidayPreview: ScheduleHolidayPreviewItem[] = useMemo(
    () =>
      holidayCatalog
        .map((holiday) => ({
          id: holiday.id,
          title: holiday.title,
          date: holiday.date,
          dateLabel: formatHolidayDateLabelRu(holiday.date, holiday.isRecurringYearly),
          isRecurringYearly: holiday.isRecurringYearly,
          isWorkingDayOverride: holiday.isWorkingDayOverride,
        }))
        .sort((a, b) => holidaySortKey(a.date, a.isRecurringYearly).localeCompare(holidaySortKey(b.date, b.isRecurringYearly)))
        .slice(0, 6),
    [holidayCatalog],
  );

  const scheduleTimeOffPreview: ScheduleTimeOffPreviewItem[] = useMemo(
    () =>
      (calendarData?.timeOff || [])
        .filter((item) =>
          timeOffEmployeeFilterId === "all"
            ? true
            : item.employeeId === null || item.employeeId === timeOffEmployeeFilterId,
        )
        .map((item) => {
          const employee = item.employeeId ? employeesById.get(item.employeeId) : null;
          return {
            id: item.id,
            employeeId: item.employeeId || null,
            employeeLabel: employee?.name || (item.employeeId ? "Сотрудник" : "Все сотрудники"),
            type: item.type,
            typeLabel: getTimeOffTypeLabelRu(item.type),
            title: item.title || null,
            startsAt: item.startsAt,
            endsAt: item.endsAt,
            notes: item.notes || null,
          };
        })
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
        .slice(0, 6),
    [calendarData?.timeOff, timeOffEmployeeFilterId, employeesById],
  );
  const scheduleWorkdayOverridePreview: ScheduleWorkdayOverridePreviewItem[] = useMemo(
    () =>
      workdayOverrideCatalog
        .filter((item) => (scheduleEmployeeId ? item.employeeId === scheduleEmployeeId : true))
        .map((item) => ({
          id: item.id,
          employeeId: item.employeeId,
          employeeLabel: employeesById.get(item.employeeId)?.name || "Сотрудник",
          date: item.date,
          dateLabel: formatHolidayDateLabelRu(item.date, false),
          startMinute: item.startMinute,
          endMinute: item.endMinute,
          breakStartMinute: item.breakStartMinute ?? null,
          breakEndMinute: item.breakEndMinute ?? null,
          breakTitle: item.breakTitle || null,
        }))
        .sort((a, b) => {
          const byDate = a.date.localeCompare(b.date);
          if (byDate !== 0) return byDate;
          return a.startMinute - b.startMinute;
        })
        .slice(0, 8),
    [workdayOverrideCatalog, scheduleEmployeeId, employeesById],
  );
  const orderedScheduleRows = useMemo(
    () =>
      [...scheduleRows].sort(
        (a, b) => WEEKDAY_EDITOR_ORDER.indexOf(a.weekday) - WEEKDAY_EDITOR_ORDER.indexOf(b.weekday),
      ),
    [scheduleRows],
  );
  const isDateOnlyTimeOff = isDateOnlyTimeOffType(timeOffForm.type);
  const timeOffStartDateValue = dateOnlyFromInputOrIso(timeOffForm.startsAt);
  const timeOffEndDateValue = dateOnlyFromInputOrIso(timeOffForm.endsAt);
  const buildDefaultHolidayForm = (date = toDateKeyLocal(anchorDate)) => ({
    date,
    title: "Праздничный день",
    isRecurringYearly: false,
    isWorkingDayOverride: false,
  });
  const buildDefaultWorkdayOverrideForm = (employeeId = scheduleEmployeeId || visibleEmployees[0]?.id || employees[0]?.id || "") => ({
    employeeId,
    date: toDateKeyLocal(anchorDate),
    startTime: minuteToInputTime(9 * 60),
    endTime: minuteToInputTime(18 * 60),
    breakEnabled: false,
    breakStartTime: minuteToInputTime(13 * 60),
    breakEndTime: minuteToInputTime(14 * 60),
    breakTitle: "Перерыв",
  });
  const buildDefaultTimeOffForm = (employeeId = "all") => {
    const defaultDate = toDateKeyLocal(new Date());
    return {
      employeeId,
      type: "vacation",
      startsAt: `${defaultDate}T00:00`,
      endsAt: `${defaultDate}T23:59`,
      title: "",
      notes: "",
    };
  };

  const toggleEmployee = (employeeId: string, nextChecked: boolean) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (nextChecked) next.add(employeeId);
      else next.delete(employeeId);
      if (next.size === 0) return prev;
      return Array.from(next);
    });
  };

  const handleHolidayDialogOpenChange = (open: boolean) => {
    setHolidayDialogOpen(open);
    if (!open) {
      setHolidayDialogMode("create");
      setEditingHolidayId(null);
      setHolidayForm(buildDefaultHolidayForm());
    }
  };

  const openCreateHolidayDialog = (date = toDateKeyLocal(anchorDate)) => {
    setHolidayDialogMode("create");
    setEditingHolidayId(null);
    setHolidayForm(buildDefaultHolidayForm(date));
    setHolidayDialogOpen(true);
  };

  const openEditHolidayDialog = (holiday: ScheduleHolidayPreviewItem) => {
    setHolidayDialogMode("edit");
    setEditingHolidayId(holiday.id);
    setHolidayForm({
      date: holiday.date,
      title: holiday.title,
      isRecurringYearly: holiday.isRecurringYearly,
      isWorkingDayOverride: holiday.isWorkingDayOverride,
    });
    setHolidayDialogOpen(true);
  };

  const handleWorkdayOverrideDialogOpenChange = (open: boolean) => {
    setWorkdayOverrideDialogOpen(open);
    if (!open) {
      setWorkdayOverrideDialogMode("create");
      setEditingWorkdayOverrideId(null);
      setWorkdayOverrideForm(buildDefaultWorkdayOverrideForm());
    }
  };

  const openCreateWorkdayOverrideDialog = (employeeId = scheduleEmployeeId || visibleEmployees[0]?.id || employees[0]?.id || "") => {
    setWorkdayOverrideDialogMode("create");
    setEditingWorkdayOverrideId(null);
    setWorkdayOverrideForm(buildDefaultWorkdayOverrideForm(employeeId));
    setWorkdayOverrideDialogOpen(true);
  };

  const openEditWorkdayOverrideDialog = (item: ScheduleWorkdayOverridePreviewItem) => {
    setWorkdayOverrideDialogMode("edit");
    setEditingWorkdayOverrideId(item.id);
    setWorkdayOverrideForm({
      employeeId: item.employeeId,
      date: item.date,
      startTime: minuteToInputTime(item.startMinute),
      endTime: minuteToInputTime(item.endMinute),
      breakEnabled: item.breakStartMinute !== null && item.breakEndMinute !== null,
      breakStartTime: minuteToInputTime(item.breakStartMinute ?? 13 * 60),
      breakEndTime: minuteToInputTime(item.breakEndMinute ?? 14 * 60),
      breakTitle: item.breakTitle || "Перерыв",
    });
    setWorkdayOverrideDialogOpen(true);
  };

  const handleTimeOffDialogOpenChange = (open: boolean) => {
    setTimeOffDialogOpen(open);
    if (!open) {
      setTimeOffDialogMode("create");
      setEditingTimeOffId(null);
      setTimeOffForm(buildDefaultTimeOffForm(timeOffEmployeeFilterId));
    }
  };

  const openCreateTimeOffDialog = (employeeId = timeOffEmployeeFilterId) => {
    setTimeOffDialogMode("create");
    setEditingTimeOffId(null);
    setTimeOffForm(buildDefaultTimeOffForm(employeeId));
    setTimeOffDialogOpen(true);
  };

  const openEditTimeOffDialog = (item: ScheduleTimeOffPreviewItem) => {
    const isDateOnlyItem = isDateOnlyTimeOffType(item.type);
    setTimeOffDialogMode("edit");
    setEditingTimeOffId(item.id);
    setTimeOffForm({
      employeeId: item.employeeId || "all",
      type: item.type,
      startsAt: isDateOnlyItem ? `${dateOnlyFromInputOrIso(item.startsAt)}T00:00` : toInputDateTimeValue(item.startsAt),
      endsAt: isDateOnlyItem ? `${dateOnlyFromInputOrIso(item.endsAt)}T23:59` : toInputDateTimeValue(item.endsAt),
      title: item.title || "",
      notes: item.notes || "",
    });
    setTimeOffDialogOpen(true);
  };

  const openCreateEmployeeDialog = () => {
    setEmployeeDialogMode("create");
    setEditingEmployeeId(null);
    setEmployeeForm({
      name: "",
      specialty: "",
      photoUrl: "",
      description: "",
      slotDurationMin: FALLBACK_APPOINTMENT_DURATION_MIN,
      color: getNextEmployeeColor(employees),
      compensationType: "percent",
      compensationValue: 0,
    });
    setEmployeeSlotDurationInput(String(FALLBACK_APPOINTMENT_DURATION_MIN));
    setEmployeeCompensationValueInput("");
    setEmployeeDialogOpen(true);
  };

  const openEditEmployeeDialog = (employee: BookingEmployee) => {
    const nextCompensationType = (employee.compensationType as BookingCompensationType) || "percent";
    const nextCompensationValue = clampEmployeeCompensationValue(employee.compensationValue ?? 0, nextCompensationType);
    setEmployeeDialogMode("edit");
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      name: employee.name || "",
      specialty: employee.specialty || "",
      photoUrl: employee.photoUrl || "",
      description: employee.description || "",
      slotDurationMin: employee.slotDurationMin || FALLBACK_APPOINTMENT_DURATION_MIN,
      color: employee.color || getEmployeeColorFallback(employee.id),
      compensationType: nextCompensationType,
      compensationValue: nextCompensationValue,
    });
    setEmployeeSlotDurationInput(String(employee.slotDurationMin || FALLBACK_APPOINTMENT_DURATION_MIN));
    setEmployeeCompensationValueInput(formatOptionalMoneyInput(nextCompensationValue));
    setEmployeeDialogOpen(true);
  };

  const openCreateAppointmentFromSlot = (draft: SlotDraft) => {
    const normalizedDraft: SlotDraft =
      draft.candidateSlots && draft.candidateSlots.length
        ? (() => {
          const selected =
            draft.candidateSlots.find((slot) => slot.employeeId === draft.employeeId) || draft.candidateSlots[0];
          const candidateSlotsAtSelectedStart =
            draft.candidateSlots?.filter((slot) => slot.startsAt === selected.startsAt) || [];
          return {
            ...draft,
            employeeId: selected.employeeId,
            startsAt: selected.startsAt,
            endsAt: selected.endsAt,
            candidateSlots: candidateSlotsAtSelectedStart.length ? candidateSlotsAtSelectedStart : draft.candidateSlots,
          };
        })()
        : draft;
    const fallbackDraftDuration = clampAppointmentDurationMin(
      getEmployeeDefaultDurationMin(normalizedDraft.employeeId),
      FALLBACK_APPOINTMENT_DURATION_MIN,
    );
    const rawDraftDuration = getDurationMinBetween(normalizedDraft.startsAt, normalizedDraft.endsAt);
    const draftDuration =
      rawDraftDuration > BOOKING_STEP_MIN
        ? alignDurationToStep(rawDraftDuration, BOOKING_STEP_MIN, fallbackDraftDuration)
        : fallbackDraftDuration;
    setSlotDraft({
      ...normalizedDraft,
      endsAt: addMinutesToIso(normalizedDraft.startsAt, draftDuration),
    });
    setActiveAppointmentId(null);
    setAppointmentDialogMode("create");
    setAppointmentStatusDraft("scheduled");
    setAppointmentForm({
      appointmentType: "primary",
      clientId: null,
      serviceId: null,
      clientName: normalizedPrefill.clientName,
      clientPhone: normalizedPrefill.clientPhone,
      clientIin: normalizedPrefill.clientIin,
      clientComment: normalizedPrefill.clientComment,
      durationMin: draftDuration,
      serviceAmount: 0,
      prepaidAmount: 0,
      prepaidPaymentMethod: "kaspi_transfer",
    });
    setAppointmentDurationInput(String(draftDuration));
    setAppointmentServiceAmountInput("");
    setAppointmentPrepaidAmountInput("");
    setSlotAvailabilityDurationMin(draftDuration);
    setAppointmentClientDetailsOpen(false);
    setAppointmentDialogOpen(true);
  };

  const openExistingAppointmentDialog = (appointment: BookingAppointment) => {
    const durationMin =
      appointment.durationMin ||
      Math.max(1, Math.round((new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime()) / (60 * 1000)));
    setActiveAppointmentId(appointment.id);
    setAppointmentDialogMode("view");
    setAppointmentStatusDraft(appointment.status || "scheduled");
    setSlotDraft({
      employeeId: appointment.employeeId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
    });
    setAppointmentForm({
      appointmentType: (appointment.appointmentType as BookingAppointmentType) || "primary",
      clientId: appointment.clientId || null,
      serviceId: appointment.serviceId || null,
      clientName: appointment.clientName || "",
      clientPhone: toAppointmentPhoneInputValue(appointment.clientPhone),
      clientIin: appointment.clientIin || "",
      clientComment: appointment.clientComment || "",
      durationMin,
      serviceAmount: appointment.serviceAmount || 0,
      prepaidAmount: appointment.prepaidAmount || 0,
      prepaidPaymentMethod: (appointment.prepaidPaymentMethod as BookingPaymentMethod) || "kaspi_transfer",
    });
    setAppointmentDurationInput(String(durationMin));
    setAppointmentServiceAmountInput(formatOptionalMoneyInput(appointment.serviceAmount));
    setAppointmentPrepaidAmountInput(formatOptionalMoneyInput(appointment.prepaidAmount));
    setAppointmentClientDetailsOpen(
      Boolean(
        appointment.clientId ||
        appointment.clientName ||
        appointment.clientPhone ||
        appointment.clientIin,
      ),
    );
    setAppointmentDialogOpen(true);
  };

  const handleAppointmentDialogOpenChange = (open: boolean) => {
    setAppointmentDialogOpen(open);
    if (!open) {
      setAppointmentDialogMode("create");
      setActiveAppointmentId(null);
      setAppointmentStatusDraft("scheduled");
      setSlotDraft(null);
      setSlotAvailabilityDurationMin(FALLBACK_APPOINTMENT_DURATION_MIN);
      setResizingAppointmentDraft(null);
      setAppointmentDurationInput(String(FALLBACK_APPOINTMENT_DURATION_MIN));
      setAppointmentServiceAmountInput("");
      setAppointmentPrepaidAmountInput("");
      setAppointmentClientDetailsOpen(false);
    }
  };

  const handleEmployeeDialogOpenChange = (open: boolean) => {
    setEmployeeDialogOpen(open);
    if (!open) {
      setEmployeeDialogMode("create");
      setEditingEmployeeId(null);
      setEmployeeForm({
        name: "",
        specialty: "",
        photoUrl: "",
        description: "",
        slotDurationMin: FALLBACK_APPOINTMENT_DURATION_MIN,
        color: getNextEmployeeColor(employees),
        compensationType: "percent",
        compensationValue: 0,
      });
      setEmployeeSlotDurationInput(String(FALLBACK_APPOINTMENT_DURATION_MIN));
      setEmployeeCompensationValueInput("");
    }
  };

  const openCreateServiceDialog = () => {
    setServiceDialogMode("create");
    setEditingServiceId(null);
    setServiceForm(buildDefaultServiceForm(employees));
    setServicePriceDialogOpen(false);
    setServiceDialogOpen(true);
  };

  const openEditServiceDialog = (service: BookingService) => {
    setServiceDialogMode("edit");
    setEditingServiceId(service.id);
    setServiceForm(buildDefaultServiceForm(employees, service));
    setServicePriceDialogOpen(false);
    setServiceDialogOpen(true);
  };

  const handleServiceDialogOpenChange = (open: boolean) => {
    setServiceDialogOpen(open);
    if (!open) {
      setServiceDialogMode("create");
      setEditingServiceId(null);
      setServiceForm(buildDefaultServiceForm(employees));
      setServicePriceDialogOpen(false);
    }
  };

  const updateServicePriceRow = (
    employeeId: string,
    updater: (row: ServicePriceEditorRow) => ServicePriceEditorRow,
  ) => {
    setServiceForm((prev) => ({
      ...prev,
      employeePrices: prev.employeePrices.map((row) => (row.employeeId === employeeId ? updater(row) : row)),
    }));
  };

  const handleServicePriceToggle = (employeeId: string, enabled: boolean) => {
    setServiceForm((prev) => ({
      ...prev,
      employeePrices: prev.employeePrices.map((row) => {
        if (row.employeeId !== employeeId) return row;
        const fallbackPrice = row.price > 0 ? row.price : prev.basePrice;
        return {
          ...row,
          enabled,
          price: enabled ? fallbackPrice : row.price,
          priceInput: enabled ? (row.priceInput || formatOptionalMoneyInput(fallbackPrice)) : row.priceInput,
        };
      }),
    }));
  };

  const handleServicePersonalPriceToggle = (checked: boolean) => {
    if (checked) {
      setServicePriceDialogOpen(true);
      return;
    }

    setServiceForm((prev) => ({
      ...prev,
      employeePrices: prev.employeePrices.map((row) => ({ ...row, enabled: false })),
    }));
    setServicePriceDialogOpen(false);
  };

  const handleServicePriceCompensationTypeChange = (
    employeeId: string,
    compensationType: BookingCompensationType,
  ) => {
    updateServicePriceRow(employeeId, (row) => {
      const compensationValue = clampCompensationValue(row.compensationValue, compensationType);
      return {
        ...row,
        compensationType,
        compensationValue,
        compensationValueInput: formatOptionalMoneyInput(compensationValue),
      };
    });
  };

  const handleServicePriceInputChange = (employeeId: string, raw: string) => {
    const digits = digitsOnly(raw);
    updateServicePriceRow(employeeId, (row) => {
      if (!digits) {
        return {
          ...row,
          price: 0,
          priceInput: "",
        };
      }

      const next = Math.max(0, Math.round(Number(digits) || 0));
      return {
        ...row,
        price: next,
        priceInput: String(next),
      };
    });
  };

  const handleServicePriceCompensationValueInputChange = (employeeId: string, raw: string) => {
    const digits = digitsOnly(raw);
    updateServicePriceRow(employeeId, (row) => {
      if (!digits) {
        return {
          ...row,
          compensationValue: 0,
          compensationValueInput: "",
        };
      }

      const next = clampCompensationValue(Number(digits), row.compensationType);
      return {
        ...row,
        compensationValue: next,
        compensationValueInput: String(next),
      };
    });
  };

  const patchAppointmentForm = (patch: Partial<typeof appointmentForm>) => {
    setAppointmentForm((prev) => ({ ...prev, ...patch }));
  };

  const handleAppointmentClientChange = (nextClientId: string | null) => {
    if (!nextClientId) {
      patchAppointmentForm({ clientId: null });
      setAppointmentClientDetailsOpen(false);
      return;
    }

    const bookingClient = clientsById.get(nextClientId);
    if (!bookingClient) {
      patchAppointmentForm({ clientId: null });
      setAppointmentClientDetailsOpen(false);
      return;
    }

    patchAppointmentForm({
      clientId: bookingClient.id,
      clientName: bookingClient.fullName,
      clientPhone: toAppointmentPhoneInputValue(bookingClient.phone),
      clientIin: bookingClient.iin || "",
    });
    setAppointmentClientDetailsOpen(true);
  };

  const handleAppointmentClientCreate = () => {
    patchAppointmentForm({
      clientId: null,
      clientName: "",
      clientPhone: "",
      clientIin: "",
    });
    setAppointmentClientDetailsOpen(true);
  };

  const handleAppointmentServiceChange = (nextServiceIdRaw: string) => {
    const nextServiceId = nextServiceIdRaw || null;
    if (!nextServiceId) {
      patchAppointmentForm({ serviceId: null });
      return;
    }

    const selectedOption = appointmentServiceOptions.find((item) => item.value === nextServiceId);
    const selectedService = servicesById.get(nextServiceId);
    const nextAppointmentType =
      inferAppointmentTypeFromServiceType(selectedService?.serviceType) || appointmentForm.appointmentType;
    const nextDurationMin = selectedOption?.durationMin
      ? alignDurationToStep(selectedOption.durationMin, appointmentDurationStepMin, appointmentDurationStepMin)
      : clampAppointmentDurationMin(appointmentForm.durationMin, appointmentDurationStepMin);

    setAppointmentDurationInput(String(nextDurationMin));
    if (appointmentDialogMode === "create") {
      setSlotAvailabilityDurationMin(nextDurationMin);
    }

    if (selectedOption?.price && selectedOption.price > 0) {
      setAppointmentServiceAmountInput(String(selectedOption.price));
      patchAppointmentForm({
        serviceId: nextServiceId,
        appointmentType: nextAppointmentType,
        durationMin: nextDurationMin,
        serviceAmount: selectedOption.price,
      });
    } else {
      patchAppointmentForm({
        serviceId: nextServiceId,
        appointmentType: nextAppointmentType,
        durationMin: nextDurationMin,
      });
    }

    setSlotDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        endsAt: addMinutesToIso(prev.startsAt, nextDurationMin),
      };
    });
  };

  const applyServiceSelectionToAppointmentForm = (service: BookingService) => {
    if (!appointmentDialogOpen) return;

    const customPrice = selectedAppointmentEmployeeId
      ? service.prices.find(
        (item) => item.employeeId === selectedAppointmentEmployeeId && item.isActive && item.price > 0,
      )
      : null;
    const resolvedPrice = customPrice?.price || service.basePrice;
    const nextAppointmentType =
      inferAppointmentTypeFromServiceType(service.serviceType) || appointmentForm.appointmentType;
    const nextDurationMin = alignDurationToStep(
      service.durationMin,
      appointmentDurationStepMin,
      appointmentDurationStepMin,
    );

    setAppointmentDurationInput(String(nextDurationMin));
    if (appointmentDialogMode === "create") {
      setSlotAvailabilityDurationMin(nextDurationMin);
    }

    if (resolvedPrice > 0) {
      setAppointmentServiceAmountInput(String(resolvedPrice));
      patchAppointmentForm({
        serviceId: service.id,
        appointmentType: nextAppointmentType,
        durationMin: nextDurationMin,
        serviceAmount: resolvedPrice,
      });
    } else {
      patchAppointmentForm({
        serviceId: service.id,
        appointmentType: nextAppointmentType,
        durationMin: nextDurationMin,
      });
    }

    setSlotDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        endsAt: addMinutesToIso(prev.startsAt, nextDurationMin),
      };
    });
  };

  const handleAppointmentServiceAmountInputChange = (raw: string) => {
    const digits = digitsOnly(raw);
    if (!digits) {
      setAppointmentServiceAmountInput("");
      patchAppointmentForm({ serviceAmount: 0 });
      return;
    }

    const next = Math.max(0, Math.round(Number(digits) || 0));
    setAppointmentServiceAmountInput(String(next));
    patchAppointmentForm({ serviceAmount: next });
  };

  const handleAppointmentPrepaidAmountInputChange = (raw: string) => {
    const digits = digitsOnly(raw);
    if (!digits) {
      setAppointmentPrepaidAmountInput("");
      patchAppointmentForm({ prepaidAmount: 0 });
      return;
    }

    const next = Math.max(0, Math.round(Number(digits) || 0));
    setAppointmentPrepaidAmountInput(String(next));
    patchAppointmentForm({ prepaidAmount: next });
  };

  const handleAppointmentServiceAmountInputBlur = () => undefined;

  const handleAppointmentPrepaidAmountInputBlur = () => undefined;

  const startEditingAppointmentFromDialog = () => {
    if (!activeAppointmentId) return;
    setAppointmentDialogMode("edit");
  };

  const handleAppointmentSlotEmployeeChange = (nextEmployeeId: string) => {
    let nextDurationMin =
      appointmentDialogMode === "create"
        ? getEmployeeDefaultDurationMin(nextEmployeeId)
        : clampAppointmentDurationMin(appointmentForm.durationMin, BOOKING_STEP_MIN);
    setAppointmentDurationInput(String(nextDurationMin));
    patchAppointmentForm({ durationMin: nextDurationMin });
    if (appointmentDialogMode === "create") {
      setSlotAvailabilityDurationMin(nextDurationMin);
    }

    if (appointmentForm.serviceId) {
      const service = servicesById.get(appointmentForm.serviceId);
      const customPrice = service?.prices.find(
        (item) => item.employeeId === nextEmployeeId && item.isActive && item.price > 0,
      );
      const nextServiceAmount = customPrice?.price || service?.basePrice || 0;

      if (service && nextServiceAmount > 0) {
        const nextAppointmentType =
          inferAppointmentTypeFromServiceType(service?.serviceType) || appointmentForm.appointmentType;
        nextDurationMin = alignDurationToStep(
          service?.durationMin,
          appointmentDurationStepMin,
          appointmentDurationStepMin,
        );
        setAppointmentDurationInput(String(nextDurationMin));
        if (appointmentDialogMode === "create") {
          setSlotAvailabilityDurationMin(nextDurationMin);
        }
        setAppointmentServiceAmountInput(String(nextServiceAmount));
        patchAppointmentForm({
          serviceId: appointmentForm.serviceId,
          appointmentType: nextAppointmentType,
          durationMin: nextDurationMin,
          serviceAmount: nextServiceAmount,
        });
      } else {
        setAppointmentServiceAmountInput("");
        patchAppointmentForm({
          serviceId: null,
          serviceAmount: 0,
        });
        toast({
          title: "Для выбранного сотрудника услуга недоступна",
        });
      }
    }

    setSlotDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        employeeId: nextEmployeeId || null,
        endsAt: addMinutesToIso(prev.startsAt, nextDurationMin),
      };
    });
  };

  const handleAppointmentStartTimeChange = (nextStartsAt: string) => {
    const nextDurationMin = appointmentDialogMode === "create"
      ? alignDurationToStep(appointmentForm.durationMin, appointmentDurationStepMin, appointmentDurationStepMin)
      : clampAppointmentDurationMin(appointmentForm.durationMin);

    setSlotDraft((prev) => {
      if (!prev || !nextStartsAt) return prev;
      return {
        ...prev,
        startsAt: nextStartsAt,
        endsAt: addMinutesToIso(nextStartsAt, nextDurationMin),
      };
    });
  };

  const handleAppointmentDurationPresetSelect = (preset: number) => {
    const nextDuration = alignDurationToStep(preset, appointmentDurationStepMin, appointmentDurationStepMin);
    setAppointmentDurationInput(String(nextDuration));
    patchAppointmentForm({ durationMin: nextDuration });
    if (appointmentDialogMode === "create") {
      setSlotAvailabilityDurationMin(nextDuration);
    }
  };

  const handleAppointmentDurationInputChange = (raw: string) => {
    const digits = digitsOnly(raw);
    setAppointmentDurationInput(digits);
    if (!digits) return;

    const nextDurationRaw = Number(digits);
    if (!Number.isFinite(nextDurationRaw)) return;
    if (nextDurationRaw < appointmentDurationStepMin || nextDurationRaw > 12 * 60) return;
    if (nextDurationRaw % appointmentDurationStepMin !== 0) return;

    patchAppointmentForm({ durationMin: nextDurationRaw });
    if (appointmentDialogMode === "create") {
      setSlotAvailabilityDurationMin(nextDurationRaw);
    }
  };

  const handleAppointmentDurationInputBlur = () => {
    const digits = digitsOnly(appointmentDurationInput);
    if (!digits) {
      setAppointmentDurationInput(String(appointmentForm.durationMin));
      return;
    }

    const nextDuration = alignDurationToStep(digits, appointmentDurationStepMin, appointmentDurationStepMin);
    setAppointmentDurationInput(String(nextDuration));
    patchAppointmentForm({ durationMin: nextDuration });
    if (appointmentDialogMode === "create") {
      setSlotAvailabilityDurationMin(nextDuration);
    }
  };

  const advanceAppointmentStatus = async (appointment: BookingAppointment) => {
    if (appointmentStatusSavingId) return;

    const nextStatus = getNextAppointmentStatus(appointment.id === activeAppointmentId ? appointmentStatusDraft : appointment.status);
    if (!nextStatus) return;

    setAppointmentStatusSavingId(appointment.id);
    if (appointment.id === activeAppointmentId) {
      setAppointmentStatusDraft(nextStatus);
    }

    try {
      await updateBookingAppointment(appointment.id, { status: nextStatus }, requestContext);
      toast({ title: `Статус изменен: ${getStatusLabelRu(nextStatus)}` });
      refreshCalendar();
    } catch (error) {
      if (appointment.id === activeAppointmentId) {
        setAppointmentStatusDraft(appointment.status || "scheduled");
      }
      toast({
        title: "Не удалось изменить статус",
        description: getErrorMessage(error),
      });
    } finally {
      setAppointmentStatusSavingId(null);
    }
  };

  const refreshCalendar = () => setRefreshTick((v) => v + 1);

  const loadScheduleRowsForEmployee = (employeeId: string) => {
    setScheduleRows(
      buildScheduleEditorRows(employeeId, calendarData?.workRules || [], calendarData?.breakRules || []),
    );
  };

  const openScheduleDialog = (employeeId?: string) => {
    const targetId = employeeId || visibleEmployees[0]?.id || employees[0]?.id || "";
    if (!targetId) {
      toast({ title: "Сначала создайте сотрудника" });
      return;
    }
    setScheduleEmployeeId(targetId);
    setTimeOffEmployeeFilterId("all");
    setScheduleRows(buildScheduleEditorRows(targetId, calendarData?.workRules || [], calendarData?.breakRules || []));
    setScheduleDialogTab("schedule");
    setScheduleDialogOpen(true);
  };

  const updateScheduleRow = (weekday: number, patch: Partial<ScheduleDayRow>) => {
    setScheduleRows((prev) =>
      prev.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)),
    );
  };

  const updateScheduleRows = (
    weekdays: number[],
    updater: (row: ScheduleDayRow) => ScheduleDayRow,
  ) => {
    if (!weekdays.length) return;

    const weekdaySet = new Set(weekdays);
    setScheduleRows((prev) =>
      prev.map((row) => (weekdaySet.has(row.weekday) ? updater(row) : row)),
    );
  };

  const handleWorkdayToggle = (weekday: number, enabled: boolean) => {
    if (enabled) {
      updateScheduleRow(weekday, { workEnabled: true });
      return;
    }
    updateScheduleRow(weekday, buildDisabledScheduleRowPatch());
  };

  const applyScheduleWeekdayPreset = () => {
    setScheduleRows(
      WEEKDAY_EDITOR_ORDER.map((weekday) =>
        weekday >= 1 && weekday <= 5
          ? {
              weekday,
              workEnabled: true,
              workStart: minuteToInputTime(9 * 60),
              workEnd: minuteToInputTime(18 * 60),
              breakEnabled: false,
              breakStart: minuteToInputTime(13 * 60),
              breakEnd: minuteToInputTime(14 * 60),
              breakTitle: "Перерыв",
            }
          : {
              weekday,
              workEnabled: false,
              workStart: minuteToInputTime(9 * 60),
              workEnd: minuteToInputTime(18 * 60),
              breakEnabled: false,
              breakStart: minuteToInputTime(13 * 60),
              breakEnd: minuteToInputTime(14 * 60),
              breakTitle: "Перерыв",
            },
      ),
    );
    toast({ title: "Установлен график по будням" });
  };

  const applyScheduleLunchPreset = () => {
    const hasAnyWorkday = scheduleRows.some((row) => row.workEnabled);
    if (!hasAnyWorkday) {
      toast({ title: "Сначала включите хотя бы один рабочий день" });
      return;
    }

    setScheduleRows((prev) =>
      prev.map((row) =>
        row.workEnabled
          ? {
              ...row,
              breakEnabled: true,
              breakStart: minuteToInputTime(13 * 60),
              breakEnd: minuteToInputTime(14 * 60),
              breakTitle: row.breakTitle.trim() || "Перерыв",
            }
          : row,
      ),
    );
    toast({ title: "Стандартный обед добавлен во все рабочие дни" });
  };

  const resetScheduleEditor = () => {
    if (!scheduleEmployeeId) return;
    setScheduleRows(
      buildScheduleEditorRows(scheduleEmployeeId, calendarData?.workRules || [], calendarData?.breakRules || []),
    );
    toast({ title: "Несохранённые изменения сброшены" });
  };

  const submitSchedule = async () => {
    if (!scheduleEmployeeId) {
      toast({ title: "Выберите сотрудника" });
      return;
    }

    const workRules: BookingRuleRangeInput[] = [];
    const breakRules: BookingRuleRangeInput[] = [];

    for (const row of scheduleRows) {
      let workStartMinute: number | null = null;
      let workEndMinute: number | null = null;

      if (row.workEnabled) {
        workStartMinute = inputTimeToMinute(row.workStart);
        workEndMinute = inputTimeToMinute(row.workEnd);
        if (workStartMinute === null || workEndMinute === null || workEndMinute <= workStartMinute) {
          toast({ title: `Проверьте рабочее время: ${WEEKDAY_LONG_RU[row.weekday]}` });
          return;
        }
        workRules.push({
          weekday: row.weekday,
          startMinute: workStartMinute,
          endMinute: workEndMinute,
          isActive: true,
        });
      }

      if (row.workEnabled && row.breakEnabled) {
        const startMinute = inputTimeToMinute(row.breakStart);
        const endMinute = inputTimeToMinute(row.breakEnd);
        if (startMinute === null || endMinute === null || endMinute <= startMinute) {
          toast({ title: `Проверьте перерыв: ${WEEKDAY_LONG_RU[row.weekday]}` });
          return;
        }
        if (
          workStartMinute === null ||
          workEndMinute === null ||
          startMinute < workStartMinute ||
          endMinute > workEndMinute
        ) {
          toast({ title: `Перерыв должен быть внутри рабочего времени: ${WEEKDAY_LONG_RU[row.weekday]}` });
          return;
        }
        breakRules.push({
          weekday: row.weekday,
          startMinute,
          endMinute,
          title: row.breakTitle.trim() || "Перерыв",
          isActive: true,
        });
      }
    }

    setScheduleSaving(true);
    try {
      await replaceBookingEmployeeWorkRules(scheduleEmployeeId, workRules, requestContext);
      await replaceBookingEmployeeBreakRules(scheduleEmployeeId, breakRules, requestContext);
      toast({ title: "Регулярный график сохранён" });
      setScheduleDialogOpen(false);
      refreshCalendar();
    } catch (error) {
      toast({ title: "Ошибка сохранения графика", description: getErrorMessage(error) });
    } finally {
      setScheduleSaving(false);
    }
  };

  const moveAppointmentToAvailableSlot = (slot: AvailableSlotCandidate) => {
    if (!draggingAppointment) return;
    if (draggingAppointment.id === movingAppointmentId) return;
    if (pendingCalendarAdjustment) return;
    if (resizingAppointmentId || resizingAppointmentDraft) return;

    const currentStart = new Date(draggingAppointment.startsAt);
    const currentEnd = new Date(draggingAppointment.endsAt);
    const durationMs = currentEnd.getTime() - currentStart.getTime();
    if (durationMs <= 0) {
      toast({ title: "Некорректная длительность записи" });
      return;
    }

    const nextStart = new Date(slot.startsAt);
    const nextEnd = new Date(nextStart.getTime() + durationMs);
    const nextEndsAtIso = nextEnd.toISOString();

    setDragHoverSlot(null);
    setDragPreviewSlot(null);
    setDraggingAppointment(null);

    if (
      draggingAppointment.employeeId === slot.employeeId &&
      draggingAppointment.startsAt === nextStart.toISOString() &&
      draggingAppointment.endsAt === nextEndsAtIso
    ) {
      return;
    }

    setPendingCalendarAdjustment({
      kind: "move",
      appointmentId: draggingAppointment.id,
      clientName: draggingAppointment.clientName || "Без имени",
      currentEmployeeLabel: employeesById.get(draggingAppointment.employeeId)?.name || draggingAppointment.employeeId,
      nextEmployeeLabel: employeesById.get(slot.employeeId)?.name || slot.employeeId,
      currentStartsAt: draggingAppointment.startsAt,
      currentEndsAt: draggingAppointment.endsAt,
      nextStartsAt: nextStart.toISOString(),
      nextEndsAt: nextEndsAtIso,
      payload: {
        employeeId: slot.employeeId,
        startsAt: nextStart.toISOString(),
        endsAt: nextEndsAtIso,
      },
    });
  };

  const commitAppointmentResize = (appointment: BookingAppointment, nextEndsAt: string) => {
    if (pendingCalendarAdjustment) return;

    const nextDurationMin = alignDurationToStep(
      getDurationMinBetween(appointment.startsAt, nextEndsAt),
      BOOKING_STEP_MIN,
      BOOKING_STEP_MIN,
    );
    const normalizedEndsAt = addMinutesToIso(appointment.startsAt, nextDurationMin);
    setDragPreviewSlot(null);
    setResizingAppointmentDraft(null);

    if (normalizedEndsAt === appointment.endsAt) {
      return;
    }

    setPendingCalendarAdjustment({
      kind: "resize",
      appointmentId: appointment.id,
      clientName: appointment.clientName || "Без имени",
      employeeLabel: employeesById.get(appointment.employeeId)?.name || appointment.employeeId,
      currentStartsAt: appointment.startsAt,
      currentEndsAt: appointment.endsAt,
      nextStartsAt: appointment.startsAt,
      nextEndsAt: normalizedEndsAt,
      payload: {
        endsAt: normalizedEndsAt,
        durationMin: nextDurationMin,
      },
    });
  };

  const confirmPendingCalendarAdjustment = async () => {
    if (!pendingCalendarAdjustment || pendingCalendarAdjustmentSaving) return;

    const adjustment = pendingCalendarAdjustment;
    setPendingCalendarAdjustmentSaving(true);

    if (adjustment.kind === "move") {
      setMovingAppointmentId(adjustment.appointmentId);
    } else {
      setResizingAppointmentId(adjustment.appointmentId);
    }

    try {
      await updateBookingAppointment(adjustment.appointmentId, adjustment.payload, requestContext);
      toast({
        title: adjustment.kind === "move" ? "Запись перенесена" : "Длительность записи обновлена",
      });
      setPendingCalendarAdjustment(null);
      refreshCalendar();
    } catch (error) {
      const err = error as BookingApiError;
      toast({
        title:
          getBookingErrorTitleRu(err.code) ||
          (adjustment.kind === "move" ? "Не удалось перенести запись" : "Не удалось изменить длительность"),
        description: getErrorMessage(error),
      });
    } finally {
      setPendingCalendarAdjustmentSaving(false);
      setMovingAppointmentId(null);
      setResizingAppointmentId(null);
    }
  };

  const startAppointmentResize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    appointment: BookingAppointment,
    slotHeightPx: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (movingAppointmentId || resizingAppointmentId || pendingCalendarAdjustment) return;
    suppressNextAppointmentOpen(600);

    const startClientY = event.clientY;
    const baseDurationMin = alignDurationToStep(
      getDurationMinBetween(appointment.startsAt, appointment.endsAt),
      BOOKING_STEP_MIN,
      BOOKING_STEP_MIN,
    );
    let nextDurationMin = baseDurationMin;
    setDragHoverSlot(null);
    setDragPreviewSlot(null);
    setDraggingAppointment(null);
    clearHoveredDaySubSlot();
    setResizingAppointmentDraft({
      appointmentId: appointment.id,
      endsAt: appointment.endsAt,
    });

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startClientY;
      const resizeStepPx = Math.max(2, (slotHeightPx * BOOKING_STEP_MIN) / timelineStepMin);
      const deltaSteps = Math.round(deltaY / resizeStepPx);
      const candidateDurationMin = alignDurationToStep(
        baseDurationMin + deltaSteps * BOOKING_STEP_MIN,
        BOOKING_STEP_MIN,
        baseDurationMin,
      );
      if (candidateDurationMin === nextDurationMin) return;
      nextDurationMin = candidateDurationMin;
      setResizingAppointmentDraft({
        appointmentId: appointment.id,
        endsAt: addMinutesToIso(appointment.startsAt, candidateDurationMin),
      });
    };

    const finishResize = (commit: boolean) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);

      const nextEndsAt = addMinutesToIso(appointment.startsAt, nextDurationMin);
      if (!commit || nextEndsAt === appointment.endsAt) {
        setResizingAppointmentDraft(null);
        return;
      }
      suppressNextAppointmentOpen(600);
      void commitAppointmentResize(appointment, nextEndsAt);
    };

    const onPointerUp = () => finishResize(true);
    const onPointerCancel = () => finishResize(false);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
  };

  const submitAppointment = async () => {
    if (!slotDraft) return;
    const selectedSlot =
      slotDraft.candidateSlots?.find((item) => item.employeeId === slotDraft.employeeId) ||
      (slotDraft.employeeId ? { employeeId: slotDraft.employeeId, startsAt: slotDraft.startsAt, endsAt: slotDraft.endsAt } : null);
    if (!selectedSlot?.employeeId) {
      toast({ title: "Выберите сотрудника" });
      return;
    }
    const durationMin = clampAppointmentDurationMin(appointmentForm.durationMin, BOOKING_STEP_MIN);
    if (!appointmentClientDetailsOpen && !appointmentForm.clientId) {
      toast({ title: "Выберите клиента или нажмите «Создать»" });
      return;
    }
    if (!appointmentForm.clientName.trim()) {
      toast({ title: "Укажите имя клиента" });
      return;
    }
    const serviceAmount = Math.max(0, Math.round(Number(appointmentForm.serviceAmount) || 0));
    const prepaidAmount = Math.max(0, Math.round(Number(appointmentForm.prepaidAmount) || 0));
    if (serviceAmount <= 0) {
      toast({ title: "Укажите стоимость приема" });
      return;
    }
    if (prepaidAmount > 0 && !appointmentForm.prepaidPaymentMethod) {
      toast({ title: "Выберите способ оплаты для предоплаты" });
      return;
    }
    if (serviceAmount > 0 && prepaidAmount > serviceAmount) {
      toast({ title: "Предоплата не может превышать стоимость приема" });
      return;
    }
    const clientPhone = serializeAppointmentPhone(appointmentForm.clientPhone);
    if (appointmentForm.clientPhone.trim() && !clientPhone) {
      toast({ title: "Телефон должен содержать 10 цифр после +7" });
      return;
    }
    const iinNormalized = normalizeIin(appointmentForm.clientIin);
    if (iinNormalized && iinNormalized.length !== 12) {
      toast({ title: "ИИН должен содержать 12 цифр" });
      return;
    }
    if (appointmentIinPreview && "error" in appointmentIinPreview) {
      toast({ title: appointmentIinPreview.error });
      return;
    }
    const clientBirthDate =
      appointmentIinPreview && !("error" in appointmentIinPreview) ? appointmentIinPreview.birthDate : null;
    const clientGender =
      appointmentIinPreview && !("error" in appointmentIinPreview) ? appointmentIinPreview.gender : null;

    const validSelectedSlot = buildCreateAppointmentCandidatesAtStart({
      startsAtIso: selectedSlot.startsAt,
      durationMin,
      employees,
      candidateEmployeeIds: [selectedSlot.employeeId],
      ignoreAppointmentId: activeAppointmentId || undefined,
      workRulesByEmployee,
      breakRulesByEmployee,
      workdayOverrideByEmployeeDateKey,
      blockingHolidayByDateKey,
      holidayWorkOverrideDateKeys,
      timeOff: calendarData?.timeOff || [],
      activeAppointments,
    }).find((candidate) => candidate.employeeId === selectedSlot.employeeId);

    if (!validSelectedSlot) {
      toast({ title: "У выбранного сотрудника нет свободного времени на эту длительность" });
      return;
    }

    setAppointmentSaving(true);
    try {
      let resolvedClientId = appointmentForm.clientId || null;
      const clientPayload = {
        fullName: appointmentForm.clientName.trim(),
        phone: clientPhone || undefined,
        iin: iinNormalized || undefined,
        birthDate: clientBirthDate,
        gender: clientGender,
      };

      const syncExistingClient = async (clientId: string) => {
        const existingClient = clientsById.get(clientId);
        if (!existingClient) return clientId;

        const hasChanges =
          existingClient.fullName !== clientPayload.fullName ||
          (existingClient.phone || null) !== (clientPayload.phone || null) ||
          (existingClient.iin || null) !== (clientPayload.iin || null) ||
          (existingClient.birthDate || null) !== (clientPayload.birthDate || null) ||
          (existingClient.gender || null) !== (clientPayload.gender || null);

        if (hasChanges) {
          await updateBookingClient(clientId, {
            fullName: clientPayload.fullName,
            phone: clientPayload.phone || null,
            iin: clientPayload.iin || null,
            birthDate: clientPayload.birthDate,
            gender: clientPayload.gender,
          }, requestContext);
        }

        return clientId;
      };

      if (resolvedClientId) {
        resolvedClientId = await syncExistingClient(resolvedClientId);
      } else {
        const matchedClient =
          (clientPayload.iin ? clients.find((item) => item.iin === clientPayload.iin) : null) ||
          (clientPayload.phone ? clients.find((item) => item.phone === clientPayload.phone) : null) ||
          null;

        if (matchedClient) {
          resolvedClientId = await syncExistingClient(matchedClient.id);
        } else {
          const result = await createBookingClient(clientPayload, requestContext);
          resolvedClientId = result.client.id;
        }
      }

      const computedEndsAt = validSelectedSlot.endsAt;
      if (activeAppointmentId) {
        await updateBookingAppointment(activeAppointmentId, {
          employeeId: selectedSlot.employeeId,
          clientId: resolvedClientId || undefined,
          serviceId: appointmentForm.serviceId || undefined,
          startsAt: selectedSlot.startsAt,
          endsAt: computedEndsAt,
          durationMin,
          status: appointmentStatusDraft,
          appointmentType: appointmentForm.appointmentType,
          clientName: appointmentForm.clientName.trim(),
          clientPhone: clientPhone || undefined,
          clientIin: iinNormalized || undefined,
          clientBirthDate: clientBirthDate || undefined,
          clientGender: clientGender || undefined,
          clientComment: appointmentForm.clientComment.trim() || undefined,
          serviceAmount,
          prepaidAmount,
          prepaidPaymentMethod: prepaidAmount > 0 ? appointmentForm.prepaidPaymentMethod : undefined,
          paymentStatus: dialogPaymentStatus,
        }, requestContext);
        toast({ title: "Запись обновлена" });
      } else {
        await createBookingAppointment({
          employeeId: selectedSlot.employeeId,
          clientId: resolvedClientId || undefined,
          serviceId: appointmentForm.serviceId || undefined,
          startsAt: selectedSlot.startsAt,
          endsAt: computedEndsAt,
          durationMin,
          appointmentType: appointmentForm.appointmentType,
          clientName: appointmentForm.clientName.trim(),
          clientPhone: clientPhone || undefined,
          clientIin: iinNormalized || undefined,
          clientBirthDate: clientBirthDate || undefined,
          clientGender: clientGender || undefined,
          clientComment: appointmentForm.clientComment.trim() || undefined,
          source: normalizedPrefill.source,
          externalRef: normalizedPrefill.externalRef,
          serviceAmount,
          prepaidAmount,
          prepaidPaymentMethod: prepaidAmount > 0 ? appointmentForm.prepaidPaymentMethod : undefined,
          paymentStatus: dialogPaymentStatus,
        }, requestContext);
        toast({ title: "Запись создана" });
      }
      handleAppointmentDialogOpenChange(false);
      refreshCalendar();
    } catch (error) {
      const err = error as BookingApiError;
      toast({
        title: getBookingErrorTitleRu(err.code) || (activeAppointmentId ? "Ошибка обновления записи" : "Ошибка создания записи"),
        description: getErrorMessage(error),
      });
    } finally {
      setAppointmentSaving(false);
    }
  };

  const submitEmployee = async () => {
    if (!employeeForm.name.trim()) {
      toast({ title: "Укажите имя сотрудника" });
      return;
    }
    const slotDurationMin = Number(employeeForm.slotDurationMin);
    if (
      !Number.isFinite(slotDurationMin) ||
      slotDurationMin < BOOKING_STEP_MIN ||
      slotDurationMin > 720 ||
      slotDurationMin % BOOKING_STEP_MIN !== 0
    ) {
      toast({ title: "Слот должен быть от 5 до 720 минут и кратным 5" });
      return;
    }
    if (
      employeeForm.compensationType === "percent" &&
      (employeeForm.compensationValue < 0 || employeeForm.compensationValue > 100)
    ) {
      toast({ title: "Процентная ставка должна быть от 0 до 100" });
      return;
    }
    setEmployeeSaving(true);
    try {
      if (employeeDialogMode === "edit") {
        if (!editingEmployeeId) {
          toast({ title: "Сотрудник для редактирования не выбран" });
          return;
        }
        const result = await updateBookingEmployee(editingEmployeeId, {
          name: employeeForm.name.trim(),
          specialty: employeeForm.specialty.trim() || null,
          photoUrl: employeeForm.photoUrl.trim() || null,
          description: employeeForm.description.trim() || null,
          color: employeeForm.color,
          slotDurationMin,
          compensationType: employeeForm.compensationType,
          compensationValue: employeeForm.compensationValue,
        }, requestContext);
        setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, result.employee.id])));
        toast({ title: `Сотрудник обновлён: ${result.employee.name}` });
      } else {
        const result = await createBookingEmployee({
          name: employeeForm.name.trim(),
          specialty: employeeForm.specialty.trim() || undefined,
          photoUrl: employeeForm.photoUrl.trim() || undefined,
          description: employeeForm.description.trim() || undefined,
          color: employeeForm.color,
          slotDurationMin,
          compensationType: employeeForm.compensationType,
          compensationValue: employeeForm.compensationValue,
        }, requestContext);
        setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, result.employee.id])));
        toast({ title: `Сотрудник создан: ${result.employee.name}` });
      }
      setEmployeeDialogOpen(false);
      setEmployeeDialogMode("create");
      setEditingEmployeeId(null);
      setEmployeeForm({
        name: "",
        specialty: "",
        photoUrl: "",
        description: "",
        slotDurationMin: FALLBACK_APPOINTMENT_DURATION_MIN,
        color: getNextEmployeeColor(employees),
        compensationType: "percent",
        compensationValue: 0,
      });
      setEmployeeSlotDurationInput(String(FALLBACK_APPOINTMENT_DURATION_MIN));
      setEmployeeCompensationValueInput("");
      refreshCalendar();
    } catch (error) {
      toast({
        title: employeeDialogMode === "edit" ? "Ошибка обновления сотрудника" : "Ошибка создания сотрудника",
        description: getErrorMessage(error),
      });
    } finally {
      setEmployeeSaving(false);
    }
  };

  const submitService = async () => {
    if (!serviceForm.name.trim()) {
      toast({ title: "Укажите название услуги" });
      return;
    }
    const basePrice = Math.max(0, Math.round(Number(serviceForm.basePrice) || 0));
    const durationMin = Number(serviceForm.durationInput);
    if (
      !Number.isFinite(durationMin) ||
      durationMin < BOOKING_STEP_MIN ||
      durationMin > 720 ||
      durationMin % BOOKING_STEP_MIN !== 0
    ) {
      toast({ title: "Длительность должна быть от 5 до 720 минут и кратной 5" });
      return;
    }

    const employeePrices = serviceForm.employeePrices.map((row) => ({
      employeeId: row.employeeId,
      price: row.enabled ? row.price : 0,
      compensationType: row.compensationType,
      compensationValue: row.compensationValue,
      isActive: row.enabled,
    }));
    const activePriceCount = employeePrices.filter((item) => item.isActive && item.price > 0).length;

    if (serviceForm.isActive && basePrice <= 0 && activePriceCount === 0) {
      toast({
        title: "Для активной услуги нужна базовая цена или персональная цена хотя бы у одного сотрудника",
      });
      return;
    }

    if (serviceForm.employeePrices.some((row) => row.enabled && row.price <= 0)) {
      toast({
        title: "У всех включённых сотрудников должна быть цена больше нуля",
      });
      return;
    }

    setServiceSaving(true);
    try {
      if (serviceDialogMode === "edit") {
        if (!editingServiceId) {
          toast({ title: "Услуга для редактирования не выбрана" });
          return;
        }

        const result = await updateBookingService(editingServiceId, {
          name: serviceForm.name.trim(),
          basePrice,
          durationMin,
          category: serviceForm.category.trim() || null,
          direction: serviceForm.direction.trim() || null,
          serviceType: serviceForm.serviceType,
          description: serviceForm.description.trim() || null,
          isActive: serviceForm.isActive,
          employeePrices,
        }, requestContext);
        toast({ title: `Услуга обновлена: ${result.service.name}` });
      } else {
        const result = await createBookingService({
          name: serviceForm.name.trim(),
          basePrice,
          durationMin,
          category: serviceForm.category.trim() || undefined,
          direction: serviceForm.direction.trim() || undefined,
          serviceType: serviceForm.serviceType,
          description: serviceForm.description.trim() || undefined,
          isActive: serviceForm.isActive,
          employeePrices,
        }, requestContext);
        setServiceCatalog((prev) => {
          const nextCatalog = prev.filter((item) => item.id !== result.service.id);
          nextCatalog.push(result.service);
          return nextCatalog;
        });
        applyServiceSelectionToAppointmentForm(result.service);
        toast({ title: `Услуга создана: ${result.service.name}` });
      }

      handleServiceDialogOpenChange(false);
      refreshCalendar();
    } catch (error) {
      toast({
        title: serviceDialogMode === "edit" ? "Ошибка обновления услуги" : "Ошибка создания услуги",
        description: getErrorMessage(error),
      });
    } finally {
      setServiceSaving(false);
    }
  };

  const submitHoliday = async () => {
    const holidayDate = dateOnlyFromInputOrIso(holidayForm.date);
    if (!holidayDate || !holidayForm.title.trim()) {
      toast({ title: "Заполните дату и название праздника" });
      return;
    }
    setHolidaySaving(true);
    try {
      if (holidayDialogMode === "edit") {
        if (!editingHolidayId) {
          toast({ title: "Праздник для редактирования не выбран" });
          return;
        }
        await updateBookingHoliday(editingHolidayId, {
          date: holidayDate,
          title: holidayForm.title.trim(),
          isRecurringYearly: holidayForm.isRecurringYearly,
          isWorkingDayOverride: holidayForm.isWorkingDayOverride,
        }, requestContext);
        toast({ title: "Праздник обновлён" });
      } else {
        await createBookingHoliday({
          date: holidayDate,
          title: holidayForm.title.trim(),
          isRecurringYearly: holidayForm.isRecurringYearly,
          isWorkingDayOverride: holidayForm.isWorkingDayOverride,
        }, requestContext);
        toast({ title: "Праздник добавлен" });
      }
      handleHolidayDialogOpenChange(false);
      refreshCalendar();
    } catch (error) {
      const err = error as BookingApiError;
      const isConflict = err.code === "HOLIDAY_CONFLICT";
      toast({
        title: isConflict
          ? "На эту дату уже есть праздник"
          : holidayDialogMode === "edit"
            ? "Ошибка обновления праздника"
            : "Ошибка добавления праздника",
        description: isConflict
          ? "Удалите существующий праздник или выберите другую дату."
          : getErrorMessage(error),
      });
    } finally {
      setHolidaySaving(false);
    }
  };

  const submitWorkdayOverride = async () => {
    if (!workdayOverrideForm.employeeId) {
      toast({ title: "Выберите сотрудника" });
      return;
    }

    const date = dateOnlyFromInputOrIso(workdayOverrideForm.date);
    const startMinute = inputTimeToMinute(workdayOverrideForm.startTime);
    const endMinute = inputTimeToMinute(workdayOverrideForm.endTime);
    const breakStartMinute = workdayOverrideForm.breakEnabled ? inputTimeToMinute(workdayOverrideForm.breakStartTime) : null;
    const breakEndMinute = workdayOverrideForm.breakEnabled ? inputTimeToMinute(workdayOverrideForm.breakEndTime) : null;

    if (!date || startMinute === null || endMinute === null || endMinute <= startMinute) {
      toast({ title: "Проверьте дату и рабочее время" });
      return;
    }
    if (
      workdayOverrideForm.breakEnabled &&
      (breakStartMinute === null ||
        breakEndMinute === null ||
        breakEndMinute <= breakStartMinute ||
        breakStartMinute < startMinute ||
        breakEndMinute > endMinute)
    ) {
      toast({ title: "Проверьте разовый перерыв: он должен быть внутри рабочего времени" });
      return;
    }

    setWorkdayOverrideSaving(true);
    try {
      const payload = {
        employeeId: workdayOverrideForm.employeeId,
        date,
        startMinute,
        endMinute,
        breakStartMinute,
        breakEndMinute,
        breakTitle: workdayOverrideForm.breakEnabled ? workdayOverrideForm.breakTitle.trim() || "Перерыв" : null,
      };

      if (workdayOverrideDialogMode === "edit") {
        if (!editingWorkdayOverrideId) {
          toast({ title: "Конкретный рабочий день для редактирования не выбран" });
          return;
        }
        await updateBookingWorkdayOverride(editingWorkdayOverrideId, payload, requestContext);
        toast({ title: "Конкретный рабочий день обновлён" });
      } else {
        await createBookingWorkdayOverride(payload, requestContext);
        toast({ title: "Конкретный рабочий день добавлен" });
      }

      handleWorkdayOverrideDialogOpenChange(false);
      refreshCalendar();
    } catch (error) {
      const err = error as BookingApiError;
      const isConflict = err.code === "WORKDAY_OVERRIDE_CONFLICT";
      toast({
        title: isConflict
          ? "На эту дату уже есть рабочий день"
          : workdayOverrideDialogMode === "edit"
            ? "Ошибка обновления рабочего дня"
            : "Ошибка добавления рабочего дня",
        description: isConflict
          ? "Измените существующий день или выберите другую дату."
          : getErrorMessage(error),
      });
    } finally {
      setWorkdayOverrideSaving(false);
    }
  };

  const submitTimeOff = async () => {
    const startsAt = isDateOnlyTimeOff ? toUtcStartOfDate(timeOffForm.startsAt) : fromInputDateTimeValue(timeOffForm.startsAt);
    const endsAt = isDateOnlyTimeOff ? toUtcEndOfDate(timeOffForm.endsAt) : fromInputDateTimeValue(timeOffForm.endsAt);
    if (!startsAt || !endsAt) {
      toast({ title: isDateOnlyTimeOff ? "Укажите корректные даты" : "Укажите корректные дату и время" });
      return;
    }
    if (+new Date(endsAt) <= +new Date(startsAt)) {
      toast({ title: isDateOnlyTimeOff ? "Дата окончания должна быть не раньше даты начала" : "Конец должен быть позже начала" });
      return;
    }
    setTimeOffSaving(true);
    try {
      const payload = {
        employeeId: timeOffForm.employeeId === "all" ? null : timeOffForm.employeeId,
        type: timeOffForm.type,
        startsAt,
        endsAt,
        title: timeOffForm.title.trim() || null,
        notes: timeOffForm.notes.trim() || null,
      };
      if (timeOffDialogMode === "edit") {
        if (!editingTimeOffId) {
          toast({ title: "Блокировка для редактирования не выбрана" });
          return;
        }
        await updateBookingTimeOff(editingTimeOffId, payload, requestContext);
        toast({ title: "Блокировка времени обновлена" });
      } else {
        await createBookingTimeOff({
          ...payload,
          title: payload.title || undefined,
          notes: payload.notes || undefined,
        }, requestContext);
        toast({ title: "Блокировка времени добавлена" });
      }
      handleTimeOffDialogOpenChange(false);
      refreshCalendar();
    } catch (error) {
      toast({
        title: timeOffDialogMode === "edit" ? "Ошибка обновления блокировки" : "Ошибка добавления блокировки",
        description: getErrorMessage(error),
      });
    } finally {
      setTimeOffSaving(false);
    }
  };

  const confirmHolidayDeletion = async () => {
    if (!pendingHolidayDeletion) return;
    setHolidayDeleting(true);
    try {
      await deleteBookingHoliday(pendingHolidayDeletion.id, requestContext);
      toast({ title: "Праздник удалён" });
      setPendingHolidayDeletion(null);
      if (editingHolidayId === pendingHolidayDeletion.id) {
        handleHolidayDialogOpenChange(false);
      }
      refreshCalendar();
    } catch (error) {
      toast({ title: "Ошибка удаления праздника", description: getErrorMessage(error) });
    } finally {
      setHolidayDeleting(false);
    }
  };

  const confirmWorkdayOverrideDeletion = async () => {
    if (!pendingWorkdayOverrideDeletion) return;
    setWorkdayOverrideDeleting(true);
    try {
      await deleteBookingWorkdayOverride(pendingWorkdayOverrideDeletion.id, requestContext);
      toast({ title: "Конкретный рабочий день удалён" });
      setPendingWorkdayOverrideDeletion(null);
      if (editingWorkdayOverrideId === pendingWorkdayOverrideDeletion.id) {
        handleWorkdayOverrideDialogOpenChange(false);
      }
      refreshCalendar();
    } catch (error) {
      toast({ title: "Ошибка удаления рабочего дня", description: getErrorMessage(error) });
    } finally {
      setWorkdayOverrideDeleting(false);
    }
  };

  const confirmTimeOffDeletion = async () => {
    if (!pendingTimeOffDeletion) return;
    setTimeOffDeleting(true);
    try {
      await deleteBookingTimeOff(pendingTimeOffDeletion.id, requestContext);
      toast({ title: "Блокировка времени удалена" });
      setPendingTimeOffDeletion(null);
      if (editingTimeOffId === pendingTimeOffDeletion.id) {
        handleTimeOffDialogOpenChange(false);
      }
      refreshCalendar();
    } catch (error) {
      toast({ title: "Ошибка удаления блокировки", description: getErrorMessage(error) });
    } finally {
      setTimeOffDeleting(false);
    }
  };

  const suppressNextDayCellClick = () => {
    suppressDayCellClickUntilRef.current = Date.now() + 250;
  };

  const shouldIgnoreDayCellClick = () => Date.now() < suppressDayCellClickUntilRef.current;
  const suppressNextAppointmentOpen = (durationMs = 350) => {
    suppressAppointmentOpenUntilRef.current = Date.now() + durationMs;
  };
  const shouldIgnoreAppointmentOpen = () => Date.now() < suppressAppointmentOpenUntilRef.current;

  const requestAppointmentCancellation = (appointment: BookingAppointment) => {
    if (pendingAppointmentCancellationSaving) return;
    setPendingAppointmentCancellation(appointment);
  };

  const confirmAppointmentCancellation = async () => {
    if (!pendingAppointmentCancellation || pendingAppointmentCancellationSaving) return;

    const appointment = pendingAppointmentCancellation;
    setPendingAppointmentCancellationSaving(true);

    try {
      await cancelBookingAppointment(appointment.id, requestContext);
      toast({ title: "Запись удалена" });
      if (activeAppointmentId === appointment.id) {
        handleAppointmentDialogOpenChange(false);
      }
      setPendingAppointmentCancellation(null);
      refreshCalendar();
    } catch (error) {
      toast({ title: "Ошибка удаления", description: getErrorMessage(error) });
    } finally {
      setPendingAppointmentCancellationSaving(false);
    }
  };

  const daySlotHeightClass = "h-16";
  const weekSlotHeightClass = "min-h-10";
  const dayTimeRowClass = "flex h-16 items-start justify-end bg-background border-t px-2 pt-0.5 text-xs text-muted-foreground";
  const weekTimeRowClass = "flex h-10 items-start justify-end bg-background border-t px-2 py-1 text-xs text-muted-foreground";
  const now = new Date();
  const nowDateKey = toDateKeyLocal(now);
  const nowMinuteOfDay = now.getHours() * 60 + now.getMinutes();
  const isAutoScrollTimeRow = (minuteOfDay: number, durationMin = timelineStepMin) =>
    nowMinuteOfDay >= minuteOfDay && nowMinuteOfDay < minuteOfDay + durationMin;
  const isCurrentTimelineSlot = (day: Date, minuteOfDay: number, durationMin = timelineStepMin) =>
    toDateKeyLocal(day) === nowDateKey && nowMinuteOfDay >= minuteOfDay && nowMinuteOfDay < minuteOfDay + durationMin;

  const renderDaySubSlotMarkers = (layout: "day" | "week") =>
    layout === "day" ? (
      <>
        {Array.from({ length: Math.max(0, daySubSlotCount - 1) }, (_, index) => (
          <span
            key={`day-sub-slot-divider-${index}`}
            className="pointer-events-none absolute inset-x-0 h-px bg-border/70"
            style={{ top: `${((index + 1) * 100) / daySubSlotCount}%` }}
          />
        ))}
      </>
    ) : null;

  const renderDaySubSlotMinuteScale = (
    layout: "day" | "week",
    minuteOfDay: number,
    visibleSubSlotIndexes?: Set<number>,
  ) =>
    layout === "day" ? (
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-0 w-6"
      >
        <div
          className="grid h-full px-1 text-[8px] leading-none"
          style={{ gridTemplateRows: `repeat(${daySubSlotCount}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: daySubSlotCount }, (_, index) => (
            <span
              key={`sub-slot-minute-${minuteOfDay}-${index}`}
              className={cn(
                "flex min-h-0 items-center justify-start",
                visibleSubSlotIndexes?.has(index)
                  ? "font-medium text-sky-800 dark:text-sky-100"
                  : "text-transparent",
              )}
            >
              {visibleSubSlotIndexes?.has(index)
                ? String((minuteOfDay + index * BOOKING_STEP_MIN) % 60).padStart(2, "0")
                : null}
            </span>
          ))}
        </div>
      </div>
    ) : null;

  const updateHoveredDaySubSlot = (
    employeeId: string,
    dayKey: string,
    minuteOfDay: number,
    clientY?: number,
    containerEl?: HTMLElement | null,
  ) => {
    const subSlotIndex = getDaySubSlotIndex(daySubSlotCount, clientY, containerEl);
    setHoveredDaySubSlotKey(`${employeeId}|${dayKey}|${minuteOfDay}|${subSlotIndex}`);
  };

  const clearHoveredDaySubSlot = () => setHoveredDaySubSlotKey(null);

  const resolveDragMoveTargetSlot = (
    day: Date,
    minuteOfDay: number,
    employee: BookingEmployee,
    employeeWorkRules: BookingWorkRule[],
    employeeBreakRules: BookingBreakRule[],
    holiday: BookingHoliday | undefined,
    workOverride: boolean,
    clientY?: number,
    containerEl?: HTMLElement | null,
  ) => {
    if (!draggingAppointment) return null;

    const dragDurationMin = clampAppointmentDurationMin(
      getDurationMinBetween(draggingAppointment.startsAt, draggingAppointment.endsAt),
      BOOKING_STEP_MIN,
    );
    const hoveredMinuteOfDay = minuteOfDay + getDaySubSlotOffsetMin(daySubSlotCount, clientY, containerEl);
    const candidateStartMinute = hoveredMinuteOfDay - draggingAppointment.pointerOffsetMin;

    if (candidateStartMinute < 0 || candidateStartMinute + dragDurationMin > 24 * 60) {
      return null;
    }

    const [candidate] = buildCreateAppointmentCandidatesAtStart({
      startsAtIso: createCellDate(day, candidateStartMinute).toISOString(),
      durationMin: dragDurationMin,
      employees,
      candidateEmployeeIds: [employee.id],
      ignoreAppointmentId: draggingAppointment.id,
      workRulesByEmployee: { [employee.id]: employeeWorkRules },
      breakRulesByEmployee: { [employee.id]: employeeBreakRules },
      workdayOverrideByEmployeeDateKey,
      blockingHolidayByDateKey: holiday ? new Map([[toDateKeyLocal(day), holiday]]) : new Map(),
      holidayWorkOverrideDateKeys: workOverride ? new Set([toDateKeyLocal(day)]) : new Set(),
      timeOff: calendarData?.timeOff || [],
      activeAppointments,
    });

    return candidate || null;
  };

  const renderTimelineCell = (
    day: Date,
    minuteOfDay: number,
    employee: BookingEmployee,
    layout: "day" | "week" = "day",
    options?: {
      durationMin?: number;
      rowHeightPx?: number;
    },
  ) => {
    const cellStart = createCellDate(day, minuteOfDay);
    const dayKey = toDateKeyLocal(day);
    const cellDayMinuteKey = dayMinuteKeyLocal(dayKey, minuteOfDay);
    const employeeCellKey = employeeCellKeyLocal(employee.id, dayKey, minuteOfDay);
    const rowDurationMin = options?.durationMin || timelineStepMin;
    const rowHeightPx = layout === "day" ? options?.rowHeightPx || DAY_SLOT_HEIGHT_PX : WEEK_SLOT_HEIGHT_PX;
    const isCollapsedDayRow = layout === "day" && rowDurationMin > timelineStepMin;
    const dayRowStyle = layout === "day" ? { height: `${rowHeightPx}px` } : undefined;
    const dragPreviewMatchesDraggingSource = Boolean(
      draggingAppointment &&
      dragPreviewSlot &&
      dragPreviewSlot.employeeId === draggingAppointment.employeeId &&
      dragPreviewSlot.startsAt === draggingAppointment.startsAt &&
      dragPreviewSlot.endsAt === draggingAppointment.endsAt,
    );

    const weekday = cellStart.getDay();
    const employeeWorkRules = (workRulesByEmployee[employee.id] || []) as BookingWorkRule[];
    const employeeWorkdayOverride = workdayOverrideByEmployeeDateKey.get(workdayOverrideKeyLocal(employee.id, dayKey));
    const employeeBreakRules = getEffectiveBreakRulesForDay({
      employeeId: employee.id,
      weekday,
      dayKey,
      breakRulesByEmployee,
      workdayOverrideByEmployeeDateKey,
    });
    const holiday = blockingHolidayByDateKey.get(dayKey);
    const workOverride = holidayWorkOverrideDateKeys.has(dayKey) || Boolean(employeeWorkdayOverride);
    const daySubSlotMinutes =
      layout === "day"
        ? getTimelineBucketMinutes(minuteOfDay, timelineStepMin, BOOKING_STEP_MIN)
        : [minuteOfDay];
    const daySubSlotEntries =
      layout === "day"
        ? daySubSlotMinutes.map((subMinuteOfDay) => {
            const subDayMinuteKey = dayMinuteKeyLocal(dayKey, subMinuteOfDay);
            const subEmployeeCellKey = employeeCellKeyLocal(employee.id, dayKey, subMinuteOfDay);
            const subStartsAtIso = createCellDate(day, subMinuteOfDay).toISOString();
            const subInWork = employeeWorkdayOverride
              ? subMinuteOfDay >= employeeWorkdayOverride.startMinute &&
                subMinuteOfDay + BOOKING_STEP_MIN <= employeeWorkdayOverride.endMinute
              : employeeWorkRules.some(
                (rule) =>
                  rule.isActive &&
                  rule.weekday === weekday &&
                  subMinuteOfDay >= rule.startMinute &&
                  subMinuteOfDay + BOOKING_STEP_MIN <= rule.endMinute,
              );
            const subOnBreak = employeeBreakRules.find(
              (rule) =>
                rule.isActive &&
                rule.weekday === weekday &&
                subMinuteOfDay < rule.endMinute &&
                subMinuteOfDay + BOOKING_STEP_MIN > rule.startMinute,
            );
            const rawSubAppointment = appointmentByEmployeeCellKey.get(subEmployeeCellKey);
            const subAppointment = isAppointmentVisible(rawSubAppointment) ? rawSubAppointment : undefined;
            const subTimeOff = timeOffByEmployeeCellKey.get(subEmployeeCellKey) || globalTimeOffByCellKey.get(subDayMinuteKey);
            const subSlot = slotMap.get(slotKey(employee.id, subStartsAtIso));
            const subDragCandidate =
              draggingAppointment && layout === "day"
                ? dragMoveCandidateBySlotKey.get(slotKey(employee.id, subStartsAtIso))
                : undefined;
            const hideDraggedSourceAppointment = Boolean(
              subAppointment &&
              draggingAppointment?.id === subAppointment.id &&
              dragPreviewSlot &&
              !dragPreviewMatchesDraggingSource,
            );

            let subState: "off" | "working" | "break" | "holiday" | "timeoff" | "appointment" | "available" = "off";
            if (holiday && !workOverride) subState = "holiday";
            else if (subTimeOff) subState = "timeoff";
            else if (subOnBreak) subState = "break";
            else if (subDragCandidate) subState = "available";
            else if (subAppointment && !hideDraggedSourceAppointment) subState = "appointment";
            else if (subSlot) subState = "available";
            else if (subInWork) subState = "working";

            return {
              minuteOfDay: subMinuteOfDay,
              appointment: subAppointment,
              timeOff: subTimeOff,
              onBreak: subOnBreak,
              inWork: subInWork,
              dragCandidate: subDragCandidate,
              slot: subSlot,
              state: subState,
            };
          })
        : [];

    const inWork =
      layout === "day"
        ? daySubSlotEntries.some((entry) => entry.inWork)
        : employeeWorkdayOverride
          ? minuteOfDay >= employeeWorkdayOverride.startMinute &&
            minuteOfDay + timelineStepMin <= employeeWorkdayOverride.endMinute
          : employeeWorkRules.some(
              (rule) =>
                rule.isActive &&
                rule.weekday === weekday &&
                minuteOfDay >= rule.startMinute &&
                minuteOfDay + timelineStepMin <= rule.endMinute,
            );
    const onBreak =
      layout === "day"
        ? daySubSlotEntries.find((entry) => entry.onBreak)?.onBreak
        : employeeBreakRules.find(
            (rule) =>
              rule.isActive &&
              rule.weekday === weekday &&
              minuteOfDay < rule.endMinute &&
              minuteOfDay + timelineStepMin > rule.startMinute,
          );

    const timeOff =
      layout === "day"
        ? daySubSlotEntries.find((entry) => entry.timeOff)?.timeOff
        : timeOffByEmployeeCellKey.get(employeeCellKey) || globalTimeOffByCellKey.get(cellDayMinuteKey);
    const appointmentInCell =
      layout === "day"
        ? daySubSlotEntries.find((entry) => entry.appointment)?.appointment
        : (() => {
            const rawAppointment = appointmentByEmployeeCellKey.get(employeeCellKey);
            return isAppointmentVisible(rawAppointment) ? rawAppointment : undefined;
          })();
    const draggingThisAppointment = Boolean(appointmentInCell && draggingAppointment?.id === appointmentInCell.id);
    const dragPreviewMatchesCurrentAppointment = Boolean(
      draggingThisAppointment &&
      draggingAppointment &&
      dragPreviewSlot &&
      dragPreviewSlot.employeeId === draggingAppointment.employeeId &&
      dragPreviewSlot.startsAt === draggingAppointment.startsAt &&
      dragPreviewSlot.endsAt === draggingAppointment.endsAt,
    );
    const appointment =
      draggingThisAppointment && dragPreviewSlot && !dragPreviewMatchesCurrentAppointment
        ? undefined
        : appointmentInCell;
    const appointmentsStartingInCell =
      layout === "day"
        ? daySubSlotMinutes.reduce<BookingAppointment[]>((items, subMinuteOfDay) => {
            const startedAppointment = appointmentStartByEmployeeCellKey.get(
              employeeCellKeyLocal(employee.id, dayKey, subMinuteOfDay),
            );
            if (
              !startedAppointment ||
              !isAppointmentVisible(startedAppointment) ||
              items.some((item) => item.id === startedAppointment.id)
            ) {
              return items;
            }
            items.push(startedAppointment);
            return items;
          }, [])
        : [];

    const serverAvailableCandidates =
      layout === "day"
        ? daySubSlotEntries
            .filter((entry) => Boolean(entry.slot))
            .map((entry) => ({
              employeeId: employee.id,
              startsAt: entry.slot!.startsAt,
              endsAt: entry.slot!.endsAt,
            }))
        : (availableCandidatesByDayMinuteKey.get(cellDayMinuteKey) || []).filter(
            (slot) => slot.employeeId === employee.id,
          );
    const availableCandidates = serverAvailableCandidates.filter(
      (slot, index, all) =>
        all.findIndex((candidate) => candidate.employeeId === slot.employeeId && candidate.startsAt === slot.startsAt) === index,
    );
    const primaryAvailable = availableCandidates[0];
    const cellSlotKeys = new Set(availableCandidates.map((slot) => slotKey(slot.employeeId, slot.startsAt)));
    const dayDragCellKey = `${employee.id}|${dayKey}|${minuteOfDay}`;
    const isDropHover =
      dragHoverSlot !== null
        ? dragHoverSlot === dayDragCellKey || cellSlotKeys.has(dragHoverSlot)
        : false;
    const hoveredSubSlotKeyPrefix = `${employee.id}|${dayKey}|${minuteOfDay}|`;
    const hoveredSubSlotIndex =
      layout === "day" && hoveredDaySubSlotKey?.startsWith(hoveredSubSlotKeyPrefix)
        ? Number(hoveredDaySubSlotKey.slice(hoveredSubSlotKeyPrefix.length))
        : null;
    const hoveredSubSlotTop =
      hoveredSubSlotIndex !== null && Number.isFinite(hoveredSubSlotIndex) && hoveredSubSlotIndex >= 0
        ? `${hoveredSubSlotIndex * (100 / daySubSlotCount)}%`
        : undefined;
    const hoveredSubSlotEntry =
      layout === "day" && hoveredSubSlotIndex !== null && Number.isFinite(hoveredSubSlotIndex) && hoveredSubSlotIndex >= 0
        ? daySubSlotEntries[hoveredSubSlotIndex]
        : undefined;
    const hoveredMinuteOfDay = hoveredSubSlotEntry?.minuteOfDay ?? minuteOfDay;
    const hoveredMinuteSuffixLabel = String(hoveredMinuteOfDay % 60).padStart(2, "0");
    const hoveredTimeLabel = formatMinuteLabel(hoveredMinuteOfDay);
    const hoveredSlotStartIso =
      layout === "day" && hoveredSubSlotEntry
        ? createCellDate(day, hoveredMinuteOfDay).toISOString()
        : null;
    const hoveredSlotKey = hoveredSlotStartIso ? slotKey(employee.id, hoveredSlotStartIso) : null;
    const hoveredSubSlotIsAvailable =
      layout === "day" ? Boolean(hoveredSubSlotEntry?.slot) : hoveredSlotKey ? cellSlotKeys.has(hoveredSlotKey) : false;
    const hasCreateableSubSlots =
      layout === "day"
        ? daySubSlotEntries.some((entry) => Boolean(entry.slot || entry.dragCandidate))
        : cellSlotKeys.size > 0;
    const visibleDaySubSlotMinuteIndexes =
      layout === "day"
        ? undefined
        : undefined;
    const showCreateHoverOverlay = Boolean(
      hoveredSubSlotTop &&
      hoveredSubSlotIsAvailable &&
      !draggingAppointment &&
      !resizingAppointmentDraft &&
      !resizingAppointmentId,
    );

    const appointmentStartsHere =
      layout === "day"
        ? appointmentsStartingInCell.length > 0
        : (() => {
            if (!appointment) return false;
            const startsAt = new Date(appointment.startsAt);
            if (Number.isNaN(startsAt.getTime()) || toDateKeyLocal(startsAt) !== dayKey) return false;
            const appointmentStartMinuteOfDay = startsAt.getHours() * 60 + startsAt.getMinutes();
            return (
              appointmentStartMinuteOfDay >= minuteOfDay &&
              appointmentStartMinuteOfDay < minuteOfDay + timelineStepMin
            );
          })();
    const timeOffStartsHere = timeOff
      ? (() => {
        const startsAt = new Date(timeOff.startsAt);
        if (Number.isNaN(startsAt.getTime())) return false;
        const startsMinute = startsAt.getHours() * 60 + startsAt.getMinutes();
        return (
          toDateKeyLocal(startsAt) === dayKey &&
          startsMinute >= minuteOfDay &&
          startsMinute < minuteOfDay + timelineStepMin
        );
      })()
      : false;
    const timeOffLabelStartsHere = timeOff
      ? (() => {
        if (timeOffStartsHere) return true;
        if (layout !== "day") return false;

        const currentRowIndex = timeRowIndexByMinute.get(minuteOfDay) ?? -1;
        if (currentRowIndex <= 0) return true;

        const previousVisibleMinute = dayTimeRows[currentRowIndex - 1];
        if (previousVisibleMinute === undefined) return true;

        const prevBucketMinutes =
          layout === "day"
            ? getTimelineBucketMinutes(previousVisibleMinute, timelineStepMin, BOOKING_STEP_MIN)
            : [previousVisibleMinute];
        const prevTimeOff = prevBucketMinutes
          .map((bucketMinute) => {
            const prevDayMinuteKey = dayMinuteKeyLocal(dayKey, bucketMinute);
            const prevEmployeeCellKey = employeeCellKeyLocal(employee.id, dayKey, bucketMinute);
            return timeOffByEmployeeCellKey.get(prevEmployeeCellKey) || globalTimeOffByCellKey.get(prevDayMinuteKey);
          })
          .find(Boolean);
        return prevTimeOff?.id !== timeOff.id;
      })()
      : false;
    const isCurrentSlot = isCurrentTimelineSlot(day, minuteOfDay, rowDurationMin);
    const slotHeightPx = layout === "week" ? 40 : rowHeightPx;

    let state: "off" | "working" | "break" | "holiday" | "timeoff" | "appointment" | "available" = "off";
    if (holiday && !workOverride) state = "holiday";
    else if (appointment) state = "appointment";
    else if (layout === "day" && hasCreateableSubSlots) state = "available";
    else if (timeOff) state = "timeoff";
    else if (onBreak) state = "break";
    else if (primaryAvailable) state = "available";
    else if (inWork) state = "working";

    const dragPreviewStartMinuteOfDay =
      dragPreviewSlot && dragPreviewSlot.employeeId === employee.id
        ? (() => {
          const startsAt = new Date(dragPreviewSlot.startsAt);
          if (Number.isNaN(startsAt.getTime()) || toDateKeyLocal(startsAt) !== dayKey) return null;
          return startsAt.getHours() * 60 + startsAt.getMinutes();
        })()
        : null;
    const dragPreviewStartsHere =
      layout === "day" &&
      dragPreviewStartMinuteOfDay !== null &&
      dragPreviewStartMinuteOfDay >= minuteOfDay &&
      dragPreviewStartMinuteOfDay < minuteOfDay + timelineStepMin;
    const dragPreviewDurationMin =
      dragPreviewStartsHere && dragPreviewSlot
        ? getDurationMinBetween(dragPreviewSlot.startsAt, dragPreviewSlot.endsAt)
        : 0;
    const dragPreviewOffsetMin =
      dragPreviewStartsHere && dragPreviewStartMinuteOfDay !== null
        ? dragPreviewStartMinuteOfDay - minuteOfDay
        : 0;
    const dragPreviewBlockHeightPx = Math.max(6, Math.round((slotHeightPx * dragPreviewDurationMin) / timelineStepMin) - 2);
    const dragPreviewBlockTopPx =
      0.5 + Math.round((slotHeightPx * dragPreviewOffsetMin) / timelineStepMin);
    const baseClass = cn(
      "relative overflow-hidden border-l border-t p-0.5 text-left transition-colors first:border-l-0",
      layout === "week" ? weekSlotHeightClass : daySlotHeightClass,
    );
    const className = cn(
      baseClass,
      layout === "day" && "bg-background/40",
      layout !== "day" && state === "off" && "bg-background/40",
      layout !== "day" && state === "working" && "bg-muted/25",
      layout !== "day" && state === "break" && "bg-amber-50/60 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
      layout !== "day" && state === "holiday" && "bg-rose-50/60 text-rose-700 dark:bg-rose-950/35 dark:text-rose-200",
      layout !== "day" && state === "timeoff" && "bg-amber-50 text-amber-900 dark:bg-amber-950/45 dark:text-amber-100",
      layout !== "day" && state === "appointment" && "bg-transparent",
      layout !== "day" && state === "available" && "cursor-pointer bg-sky-50/70 dark:bg-sky-950/30",
      hasCreateableSubSlots && "cursor-pointer",
      (appointment && appointmentStartsHere) || dragPreviewStartsHere ? "overflow-visible" : null,
      isCurrentSlot && "ring-1 ring-sky-300/80 ring-inset dark:ring-sky-500/60",
      isDropHover && layout !== "day" && "ring-2 ring-sky-500 ring-inset dark:ring-sky-400",
      (movingAppointmentId || resizingAppointmentId) && "transition-opacity",
    );

    const canAcceptDayDrag = layout === "day";
    const resolveDropTargetSlot = (clientY?: number, containerEl?: HTMLElement | null) =>
      layout === "day"
        ? resolveDragMoveTargetSlot(
          day,
          minuteOfDay,
          employee,
          employeeWorkRules,
          employeeBreakRules,
          holiday,
          workOverride,
          clientY,
          containerEl,
        )
        : pickAvailableSlotCandidate(availableCandidates, rowDurationMin, clientY, containerEl);
    const applyDragFeedback = (slot: AvailableSlotCandidate | null) => {
      if (!slot) {
        setDragHoverSlot(null);
        setDragPreviewSlot(null);
        return;
      }

      if (layout === "day") {
        setDragHoverSlot(dayDragCellKey);
        setDragPreviewSlot(slot);
        return;
      }

      setDragHoverSlot(slotKey(slot.employeeId, slot.startsAt));
      setDragPreviewSlot(null);
    };
    const dayCellTitle =
      hasCreateableSubSlots
        ? `Создать запись: ${employee.name}, ${hoveredTimeLabel}`
        : (!workOverride && holiday ? holiday.title : null) || timeOff?.title || onBreak?.title || undefined;
    const renderDaySubSlotBackgrounds = () => {
      if (layout !== "day" || isCollapsedDayRow) return null;

      return daySubSlotEntries.map((entry, subSlotIndex) => {
        if (entry.state === "appointment") return null;

        const subSlotClass = cn(
          "pointer-events-none absolute inset-x-0",
          entry.state === "off" && "bg-background/40",
          entry.state === "working" && "bg-muted/25",
          entry.state === "break" && "bg-amber-50/60 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
          entry.state === "holiday" && "bg-rose-50/60 text-rose-700 dark:bg-rose-950/35 dark:text-rose-200",
          entry.state === "timeoff" && "bg-amber-50 text-amber-900 dark:bg-amber-950/45 dark:text-amber-100",
          entry.state === "available" && "bg-sky-50/70 dark:bg-sky-950/30",
        );

        return (
          <span
            key={`${employee.id}|${dayKey}|${minuteOfDay}|bg|${subSlotIndex}`}
            className={subSlotClass}
            style={{
              top: `${(subSlotIndex * 100) / daySubSlotCount}%`,
              height: `${100 / daySubSlotCount}%`,
            }}
          />
        );
      });
    };
    const renderDayCreateHitAreas = () => {
      if (
        layout !== "day" ||
        isCollapsedDayRow ||
        !hasCreateableSubSlots ||
        draggingAppointment ||
        resizingAppointmentDraft ||
        resizingAppointmentId
      ) {
        return null;
      }

      return daySubSlotEntries.map((entry, subSlotIndex) => {
        const subSlot = entry.slot;
        if (!subSlot) return null;

        const subSlotHoverKey = `${employee.id}|${dayKey}|${minuteOfDay}|${subSlotIndex}`;

        return (
          <button
            key={subSlotHoverKey}
            type="button"
            tabIndex={-1}
            className="absolute inset-x-0 z-0 p-0"
            style={{
              top: `${(subSlotIndex * 100) / daySubSlotCount}%`,
              height: `${100 / daySubSlotCount}%`,
            }}
            onMouseEnter={() => setHoveredDaySubSlotKey(subSlotHoverKey)}
            onMouseLeave={clearHoveredDaySubSlot}
            onClick={(event) => {
              if (shouldIgnoreDayCellClick()) {
                event.preventDefault();
                return;
              }
              event.stopPropagation();
              openCreateAppointmentFromSlot({
                employeeId: employee.id,
                startsAt: subSlot.startsAt,
                endsAt: subSlot.endsAt,
                candidateSlots: [subSlot],
              });
            }}
            aria-label={`Создать запись: ${employee.name}, ${formatMinuteLabel(entry.minuteOfDay)}`}
            title={`Создать запись: ${employee.name}, ${formatMinuteLabel(entry.minuteOfDay)}`}
          />
        );
      });
    };
    const renderAppointmentBlock = (appointmentForRender: BookingAppointment) => {
      const startsAt = new Date(appointmentForRender.startsAt);
      if (Number.isNaN(startsAt.getTime()) || toDateKeyLocal(startsAt) !== dayKey) return null;

      const appointmentStartMinuteOfDay = startsAt.getHours() * 60 + startsAt.getMinutes();
      if (
        appointmentStartMinuteOfDay < minuteOfDay ||
        appointmentStartMinuteOfDay >= minuteOfDay + timelineStepMin
      ) {
        return null;
      }

      const draggingThisRenderedAppointment = draggingAppointment?.id === appointmentForRender.id;
      const dragPreviewMatchesRenderedAppointment = Boolean(
        draggingThisRenderedAppointment &&
        draggingAppointment &&
        dragPreviewSlot &&
        dragPreviewSlot.employeeId === draggingAppointment.employeeId &&
        dragPreviewSlot.startsAt === draggingAppointment.startsAt &&
        dragPreviewSlot.endsAt === draggingAppointment.endsAt,
      );
      if (
        draggingThisRenderedAppointment &&
        dragPreviewSlot &&
        !dragPreviewMatchesRenderedAppointment
      ) {
        return null;
      }

      const resizingDraftEndsAt =
        resizingAppointmentDraft?.appointmentId === appointmentForRender.id
          ? resizingAppointmentDraft.endsAt
          : appointmentForRender.endsAt;
      const appointmentDurationMinForRender = getDurationMinBetween(
        appointmentForRender.startsAt,
        resizingDraftEndsAt,
      );
      const appointmentStartOffsetMin = appointmentStartMinuteOfDay - minuteOfDay;
      const exactSlotFactor = appointmentDurationMinForRender / timelineStepMin;
      const appointmentBlockHeightPx = Math.max(6, Math.round(slotHeightPx * exactSlotFactor) - 2);
      const appointmentBlockTopPx =
        0.5 + Math.round((slotHeightPx * appointmentStartOffsetMin) / timelineStepMin);
      const appointmentSurfaceClassName = getAppointmentSurfaceClassName(appointmentForRender.status);
      const appointmentMutedTextClassName = getAppointmentMutedTextClassName(appointmentForRender.status);
      const appointmentHandleClassName = getAppointmentHandleClassName(appointmentForRender.status);
      const usesStatusSurface = Boolean(appointmentSurfaceClassName);
      const showAppointmentName = appointmentBlockHeightPx >= 9;
      const showAppointmentPhone = layout === "day" && appointmentBlockHeightPx >= 22;
      const inlinePhoneText = showAppointmentPhone
        ? formatAppointmentPhoneDisplay(appointmentForRender.clientPhone) || "Без номера"
        : null;
      const showAppointmentStatus = layout === "day" && appointmentBlockHeightPx >= 24;
      const showResizeHandle = layout === "day" && appointmentBlockHeightPx >= 12;
      const appointmentSpansMultipleTimelineRows =
        appointmentStartOffsetMin + appointmentDurationMinForRender > timelineStepMin;
      const showWeekWrapIcon = layout === "week" && showAppointmentName && appointmentSpansMultipleTimelineRows;
      const isResizingThisAppointment =
        Boolean(resizingAppointmentDraft?.appointmentId === appointmentForRender.id) ||
        Boolean(resizingAppointmentId === appointmentForRender.id);

      return (
        <div
          key={appointmentForRender.id}
          className={cn(
            "absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-[4px] border px-1 py-0.5",
            "flex min-w-0 flex-col justify-center",
            "cursor-grab active:cursor-grabbing",
            appointmentSurfaceClassName || "text-white",
            movingAppointmentId === appointmentForRender.id && "opacity-50",
            draggingAppointment?.id === appointmentForRender.id && "opacity-80",
            isResizingThisAppointment && layout === "day" && "cursor-row-resize ring-1 ring-white/80",
          )}
          style={{
            ...(usesStatusSurface
              ? {}
              : {
                  backgroundColor: employee.color || "#10b981",
                  borderColor: employee.color || "#10b981",
                }),
            top: `${appointmentBlockTopPx}px`,
            height: `${appointmentBlockHeightPx}px`,
          }}
          draggable={movingAppointmentId !== appointmentForRender.id && !isResizingThisAppointment}
          onDragStart={(event) => {
            if (isResizingThisAppointment) {
              event.preventDefault();
              return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            const relativeY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
            const renderedDurationMin = Math.max(
              BOOKING_STEP_MIN,
              clampAppointmentDurationMin(
                appointmentDurationMinForRender ||
                  getDurationMinBetween(appointmentForRender.startsAt, appointmentForRender.endsAt),
              ),
            );
            const rawPointerOffsetMin =
              rect.height > 0
                ? Math.round(((relativeY / rect.height) * renderedDurationMin) / BOOKING_STEP_MIN) * BOOKING_STEP_MIN
                : 0;
            const pointerOffsetMin = Math.max(
              0,
              Math.min(Math.max(0, renderedDurationMin - BOOKING_STEP_MIN), rawPointerOffsetMin),
            );
            clearHoveredDaySubSlot();
            setDragPreviewSlot({
              employeeId: appointmentForRender.employeeId,
              startsAt: appointmentForRender.startsAt,
              endsAt: appointmentForRender.endsAt,
            });
            setDraggingAppointment({
              id: appointmentForRender.id,
              employeeId: appointmentForRender.employeeId,
              startsAt: appointmentForRender.startsAt,
              endsAt: appointmentForRender.endsAt,
              clientName: appointmentForRender.clientName,
              pointerOffsetMin,
            });
            event.dataTransfer.effectAllowed = "move";
            try {
              event.dataTransfer.setData("text/plain", appointmentForRender.id);
            } catch { }
          }}
          onDragEnd={() => {
            setDragHoverSlot(null);
            setDragPreviewSlot(null);
            setDraggingAppointment(null);
            clearHoveredDaySubSlot();
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (shouldIgnoreAppointmentOpen()) return;
            openExistingAppointmentDialog(appointmentForRender);
          }}
          title={
            layout === "day"
              ? "Кликните для просмотра, перетащите для переноса, тяните нижний маркер для изменения длительности"
              : "Кликните для просмотра, перетащите для переноса"
          }
          role="button"
          tabIndex={0}
        >
          {showAppointmentName ? (
            <span className={cn("text-[11px] font-semibold leading-none", showWeekWrapIcon && "flex items-center gap-1")}>
              {showWeekWrapIcon ? <CornerDownRight className="size-3 shrink-0" /> : null}
              <span className="min-w-0 truncate">
                {appointmentForRender.clientName}
                {inlinePhoneText ? ` ${inlinePhoneText}` : ""}
              </span>
            </span>
          ) : null}
          {showAppointmentStatus ? (
            <AppointmentStatusInline
              status={appointmentForRender.status}
              className={cn("mt-0.5 text-[9px] font-medium leading-none", appointmentMutedTextClassName)}
              iconClassName="size-2.5 shrink-0"
            />
          ) : null}
          {showResizeHandle ? (
            <button
              type="button"
              className="absolute inset-x-0 bottom-0 flex h-2.5 items-center justify-center cursor-row-resize"
              onPointerDown={(event) => startAppointmentResize(event, appointmentForRender, slotHeightPx)}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              aria-label="Изменить длительность записи"
              title="Потяните вниз или вверх, чтобы изменить длительность"
            >
              <span className={cn("h-0.5 w-5 rounded", appointmentHandleClassName)} />
            </button>
          ) : null}
        </div>
      );
    };

    if (layout !== "day" && state === "available" && primaryAvailable) {
      return (
        <button
          key={employee.id + cellStart.toISOString()}
          type="button"
          className={className}
          style={dayRowStyle}
          onDragOver={(event) => {
            if (!draggingAppointment || resizingAppointmentDraft || resizingAppointmentId) return;
            const hoveredSlot = resolveDropTargetSlot(event.clientY, event.currentTarget);
            if (!hoveredSlot) {
              applyDragFeedback(null);
              return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            applyDragFeedback(hoveredSlot);
          }}
          onDragEnter={(event) => {
            if (!draggingAppointment || resizingAppointmentDraft || resizingAppointmentId) return;
            const hoveredSlot = resolveDropTargetSlot(event.clientY, event.currentTarget);
            if (hoveredSlot) {
              event.preventDefault();
            }
            applyDragFeedback(hoveredSlot);
          }}
          onDragLeave={() => {
            if (isDropHover) applyDragFeedback(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const targetSlot = resolveDropTargetSlot(event.clientY, event.currentTarget);
            applyDragFeedback(null);
            suppressNextDayCellClick();
            if (targetSlot) void moveAppointmentToAvailableSlot(targetSlot);
          }}
          onClick={() => {
            openCreateAppointmentFromSlot({
              employeeId: primaryAvailable.employeeId,
              startsAt: primaryAvailable.startsAt,
              endsAt: primaryAvailable.endsAt,
              candidateSlots: availableCandidates,
            });
          }}
          title={`Создать запись: ${employee.name}`}>
          {!isCollapsedDayRow ? renderDaySubSlotMinuteScale(layout, minuteOfDay, visibleDaySubSlotMinuteIndexes) : null}
          {dragPreviewStartsHere && !dragPreviewMatchesCurrentAppointment ? (
            <div
              className="pointer-events-none absolute left-0.5 right-0.5 z-20 overflow-hidden rounded-md border border-dashed border-sky-500 bg-sky-300/20 dark:border-sky-400/70 dark:bg-sky-500/15"
              style={{
                top: `${dragPreviewBlockTopPx}px`,
                height: `${dragPreviewBlockHeightPx}px`,
              }}
            >
              <div className="px-1 py-0.5 text-[10px] font-semibold leading-none text-sky-700 dark:text-sky-100">
                {draggingAppointment?.clientName || "Запись"}
              </div>
            </div>
          ) : null}
          {showCreateHoverOverlay ? (
            <span
              className="pointer-events-none absolute inset-x-0 z-10 flex items-center justify-start bg-sky-300/65 pl-1 dark:bg-sky-500/30"
              style={{ top: hoveredSubSlotTop, height: `${100 / daySubSlotCount}%` }}
            >
              <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-100">+{hoveredMinuteSuffixLabel}</span>
            </span>
          ) : null}
          {!isCollapsedDayRow ? renderDaySubSlotMarkers(layout) : null}
          {isCurrentSlot ? <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-sky-500 dark:bg-sky-400" /> : null}
        </button>
      );
    }

    return (
      <div
        key={employee.id + cellStart.toISOString()}
        className={className}
        onDragOver={(event) => {
          if (!canAcceptDayDrag || !draggingAppointment || resizingAppointmentDraft || resizingAppointmentId) return;
          const hoveredSlot = resolveDropTargetSlot(event.clientY, event.currentTarget);
          if (!hoveredSlot) {
            applyDragFeedback(null);
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          applyDragFeedback(hoveredSlot);
        }}
        onDragEnter={(event) => {
          if (!canAcceptDayDrag || !draggingAppointment || resizingAppointmentDraft || resizingAppointmentId) return;
          const hoveredSlot = resolveDropTargetSlot(event.clientY, event.currentTarget);
          if (hoveredSlot) {
            event.preventDefault();
          }
          applyDragFeedback(hoveredSlot);
        }}
        onDragLeave={() => {
          if (isDropHover) applyDragFeedback(null);
        }}
        onDrop={(event) => {
          if (!canAcceptDayDrag) return;
          const targetSlot = resolveDropTargetSlot(event.clientY, event.currentTarget);
          applyDragFeedback(null);
          suppressNextDayCellClick();
          if (!targetSlot) return;
          event.preventDefault();
          void moveAppointmentToAvailableSlot(targetSlot);
        }}
        title={layout === "day" ? undefined : dayCellTitle}
        style={dayRowStyle}
      >
        {!isCollapsedDayRow ? renderDaySubSlotMinuteScale(layout, minuteOfDay, visibleDaySubSlotMinuteIndexes) : null}
        {!isCollapsedDayRow ? renderDaySubSlotMarkers(layout) : null}
        {isCurrentSlot ? <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-sky-500 dark:bg-sky-400" /> : null}
        {dragPreviewStartsHere && !dragPreviewMatchesCurrentAppointment ? (
          <div
            className="pointer-events-none absolute left-0.5 right-0.5 z-20 overflow-hidden rounded-md border border-dashed border-sky-500 bg-sky-300/20 dark:border-sky-400/70 dark:bg-sky-500/15"
            style={{
              top: `${dragPreviewBlockTopPx}px`,
              height: `${dragPreviewBlockHeightPx}px`,
            }}
          >
            <div className="px-1 py-0.5 text-[10px] font-semibold leading-none text-sky-700 dark:text-sky-100">
              {draggingAppointment?.clientName || "Запись"}
            </div>
          </div>
        ) : null}
        {renderDaySubSlotBackgrounds()}
        {renderDayCreateHitAreas()}
        {showCreateHoverOverlay ? (
          <span
            className="pointer-events-none absolute inset-x-0 z-0 flex items-center justify-start bg-sky-200/50 pl-1 dark:bg-sky-500/22"
            style={{ top: hoveredSubSlotTop, height: `${100 / daySubSlotCount}%` }}
          >
            <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-100">+{hoveredMinuteSuffixLabel}</span>
          </span>
        ) : null}
        {layout === "day"
          ? appointmentsStartingInCell.map((item) => renderAppointmentBlock(item))
          : appointment && appointmentStartsHere
            ? renderAppointmentBlock(appointment)
            : null}
        {!appointment && timeOff && timeOffLabelStartsHere ? (
          <div className="relative z-0 flex h-full items-center truncate pl-7 pr-1 text-[10px] font-medium">
            {timeOff.title || getTimeOffTypeLabelRu(timeOff.type)}
          </div>
        ) : null}
        {!appointment && !timeOff && onBreak ? (
          <div className="relative z-0 flex h-full items-center truncate pl-7 pr-1 text-[10px]">
            {onBreak.title || "Перерыв"}
          </div>
        ) : null}
        {!appointment && !timeOff && !onBreak && holiday && !workOverride ? (
          <div className="relative z-0 flex h-full items-center truncate pl-7 pr-1 text-[10px]">
            {holiday.title}
          </div>
        ) : null}
      </div>
    );
  };

  const getWeekTimelineRowContext = (day: Date, minuteOfDay: number, durationMin = weekTimelineStepMin) => {
    const cellStart = createCellDate(day, minuteOfDay);
    const cellEnd = new Date(cellStart);
    cellEnd.setMinutes(cellEnd.getMinutes() + durationMin);
    const dayKey = toDateKeyLocal(day);
    const weekday = day.getDay();
    const bucketMinutes = getTimelineBucketMinutes(minuteOfDay, durationMin, BOOKING_STEP_MIN);
    const holiday = blockingHolidayByDateKey.get(dayKey);
    const appointmentsById = new Map<string, BookingAppointment>();
    const timeOffById = new Map<string, BookingTimeOff>();
    const breaksById = new Map<string, BookingBreakRule>();
    const availableCandidatesByKey = new Map<string, AvailableSlotCandidate>();

    for (const bucketMinute of bucketMinutes) {
      const bucketDayMinuteKey = dayMinuteKeyLocal(dayKey, bucketMinute);
      for (const appointment of appointmentsOverlappingByDayMinuteKey.get(bucketDayMinuteKey) || []) {
        if (!isAppointmentVisible(appointment)) continue;
        appointmentsById.set(appointment.id, appointment);
      }
      for (const item of timeOffOverlappingByDayMinuteKey.get(bucketDayMinuteKey) || []) {
        timeOffById.set(item.id, item);
      }
      for (const employee of visibleEmployees) {
        for (const rule of getEffectiveBreakRulesForDay({
          employeeId: employee.id,
          weekday,
          dayKey,
          breakRulesByEmployee,
          workdayOverrideByEmployeeDateKey,
        })) {
          if (
            bucketMinute < rule.endMinute &&
            bucketMinute + BOOKING_STEP_MIN > rule.startMinute
          ) {
            breaksById.set(rule.id, rule);
          }
        }
      }
      for (const candidate of availableCandidatesByDayMinuteKey.get(bucketDayMinuteKey) || []) {
        availableCandidatesByKey.set(`${candidate.employeeId}|${candidate.startsAt}`, candidate);
      }
    }

    const appointmentsOverlapping = Array.from(appointmentsById.values()).sort(
      (a, b) => +new Date(a.startsAt) - +new Date(b.startsAt),
    );
    const overlappingTimeOff = Array.from(timeOffById.values()).sort(
      (a, b) => +new Date(a.startsAt) - +new Date(b.startsAt),
    );
    const overlappingBreaks = Array.from(breaksById.values()).sort((a, b) => a.startMinute - b.startMinute);
    const breakLabelText = Array.from(
      new Set(overlappingBreaks.map((item) => item.title?.trim() || "Перерыв")),
    ).join(", ");
    const availableCandidates = Array.from(availableCandidatesByKey.values()).sort(
      (a, b) => +new Date(a.startsAt) - +new Date(b.startsAt),
    );

    return {
      cellStart,
      cellEnd,
      dayKey,
      holiday,
      appointmentsOverlapping,
      overlappingTimeOff,
      overlappingBreaks,
      breakLabelText,
      availableCandidates,
      availableEmployeeCount: new Set(availableCandidates.map((candidate) => candidate.employeeId)).size,
    };
  };

  const renderWeekTimelineRow = (
    day: Date,
    minuteOfDay: number,
    options?: {
      durationMin?: number;
      isCollapsed?: boolean;
    },
  ) => {
    const rowDurationMin = options?.durationMin || weekTimelineStepMin;
    const {
      cellStart,
      cellEnd,
      holiday,
      appointmentsOverlapping,
      overlappingTimeOff,
      breakLabelText,
      availableCandidates,
      availableEmployeeCount,
    } = getWeekTimelineRowContext(day, minuteOfDay, rowDurationMin);
    const isCurrentSlot = isCurrentTimelineSlot(day, minuteOfDay, rowDurationMin);
    const canCreateInSlot = availableEmployeeCount > 0;
    const isCollapsedWeekRow = Boolean(options?.isCollapsed);
    const currentWeekRowIndex = weekTimeRowIndexByMinute.get(minuteOfDay) ?? -1;
    const previousWeekRowMinute = currentWeekRowIndex > 0 ? weekTimeRows[currentWeekRowIndex - 1] : undefined;
    const previousBreakLabelText =
      breakLabelText && previousWeekRowMinute !== undefined
        ? getWeekTimelineRowContext(day, previousWeekRowMinute, weekTimelineStepMin).breakLabelText
        : "";
    const showBreakLabel =
      Boolean(breakLabelText) &&
      appointmentsOverlapping.length === 0 &&
      overlappingTimeOff.length === 0 &&
      breakLabelText !== previousBreakLabelText;

    const weekRowTitle =
      overlappingTimeOff.length > 0
        ? overlappingTimeOff.length === 1
          ? overlappingTimeOff[0].title || getTimeOffTypeLabelRu(overlappingTimeOff[0].type)
          : `Блокировки: ${overlappingTimeOff.length}`
        : breakLabelText
          ? breakLabelText
          : holiday?.title;

    const className = cn(
      "relative h-full overflow-hidden border-t px-0.5 py-0.5",
      holiday && !canCreateInSlot ? "bg-rose-50/60 dark:bg-rose-950/35" : "bg-background/40",
      appointmentsOverlapping.length > 0 && "bg-background",
      availableEmployeeCount > 0 &&
        appointmentsOverlapping.length === 0 &&
        (!holiday || canCreateInSlot) &&
        "bg-sky-50/40 dark:bg-sky-950/25",
      isCurrentSlot && "ring-1 ring-sky-300/80 ring-inset dark:ring-sky-500/60",
    );

    if (canCreateInSlot) {
      return (
        <button
          type="button"
          className={cn(className, "group w-full text-left hover:bg-sky-100/50 dark:hover:bg-sky-900/35")}
          title="Создать запись"
          onClick={() =>
            openCreateAppointmentFromSlot({
              employeeId: availableCandidates[0]?.employeeId || null,
              startsAt: availableCandidates[0]?.startsAt || cellStart.toISOString(),
              endsAt: availableCandidates[0]?.endsAt || cellEnd.toISOString(),
              candidateSlots: availableCandidates,
            })
          }
        >
          {isCurrentSlot ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-sky-500 dark:bg-sky-400" />
          ) : null}
          <div className="flex h-full items-center">
            <span
              className="flex shrink-0 items-center justify-center text-[10px] font-semibold text-sky-800 opacity-0 transition-opacity group-hover:opacity-100 dark:text-sky-100"
              style={{ width: `${WEEK_OVERLAY_LEFT_GUTTER_PX - 2}px` }}
            >
              <Plus className="size-3 shrink-0" />
            </span>
            {showBreakLabel ? (
              <span className="min-w-0 truncate text-[10px] font-medium text-amber-800 dark:text-amber-100">
                {breakLabelText}
              </span>
            ) : null}
          </div>
        </button>
      );
    }

    return (
      <div className={className} title={weekRowTitle || undefined}>
        {isCurrentSlot ? <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-sky-500 dark:bg-sky-400" /> : null}
        {showBreakLabel ? (
          <div className="flex h-full items-center truncate px-1 text-[10px] font-medium text-amber-800 dark:text-amber-100">
            {breakLabelText}
          </div>
        ) : !isCollapsedWeekRow && holiday && appointmentsOverlapping.length === 0 ? (
          <div className="flex h-full items-center truncate px-1 text-[10px] text-rose-700 dark:text-rose-200">
            {holiday.title}
          </div>
        ) : null}
      </div>
    );
  };

  const renderWeekTimelineDayOverlay = (
    day: Date,
    getOffsetTopPx: (minuteOfDay: number) => number,
    columnHeightPx: number,
  ) => {
    const dayKey = toDateKeyLocal(day);
    const firstVisibleMinute = weekTimeRows[0];

    if (firstVisibleMinute === undefined) return null;

    const lastVisibleMinute = weekTimeRows[weekTimeRows.length - 1];
    const endVisibleMinute =
      lastVisibleMinute === undefined ? firstVisibleMinute + weekTimelineStepMin : lastVisibleMinute + weekTimelineStepMin;
    const appointmentsById = new Map<string, BookingAppointment>();

    for (const minuteOfDay of weekTimeRows) {
      const bucketMinutes = getTimelineBucketMinutes(minuteOfDay, weekTimelineStepMin, BOOKING_STEP_MIN);
      for (const bucketMinute of bucketMinutes) {
        const bucketDayMinuteKey = dayMinuteKeyLocal(dayKey, bucketMinute);
        for (const appointment of appointmentsOverlappingByDayMinuteKey.get(bucketDayMinuteKey) || []) {
          if (!isAppointmentVisible(appointment)) continue;
          appointmentsById.set(appointment.id, appointment);
        }
      }
    }

    const dayAppointments = Array.from(appointmentsById.values()).sort(
      (a, b) => +new Date(a.startsAt) - +new Date(b.startsAt),
    );
    const earliestMarkerMinuteByEmployeeId = new Map<string, number>();

    for (const appointment of dayAppointments) {
      const appointmentStartMinuteOfDay = getMinuteOfDayFromIso(appointment.startsAt);
      if (appointmentStartMinuteOfDay === null) continue;

      const currentMinStart = earliestMarkerMinuteByEmployeeId.get(appointment.employeeId);
      if (currentMinStart === undefined || appointmentStartMinuteOfDay < currentMinStart) {
        earliestMarkerMinuteByEmployeeId.set(appointment.employeeId, appointmentStartMinuteOfDay);
      }
    }

    const statusBlocks: Array<{
      employeeId: string;
      kind: "timeoff";
      label: string;
      startMinute: number;
      endMinute: number;
      itemKey: string;
    }> = [];

    for (const employee of visibleEmployees) {
      let currentStatusBlock:
        | {
            kind: "timeoff";
            label: string;
            startMinute: number;
            endMinute: number;
            itemKey: string;
          }
        | null = null;

      const flushStatusBlock = () => {
        if (!currentStatusBlock) return;
        statusBlocks.push({
          employeeId: employee.id,
          ...currentStatusBlock,
        });
        const currentEarliestMinute = earliestMarkerMinuteByEmployeeId.get(employee.id);
        if (currentEarliestMinute === undefined || currentStatusBlock.startMinute < currentEarliestMinute) {
          earliestMarkerMinuteByEmployeeId.set(employee.id, currentStatusBlock.startMinute);
        }
        currentStatusBlock = null;
      };

      for (const minuteOfDay of weekTimeRows) {
        const bucketDayMinuteKey = dayMinuteKeyLocal(dayKey, minuteOfDay);
        const employeeCellKey = employeeCellKeyLocal(employee.id, dayKey, minuteOfDay);
        const hasVisibleAppointment = (appointmentsOverlappingByDayMinuteKey.get(bucketDayMinuteKey) || []).some(
          (appointment) => appointment.employeeId === employee.id && isAppointmentVisible(appointment),
        );

        if (hasVisibleAppointment) {
          flushStatusBlock();
          continue;
        }

        const timeOff = timeOffByEmployeeCellKey.get(employeeCellKey) || globalTimeOffByCellKey.get(bucketDayMinuteKey);
        const nextStatusBlock = timeOff
          ? {
              kind: "timeoff" as const,
              label: timeOff.title || getTimeOffTypeLabelRu(timeOff.type),
              itemKey: `timeoff:${timeOff.id}`,
            }
          : null;

        if (!nextStatusBlock) {
          flushStatusBlock();
          continue;
        }

        if (
          currentStatusBlock &&
          currentStatusBlock.itemKey === nextStatusBlock.itemKey &&
          currentStatusBlock.kind === nextStatusBlock.kind &&
          currentStatusBlock.endMinute === minuteOfDay
        ) {
          currentStatusBlock.endMinute = minuteOfDay + weekTimelineStepMin;
          continue;
        }

        flushStatusBlock();
        currentStatusBlock = {
          ...nextStatusBlock,
          startMinute: minuteOfDay,
          endMinute: minuteOfDay + weekTimelineStepMin,
        };
      }

      flushStatusBlock();
    }

    const dayEmployeeCascadeIndexById = new Map(
      Array.from(earliestMarkerMinuteByEmployeeId.entries())
        .sort((a, b) => {
          if (a[1] !== b[1]) return a[1] - b[1];
          return (visibleEmployeeIndexById.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (visibleEmployeeIndexById.get(b[0]) ?? Number.MAX_SAFE_INTEGER);
        })
        .map(([employeeId], index) => [employeeId, Math.min(index, weekVisibleEmployeeCascadeCount - 1)] as const),
    );
    const renderedStatusBlocks = statusBlocks.map((block) => {
      const employee = employeesById.get(block.employeeId);
      const visibleStartMinute = Math.max(block.startMinute, firstVisibleMinute);
      const visibleEndMinute = Math.min(block.endMinute, endVisibleMinute);

      if (visibleEndMinute <= visibleStartMinute) return null;

      const cascadeIndex =
        dayEmployeeCascadeIndexById.get(block.employeeId) ??
        Math.min(visibleEmployeeIndexById.get(block.employeeId) ?? 0, weekVisibleEmployeeCascadeCount - 1);
      const cascadeLeftPx = WEEK_OVERLAY_LEFT_GUTTER_PX + cascadeIndex * WEEK_OVERLAY_CASCADE_OFFSET_PX;
      const blockTopPx = 0.5 + Math.round(getOffsetTopPx(visibleStartMinute));
      const blockBottomPx = Math.min(columnHeightPx, Math.max(blockTopPx + 12, Math.round(getOffsetTopPx(visibleEndMinute))));
      const blockHeightPx = Math.max(12, blockBottomPx - blockTopPx - 2);

      return (
        <div
          key={`${dayKey}-${block.itemKey}-${block.employeeId}-${block.startMinute}`}
          className={cn(
            "pointer-events-none absolute right-0.5 z-10 overflow-hidden px-1 py-0.5 text-left",
            "flex min-w-0 items-center justify-start text-[10px] font-medium leading-none",
            block.kind === "timeoff"
              ? "bg-amber-50 text-amber-900 dark:bg-amber-950/45 dark:text-amber-100"
              : "bg-amber-50/60 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
          )}
          style={{
            left: `${cascadeLeftPx}px`,
            top: `${blockTopPx}px`,
            height: `${blockHeightPx}px`,
            zIndex: 10 + cascadeIndex,
          }}
          title={`${employee?.name || "Сотрудник"} · ${block.label}`}
        >
          <span className="min-w-0 truncate">{block.label}</span>
        </div>
      );
    });

    const renderedAppointments = dayAppointments.map((appointment) => {
      const employee = employeesById.get(appointment.employeeId);
      const startsAt = new Date(appointment.startsAt);
      const endsAt = new Date(appointment.endsAt);

      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;
      if (toDateKeyLocal(startsAt) !== dayKey) return null;

      const appointmentStartMinuteOfDay = startsAt.getHours() * 60 + startsAt.getMinutes();
      const appointmentEndMinuteOfDay = endsAt.getHours() * 60 + endsAt.getMinutes();
      const visibleStartMinute = Math.max(appointmentStartMinuteOfDay, firstVisibleMinute);
      const visibleEndMinute = Math.min(appointmentEndMinuteOfDay, endVisibleMinute);

      if (visibleEndMinute <= visibleStartMinute) return null;

      const appointmentSurfaceClassName = getAppointmentSurfaceClassName(appointment.status);
      const usesStatusSurface = Boolean(appointmentSurfaceClassName);
      const cascadeIndex =
        dayEmployeeCascadeIndexById.get(appointment.employeeId) ??
        Math.min(visibleEmployeeIndexById.get(appointment.employeeId) ?? 0, weekVisibleEmployeeCascadeCount - 1);
      const cascadeLeftPx = WEEK_OVERLAY_LEFT_GUTTER_PX + cascadeIndex * WEEK_OVERLAY_CASCADE_OFFSET_PX;
      const appointmentBlockTopPx = 0.5 + Math.round(getOffsetTopPx(visibleStartMinute));
      const appointmentBlockBottomPx = Math.min(columnHeightPx, Math.max(appointmentBlockTopPx + 12, Math.round(getOffsetTopPx(visibleEndMinute))));
      const appointmentBlockHeightPx = Math.max(12, appointmentBlockBottomPx - appointmentBlockTopPx - 2);
      const showWrapIcon = appointmentStartMinuteOfDay < firstVisibleMinute;
      const appointmentTimeRangeLabel = `${formatMinuteLabel(appointmentStartMinuteOfDay)}-${formatMinuteLabel(appointmentEndMinuteOfDay)}`;

      return (
        <button
          type="button"
          key={`${dayKey}-${appointment.id}`}
          className={cn(
            "absolute right-0.5 z-20 overflow-hidden rounded-[4px] border px-1 py-0.5 text-left shadow-sm",
            "flex min-w-0 flex-col items-start justify-start",
            appointmentSurfaceClassName || "text-white hover:brightness-95",
          )}
          style={{
            ...(usesStatusSurface
              ? {}
              : {
                  backgroundColor: employee?.color || "#0ea5e9",
                  borderColor: employee?.color || "#0ea5e9",
                }),
            left: `${cascadeLeftPx}px`,
            top: `${appointmentBlockTopPx}px`,
            height: `${appointmentBlockHeightPx}px`,
            zIndex: 20 + cascadeIndex,
          }}
          title={`${employee?.name || "Сотрудник"} · ${appointment.clientName}${formatAppointmentPhoneDisplay(appointment.clientPhone) ? ` · ${formatAppointmentPhoneDisplay(appointment.clientPhone)}` : ""
            }`}
          onClick={() => openExistingAppointmentDialog(appointment)}
        >
          <span className="flex min-w-0 items-center gap-1 text-[9px] font-semibold leading-none opacity-90">
            {showWrapIcon ? <CornerDownRight className="size-2.5 shrink-0" /> : null}
            <AppointmentStatusInline
              status={appointment.status}
              showLabel={false}
              iconClassName="size-2.5 shrink-0"
            />
            <span className="min-w-0 truncate">{appointmentTimeRangeLabel}</span>
          </span>
          <span className="min-w-0 truncate text-[10px] font-medium leading-none opacity-85">
            {appointment.clientName}
          </span>
        </button>
      );
    });

    return [...renderedStatusBlocks, ...renderedAppointments];
  };

  return (
    <div className="h-[100dvh] overflow-hidden">
      <div className="grid h-full min-h-0 min-[1100px]:grid-cols-[248px_minmax(0,1fr)] min-[1400px]:grid-cols-[264px_minmax(0,1fr)]">
        <Card className="min-w-0 h-full min-h-0 gap-3 overflow-hidden border-border/80 py-4">
          <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 min-[1400px]:px-4">
            <Tabs value={view} onValueChange={(value) => setView(value as BookingView)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="day">День</TabsTrigger>
                <TabsTrigger value="week">Неделя</TabsTrigger>
                <TabsTrigger value="month">Месяц</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="rounded-lg">
              <Calendar
                mode="single"
                locale={ru}
                selected={anchorDate}
                onSelect={(date) => date && setAnchorDate(date)}
                month={anchorDate}
                onMonthChange={setAnchorDate}
                className="mx-auto rounded-lg [--cell-size:2.05rem] min-[1100px]:[--cell-size:2.2rem] min-[1400px]:[--cell-size:2.45rem]"
              />
            </div>

            <div className="space-y-2">
              <Tabs
                value={directoryTab}
                onValueChange={(value) => setDirectoryTab(value as "employees" | "services")}
                className="space-y-2"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="employees">Сотрудники</TabsTrigger>
                  <TabsTrigger value="services">Услуги</TabsTrigger>
                </TabsList>

                <TabsContent value="employees" className="mt-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Сотрудники</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={openCreateEmployeeDialog}
                        title="Создать сотрудника"
                        aria-label="Создать сотрудника"
                      >
                        <Plus className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => openScheduleDialog(visibleEmployees[0]?.id || employees[0]?.id)}
                        disabled={!employees.length}
                        title="График"
                        aria-label="График"
                      >
                        <Clock3 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md">
                    <div className="space-y-1 p-1">
                      {employees.length === 0 ? (
                        <div className="text-muted-foreground px-2 py-6 text-center text-sm">
                          Нет сотрудников. Создайте первого, чтобы открыть слоты записи.
                        </div>
                      ) : (
                        employees.map((employee) => {
                          const checked = selectedSet.has(employee.id);
                          const displayName = truncateText(employee.name || "Сотрудник", EMPLOYEE_NAME_MAX_LENGTH);
                          const specialtyLabel = truncateText(
                            employee.specialty || "Без специализации",
                            EMPLOYEE_SPECIALTY_MAX_LENGTH,
                          );

                          return (
                            <div
                              key={employee.id}
                              className="group hover:bg-accent flex items-start gap-2 rounded-sm bg-muted px-2 py-2"
                            >
                              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => toggleEmployee(employee.id, value === true)}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium">{displayName}</div>
                                  <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                                    <span
                                      className="inline-block size-2.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: employee.color || getEmployeeColorFallback(employee.id) }}
                                    />
                                    <span className="truncate">{specialtyLabel}</span>
                                    <Badge
                                      variant="outline"
                                      className="h-4 shrink-0 rounded-sm px-1 text-[10px] font-normal leading-none"
                                    >
                                      {employee.slotDurationMin}м
                                    </Badge>
                                  </div>
                                  {employee.description ? (
                                    <div className="text-muted-foreground mt-1 max-h-8 overflow-hidden text-[11px] leading-4">
                                      {employee.description}
                                    </div>
                                  ) : null}
                                </div>
                              </label>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                title="Редактировать сотрудника"
                                aria-label="Редактировать сотрудника"
                                onClick={() => openEditEmployeeDialog(employee)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="services" className="mt-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Услуги</Label>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={openCreateServiceDialog}
                      title="Создать услугу"
                      aria-label="Создать услугу"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>

                  <div className="rounded-md">
                    <div className="space-y-1 p-1">
                      {services.length === 0 ? (
                        <div className="text-muted-foreground px-2 py-6 text-center text-sm">
                          Нет услуг. Добавьте первую, чтобы настроить базовую и персональные цены.
                        </div>
                      ) : (
                        services.map((service) => {
                          const activePrices = service.prices.filter((item) => item.isActive && item.price > 0);
                          const effectivePricePoints = [
                            ...(service.basePrice > 0 ? [service.basePrice] : []),
                            ...activePrices.map((item) => item.price),
                          ];
                          const minPrice = effectivePricePoints.length ? Math.min(...effectivePricePoints) : null;
                          const serviceTypeLabel =
                            getServiceAppointmentTypeLabel(service.serviceType) || "Тип не задан";

                          return (
                            <div
                              key={service.id}
                              className={cn(
                                "group hover:bg-accent rounded-md border border-border/60 bg-muted/35 px-2.5 py-2 transition-colors",
                                !service.isActive && "opacity-65",
                              )}
                            >
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium leading-5">{service.name}</div>
                                  <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-4">
                                    <span>{formatDurationRu(service.durationMin)}</span>
                                    <span>•</span>
                                    <span>{serviceTypeLabel}</span>
                                    <span>•</span>
                                    <span>
                                      от <span className="text-foreground font-medium">{minPrice !== null ? `${minPrice} ₸` : "не задана"}</span>
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                  title="Редактировать услугу"
                                  aria-label="Редактировать услугу"
                                  onClick={() => openEditServiceDialog(service)}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 h-full min-h-0 rounded-xl bg-background p-1">
          <Tabs
            value={contentTab}
            onValueChange={(value) => setContentTab(value as "calendar" | "list")}
            className="h-full min-h-0 space-y-1.5"
          >
            <div className="flex justify-end">
              <TabsList className="grid w-[220px] grid-cols-2">
                <TabsTrigger value="calendar">Календарь</TabsTrigger>
                <TabsTrigger value="list">Список</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="calendar" className="mt-0 min-h-0 overflow-hidden">
              <div className="flex h-full min-h-0 flex-col px-0 pt-0">
                {view === "month" ? (
                  <div className="h-full min-h-0 overflow-auto px-4 pb-4">
                    <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
                      {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                        <div key={day} className="py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-2">
                      {monthDays.map((day) => {
                        const dayKey = toDateKeyLocal(day);
                        const stat = monthStats.get(dayKey);
                        const appointmentsCount = stat?.appointments || 0;
                        const freeSlotsCount = stat?.availableSlots || 0;
                        const dayHolidays = holidaysByDateKey.get(dayKey) || [];
                        const blockedDayHolidays = blockedHolidaysByDateKey.get(dayKey) || [];
                        const hasBlockingHoliday = blockedDayHolidays.length > 0;
                        const hasWorkingHoliday = dayHolidays.some((holiday) => holiday.isWorkingDayOverride);
                        const holidayTitle = dayHolidays
                          .map((holiday) => `${holiday.title}${holiday.isWorkingDayOverride ? " (с записью)" : ""}`)
                          .join(", ");
                        const primaryHoliday = dayHolidays[0];
                        const isToday = toDateKeyLocal(day) === toDateKeyLocal(new Date());
                        return (
                          <button
                            key={day.toISOString()}
                            type="button"
                            onClick={() => {
                              setAnchorDate(day);
                              setView("day");
                              setContentTab("calendar");
                            }}
                            className={cn(
                              "min-h-24 rounded-xl border bg-background p-2 text-left transition hover:border-slate-400 hover:bg-muted/20 dark:hover:border-border",
                              !isSameMonth(day, anchorDate) && "opacity-45",
                              isToday && "border-slate-900 shadow-sm dark:border-white/25",
                              hasBlockingHoliday && "border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/30",
                              !hasBlockingHoliday &&
                                hasWorkingHoliday &&
                                "border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/25",
                            )}>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm font-semibold">{day.getDate()}</span>
                              <div className="flex items-center gap-1">
                                {dayHolidays.length > 0 ? (
                                  <span
                                    className={cn(
                                      "inline-block size-2 rounded-full",
                                      hasBlockingHoliday ? "bg-rose-500 dark:bg-rose-400" : "bg-amber-500 dark:bg-amber-300",
                                    )}
                                    title={holidayTitle}
                                  />
                                ) : null}
                                {isToday ? <Badge variant="outline">Сегодня</Badge> : null}
                              </div>
                            </div>
                            <div className="pt-1">
                              {primaryHoliday ? (
                                <div
                                  className={cn(
                                    "mb-1 truncate rounded-md px-2 py-1 text-[10px] font-medium",
                                    hasBlockingHoliday
                                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-100"
                                      : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
                                  )}
                                  title={holidayTitle}
                                >
                                  {primaryHoliday.title}
                                  {primaryHoliday.isWorkingDayOverride ? " (с записью)" : ""}
                                  {dayHolidays.length > 1 ? ` +${dayHolidays.length - 1}` : ""}
                                </div>
                              ) : null}
                              <div className="rounded-md bg-card px-2 py-1 text-[11px]">
                                <span className="text-muted-foreground">Записано:</span>{" "}
                                <span className="font-semibold text-foreground">{appointmentsCount}</span>
                                <span className="text-muted-foreground"> Свободно:</span>{" "}
                                <span className="font-semibold text-foreground">{freeSlotsCount}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : view === "week" ? (
                  <WeekTimeline
                    visibleEmployees={visibleEmployees}
                    dayListForTimeline={dayListForTimeline}
                    timeRows={weekTimeRows}
                    weekGridMinWidth={weekGridMinWidth}
                    weekTimeColumnWidth={weekTimeColumnWidth}
                    weekDaysCount={weekDaysCount}
                    weekDayMinColumnWidth={weekDayMinColumnWidth}
                    weekHeaderTitle={weekHeaderTitle}
                    weekHeaderSubtitle={weekHeaderSubtitle}
                    weekTimeRowClass={weekTimeRowClass}
                    weekRowHeightPx={WEEK_SLOT_HEIGHT_PX}
                    holidaysByDateKey={holidaysByDateKey}
                    toDateKeyLocal={toDateKeyLocal}
                    weekdayShortRu={WEEKDAY_LONG_RU}
                    weekDayEmployeeLabelByDateKey={weekDayEmployeeLabelByDateKey}
                    weekCollapsedRangeByMinute={weekCollapsedRangeByMinute}
                    headerControls={renderAppointmentVisibilityToggles("justify-end")}
                    formatMinuteLabel={formatMinuteLabel}
                    renderWeekTimelineRow={renderWeekTimelineRow}
                    renderWeekTimelineDayOverlay={renderWeekTimelineDayOverlay}
                  />
                ) : (
                  <DayTimeline
                    dayListForTimeline={dayListForTimeline}
                    visibleEmployees={visibleEmployees}
                    timeRows={dayTimeRows}
                    holidaysByDateKey={holidaysByDateKey}
                    toDateKeyLocal={toDateKeyLocal}
                    weekdayShortRu={WEEKDAY_SHORT_RU}
                    headerControls={renderAppointmentVisibilityToggles("justify-end")}
                    dayCollapsedRangeByDayMinuteKey={dayCollapsedRangeByDayMinuteKey}
                    daySubSlotCount={daySubSlotCount}
                    dayTimeColumnWidth={dayTimeColumnWidth}
                    dayEmployeeMinColumnWidth={dayEmployeeMinColumnWidth}
                    dayTimeRowClass={dayTimeRowClass}
                    daySlotHeightClass={daySlotHeightClass}
                    formatMinuteLabel={formatMinuteLabel}
                    isAutoScrollTimeRow={isAutoScrollTimeRow}
                    renderTimelineCell={renderTimelineCell}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="list" className="mt-0 min-h-0 overflow-hidden">
              <Card className="h-full min-h-0 border-border/80 bg-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Список записей {view === "day" ? "на день" : "в диапазоне"}</CardTitle>
                  <CardDescription>Клик по карточке открывает просмотр, а справа доступен быстрый переход на следующий статус</CardDescription>
                  {renderAppointmentVisibilityToggles("pt-1")}
                </CardHeader>
                <CardContent className="min-h-0 flex-1 overflow-auto">
                  <div className="space-y-2">
                    {visibleSelectedDayAppointments.length === 0 ? (
                      <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
                        Пока нет записей в выбранном диапазоне.
                      </div>
                    ) : (
                      visibleSelectedDayAppointments.slice(0, 20).map((appointment) => {
                        const employee = employeesById.get(appointment.employeeId);
                        const appointmentSurfaceClassName = getAppointmentSurfaceClassName(appointment.status);
                        return (
                          <div
                            key={appointment.id}
                            className={cn(
                              "focus-visible:ring-ring flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2",
                              appointmentSurfaceClassName
                                ? appointmentSurfaceClassName
                                : "bg-card hover:bg-accent/40",
                            )}
                            role="button"
                            tabIndex={0}
                            onClick={() => openExistingAppointmentDialog(appointment)}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              openExistingAppointmentDialog(appointment);
                            }}
                            title="Открыть запись"
                            aria-label={`Открыть запись ${appointment.clientName || "Без имени"}`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block size-2.5 rounded-full"
                                  style={{ backgroundColor: employee?.color || "#0ea5e9" }}
                                />
                                <span className="truncate font-medium">{appointment.clientName}</span>
                                <Badge variant="outline" className="gap-1 bg-background/80 dark:bg-background/20">
                                  <AppointmentStatusInline
                                    status={appointment.status}
                                    className={cn(
                                      "text-[11px]",
                                      appointmentSurfaceClassName
                                        ? getAppointmentMutedTextClassName(appointment.status)
                                        : "text-foreground dark:text-foreground",
                                    )}
                                  />
                                </Badge>
                              </div>
                              <div className="text-muted-foreground mt-1 text-xs">
                                {new Date(appointment.startsAt).toLocaleString("ru-RU", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {" · "}
                                {employee?.name || appointment.employeeId}
                                {formatAppointmentPhoneDisplay(appointment.clientPhone)
                                  ? ` · ${formatAppointmentPhoneDisplay(appointment.clientPhone)}`
                                  : ""}
                              </div>
                              {appointment.clientIin ? (
                                <div className="text-muted-foreground mt-1 text-xs">
                                  ИИН: {appointment.clientIin}
                                  {appointment.clientBirthDate ? ` · ДР: ${appointment.clientBirthDate}` : ""}
                                  {appointment.clientGender ? ` · Пол: ${getGenderLabelRu(appointment.clientGender)}` : ""}
                                </div>
                              ) : null}
                            </div>
                            {getNextAppointmentStatus(appointment.status) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={appointmentStatusSavingId === appointment.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void advanceAppointmentStatus(appointment);
                                }}
                              >
                                {appointmentStatusSavingId === appointment.id
                                  ? "Сохраняю..."
                                  : getAdvanceStatusActionLabelRu(appointment.status)}
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" disabled>
                                {getStatusLabelRu(appointment.status)}
                              </Button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog
        open={Boolean(pendingCalendarAdjustment)}
        onOpenChange={(open) => {
          if (!open && !pendingCalendarAdjustmentSaving) {
            setPendingCalendarAdjustment(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingCalendarAdjustment?.kind === "move"
                ? "Подтвердить перенос записи"
                : "Подтвердить изменение длительности"}
            </DialogTitle>
            <DialogDescription>
              Проверьте сотрудника, клиента и новое время перед сохранением.
            </DialogDescription>
          </DialogHeader>
          {pendingCalendarAdjustment ? (
            <div className="grid gap-3 text-sm">
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="text-muted-foreground text-xs">Клиент</div>
                <div className="font-medium">{pendingCalendarAdjustment.clientName}</div>
              </div>

              {pendingCalendarAdjustment.kind === "move" ? (
                <>
                  <div className="rounded-lg border px-3 py-2">
                    <div className="text-muted-foreground text-xs">Было</div>
                    <div className="font-medium">{pendingCalendarAdjustment.currentEmployeeLabel}</div>
                    <div>{formatDateTimeRangeRu(pendingCalendarAdjustment.currentStartsAt, pendingCalendarAdjustment.currentEndsAt)}</div>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 dark:border-sky-900/70 dark:bg-sky-950/35">
                    <div className="text-xs text-sky-700 dark:text-sky-200">Станет</div>
                    <div className="font-medium text-sky-950 dark:text-sky-100">{pendingCalendarAdjustment.nextEmployeeLabel}</div>
                    <div className="text-sky-900 dark:text-sky-100">
                      {formatDateTimeRangeRu(pendingCalendarAdjustment.nextStartsAt, pendingCalendarAdjustment.nextEndsAt)}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <div className="text-muted-foreground text-xs">Сотрудник</div>
                    <div className="font-medium">{pendingCalendarAdjustment.employeeLabel}</div>
                  </div>
                  <div className="rounded-lg border px-3 py-2">
                    <div className="text-muted-foreground text-xs">Было</div>
                    <div>{formatDateTimeRangeRu(pendingCalendarAdjustment.currentStartsAt, pendingCalendarAdjustment.currentEndsAt)}</div>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 dark:border-sky-900/70 dark:bg-sky-950/35">
                    <div className="text-xs text-sky-700 dark:text-sky-200">Станет</div>
                    <div className="text-sky-900 dark:text-sky-100">
                      {formatDateTimeRangeRu(pendingCalendarAdjustment.nextStartsAt, pendingCalendarAdjustment.nextEndsAt)}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingCalendarAdjustment(null)}
              disabled={pendingCalendarAdjustmentSaving}
            >
              Отмена
            </Button>
            <Button onClick={confirmPendingCalendarAdjustment} disabled={pendingCalendarAdjustmentSaving}>
              {pendingCalendarAdjustmentSaving ? "Сохраняю..." : "Подтверждаю"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingAppointmentCancellation)}
        onOpenChange={(open) => {
          if (!open && !pendingAppointmentCancellationSaving) {
            setPendingAppointmentCancellation(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить запись</DialogTitle>
            <DialogDescription>
              Запись будет отменена и исчезнет из активного календаря.
            </DialogDescription>
          </DialogHeader>
          {pendingAppointmentCancellation ? (
            <div className="grid gap-3 text-sm">
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="text-muted-foreground text-xs">Клиент</div>
                <div className="font-medium">{pendingAppointmentCancellation.clientName || "Без имени"}</div>
              </div>
              <div className="rounded-lg border px-3 py-2">
                <div className="text-muted-foreground text-xs">Сотрудник</div>
                <div className="font-medium">
                  {employeesById.get(pendingAppointmentCancellation.employeeId)?.name || pendingAppointmentCancellation.employeeId}
                </div>
              </div>
              <div className="rounded-lg border px-3 py-2">
                <div className="text-muted-foreground text-xs">Время</div>
                <div>{formatDateTimeRangeRu(pendingAppointmentCancellation.startsAt, pendingAppointmentCancellation.endsAt)}</div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingAppointmentCancellation(null)}
              disabled={pendingAppointmentCancellationSaving}
            >
              Нет
            </Button>
            <Button
              variant="destructive"
              onClick={confirmAppointmentCancellation}
              disabled={pendingAppointmentCancellationSaving}
            >
              {pendingAppointmentCancellationSaving ? "Удаляю..." : "Да, удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppointmentDialog
        open={appointmentDialogOpen}
        onOpenChange={handleAppointmentDialogOpenChange}
        mode={appointmentDialogMode}
        onStartEdit={startEditingAppointmentFromDialog}
        onRequestDelete={
          appointmentDialogMode === "view" && activeDialogAppointment
            ? () => requestAppointmentCancellation(activeDialogAppointment)
            : undefined
        }
        appointmentStatus={appointmentStatusDraft}
        appointmentStatusLabel={getStatusLabelRu(appointmentStatusDraft)}
        paymentStatusLabel={getPaymentStatusLabelRu(dialogPaymentStatus)}
        paymentMethodOptions={PAYMENT_METHOD_OPTIONS}
        statusOptions={APPOINTMENT_STATUS_OPTIONS}
        onStatusChange={setAppointmentStatusDraft}
        onAdvanceStatus={
          appointmentDialogMode === "view" && activeDialogAppointment && getNextAppointmentStatus(appointmentStatusDraft)
            ? () => void advanceAppointmentStatus(activeDialogAppointment)
            : undefined
        }
        nextStatusActionLabel={getAdvanceStatusActionLabelRu(appointmentStatusDraft)}
        statusActionSaving={Boolean(activeDialogAppointment && appointmentStatusSavingId === activeDialogAppointment.id)}
        slotDraft={slotDraft}
        employees={employees}
        appointmentPreviewStartIso={appointmentPreviewStartIso}
        appointmentPreviewEndIso={appointmentPreviewEndIso}
        appointmentDurationMin={appointmentDurationMin}
        appointmentDurationInput={appointmentDurationInput}
        appointmentDurationStepMin={
          appointmentDialogMode === "create" ? appointmentDurationStepMin : BOOKING_STEP_MIN
        }
        formatDurationRu={formatDurationRu}
        durationPresets={appointmentDurationPresets}
        appointmentForm={appointmentForm}
        serviceAmountInput={{
          value: appointmentServiceAmountInput,
          onChange: handleAppointmentServiceAmountInputChange,
          onBlur: handleAppointmentServiceAmountInputBlur,
        }}
        prepaidAmountInput={{
          value: appointmentPrepaidAmountInput,
          onChange: handleAppointmentPrepaidAmountInputChange,
          onBlur: handleAppointmentPrepaidAmountInputBlur,
        }}
        serviceOptions={appointmentServiceOptions}
        clientOptions={appointmentClientOptions}
        selectedClientLabel={
          selectedAppointmentClient
            ? appointmentClientOptions.find((item) => item.value === selectedAppointmentClient.id)?.label || selectedAppointmentClient.fullName
            : null
        }
        selectedServiceLabel={
          activeDialogAppointment?.serviceNameSnapshot
            ? `${activeDialogAppointment.serviceNameSnapshot}${activeDialogAppointment.serviceDurationMinSnapshot ? ` · ${formatDurationRu(activeDialogAppointment.serviceDurationMinSnapshot)}` : ""}`
            : selectedAppointmentService
              ? `${selectedAppointmentService.name} · ${formatDurationRu(selectedAppointmentService.durationMin)}`
              : null
        }
        onClientChange={handleAppointmentClientChange}
        onCreateClient={handleAppointmentClientCreate}
        onServiceChange={handleAppointmentServiceChange}
        onOpenCreateService={openCreateServiceDialog}
        onOpenEditService={(serviceId) => {
          const service = servicesById.get(serviceId);
          if (service) openEditServiceDialog(service);
        }}
        showClientFields={appointmentDialogMode === "view" || appointmentClientDetailsOpen}
        patchAppointmentForm={patchAppointmentForm}
        appointmentIinPreview={appointmentIinPreview}
        getGenderLabelRu={getGenderLabelRu}
        onSlotEmployeeChange={handleAppointmentSlotEmployeeChange}
        startTimeOptions={appointmentStartTimeOptions}
        onStartTimeChange={handleAppointmentStartTimeChange}
        onDurationPresetSelect={handleAppointmentDurationPresetSelect}
        onDurationInputChange={handleAppointmentDurationInputChange}
        onDurationInputBlur={handleAppointmentDurationInputBlur}
        normalizeIin={normalizeIin}
        normalizePhoneInput={normalizeAppointmentPhoneInput}
        onSubmit={submitAppointment}
        saving={appointmentSaving}
      />

      <Dialog open={employeeDialogOpen} onOpenChange={handleEmployeeDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{employeeDialogMode === "edit" ? "Редактировать сотрудника" : "Новый сотрудник"}</DialogTitle>
            <DialogDescription>
              {employeeDialogMode === "edit"
                ? "Измените данные сотрудника и сохраните."
                : "После создания автоматически добавится базовый график: Пн-Пт 09:00-18:00."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Имя</Label>
              <Input value={employeeForm.name} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Специализация</Label>
              <Input value={employeeForm.specialty} onChange={(e) => setEmployeeForm((prev) => ({ ...prev, specialty: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Фото</Label>
              <Input
                value={employeeForm.photoUrl}
                placeholder="https://..."
                onChange={(e) => setEmployeeForm((prev) => ({ ...prev, photoUrl: e.target.value }))}
              />
              <div className="text-muted-foreground text-xs">Можно указать ссылку на фото сотрудника.</div>
            </div>
            <div className="grid gap-2">
              <Label>Описание</Label>
              <Textarea
                value={employeeForm.description}
                placeholder="Кратко о сотруднике, опыте или направлении"
                onChange={(e) => setEmployeeForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Слот (мин)</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={employeeSlotDurationInput}
                onChange={(e) => {
                  const digits = digitsOnly(e.target.value);
                  setEmployeeSlotDurationInput(digits);
                  if (!digits) {
                    setEmployeeForm((prev) => ({
                      ...prev,
                      slotDurationMin: 0,
                    }));
                    return;
                  }

                  const next = Number(digits);
                  setEmployeeForm((prev) => ({
                    ...prev,
                    slotDurationMin: Number.isFinite(next) ? next : 0,
                  }));
                }}
              />
              <div className="text-muted-foreground text-xs">От 5 до 720 минут, шаг 5 минут.</div>
            </div>
            <div className="grid gap-2">
              <Label>Ставка</Label>
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <select
                  className="border-input bg-background h-9 rounded-md border pl-3 pr-10 text-sm"
                  value={employeeForm.compensationType}
                  onChange={(e) => {
                    const nextCompensationType = e.target.value as BookingCompensationType;
                    setEmployeeForm((prev) => ({
                      ...prev,
                      compensationType: nextCompensationType,
                      compensationValue: clampEmployeeCompensationValue(prev.compensationValue, nextCompensationType),
                    }));
                    setEmployeeCompensationValueInput((prev) => {
                      if (!prev) return prev;
                      const digits = digitsOnly(prev);
                      const normalizedValue = clampEmployeeCompensationValue(
                        digits ? Number(digits) : 0,
                        nextCompensationType,
                      );
                      return String(normalizedValue);
                    });
                  }}
                >
                  <option value="percent">{COMPENSATION_TYPE_LABEL_RU.percent}</option>
                  <option value="fixed">{COMPENSATION_TYPE_LABEL_RU.fixed}</option>
                </select>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={employeeCompensationValueInput}
                    className="pr-10"
                    onChange={(e) => {
                      const digits = digitsOnly(e.target.value);
                      if (!digits) {
                        setEmployeeCompensationValueInput("");
                        setEmployeeForm((prev) => ({
                          ...prev,
                          compensationValue: 0,
                        }));
                        return;
                      }

                      const normalizedValue = clampEmployeeCompensationValue(Number(digits));
                      setEmployeeCompensationValueInput(String(normalizedValue));
                      setEmployeeForm((prev) => ({
                        ...prev,
                        compensationValue: normalizedValue,
                      }));
                    }}
                  />
                  <span className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                    {employeeForm.compensationType === "percent" ? "%" : "₸"}
                  </span>
                </div>
              </div>
              <div className="text-muted-foreground text-xs">
                {employeeForm.compensationType === "percent"
                  ? "Процент с приема, не больше 100%"
                  : "Фиксированная выплата за прием в тенге"}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Цвет сотрудника</Label>
              <div className="flex flex-wrap gap-2">
                {EMPLOYEE_COLOR_POOL.map((color) => {
                  const selected = employeeForm.color.toUpperCase() === color.toUpperCase();
                  return (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "size-7 rounded-full border transition-transform hover:scale-105",
                        selected
                          ? "ring-2 ring-offset-2 ring-offset-background ring-slate-500 border-slate-700 dark:ring-slate-300 dark:border-slate-400"
                          : "border-slate-200 dark:border-slate-700",
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Выбрать цвет ${color}`}
                      title={color}
                      onClick={() => setEmployeeForm((prev) => ({ ...prev, color }))}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleEmployeeDialogOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={submitEmployee} disabled={employeeSaving}>
              {employeeSaving ? "Сохраняю..." : employeeDialogMode === "edit" ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={serviceDialogOpen} onOpenChange={handleServiceDialogOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{serviceDialogMode === "edit" ? "Редактировать услугу" : "Новая услуга"}</DialogTitle>
            <DialogDescription>
              У услуги есть базовая цена. Персональные цены сотрудников работают как оверрайд поверх нее.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
              <div className="grid gap-2">
                <Label>Название</Label>
                <Input
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Активна</Label>
                <div className="flex h-10 items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3">
                  <span className="text-sm">Показывать в записи</span>
                  <Switch
                    checked={serviceForm.isActive}
                    onCheckedChange={(checked) =>
                      setServiceForm((prev) => ({
                        ...prev,
                        isActive: checked,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
              <div className="grid gap-2">
                <Label>Тип записи</Label>
                <select
                  className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                  value={serviceForm.serviceType}
                  onChange={(e) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      serviceType: e.target.value as BookingAppointmentType,
                    }))
                  }
                >
                  {SERVICE_APPOINTMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Длительность (мин)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={serviceForm.durationInput}
                  onChange={(e) => {
                    const digits = digitsOnly(e.target.value);
                    setServiceForm((prev) => ({
                      ...prev,
                      durationInput: digits,
                      durationMin: digits ? Number(digits) : 0,
                    }));
                  }}
                  onBlur={() => {
                    const normalized = clampAppointmentDurationMin(
                      serviceForm.durationInput,
                      FALLBACK_APPOINTMENT_DURATION_MIN,
                    );
                    setServiceForm((prev) => ({
                      ...prev,
                      durationMin: normalized,
                      durationInput: String(normalized),
                    }));
                  }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
              <div className="grid gap-2">
                <Label>Базовая цена</Label>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="numeric"
                    className="pr-8"
                    value={serviceForm.basePriceInput}
                    placeholder="0"
                    onChange={(e) => {
                      const digits = digitsOnly(e.target.value);
                      if (!digits) {
                        setServiceForm((prev) => ({
                          ...prev,
                          basePrice: 0,
                          basePriceInput: "",
                        }));
                        return;
                      }

                      const nextPrice = Math.max(0, Math.round(Number(digits) || 0));
                      setServiceForm((prev) => ({
                        ...prev,
                        basePrice: nextPrice,
                        basePriceInput: String(nextPrice),
                      }));
                    }}
                  />
                  <span className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                    ₸
                  </span>
                </div>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/15 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <label className="flex min-w-0 items-start gap-3">
                    <Checkbox
                      checked={serviceHasCustomPrices}
                      disabled={!employees.length}
                      onCheckedChange={(value) => handleServicePersonalPriceToggle(value === true)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">Персональные цены</span>
                      <span className="text-muted-foreground block text-xs">
                        Без персональной цены используется базовая цена.
                      </span>
                    </span>
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setServicePriceDialogOpen(true)}
                    disabled={!employees.length}
                  >
                    Выбрать
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Категория</Label>
                <Input
                  value={serviceForm.category}
                  placeholder="Консультации"
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, category: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Направление</Label>
                <Input
                  value={serviceForm.direction}
                  placeholder="Кардиология"
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, direction: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Описание</Label>
              <Textarea
                value={serviceForm.description}
                placeholder="Что входит в услугу, кому подходит и другие детали"
                onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleServiceDialogOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={submitService} disabled={serviceSaving}>
              {serviceSaving ? "Сохраняю..." : serviceDialogMode === "edit" ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={servicePriceDialogOpen} onOpenChange={setServicePriceDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Персональные цены сотрудников</DialogTitle>
            <DialogDescription>
              Отмеченные сотрудники используют свою цену и ставку. Для остальных действует базовая цена услуги.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-2 overflow-auto pr-1">
            {serviceForm.employeePrices.length === 0 ? (
              <div className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm">
                Сначала создайте хотя бы одного сотрудника, затем можно будет настроить персональные цены.
              </div>
            ) : (
              serviceForm.employeePrices.map((row) => {
                const employee = employeesById.get(row.employeeId);
                if (!employee) return null;

                return (
                  <div
                    key={`service-price-${row.employeeId}`}
                    className="grid gap-3 rounded-md border border-border/60 bg-muted/10 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_120px_130px_130px]"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <label className="mt-1">
                        <Checkbox
                          checked={row.enabled}
                          onCheckedChange={(value) => handleServicePriceToggle(row.employeeId, value === true)}
                        />
                      </label>
                      <Avatar className="size-9 border border-border/70">
                        <AvatarImage src={employee.photoUrl || undefined} alt={employee.name} />
                        <AvatarFallback className="text-[11px] font-medium">
                          {getNameInitials(employee.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{employee.name}</div>
                        <div className="text-muted-foreground truncate text-xs">
                          {employee.specialty || "Без специализации"}
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Цена</Label>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="numeric"
                          disabled={!row.enabled}
                          className="pr-8"
                          value={row.priceInput}
                          placeholder={serviceForm.basePrice > 0 ? String(serviceForm.basePrice) : "0"}
                          onChange={(e) => handleServicePriceInputChange(row.employeeId, e.target.value)}
                        />
                        <span className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                          ₸
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Ставка</Label>
                      <select
                        className="border-input bg-background h-9 rounded-md border pl-3 pr-10 text-sm"
                        value={row.compensationType}
                        disabled={!row.enabled}
                        onChange={(e) =>
                          handleServicePriceCompensationTypeChange(
                            row.employeeId,
                            e.target.value as BookingCompensationType,
                          )
                        }
                      >
                        <option value="percent">Процент</option>
                        <option value="fixed">Фикс</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">Значение ставки</Label>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="numeric"
                          disabled={!row.enabled}
                          className="pr-8"
                          value={row.compensationValueInput}
                          placeholder="0"
                          onChange={(e) =>
                            handleServicePriceCompensationValueInputChange(row.employeeId, e.target.value)
                          }
                        />
                        <span className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                          {row.compensationType === "percent" ? "%" : "₸"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServicePriceDialogOpen(false)}>
              Готово
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Регулярный график и перерывы</DialogTitle>
            <DialogDescription>
              Управляйте рабочим расписанием сотрудника, праздниками и блокировками времени.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pr-1">
            <Tabs
              value={scheduleDialogTab}
              onValueChange={(value) => setScheduleDialogTab(value as "schedule" | "exceptions")}
              className="space-y-3"
            >
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="schedule">График работ</TabsTrigger>
                <TabsTrigger value="exceptions">Праздники и отпуска</TabsTrigger>
              </TabsList>

              <TabsContent value="schedule" className="mt-0">
                <div className="mb-3 grid gap-2 sm:max-w-sm">
                  <Label>Сотрудник</Label>
                  <select
                    className="border-input bg-background h-9 rounded-md border pl-3 pr-10 text-sm"
                    value={scheduleEmployeeId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setScheduleEmployeeId(nextId);
                      loadScheduleRowsForEmployee(nextId);
                    }}>
                    {employees.length === 0 ? <option value="">Нет сотрудников</option> : null}
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} {employee.specialty ? `· ${employee.specialty}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={applyScheduleWeekdayPreset}>
                    Будни
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={applyScheduleLunchPreset}>
                    Обед
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={resetScheduleEditor}>
                    Сбросить
                  </Button>
                </div>
                <div className="rounded-lg border">
                  <div className="min-w-[980px]">
                    <div className="grid grid-cols-[170px_90px_150px_150px_90px_150px_150px] gap-0 border-b bg-muted/20 text-xs font-medium">
                      <div className="px-3 py-2">День</div>
                      <div className="px-3 py-2 text-center">Рабочий</div>
                      <div className="px-3 py-2">Начало</div>
                      <div className="px-3 py-2">Конец</div>
                      <div className="px-3 py-2 text-center">Перерыв</div>
                      <div className="px-3 py-2">Начало перерыва</div>
                      <div className="px-3 py-2">Конец перерыва</div>
                    </div>

                    <div className="divide-y">
                      {orderedScheduleRows.map((row) => (
                        <div
                          key={`schedule-${row.weekday}`}
                          className="grid grid-cols-[170px_90px_150px_150px_90px_150px_150px] items-center gap-0">
                          <div className="px-3 py-2">
                            <div className="text-sm font-medium">{WEEKDAY_LONG_RU[row.weekday]}</div>
                            {row.workEnabled && row.breakEnabled ? (
                              <Input
                                className="mt-1 h-8 text-xs"
                                value={row.breakTitle}
                                onChange={(e) => updateScheduleRow(row.weekday, { breakTitle: e.target.value })}
                                placeholder="Название перерыва"
                              />
                            ) : (
                              <div className="text-muted-foreground mt-1 text-xs">
                                {row.workEnabled ? "Без перерыва" : "Нерабочий день"}
                              </div>
                            )}
                          </div>
                          <div className="flex justify-center px-3 py-2">
                            <Checkbox
                              checked={row.workEnabled}
                              onCheckedChange={(checked) => handleWorkdayToggle(row.weekday, checked === true)}
                            />
                          </div>
                          <div className="px-3 py-2">
                            <TimePicker24h
                              disabled={!row.workEnabled}
                              value={row.workStart}
                              onChange={(value) => updateScheduleRow(row.weekday, { workStart: value })}
                              minuteStep={10}
                              placeholder="Начало"
                            />
                          </div>
                          <div className="px-3 py-2">
                            <TimePicker24h
                              disabled={!row.workEnabled}
                              value={row.workEnd}
                              onChange={(value) => updateScheduleRow(row.weekday, { workEnd: value })}
                              minuteStep={10}
                              placeholder="Конец"
                            />
                          </div>
                          <div className="flex justify-center px-3 py-2">
                            <Checkbox
                              checked={row.breakEnabled}
                              onCheckedChange={(checked) => updateScheduleRow(row.weekday, { breakEnabled: checked === true })}
                              disabled={!row.workEnabled}
                            />
                          </div>
                          <div className="px-3 py-2">
                            {row.workEnabled && row.breakEnabled ? (
                              <TimePicker24h
                                value={row.breakStart}
                                onChange={(value) => updateScheduleRow(row.weekday, { breakStart: value })}
                                minuteStep={10}
                                placeholder="Начало перерыва"
                              />
                            ) : (
                              <div className="text-muted-foreground h-9 rounded-md border border-dashed px-3 py-2 text-xs">
                                -
                              </div>
                            )}
                          </div>
                          <div className="px-3 py-2">
                            {row.workEnabled && row.breakEnabled ? (
                              <TimePicker24h
                                value={row.breakEnd}
                                onChange={(value) => updateScheduleRow(row.weekday, { breakEnd: value })}
                                minuteStep={10}
                                placeholder="Конец перерыва"
                              />
                            ) : (
                              <div className="text-muted-foreground h-9 rounded-md border border-dashed px-3 py-2 text-xs">
                                -
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">Конкретные рабочие дни</div>
                      <div className="text-muted-foreground text-xs">
                        Используются как разовые рабочие исключения и перекрывают обычный недельный график.
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCreateWorkdayOverrideDialog()}
                      disabled={!employees.length}
                    >
                      Добавить
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {scheduleWorkdayOverridePreview.length === 0 ? (
                      <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
                        Для выбранного сотрудника пока нет конкретных рабочих дней.
                      </div>
                    ) : (
                      scheduleWorkdayOverridePreview.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-md border bg-sky-50/60 px-3 py-2 text-sm dark:border-sky-900/60 dark:bg-sky-950/30"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium">{item.dateLabel}</div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                title="Редактировать рабочий день"
                                aria-label="Редактировать рабочий день"
                                onClick={() => openEditWorkdayOverrideDialog(item)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-7 text-sky-700 hover:text-sky-700 dark:text-sky-200"
                                title="Удалить рабочий день"
                                aria-label="Удалить рабочий день"
                                onClick={() => setPendingWorkdayOverrideDeletion(item)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {formatMinuteLabel(item.startMinute)} - {formatMinuteLabel(item.endMinute)}
                          </div>
                          {item.breakStartMinute !== null && item.breakEndMinute !== null ? (
                            <div className="text-muted-foreground text-xs">
                              {item.breakTitle || "Перерыв"} · {formatMinuteLabel(item.breakStartMinute)} -{" "}
                              {formatMinuteLabel(item.breakEndMinute)}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="exceptions" className="mt-0">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CalendarPlus className="size-4 text-rose-600 dark:text-rose-300" />
                        <div className="text-sm font-semibold">Праздники</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCreateHolidayDialog(toDateKeyLocal(anchorDate))}>
                        Добавить
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {scheduleHolidayPreview.length === 0 ? (
                        <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
                          Праздников пока нет.
                        </div>
                      ) : (
                        scheduleHolidayPreview.map((holiday) => (
                          <div key={holiday.id} className="rounded-md border bg-rose-50/60 px-3 py-2 text-sm dark:border-rose-900/60 dark:bg-rose-950/30">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium">{holiday.title}</div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  title="Редактировать праздник"
                                  aria-label="Редактировать праздник"
                                  onClick={() => openEditHolidayDialog(holiday)}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-rose-700 hover:text-rose-700 dark:text-rose-200"
                                  title="Удалить праздник"
                                  aria-label="Удалить праздник"
                                  onClick={() => setPendingHolidayDeletion(holiday)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {holiday.dateLabel}
                              {holiday.isRecurringYearly ? " · ежегодно" : ""}
                              {holiday.isWorkingDayOverride ? " · рабочий день" : ""}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Clock3 className="size-4 text-amber-700 dark:text-amber-300" />
                        <div className="text-sm font-semibold">Отпуска и блокировки</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCreateTimeOffDialog()}>
                        Добавить
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:max-w-xs">
                      <Label>Сотрудник</Label>
                      <select
                        className="border-input bg-background h-9 rounded-md border pl-3 pr-10 text-sm"
                        value={timeOffEmployeeFilterId}
                        onChange={(e) => setTimeOffEmployeeFilterId(e.target.value)}
                      >
                        <option value="all">Все сотрудники</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      {scheduleTimeOffPreview.length === 0 ? (
                        <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
                          Блокировок для выбранного фильтра пока нет.
                        </div>
                      ) : (
                        scheduleTimeOffPreview.map((item) => (
                          <div key={item.id} className="rounded-md border bg-amber-50/70 px-3 py-2 text-sm dark:border-amber-900/60 dark:bg-amber-950/35">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium">{item.title || item.typeLabel}</div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  title="Редактировать блокировку"
                                  aria-label="Редактировать блокировку"
                                  onClick={() => openEditTimeOffDialog(item)}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-amber-700 hover:text-amber-700 dark:text-amber-200"
                                  title="Удалить блокировку"
                                  aria-label="Удалить блокировку"
                                  onClick={() => setPendingTimeOffDeletion(item)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {item.employeeLabel} · {formatTimeOffRangeRu(item)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Отмена
            </Button>
            {scheduleDialogTab === "schedule" ? (
              <Button onClick={submitSchedule} disabled={scheduleSaving || !employees.length}>
                {scheduleSaving ? "Сохраняю..." : "Сохранить график"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={holidayDialogOpen} onOpenChange={handleHolidayDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{holidayDialogMode === "edit" ? "Редактировать праздник" : "Добавить праздник"}</DialogTitle>
            <DialogDescription>Праздник блокирует запись на выбранную дату, если не включён режим рабочего дня.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Дата</Label>
              <DatePickerPopover
                value={holidayForm.date}
                onChange={(value) => setHolidayForm((prev) => ({ ...prev, date: value }))}
                placeholder="Выберите дату"
              />
            </div>
            <div className="grid gap-2">
              <Label>Название</Label>
              <Input value={holidayForm.title} onChange={(e) => setHolidayForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={holidayForm.isRecurringYearly}
                onCheckedChange={(checked) => setHolidayForm((prev) => ({ ...prev, isRecurringYearly: checked === true }))}
              />
              Повторять каждый год
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={holidayForm.isWorkingDayOverride}
                onCheckedChange={(checked) => setHolidayForm((prev) => ({ ...prev, isWorkingDayOverride: checked === true }))}
              />
              Рабочий день (разрешить запись)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleHolidayDialogOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={submitHoliday} disabled={holidaySaving}>
              {holidaySaving ? "Сохраняю..." : holidayDialogMode === "edit" ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={workdayOverrideDialogOpen} onOpenChange={handleWorkdayOverrideDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {workdayOverrideDialogMode === "edit" ? "Редактировать конкретный рабочий день" : "Добавить конкретный рабочий день"}
            </DialogTitle>
            <DialogDescription>
              Этот день работает как индивидуальное исключение для сотрудника и перекрывает обычный график по дню недели, включая перерыв.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Сотрудник</Label>
              <select
                className="border-input bg-background h-9 rounded-md border pl-3 pr-10 text-sm"
                value={workdayOverrideForm.employeeId}
                onChange={(e) => setWorkdayOverrideForm((prev) => ({ ...prev, employeeId: e.target.value }))}
              >
                {employees.length === 0 ? <option value="">Нет сотрудников</option> : null}
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} {employee.specialty ? `· ${employee.specialty}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Дата</Label>
              <DatePickerPopover
                value={workdayOverrideForm.date}
                onChange={(value) => setWorkdayOverrideForm((prev) => ({ ...prev, date: value }))}
                placeholder="Выберите дату"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Начало</Label>
                <TimePicker24h
                  value={workdayOverrideForm.startTime}
                  onChange={(value) => setWorkdayOverrideForm((prev) => ({ ...prev, startTime: value }))}
                  minuteStep={BOOKING_STEP_MIN}
                  placeholder="Начало"
                />
              </div>
              <div className="grid gap-2">
                <Label>Конец</Label>
                <TimePicker24h
                  value={workdayOverrideForm.endTime}
                  onChange={(value) => setWorkdayOverrideForm((prev) => ({ ...prev, endTime: value }))}
                  minuteStep={BOOKING_STEP_MIN}
                  placeholder="Конец"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div className="grid gap-0.5">
                <Label className="text-sm">Разовый перерыв</Label>
                <div className="text-muted-foreground text-xs">
                  Если включён, заменяет обычный перерыв только для этой даты.
                </div>
              </div>
              <Switch
                checked={workdayOverrideForm.breakEnabled}
                onCheckedChange={(checked) => setWorkdayOverrideForm((prev) => ({ ...prev, breakEnabled: checked }))}
              />
            </div>
            {workdayOverrideForm.breakEnabled ? (
              <>
                <div className="grid gap-2">
                  <Label>Название перерыва</Label>
                  <Input
                    value={workdayOverrideForm.breakTitle}
                    onChange={(e) => setWorkdayOverrideForm((prev) => ({ ...prev, breakTitle: e.target.value }))}
                    placeholder="Перерыв"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Начало перерыва</Label>
                    <TimePicker24h
                      value={workdayOverrideForm.breakStartTime}
                      onChange={(value) => setWorkdayOverrideForm((prev) => ({ ...prev, breakStartTime: value }))}
                      minuteStep={BOOKING_STEP_MIN}
                      placeholder="Начало перерыва"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Конец перерыва</Label>
                    <TimePicker24h
                      value={workdayOverrideForm.breakEndTime}
                      onChange={(value) => setWorkdayOverrideForm((prev) => ({ ...prev, breakEndTime: value }))}
                      minuteStep={BOOKING_STEP_MIN}
                      placeholder="Конец перерыва"
                    />
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleWorkdayOverrideDialogOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={submitWorkdayOverride} disabled={workdayOverrideSaving}>
              {workdayOverrideSaving ? "Сохраняю..." : workdayOverrideDialogMode === "edit" ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={timeOffDialogOpen} onOpenChange={handleTimeOffDialogOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {timeOffDialogMode === "edit" ? "Редактировать отпуск / блокировку" : "Отпуск / перерыв / блок времени"}
            </DialogTitle>
            <DialogDescription>
              Можно создать блок для конкретного сотрудника или для всех сотрудников сразу.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Сотрудник</Label>
                <select
                  className="border-input bg-background h-9 rounded-md border pl-3 pr-10 text-sm"
                  value={timeOffForm.employeeId}
                  onChange={(e) => setTimeOffForm((prev) => ({ ...prev, employeeId: e.target.value }))}>
                  <option value="all">Все сотрудники</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Тип</Label>
                <select
                  className="border-input bg-background h-9 rounded-md border pl-3 pr-10 text-sm"
                  value={timeOffForm.type}
                  onChange={(e) => setTimeOffForm((prev) => ({ ...prev, type: e.target.value }))}>
                  <option value="vacation">Отпуск</option>
                  <option value="break">Перерыв</option>
                  <option value="manual_block">Блокировка</option>
                  <option value="sick_leave">Больничный</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>{isDateOnlyTimeOff ? "Дата начала" : "Начало"}</Label>
                {isDateOnlyTimeOff ? (
                  <DatePickerPopover
                    value={timeOffStartDateValue}
                    onChange={(value) => setTimeOffForm((prev) => ({ ...prev, startsAt: `${value}T00:00` }))}
                    placeholder="Выберите дату"
                  />
                ) : (
                  <DateTimePicker24h
                    value={timeOffForm.startsAt}
                    onChange={(value) => setTimeOffForm((prev) => ({ ...prev, startsAt: value }))}
                    placeholder="Выберите дату и время"
                    minuteStep={BOOKING_STEP_MIN}
                  />
                )}
              </div>
              <div className="grid gap-2">
                <Label>{isDateOnlyTimeOff ? "Дата окончания" : "Конец"}</Label>
                {isDateOnlyTimeOff ? (
                  <DatePickerPopover
                    value={timeOffEndDateValue}
                    onChange={(value) => setTimeOffForm((prev) => ({ ...prev, endsAt: `${value}T23:59` }))}
                    placeholder="Выберите дату"
                  />
                ) : (
                  <DateTimePicker24h
                    value={timeOffForm.endsAt}
                    onChange={(value) => setTimeOffForm((prev) => ({ ...prev, endsAt: value }))}
                    placeholder="Выберите дату и время"
                    minuteStep={BOOKING_STEP_MIN}
                  />
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Название</Label>
              <Input
                value={timeOffForm.title}
                onChange={(e) => setTimeOffForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Отпуск, обед, кабинет занят"
              />
            </div>
            <div className="grid gap-2">
              <Label>Комментарий</Label>
              <Textarea
                value={timeOffForm.notes}
                onChange={(e) => setTimeOffForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleTimeOffDialogOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={submitTimeOff} disabled={timeOffSaving}>
              {timeOffSaving ? "Сохраняю..." : timeOffDialogMode === "edit" ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingHolidayDeletion)}
        onOpenChange={(open) => {
          if (!open && !holidayDeleting) {
            setPendingHolidayDeletion(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить праздник</DialogTitle>
            <DialogDescription>Праздник исчезнет из календаря и больше не будет влиять на доступность.</DialogDescription>
          </DialogHeader>
          {pendingHolidayDeletion ? (
            <div className="grid gap-3 text-sm">
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="text-muted-foreground text-xs">Название</div>
                <div className="font-medium">{pendingHolidayDeletion.title}</div>
              </div>
              <div className="rounded-lg border px-3 py-2">
                <div className="text-muted-foreground text-xs">Дата</div>
                <div>
                  {pendingHolidayDeletion.dateLabel}
                  {pendingHolidayDeletion.isRecurringYearly ? " · ежегодно" : ""}
                  {pendingHolidayDeletion.isWorkingDayOverride ? " · рабочий день" : ""}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingHolidayDeletion(null)}
              disabled={holidayDeleting}
            >
              Нет
            </Button>
            <Button
              variant="destructive"
              onClick={confirmHolidayDeletion}
              disabled={holidayDeleting}
            >
              {holidayDeleting ? "Удаляю..." : "Да, удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingWorkdayOverrideDeletion)}
        onOpenChange={(open) => {
          if (!open && !workdayOverrideDeleting) {
            setPendingWorkdayOverrideDeletion(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить конкретный рабочий день</DialogTitle>
            <DialogDescription>
              После удаления эта дата снова будет работать только по обычному недельному графику.
            </DialogDescription>
          </DialogHeader>
          {pendingWorkdayOverrideDeletion ? (
            <div className="grid gap-3 text-sm">
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="text-muted-foreground text-xs">Сотрудник</div>
                <div className="font-medium">{pendingWorkdayOverrideDeletion.employeeLabel}</div>
              </div>
              <div className="rounded-lg border px-3 py-2">
                <div className="text-muted-foreground text-xs">Дата</div>
                <div>{pendingWorkdayOverrideDeletion.dateLabel}</div>
              </div>
              <div className="rounded-lg border px-3 py-2">
                <div className="text-muted-foreground text-xs">Время</div>
                <div>
                  {formatMinuteLabel(pendingWorkdayOverrideDeletion.startMinute)} -{" "}
                  {formatMinuteLabel(pendingWorkdayOverrideDeletion.endMinute)}
                </div>
              </div>
              {pendingWorkdayOverrideDeletion.breakStartMinute !== null &&
              pendingWorkdayOverrideDeletion.breakEndMinute !== null ? (
                <div className="rounded-lg border px-3 py-2">
                  <div className="text-muted-foreground text-xs">Перерыв</div>
                  <div>
                    {pendingWorkdayOverrideDeletion.breakTitle || "Перерыв"} ·{" "}
                    {formatMinuteLabel(pendingWorkdayOverrideDeletion.breakStartMinute)} -{" "}
                    {formatMinuteLabel(pendingWorkdayOverrideDeletion.breakEndMinute)}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingWorkdayOverrideDeletion(null)}
              disabled={workdayOverrideDeleting}
            >
              Нет
            </Button>
            <Button
              variant="destructive"
              onClick={confirmWorkdayOverrideDeletion}
              disabled={workdayOverrideDeleting}
            >
              {workdayOverrideDeleting ? "Удаляю..." : "Да, удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingTimeOffDeletion)}
        onOpenChange={(open) => {
          if (!open && !timeOffDeleting) {
            setPendingTimeOffDeletion(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить блокировку времени</DialogTitle>
            <DialogDescription>Блокировка исчезнет из календаря и освободит этот интервал.</DialogDescription>
          </DialogHeader>
          {pendingTimeOffDeletion ? (
            <div className="grid gap-3 text-sm">
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="text-muted-foreground text-xs">Название</div>
                <div className="font-medium">{pendingTimeOffDeletion.title || pendingTimeOffDeletion.typeLabel}</div>
              </div>
              <div className="rounded-lg border px-3 py-2">
                <div className="text-muted-foreground text-xs">Сотрудник</div>
                <div>{pendingTimeOffDeletion.employeeLabel}</div>
              </div>
              <div className="rounded-lg border px-3 py-2">
                <div className="text-muted-foreground text-xs">Период</div>
                <div>{formatTimeOffRangeRu(pendingTimeOffDeletion)}</div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingTimeOffDeletion(null)}
              disabled={timeOffDeleting}
            >
              Нет
            </Button>
            <Button
              variant="destructive"
              onClick={confirmTimeOffDeletion}
              disabled={timeOffDeleting}
            >
              {timeOffDeleting ? "Удаляю..." : "Да, удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
