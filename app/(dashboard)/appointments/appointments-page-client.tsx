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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker24h } from "@/components/ui/time-picker-24h";
import { useToast } from "@/hooks/use-toast";
import {
  BookingApiError,
  BookingBreakRule,
  BookingCalendarViewResponse,
  BookingCompensationType,
  BookingEmployee,
  BookingAppointment,
  BookingHoliday,
  BookingPaymentMethod,
  BookingPaymentStatus,
  BookingRequestContext,
  BookingTimeOff,
  BookingRuleRangeInput,
  BookingWorkRule,
  BookingView,
  cancelBookingAppointment,
  createBookingAppointment,
  createBookingEmployee,
  createBookingHoliday,
  createBookingTimeOff,
  deleteBookingHoliday,
  deleteBookingTimeOff,
  fetchBookingCalendarView,
  listBookingHolidays,
  replaceBookingEmployeeBreakRules,
  replaceBookingEmployeeWorkRules,
  updateBookingHoliday,
  updateBookingTimeOff,
  updateBookingEmployee,
  updateBookingAppointment,
} from "@/lib/booking-api";
import { cn } from "@/lib/utils";
import { useAppointmentsCalendarIndexes } from "./hooks/use-appointments-calendar-indexes";
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
const WEEK_TIMELINE_STEP_MIN = 60;
const DAY_SUB_SLOT_COUNT = Math.max(1, Math.round(TIMELINE_STEP_MIN / BOOKING_STEP_MIN));
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
      TIMELINE_STEP_MIN - BOOKING_STEP_MIN,
      Math.round(((relativeY / rect.height) * TIMELINE_STEP_MIN) / BOOKING_STEP_MIN) * BOOKING_STEP_MIN,
    ),
  );

  let bestCandidate = candidates[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestMinute = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const startMinute = getMinuteOfDayFromIso(candidate.startsAt);
    if (startMinute === null) continue;
    const offsetMin = ((startMinute % TIMELINE_STEP_MIN) + TIMELINE_STEP_MIN) % TIMELINE_STEP_MIN;
    const distance = Math.abs(offsetMin - targetOffsetMin);
    if (distance < bestDistance || (distance === bestDistance && startMinute < bestMinute)) {
      bestCandidate = candidate;
      bestDistance = distance;
      bestMinute = startMinute;
    }
  }

  return bestCandidate;
}

function getDaySubSlotOffsetMin(clientY?: number, containerEl?: HTMLElement | null) {
  const subSlotIndex = getDaySubSlotIndex(clientY, containerEl);
  return subSlotIndex * BOOKING_STEP_MIN;
}

function getDaySubSlotIndex(clientY?: number, containerEl?: HTMLElement | null) {
  if (clientY === undefined || !containerEl) return 0;

  const rect = containerEl.getBoundingClientRect();
  if (rect.height <= 0) return 0;

  const relativeY = Math.max(0, Math.min(rect.height, clientY - rect.top));
  const normalizedPosition = Math.min(0.999999, relativeY / rect.height);
  return Math.max(0, Math.min(DAY_SUB_SLOT_COUNT - 1, Math.floor(normalizedPosition * DAY_SUB_SLOT_COUNT)));
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
  const workOverride = holidayWorkOverrideDateKeys.has(dayKey);
  if (holiday && !workOverride) return [];

  const endsAt = new Date(startsAt);
  endsAt.setMinutes(endsAt.getMinutes() + normalizedDurationMin);
  const weekday = startsAt.getDay();
  const allowedEmployeeIds = candidateEmployeeIds?.length ? new Set(candidateEmployeeIds) : null;

  const candidates: AvailableSlotCandidate[] = [];

  for (const employee of employees) {
    if (allowedEmployeeIds && !allowedEmployeeIds.has(employee.id)) continue;

    const employeeWorkRules = workRulesByEmployee[employee.id] || [];
    const employeeBreakRules = breakRulesByEmployee[employee.id] || [];
    const fitsWorkRule = employeeWorkRules.some(
      (rule) =>
        rule.isActive &&
        rule.weekday === weekday &&
        startMinute >= rule.startMinute &&
        endMinute <= rule.endMinute,
    );
    if (!fitsWorkRule) continue;

    const overlapsBreak = employeeBreakRules.some(
      (rule) =>
        rule.isActive &&
        rule.weekday === weekday &&
        startMinute < rule.endMinute &&
        endMinute > rule.startMinute,
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

export default function AppointmentsPageClient({
  prefill,
  requestContext,
}: AppointmentsPageClientProps = {}) {
  const appointmentVisibilityHydratedRef = useRef(false);
  const autoScrollKeyRef = useRef<string | null>(null);
  const autoScrollInteractedRef = useRef(false);
  const autoScrollSuppressUntilRef = useRef(0);
  const timelineAnchorKeyRef = useRef<string | null>(null);
  const { toast } = useToast();
  const [view, setView] = useState<BookingView>("week");
  const [contentTab, setContentTab] = useState<"calendar" | "list">("calendar");
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [calendarData, setCalendarData] = useState<BookingCalendarViewResponse | null>(null);
  const [holidayCatalog, setHolidayCatalog] = useState<BookingHoliday[]>([]);
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
    clientName: "",
    clientPhone: "",
    clientIin: "",
    clientComment: "",
    durationMin: FALLBACK_APPOINTMENT_DURATION_MIN,
    serviceAmount: 0,
    prepaidAmount: 0,
    prepaidPaymentMethod: "kaspi_transfer" as BookingPaymentMethod,
  });
  const [appointmentServiceAmountInput, setAppointmentServiceAmountInput] = useState("0");
  const [appointmentPrepaidAmountInput, setAppointmentPrepaidAmountInput] = useState("0");
  const [appointmentStatusDraft, setAppointmentStatusDraft] = useState<string>("scheduled");
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [appointmentStatusSavingId, setAppointmentStatusSavingId] = useState<string | null>(null);
  const [slotAvailabilityDurationMin, setSlotAvailabilityDurationMin] = useState<number>(FALLBACK_APPOINTMENT_DURATION_MIN);

  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [employeeDialogMode, setEmployeeDialogMode] = useState<"create" | "edit">("create");
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    specialty: "",
    slotDurationMin: FALLBACK_APPOINTMENT_DURATION_MIN,
    color: EMPLOYEE_COLOR_POOL[0]!,
    compensationType: "percent" as BookingCompensationType,
    compensationValue: 0,
  });
  const [employeeCompensationValueInput, setEmployeeCompensationValueInput] = useState("0");
  const [employeeSaving, setEmployeeSaving] = useState(false);

  const clampEmployeeCompensationValue = (
    value: number,
    compensationType: BookingCompensationType = employeeForm.compensationType,
  ) => {
    const normalized = Math.max(0, Math.round(value));
    return compensationType === "percent" ? Math.min(100, normalized) : normalized;
  };

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
        clientPhone: (prefill?.clientPhone || "").trim(),
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

  const rawEmployees = calendarData?.employees || [];
  const employees = useMemo(
    () =>
      rawEmployees.map((employee) => ({
        ...employee,
        color: employee.color || getEmployeeColorFallback(employee.id),
      })),
    [rawEmployees],
  );
  const employeesById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee] as const)), [employees]);
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
  const selectedSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);
  const visibleEmployees = useMemo(
    () => (selectionInitialized ? employees.filter((employee) => selectedSet.has(employee.id)) : []),
    [selectionInitialized, employees, selectedSet],
  );
  const visibleEmployeeIdSet = useMemo(() => new Set(visibleEmployees.map((employee) => employee.id)), [visibleEmployees]);

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

  const activeAppointments = useMemo(
    () => (calendarData?.appointments || []).filter((appointment) => appointmentIsActive(appointment.status)),
    [calendarData?.appointments],
  );
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

  const timelineRange = useMemo(() => {
    let minMinute = 8 * 60;
    let maxMinute = 20 * 60;
    const currentMinuteOfDay = (() => {
      const now = new Date();
      return now.getHours() * 60 + now.getMinutes();
    })();
    const initialWorkRulesByEmployee: Record<string, BookingWorkRule[]> = {};
    for (const rule of calendarData?.workRules || []) {
      if (!initialWorkRulesByEmployee[rule.employeeId]) initialWorkRulesByEmployee[rule.employeeId] = [];
      initialWorkRulesByEmployee[rule.employeeId].push(rule);
    }
    for (const employee of visibleEmployees) {
      const rules = initialWorkRulesByEmployee[employee.id] || [];
      for (const rule of rules) {
        minMinute = Math.min(minMinute, Math.max(0, rule.startMinute - 30));
        maxMinute = Math.max(maxMinute, Math.min(24 * 60, rule.endMinute + 30));
      }
    }
    for (const appointment of activeAppointments) {
      if (!visibleEmployeeIdSet.has(appointment.employeeId)) continue;
      const start = new Date(appointment.startsAt);
      const end = new Date(appointment.endsAt);
      minMinute = Math.min(minMinute, start.getHours() * 60 + start.getMinutes() - 30);
      maxMinute = Math.max(maxMinute, end.getHours() * 60 + end.getMinutes() + 30);
    }
    minMinute = Math.min(minMinute, currentMinuteOfDay - TIMELINE_STEP_MIN);
    maxMinute = Math.max(maxMinute, currentMinuteOfDay + TIMELINE_STEP_MIN);
    minMinute = Math.max(0, Math.floor(minMinute / TIMELINE_STEP_MIN) * TIMELINE_STEP_MIN);
    maxMinute = Math.min(24 * 60, Math.ceil(maxMinute / TIMELINE_STEP_MIN) * TIMELINE_STEP_MIN);
    return { minMinute, maxMinute };
  }, [calendarData?.workRules, visibleEmployees, activeAppointments, visibleEmployeeIdSet]);

  const dayTimeRows = useMemo(() => {
    const rows: number[] = [];
    for (let minute = timelineRange.minMinute; minute < timelineRange.maxMinute; minute += TIMELINE_STEP_MIN) {
      rows.push(minute);
    }
    return rows;
  }, [timelineRange]);

  const weekTimeRows = useMemo(() => {
    const minMinute = Math.max(
      0,
      Math.floor(timelineRange.minMinute / WEEK_TIMELINE_STEP_MIN) * WEEK_TIMELINE_STEP_MIN,
    );
    const maxMinute = Math.min(
      24 * 60,
      Math.ceil(timelineRange.maxMinute / WEEK_TIMELINE_STEP_MIN) * WEEK_TIMELINE_STEP_MIN,
    );
    const rows: number[] = [];
    for (let minute = minMinute; minute < maxMinute; minute += WEEK_TIMELINE_STEP_MIN) {
      rows.push(minute);
    }
    return rows;
  }, [timelineRange]);

  const timeRowIndexByMinute = useMemo(
    () => new Map(dayTimeRows.map((minute, index) => [minute, index] as const)),
    [dayTimeRows],
  );

  const {
    slotMap,
    workRulesByEmployee,
    breakRulesByEmployee,
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
    const weekday = targetDay.getDay();
    const employeeWorkRules = (workRulesByEmployee[slotDraft.employeeId] || []) as BookingWorkRule[];
    const optionMinutes = new Set<number>();

    for (const rule of employeeWorkRules) {
      if (!rule.isActive || rule.weekday !== weekday) continue;
      const latestStartMinute = rule.endMinute - appointmentDurationMin;
      if (latestStartMinute < rule.startMinute) continue;
      for (let minute = rule.startMinute; minute <= latestStartMinute; minute += BOOKING_STEP_MIN) {
        optionMinutes.add(minute);
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
      const weekday = day.getDay();

      for (const employee of visibleEmployees) {
        const employeeWorkRules = (workRulesByEmployee[employee.id] || []) as BookingWorkRule[];

        for (const rule of employeeWorkRules) {
          if (!rule.isActive || rule.weekday !== weekday) continue;

          const latestStartMinute = rule.endMinute - dragDurationMin;
          if (latestStartMinute < rule.startMinute) continue;

          for (let minute = rule.startMinute; minute <= latestStartMinute; minute += BOOKING_STEP_MIN) {
            const startsAtIso = createCellDate(day, minute).toISOString();
            const candidate = buildCreateAppointmentCandidatesAtStart({
              startsAtIso,
              durationMin: dragDurationMin,
              employees,
              candidateEmployeeIds: [employee.id],
              ignoreAppointmentId: draggingAppointment.id,
              workRulesByEmployee,
              breakRulesByEmployee,
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
    blockingHolidayByDateKey,
    holidayWorkOverrideDateKeys,
    calendarData?.timeOff,
    activeAppointments,
  ]);

  const weekDaysCount = Math.max(dayListForTimeline.length, 1);
  const weekTimeColumnWidth = 52;
  const weekDayMinColumnWidth = Math.max(92, Math.floor((920 - weekTimeColumnWidth) / weekDaysCount));
  const weekGridMinWidth = weekTimeColumnWidth + weekDayMinColumnWidth * weekDaysCount;
  const weekHeaderTitle = `Неделя ${getWeekOfMonth(anchorDate)}`;
  const weekHeaderSubtitle = getEmployeeCountLabelRu(visibleEmployees.length);
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
      slotDurationMin: FALLBACK_APPOINTMENT_DURATION_MIN,
      color: getNextEmployeeColor(employees),
      compensationType: "percent",
      compensationValue: 0,
    });
    setEmployeeCompensationValueInput("0");
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
      slotDurationMin: employee.slotDurationMin || FALLBACK_APPOINTMENT_DURATION_MIN,
      color: employee.color || getEmployeeColorFallback(employee.id),
      compensationType: nextCompensationType,
      compensationValue: nextCompensationValue,
    });
    setEmployeeCompensationValueInput(String(nextCompensationValue));
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
      clientName: normalizedPrefill.clientName,
      clientPhone: normalizedPrefill.clientPhone,
      clientIin: normalizedPrefill.clientIin,
      clientComment: normalizedPrefill.clientComment,
      durationMin: draftDuration,
      serviceAmount: 0,
      prepaidAmount: 0,
      prepaidPaymentMethod: "kaspi_transfer",
    });
    setAppointmentServiceAmountInput("0");
    setAppointmentPrepaidAmountInput("0");
    setSlotAvailabilityDurationMin(draftDuration);
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
      clientName: appointment.clientName || "",
      clientPhone: appointment.clientPhone || "",
      clientIin: appointment.clientIin || "",
      clientComment: appointment.clientComment || "",
      durationMin,
      serviceAmount: appointment.serviceAmount || 0,
      prepaidAmount: appointment.prepaidAmount || 0,
      prepaidPaymentMethod: (appointment.prepaidPaymentMethod as BookingPaymentMethod) || "kaspi_transfer",
    });
    setAppointmentServiceAmountInput(String(Math.max(0, Math.round(appointment.serviceAmount || 0))));
    setAppointmentPrepaidAmountInput(String(Math.max(0, Math.round(appointment.prepaidAmount || 0))));
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
      setAppointmentServiceAmountInput("0");
      setAppointmentPrepaidAmountInput("0");
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
        slotDurationMin: FALLBACK_APPOINTMENT_DURATION_MIN,
        color: getNextEmployeeColor(employees),
        compensationType: "percent",
        compensationValue: 0,
      });
      setEmployeeCompensationValueInput("0");
    }
  };

  const patchAppointmentForm = (patch: Partial<typeof appointmentForm>) => {
    setAppointmentForm((prev) => ({ ...prev, ...patch }));
  };

  const normalizeCurrencyInput = (raw: string) => raw.replace(/\D/g, "");

  const handleAppointmentServiceAmountInputChange = (raw: string) => {
    const digits = normalizeCurrencyInput(raw);
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
    const digits = normalizeCurrencyInput(raw);
    if (!digits) {
      setAppointmentPrepaidAmountInput("");
      patchAppointmentForm({ prepaidAmount: 0 });
      return;
    }

    const next = Math.max(0, Math.round(Number(digits) || 0));
    setAppointmentPrepaidAmountInput(String(next));
    patchAppointmentForm({ prepaidAmount: next });
  };

  const handleAppointmentServiceAmountInputBlur = () => {
    if (appointmentServiceAmountInput.trim() !== "") return;
    setAppointmentServiceAmountInput("0");
    patchAppointmentForm({ serviceAmount: 0 });
  };

  const handleAppointmentPrepaidAmountInputBlur = () => {
    if (appointmentPrepaidAmountInput.trim() !== "") return;
    setAppointmentPrepaidAmountInput("0");
    patchAppointmentForm({ prepaidAmount: 0 });
  };

  const startEditingAppointmentFromDialog = () => {
    if (!activeAppointmentId) return;
    setAppointmentDialogMode("edit");
  };

  const handleAppointmentSlotEmployeeChange = (nextEmployeeId: string) => {
    const nextDurationMin =
      appointmentDialogMode === "create"
        ? getEmployeeDefaultDurationMin(nextEmployeeId)
        : clampAppointmentDurationMin(appointmentForm.durationMin, BOOKING_STEP_MIN);
    patchAppointmentForm({ durationMin: nextDurationMin });
    if (appointmentDialogMode === "create") {
      setSlotAvailabilityDurationMin(nextDurationMin);
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
    patchAppointmentForm({ durationMin: nextDuration });
    if (appointmentDialogMode === "create") {
      setSlotAvailabilityDurationMin(nextDuration);
    }
  };

  const handleAppointmentDurationInputChange = (raw: string) => {
    const nextDuration = alignDurationToStep(raw, appointmentDurationStepMin, appointmentDurationStepMin);
    if (appointmentDialogMode === "create") {
      setSlotAvailabilityDurationMin(nextDuration);
    }
    patchAppointmentForm({ durationMin: nextDuration });
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

  const handleWorkdayToggle = (weekday: number, enabled: boolean) => {
    if (enabled) {
      updateScheduleRow(weekday, { workEnabled: true });
      return;
    }
    updateScheduleRow(weekday, {
      workEnabled: false,
      breakEnabled: false,
      breakStart: minuteToInputTime(13 * 60),
      breakEnd: minuteToInputTime(14 * 60),
      breakTitle: "Перерыв",
    });
  };

  const submitSchedule = async () => {
    if (!scheduleEmployeeId) {
      toast({ title: "Выберите сотрудника" });
      return;
    }

    const workRules: BookingRuleRangeInput[] = [];
    const breakRules: BookingRuleRangeInput[] = [];

    for (const row of scheduleRows) {
      if (row.workEnabled) {
        const startMinute = inputTimeToMinute(row.workStart);
        const endMinute = inputTimeToMinute(row.workEnd);
        if (startMinute === null || endMinute === null || endMinute <= startMinute) {
          toast({ title: `Проверьте рабочее время: ${WEEKDAY_LONG_RU[row.weekday]}` });
          return;
        }
        workRules.push({
          weekday: row.weekday,
          startMinute,
          endMinute,
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
      const resizeStepPx = Math.max(2, (slotHeightPx * BOOKING_STEP_MIN) / TIMELINE_STEP_MIN);
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
    if (!appointmentForm.clientName.trim()) {
      toast({ title: "Укажите имя клиента" });
      return;
    }
    const serviceAmount = Math.max(0, Math.round(Number(appointmentForm.serviceAmount) || 0));
    const prepaidAmount = Math.max(0, Math.round(Number(appointmentForm.prepaidAmount) || 0));
    if (prepaidAmount > 0 && !appointmentForm.prepaidPaymentMethod) {
      toast({ title: "Выберите способ оплаты для предоплаты" });
      return;
    }
    if (serviceAmount > 0 && prepaidAmount > serviceAmount) {
      toast({ title: "Предоплата не может превышать стоимость приема" });
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

    const validSelectedSlot = buildCreateAppointmentCandidatesAtStart({
      startsAtIso: selectedSlot.startsAt,
      durationMin,
      employees,
      candidateEmployeeIds: [selectedSlot.employeeId],
      ignoreAppointmentId: activeAppointmentId || undefined,
      workRulesByEmployee,
      breakRulesByEmployee,
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
      const computedEndsAt = validSelectedSlot.endsAt;
      if (activeAppointmentId) {
        await updateBookingAppointment(activeAppointmentId, {
          employeeId: selectedSlot.employeeId,
          startsAt: selectedSlot.startsAt,
          endsAt: computedEndsAt,
          durationMin,
          status: appointmentStatusDraft,
          clientName: appointmentForm.clientName.trim(),
          clientPhone: appointmentForm.clientPhone.trim() || undefined,
          clientIin: iinNormalized || undefined,
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
          startsAt: selectedSlot.startsAt,
          endsAt: computedEndsAt,
          durationMin,
          clientName: appointmentForm.clientName.trim(),
          clientPhone: appointmentForm.clientPhone.trim() || undefined,
          clientIin: iinNormalized || undefined,
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
        slotDurationMin: FALLBACK_APPOINTMENT_DURATION_MIN,
        color: getNextEmployeeColor(employees),
        compensationType: "percent",
        compensationValue: 0,
      });
      setEmployeeCompensationValueInput("0");
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
  const weekTimeRowClass = "flex min-h-10 items-start justify-end bg-background border-t px-2 py-1 text-xs text-muted-foreground";
  const now = new Date();
  const nowDateKey = toDateKeyLocal(now);
  const nowMinuteOfDay = now.getHours() * 60 + now.getMinutes();
  const timelineStartDayMs = dayListForTimeline[0]?.getTime() ?? anchorDate.getTime();
  const isAutoScrollTimeRow = (minuteOfDay: number, durationMin = TIMELINE_STEP_MIN) =>
    nowMinuteOfDay >= minuteOfDay && nowMinuteOfDay < minuteOfDay + durationMin;
  const isCurrentTimelineSlot = (day: Date, minuteOfDay: number, durationMin = TIMELINE_STEP_MIN) =>
    toDateKeyLocal(day) === nowDateKey && nowMinuteOfDay >= minuteOfDay && nowMinuteOfDay < minuteOfDay + durationMin;

  useEffect(() => {
    if (contentTab !== "calendar" || view === "month") {
      autoScrollKeyRef.current = null;
      autoScrollInteractedRef.current = false;
      timelineAnchorKeyRef.current = null;
      return;
    }

    const timelineAnchorKey =
      view === "day"
        ? `day:${toDateKeyLocal(anchorDate)}`
        : `week:${toDateKeyLocal(dayListForTimeline[0] || anchorDate)}`;

    if (timelineAnchorKeyRef.current !== timelineAnchorKey) {
      timelineAnchorKeyRef.current = timelineAnchorKey;
      autoScrollKeyRef.current = null;
      autoScrollInteractedRef.current = false;
    }

    if (
      autoScrollKeyRef.current === timelineAnchorKey ||
      autoScrollInteractedRef.current ||
      typeof window === "undefined"
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const currentRowAnchor = document.querySelector<HTMLElement>('[data-current-time-anchor="true"]');
      if (!currentRowAnchor) return;
      autoScrollSuppressUntilRef.current = Date.now() + 400;
      currentRowAnchor.scrollIntoView({ block: "center", inline: "nearest" });
      autoScrollKeyRef.current = timelineAnchorKey;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [contentTab, view, anchorDate.getTime(), timelineStartDayMs]);

  useEffect(() => {
    if (contentTab !== "calendar" || view === "month" || typeof window === "undefined") return;

    const markAutoScrollInteracted = () => {
      if (Date.now() <= autoScrollSuppressUntilRef.current) return;
      autoScrollInteractedRef.current = true;
    };

    window.addEventListener("scroll", markAutoScrollInteracted, { passive: true });
    window.addEventListener("wheel", markAutoScrollInteracted, { passive: true });
    window.addEventListener("touchmove", markAutoScrollInteracted, { passive: true });

    return () => {
      window.removeEventListener("scroll", markAutoScrollInteracted);
      window.removeEventListener("wheel", markAutoScrollInteracted);
      window.removeEventListener("touchmove", markAutoScrollInteracted);
    };
  }, [contentTab, view]);

  const renderDaySubSlotMarkers = (layout: "day" | "week") =>
    layout === "day" ? (
      <>
        {Array.from({ length: Math.max(0, DAY_SUB_SLOT_COUNT - 1) }, (_, index) => (
          <span
            key={`day-sub-slot-divider-${index}`}
            className="pointer-events-none absolute inset-x-0 h-px bg-border/70"
            style={{ top: `${((index + 1) * 100) / DAY_SUB_SLOT_COUNT}%` }}
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
        <div className="grid h-full grid-rows-6 px-1 text-[8px] leading-none">
          {Array.from({ length: DAY_SUB_SLOT_COUNT }, (_, index) => (
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
    const subSlotIndex = getDaySubSlotIndex(clientY, containerEl);
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
    const hoveredMinuteOfDay = minuteOfDay + getDaySubSlotOffsetMin(clientY, containerEl);
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
  ) => {
    const cellStart = createCellDate(day, minuteOfDay);
    const dayKey = toDateKeyLocal(day);
    const cellDayMinuteKey = dayMinuteKeyLocal(dayKey, minuteOfDay);
    const employeeCellKey = employeeCellKeyLocal(employee.id, dayKey, minuteOfDay);
    const dragPreviewMatchesDraggingSource = Boolean(
      draggingAppointment &&
      dragPreviewSlot &&
      dragPreviewSlot.employeeId === draggingAppointment.employeeId &&
      dragPreviewSlot.startsAt === draggingAppointment.startsAt &&
      dragPreviewSlot.endsAt === draggingAppointment.endsAt,
    );

    const employeeWorkRules = (workRulesByEmployee[employee.id] || []) as BookingWorkRule[];
    const employeeBreakRules = (breakRulesByEmployee[employee.id] || []) as BookingBreakRule[];
    const weekday = cellStart.getDay();
    const holiday = blockingHolidayByDateKey.get(dayKey);
    const workOverride = holidayWorkOverrideDateKeys.has(dayKey);
    const daySubSlotMinutes =
      layout === "day"
        ? getTimelineBucketMinutes(minuteOfDay, TIMELINE_STEP_MIN, BOOKING_STEP_MIN)
        : [minuteOfDay];
    const daySubSlotEntries =
      layout === "day"
        ? daySubSlotMinutes.map((subMinuteOfDay) => {
            const subDayMinuteKey = dayMinuteKeyLocal(dayKey, subMinuteOfDay);
            const subEmployeeCellKey = employeeCellKeyLocal(employee.id, dayKey, subMinuteOfDay);
            const subStartsAtIso = createCellDate(day, subMinuteOfDay).toISOString();
            const subInWork = employeeWorkRules.some(
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
        : employeeWorkRules.some(
            (rule) =>
              rule.isActive &&
              rule.weekday === weekday &&
              minuteOfDay >= rule.startMinute &&
              minuteOfDay + TIMELINE_STEP_MIN <= rule.endMinute,
          );
    const onBreak =
      layout === "day"
        ? daySubSlotEntries.find((entry) => entry.onBreak)?.onBreak
        : employeeBreakRules.find(
            (rule) =>
              rule.isActive &&
              rule.weekday === weekday &&
              minuteOfDay < rule.endMinute &&
              minuteOfDay + TIMELINE_STEP_MIN > rule.startMinute,
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
        ? `${hoveredSubSlotIndex * (100 / DAY_SUB_SLOT_COUNT)}%`
        : undefined;
    const hoveredSubSlotEntry =
      layout === "day" && hoveredSubSlotIndex !== null && Number.isFinite(hoveredSubSlotIndex) && hoveredSubSlotIndex >= 0
        ? daySubSlotEntries[hoveredSubSlotIndex]
        : undefined;
    const hoveredMinuteOfDay = hoveredSubSlotEntry?.minuteOfDay ?? minuteOfDay;
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
        ? new Set(
            daySubSlotEntries.flatMap((entry, index) => (entry.state === "available" ? [index] : [])),
          )
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
              appointmentStartMinuteOfDay < minuteOfDay + TIMELINE_STEP_MIN
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
          startsMinute < minuteOfDay + TIMELINE_STEP_MIN
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
            ? getTimelineBucketMinutes(previousVisibleMinute, TIMELINE_STEP_MIN, BOOKING_STEP_MIN)
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
    const isCurrentSlot = isCurrentTimelineSlot(day, minuteOfDay);
    const slotHeightPx = layout === "week" ? 40 : DAY_SLOT_HEIGHT_PX;

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
      dragPreviewStartMinuteOfDay < minuteOfDay + TIMELINE_STEP_MIN;
    const dragPreviewDurationMin =
      dragPreviewStartsHere && dragPreviewSlot
        ? getDurationMinBetween(dragPreviewSlot.startsAt, dragPreviewSlot.endsAt)
        : 0;
    const dragPreviewOffsetMin =
      dragPreviewStartsHere && dragPreviewStartMinuteOfDay !== null
        ? dragPreviewStartMinuteOfDay - minuteOfDay
        : 0;
    const dragPreviewBlockHeightPx = Math.max(6, Math.round((slotHeightPx * dragPreviewDurationMin) / TIMELINE_STEP_MIN) - 2);
    const dragPreviewBlockTopPx =
      0.5 + Math.round((slotHeightPx * dragPreviewOffsetMin) / TIMELINE_STEP_MIN);
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
        : pickAvailableSlotCandidate(availableCandidates, clientY, containerEl);
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
        : holiday?.title || timeOff?.title || onBreak?.title || undefined;
    const renderDaySubSlotBackgrounds = () => {
      if (layout !== "day") return null;

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
              top: `${(subSlotIndex * 100) / DAY_SUB_SLOT_COUNT}%`,
              height: `${100 / DAY_SUB_SLOT_COUNT}%`,
            }}
          />
        );
      });
    };
    const renderDayCreateHitAreas = () => {
      if (
        layout !== "day" ||
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
              top: `${(subSlotIndex * 100) / DAY_SUB_SLOT_COUNT}%`,
              height: `${100 / DAY_SUB_SLOT_COUNT}%`,
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
        appointmentStartMinuteOfDay >= minuteOfDay + TIMELINE_STEP_MIN
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
      const exactSlotFactor = appointmentDurationMinForRender / TIMELINE_STEP_MIN;
      const appointmentBlockHeightPx = Math.max(6, Math.round(slotHeightPx * exactSlotFactor) - 2);
      const appointmentBlockTopPx =
        0.5 + Math.round((slotHeightPx * appointmentStartOffsetMin) / TIMELINE_STEP_MIN);
      const appointmentSurfaceClassName = getAppointmentSurfaceClassName(appointmentForRender.status);
      const appointmentMutedTextClassName = getAppointmentMutedTextClassName(appointmentForRender.status);
      const appointmentHandleClassName = getAppointmentHandleClassName(appointmentForRender.status);
      const usesStatusSurface = Boolean(appointmentSurfaceClassName);
      const showAppointmentName = appointmentBlockHeightPx >= 9;
      const showAppointmentPhone = layout === "day" && appointmentBlockHeightPx >= 22;
      const inlinePhoneText = showAppointmentPhone ? appointmentForRender.clientPhone || "Без номера" : null;
      const showAppointmentStatus = layout === "day" && appointmentBlockHeightPx >= 24;
      const showResizeHandle = layout === "day" && appointmentBlockHeightPx >= 12;
      const appointmentSpansMultipleTimelineRows =
        appointmentStartOffsetMin + appointmentDurationMinForRender > TIMELINE_STEP_MIN;
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
          {renderDaySubSlotMinuteScale(layout, minuteOfDay, visibleDaySubSlotMinuteIndexes)}
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
              className="pointer-events-none absolute inset-x-0 z-10 flex items-center justify-start bg-sky-300/65 pl-6 dark:bg-sky-500/30"
              style={{ top: hoveredSubSlotTop, height: `${100 / DAY_SUB_SLOT_COUNT}%` }}
            >
              <span className="text-[10px] text-sky-700 dark:text-sky-100">+</span>
            </span>
          ) : null}
          {renderDaySubSlotMarkers(layout)}
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
      >
        {renderDaySubSlotMinuteScale(layout, minuteOfDay, visibleDaySubSlotMinuteIndexes)}
        {renderDaySubSlotMarkers(layout)}
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
            className="pointer-events-none absolute inset-x-0 z-0 flex items-center justify-start bg-sky-200/50 pl-6 dark:bg-sky-500/22"
            style={{ top: hoveredSubSlotTop, height: `${100 / DAY_SUB_SLOT_COUNT}%` }}
          >
            <span className="text-[10px] text-sky-700 dark:text-sky-100">+</span>
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
        {!appointment && !timeOff && !onBreak && holiday ? (
          <div className="relative z-0 flex h-full items-center truncate pl-7 pr-1 text-[10px]">
            {holiday.title}
          </div>
        ) : null}
        {layout === "day" && !hasCreateableSubSlots && timeOff && timeOffLabelStartsHere ? (
          <div className="relative z-0 flex h-full items-center truncate pl-7 pr-1 text-[10px] font-medium">
            {timeOff.title || getTimeOffTypeLabelRu(timeOff.type)}
          </div>
        ) : null}
        {layout === "day" && !hasCreateableSubSlots && !timeOff && onBreak ? (
          <div className="relative z-0 flex h-full items-center truncate pl-7 pr-1 text-[10px]">
            {onBreak.title || "Перерыв"}
          </div>
        ) : null}
        {layout === "day" && !hasCreateableSubSlots && !timeOff && !onBreak && holiday ? (
          <div className="relative z-0 flex h-full items-center truncate pl-7 pr-1 text-[10px]">
            {holiday.title}
          </div>
        ) : null}
      </div>
    );
  };

  const renderWeekAggregateCell = (day: Date, minuteOfDay: number) => {
    const cellStart = createCellDate(day, minuteOfDay);
    const cellEnd = new Date(cellStart);
    cellEnd.setMinutes(cellEnd.getMinutes() + WEEK_TIMELINE_STEP_MIN);
    const dayKey = toDateKeyLocal(day);
    const bucketMinutes = getTimelineBucketMinutes(minuteOfDay, WEEK_TIMELINE_STEP_MIN, BOOKING_STEP_MIN);
    const key = `week-${toDateKeyLocal(day)}-${minuteOfDay}`;

    const holiday = blockingHolidayByDateKey.get(dayKey);

    const appointmentsById = new Map<string, BookingAppointment>();
    const timeOffById = new Map<string, BookingTimeOff>();
    const availableCandidatesByKey = new Map<string, { employeeId: string; startsAt: string; endsAt: string }>();

    for (const bucketMinute of bucketMinutes) {
      const bucketDayMinuteKey = dayMinuteKeyLocal(dayKey, bucketMinute);
      for (const appointment of appointmentsOverlappingByDayMinuteKey.get(bucketDayMinuteKey) || []) {
        if (!isAppointmentVisible(appointment)) continue;
        appointmentsById.set(appointment.id, appointment);
      }
      for (const item of timeOffOverlappingByDayMinuteKey.get(bucketDayMinuteKey) || []) {
        timeOffById.set(item.id, item);
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
    const availableCandidates = Array.from(availableCandidatesByKey.values()).sort(
      (a, b) => +new Date(a.startsAt) - +new Date(b.startsAt),
    );
    const availableEmployeeCount = new Set(availableCandidates.map((candidate) => candidate.employeeId)).size;

    const isCurrentSlot = isCurrentTimelineSlot(day, minuteOfDay, WEEK_TIMELINE_STEP_MIN);

    const className = cn(
      "relative overflow-hidden border-l border-t px-0.5 py-0.5 first:border-l-0",
      weekSlotHeightClass,
      holiday ? "bg-rose-50/60 dark:bg-rose-950/35" : "bg-background/40",
      appointmentsOverlapping.length > 0 && "bg-background",
      availableEmployeeCount > 0 && appointmentsOverlapping.length === 0 && !holiday && "bg-sky-50/40 dark:bg-sky-950/25",
      isCurrentSlot && "ring-1 ring-sky-300/80 ring-inset dark:ring-sky-500/60",
    );
    const canCreateInSlot = availableEmployeeCount > 0;

    return (
      <div key={key} className={className} title={holiday?.title || undefined}>
        {isCurrentSlot ? <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-sky-500 dark:bg-sky-400" /> : null}
        {appointmentsOverlapping.length > 0 || canCreateInSlot ? (
          <div className="flex flex-col gap-1">
            {appointmentsOverlapping.map((appointment) => {
              const employee = employeesById.get(appointment.employeeId);
              const appointmentStart = new Date(appointment.startsAt);
              const appointmentEnd = new Date(appointment.endsAt);
              const showWrapIcon =
                !Number.isNaN(appointmentStart.getTime()) &&
                !Number.isNaN(appointmentEnd.getTime()) &&
                appointmentStart < cellStart &&
                appointmentEnd > cellStart;
              return (
                <button
                  type="button"
                  key={`${appointment.id}-${dayKey}-${minuteOfDay}`}
                  className={cn(
                    "flex h-[18px] max-w-full items-center gap-1 rounded-[4px] border px-1.5 text-[10px] leading-none",
                    getAppointmentSurfaceClassName(appointment.status) || "border-transparent text-white hover:brightness-95",
                  )}
                  style={
                    getAppointmentSurfaceClassName(appointment.status)
                      ? undefined
                      : {
                          backgroundColor: employee?.color || "#0ea5e9",
                          borderColor: employee?.color || "#0ea5e9",
                        }
                  }
                  title={`${employee?.name || "Сотрудник"} · ${appointment.clientName}${appointment.clientPhone ? ` · ${appointment.clientPhone}` : ""
                    }`}
                  onClick={() => openExistingAppointmentDialog(appointment)}
                >
                  {showWrapIcon ? <CornerDownRight className="size-2.5 shrink-0" /> : null}
                  <AppointmentStatusInline
                    status={appointment.status}
                    showLabel={false}
                    iconClassName="size-2.5 shrink-0"
                  />
                  <span className="min-w-0 truncate font-semibold">{appointment.clientName}</span>
                </button>
              );
            })}
            {canCreateInSlot ? (
              <button
                type="button"
                className="flex h-[18px] max-w-full items-center gap-1 rounded-[4px] border border-sky-200/80 bg-sky-100/80 px-1.5 text-[10px] leading-none text-sky-900 hover:bg-sky-200/70 dark:border-sky-800/70 dark:bg-sky-950/55 dark:text-sky-100 dark:hover:bg-sky-900/80"
                title={`Создать запись (${availableEmployeeCount}/${Math.max(visibleEmployees.length, 1)} свободно)`}
                onClick={() =>
                  openCreateAppointmentFromSlot({
                    employeeId: availableCandidates[0]?.employeeId || null,
                    startsAt: availableCandidates[0]?.startsAt || cellStart.toISOString(),
                    endsAt: availableCandidates[0]?.endsAt || cellEnd.toISOString(),
                    candidateSlots: availableCandidates,
                  })
                }>
                <Plus className="size-3 shrink-0" />
                <span className="font-semibold text-sky-900 dark:text-sky-100">
                  {availableEmployeeCount}/{Math.max(visibleEmployees.length, 1)}
                </span>
              </button>
            ) : null}
          </div>
        ) : overlappingTimeOff.length > 0 ? (
          <div className="truncate text-[10px] text-amber-800 dark:text-amber-100">
            {overlappingTimeOff.length === 1
              ? overlappingTimeOff[0].title || getTimeOffTypeLabelRu(overlappingTimeOff[0].type)
              : `Блокировки: ${overlappingTimeOff.length}`}
          </div>
        ) : holiday ? (
          <div className="truncate text-[10px] text-rose-700 dark:text-rose-200">{holiday.title}</div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid min-[1100px]:grid-cols-[280px_minmax(0,1fr)] min-[1400px]:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="min-w-0 gap-4 border-border/80 py-4">
          <CardContent className="space-y-4 px-4 min-[1400px]:px-6">
            <Tabs value={view} onValueChange={(value) => setView(value as BookingView)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="day">День</TabsTrigger>
                <TabsTrigger value="week">Неделя</TabsTrigger>
                <TabsTrigger value="month">Месяц</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="rounded-lg p-2">
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
              <div className="flex items-center justify-between">
                <Label className="text-sm">Сотрудники</Label>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={openCreateEmployeeDialog}
                    title="Создать сотрудника"
                    aria-label="Создать сотрудника">
                    <Plus className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => openScheduleDialog(visibleEmployees[0]?.id || employees[0]?.id)}
                    disabled={!employees.length}
                    title="График"
                    aria-label="График">
                    <Clock3 className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="rounded-md">
                <div className="space-y-1 p-2">
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
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 rounded-xl bg-background p-2">
          <Tabs value={contentTab} onValueChange={(value) => setContentTab(value as "calendar" | "list")} className="space-y-2">
            <div className="flex justify-end">
              <TabsList className="grid w-[220px] grid-cols-2">
                <TabsTrigger value="calendar">Календарь</TabsTrigger>
                <TabsTrigger value="list">Список</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="calendar" className="mt-0">
              <div className="px-0 pt-0">
                {view === "month" ? (
                  <div className="px-4 pb-4">
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
                    rowDurationMin={WEEK_TIMELINE_STEP_MIN}
                    holidaysByDateKey={holidaysByDateKey}
                    toDateKeyLocal={toDateKeyLocal}
                    weekdayShortRu={WEEKDAY_LONG_RU}
                    headerControls={renderAppointmentVisibilityToggles("justify-end")}
                    formatMinuteLabel={formatMinuteLabel}
                    isAutoScrollTimeRow={isAutoScrollTimeRow}
                    renderWeekAggregateCell={renderWeekAggregateCell}
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

            <TabsContent value="list" className="mt-0">
              <Card className="border-border/80 bg-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Список записей {view === "day" ? "на день" : "в диапазоне"}</CardTitle>
                  <CardDescription>Клик по карточке открывает просмотр, а справа доступен быстрый переход на следующий статус</CardDescription>
                  {renderAppointmentVisibilityToggles("pt-1")}
                </CardHeader>
                <CardContent>
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
                                {appointment.clientPhone ? ` · ${appointment.clientPhone}` : ""}
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
        patchAppointmentForm={patchAppointmentForm}
        appointmentIinPreview={appointmentIinPreview}
        getGenderLabelRu={getGenderLabelRu}
        onSlotEmployeeChange={handleAppointmentSlotEmployeeChange}
        startTimeOptions={appointmentStartTimeOptions}
        onStartTimeChange={handleAppointmentStartTimeChange}
        onDurationPresetSelect={handleAppointmentDurationPresetSelect}
        onDurationInputChange={handleAppointmentDurationInputChange}
        normalizeIin={normalizeIin}
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
              <Label>Слот (мин)</Label>
              <Input
                type="number"
                min={BOOKING_STEP_MIN}
                step={BOOKING_STEP_MIN}
                value={employeeForm.slotDurationMin}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setEmployeeForm((prev) => ({
                    ...prev,
                    slotDurationMin: Number.isFinite(next) ? next : BOOKING_STEP_MIN,
                  }));
                }}
              />
              <div className="text-muted-foreground text-xs">От 5 до 720 минут, шаг 5 минут.</div>
            </div>
            <div className="grid gap-2">
              <Label>Ставка</Label>
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <select
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
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
                      const digits = prev.replace(/\D/g, "");
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
                      const digits = e.target.value.replace(/\D/g, "");
                      if (!digits) {
                        setEmployeeCompensationValueInput("");
                        return;
                      }

                      const normalizedValue = clampEmployeeCompensationValue(Number(digits));
                      setEmployeeCompensationValueInput(String(normalizedValue));
                      setEmployeeForm((prev) => ({
                        ...prev,
                        compensationValue: normalizedValue,
                      }));
                    }}
                    onBlur={() => {
                      if (employeeCompensationValueInput.trim() !== "") return;
                      setEmployeeCompensationValueInput("0");
                      setEmployeeForm((prev) => ({
                        ...prev,
                        compensationValue: 0,
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
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
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
                        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
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
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
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
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
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
