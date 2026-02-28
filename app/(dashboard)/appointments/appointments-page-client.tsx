"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useState } from "react";
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
  Clock3,
  CornerDownRight,
  Pencil,
  Plus,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker24h } from "@/components/ui/time-picker-24h";
import { useToast } from "@/hooks/use-toast";
import {
  BookingApiError,
  BookingBreakRule,
  BookingCalendarViewResponse,
  BookingEmployee,
  BookingAppointment,
  BookingRuleRangeInput,
  BookingWorkRule,
  BookingView,
  cancelBookingAppointment,
  createBookingAppointment,
  createBookingEmployee,
  createBookingHoliday,
  createBookingTimeOff,
  fetchBookingCalendarView,
  replaceBookingEmployeeBreakRules,
  replaceBookingEmployeeWorkRules,
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

const WEEKDAY_SHORT_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const WEEKDAY_LONG_RU = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const WEEKDAY_EDITOR_ORDER = [1, 2, 3, 4, 5, 6, 0];
const BOOKING_STEP_MIN = 10;
const TIMELINE_STEP_MIN = 30;
const EMPLOYEE_NAME_MAX_LENGTH = 20;
const EMPLOYEE_SPECIALTY_MAX_LENGTH = 15;
const APPOINTMENT_DURATION_PRESET_BASE_MIN = [20, 40, 60, 120, 180];
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
  scheduled: "Запланирована",
  confirmed: "Подтверждена",
  completed: "Завершена",
  cancelled: "Отменена",
  no_show: "Неявка",
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
};

type ResizeAppointmentDraft = {
  appointmentId: string;
  endsAt: string;
};

type ScheduleHolidayPreviewItem = {
  id: string;
  title: string;
  dateLabel: string;
  isRecurringYearly: boolean;
  isWorkingDayOverride: boolean;
};

type ScheduleTimeOffPreviewItem = {
  id: string;
  employeeLabel: string;
  type: string;
  typeLabel: string;
  title: string | null;
  startsAt: string;
  endsAt: string;
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

function buildDurationPresets(stepMin: number, currentDurationMin: number) {
  const safeStep = normalizeDurationStepMin(stepMin, BOOKING_STEP_MIN);
  const set = new Set<number>();
  for (const baseMin of APPOINTMENT_DURATION_PRESET_BASE_MIN) {
    const value = alignDurationToStep(baseMin, safeStep, safeStep);
    if (value >= safeStep && value <= 12 * 60) set.add(value);
  }
  set.add(safeStep);
  const currentAligned = alignDurationToStep(currentDurationMin, safeStep, safeStep);
  if (currentAligned <= 12 * 60) set.add(currentAligned);
  return Array.from(set).sort((a, b) => a - b);
}

function getDurationMinBetween(startsAtIso: string, endsAtIso: string) {
  const start = new Date(startsAtIso);
  const end = new Date(endsAtIso);
  const diff = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
  return diff > 0 ? diff : TIMELINE_STEP_MIN;
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

export default function AppointmentsPageClient({ prefill }: AppointmentsPageClientProps = {}) {
  const { toast } = useToast();
  const [view, setView] = useState<BookingView>("week");
  const [contentTab, setContentTab] = useState<"calendar" | "list">("calendar");
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [calendarData, setCalendarData] = useState<BookingCalendarViewResponse | null>(null);
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  const [slotDraft, setSlotDraft] = useState<SlotDraft | null>(null);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [appointmentDialogMode, setAppointmentDialogMode] = useState<"create" | "view" | "edit">("create");
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(null);
  const [appointmentForm, setAppointmentForm] = useState({
    clientName: "",
    clientPhone: "",
    clientIin: "",
    clientComment: "",
    durationMin: TIMELINE_STEP_MIN,
  });
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [slotAvailabilityDurationMin, setSlotAvailabilityDurationMin] = useState<number | null>(null);

  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [employeeDialogMode, setEmployeeDialogMode] = useState<"create" | "edit">("create");
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    specialty: "",
    slotDurationMin: 30,
    color: EMPLOYEE_COLOR_POOL[0]!,
  });
  const [employeeSaving, setEmployeeSaving] = useState(false);

  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    date: toDateKeyLocal(new Date()),
    title: "Праздничный день",
    isRecurringYearly: false,
    isWorkingDayOverride: false,
  });
  const [holidaySaving, setHolidaySaving] = useState(false);

  const [timeOffDialogOpen, setTimeOffDialogOpen] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({
    employeeId: "all",
    type: "vacation",
    startsAt: toInputDateTimeValue(new Date().toISOString()),
    endsAt: toInputDateTimeValue(new Date(Date.now() + 60 * 60 * 1000).toISOString()),
    title: "",
    notes: "",
  });
  const [timeOffSaving, setTimeOffSaving] = useState(false);

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleDialogTab, setScheduleDialogTab] = useState<"schedule" | "exceptions">("schedule");
  const [scheduleEmployeeId, setScheduleEmployeeId] = useState<string>("");
  const [scheduleRows, setScheduleRows] = useState<ScheduleDayRow[]>(() =>
    buildScheduleEditorRows(null, [], []),
  );
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const [draggingAppointment, setDraggingAppointment] = useState<DragAppointmentDraft | null>(null);
  const [dragHoverSlot, setDragHoverSlot] = useState<string | null>(null);
  const [movingAppointmentId, setMovingAppointmentId] = useState<string | null>(null);
  const [resizingAppointmentId, setResizingAppointmentId] = useState<string | null>(null);
  const [resizingAppointmentDraft, setResizingAppointmentDraft] = useState<ResizeAppointmentDraft | null>(null);

  const appointmentIinPreview = deriveIdentityFromIinClient(appointmentForm.clientIin);
  const selectedAppointmentSlot =
    slotDraft
      ? slotDraft.candidateSlots?.find((item) => item.employeeId === slotDraft.employeeId) ||
      (slotDraft.employeeId
        ? { employeeId: slotDraft.employeeId, startsAt: slotDraft.startsAt, endsAt: slotDraft.endsAt }
        : null)
      : null;
  const appointmentPreviewStartIso = selectedAppointmentSlot?.startsAt || slotDraft?.startsAt || null;
  const selectedEmployeeIdsKey = selectedEmployeeIds.join(",");
  const normalizedPrefill = useMemo(
    () => ({
      clientName: (prefill?.clientName || "").trim(),
      clientPhone: (prefill?.clientPhone || "").trim(),
      clientIin: normalizeIin(prefill?.clientIin || "").slice(0, 12),
      clientComment: (prefill?.clientComment || "").trim(),
      source: (prefill?.source || "dashboard").trim() || "dashboard",
      externalRef: (prefill?.externalRef || "").trim() || undefined,
    }),
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
    if (appointmentDialogMode !== "create" || !appointmentDialogOpen || !slotDraft || !calendarData) return;
    const targetStartIso = slotDraft.startsAt;
    const visibleIds = selectionInitialized ? new Set(selectedEmployeeIds) : new Set<string>();
    const candidates = (calendarData.slots || [])
      .filter(
        (slot) =>
          slot.startsAt === targetStartIso &&
          (!selectionInitialized || !visibleIds.size || visibleIds.has(slot.employeeId)),
      )
      .map((slot) => ({ employeeId: slot.employeeId, startsAt: slot.startsAt, endsAt: slot.endsAt }));

    if (!candidates.length) {
      setSlotDraft((prev) => (prev ? { ...prev, candidateSlots: [], employeeId: null } : prev));
      return;
    }

    setSlotDraft((prev) => {
      if (!prev) return prev;
      const currentEmployeeId = prev.employeeId && candidates.some((c) => c.employeeId === prev.employeeId) ? prev.employeeId : candidates[0].employeeId;
      const current = candidates.find((c) => c.employeeId === currentEmployeeId) || candidates[0];
      if (
        prev.employeeId === current.employeeId &&
        prev.startsAt === current.startsAt &&
        prev.endsAt === current.endsAt &&
        (prev.candidateSlots?.length || 0) === candidates.length
      ) {
        return prev;
      }
      return {
        ...prev,
        employeeId: current.employeeId,
        startsAt: current.startsAt,
        endsAt: current.endsAt,
        candidateSlots: candidates,
      };
    });
  }, [appointmentDialogMode, appointmentDialogOpen, slotDraft?.startsAt, calendarData, selectionInitialized, selectedEmployeeIdsKey]);

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
              durationMin: slotAvailabilityDurationMin ?? undefined,
            });
        if (!active) return;
        setCalendarData(response);
        if (!selectionInitialized) {
          setSelectedEmployeeIds(response.employees.map((e) => e.id));
          setSelectionInitialized(true);
        }
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
  }, [anchorDate.getTime(), view, refreshTick, selectionInitialized, slotAvailabilityDurationMin]);

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
  const getEmployeeSlotStepMin = (employeeId?: string | null) =>
    normalizeDurationStepMin(employeeId ? employeesById.get(employeeId)?.slotDurationMin : null, BOOKING_STEP_MIN);
  const selectedAppointmentEmployeeId = selectedAppointmentSlot?.employeeId || slotDraft?.employeeId || null;
  const appointmentDurationStepMin = getEmployeeSlotStepMin(selectedAppointmentEmployeeId);
  const rawAppointmentDurationMin = clampAppointmentDurationMin(appointmentForm.durationMin);
  const appointmentDurationMin =
    appointmentDialogMode === "create"
      ? alignDurationToStep(rawAppointmentDurationMin, appointmentDurationStepMin, appointmentDurationStepMin)
      : rawAppointmentDurationMin;
  const appointmentDurationPresets = useMemo(
    () =>
      buildDurationPresets(
        appointmentDialogMode === "create" ? appointmentDurationStepMin : BOOKING_STEP_MIN,
        appointmentDurationMin,
      ),
    [appointmentDialogMode, appointmentDurationStepMin, appointmentDurationMin],
  );
  const appointmentStartTimeOptions = useMemo(() => {
    if (appointmentDialogMode !== "create" || !slotDraft?.employeeId || !calendarData) return [];
    const targetDayKey = toDateKeyLocal(new Date(slotDraft.startsAt));
    const unique = new Map<string, string>();

    for (const slot of calendarData.slots || []) {
      if (slot.employeeId !== slotDraft.employeeId) continue;
      const startsAt = new Date(slot.startsAt);
      if (Number.isNaN(startsAt.getTime())) continue;
      if (toDateKeyLocal(startsAt) !== targetDayKey) continue;
      if (!unique.has(slot.startsAt)) {
        unique.set(
          slot.startsAt,
          startsAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        );
      }
    }

    return Array.from(unique.entries())
      .sort((a, b) => +new Date(a[0]) - +new Date(b[0]))
      .map(([value, label]) => ({ value, label }));
  }, [appointmentDialogMode, slotDraft?.employeeId, slotDraft?.startsAt, calendarData]);
  const appointmentPreviewEndIso = appointmentPreviewStartIso
    ? addMinutesToIso(appointmentPreviewStartIso, appointmentDurationMin)
    : null;
  const selectedSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);
  const visibleEmployees = useMemo(
    () => (selectionInitialized ? employees.filter((employee) => selectedSet.has(employee.id)) : employees),
    [selectionInitialized, employees, selectedSet],
  );
  const visibleEmployeeIdSet = useMemo(() => new Set(visibleEmployees.map((employee) => employee.id)), [visibleEmployees]);

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

  const timeRows = useMemo(() => {
    let minMinute = 8 * 60;
    let maxMinute = 20 * 60;
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
    minMinute = Math.max(0, Math.floor(minMinute / TIMELINE_STEP_MIN) * TIMELINE_STEP_MIN);
    maxMinute = Math.min(24 * 60, Math.ceil(maxMinute / TIMELINE_STEP_MIN) * TIMELINE_STEP_MIN);
    const rows: number[] = [];
    for (let minute = minMinute; minute < maxMinute; minute += TIMELINE_STEP_MIN) rows.push(minute);
    return rows;
  }, [calendarData?.workRules, visibleEmployees, activeAppointments, visibleEmployeeIdSet]);
  const timeRowIndexByMinute = useMemo(
    () => new Map(timeRows.map((minute, index) => [minute, index] as const)),
    [timeRows],
  );

  const {
    workRulesByEmployee,
    breakRulesByEmployee,
    monthStats,
    holidaysByDateKey,
    blockedHolidaysByDateKey,
    blockingHolidayByDateKey,
    holidayWorkOverrideDateKeys,
    appointmentByEmployeeCellKey,
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
    slotStepMin: TIMELINE_STEP_MIN,
  });

  const weekDaysCount = Math.max(dayListForTimeline.length, 1);
  const weekTimeColumnWidth = 52;
  const weekDayMinColumnWidth = Math.max(92, Math.floor((920 - weekTimeColumnWidth) / weekDaysCount));
  const weekGridMinWidth = weekTimeColumnWidth + weekDayMinColumnWidth * weekDaysCount;
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

  const scheduleHolidayPreview: ScheduleHolidayPreviewItem[] = useMemo(
    () =>
      (calendarData?.holidays || [])
        .map((holiday) => ({
          id: holiday.id,
          title: holiday.title,
          dateLabel: holiday.date,
          isRecurringYearly: holiday.isRecurringYearly,
          isWorkingDayOverride: holiday.isWorkingDayOverride,
        }))
        .sort((a, b) => a.dateLabel.localeCompare(b.dateLabel))
        .slice(0, 6),
    [calendarData?.holidays],
  );

  const scheduleTimeOffPreview: ScheduleTimeOffPreviewItem[] = useMemo(
    () =>
      (calendarData?.timeOff || [])
        .filter((item) => !scheduleEmployeeId || item.employeeId === null || item.employeeId === scheduleEmployeeId)
        .map((item) => {
          const employee = item.employeeId ? employeesById.get(item.employeeId) : null;
          return {
            id: item.id,
            employeeLabel: employee?.name || (item.employeeId ? "Сотрудник" : "Все сотрудники"),
            type: item.type,
            typeLabel: getTimeOffTypeLabelRu(item.type),
            title: item.title || null,
            startsAt: item.startsAt,
            endsAt: item.endsAt,
          };
        })
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
        .slice(0, 6),
    [calendarData?.timeOff, scheduleEmployeeId, employeesById],
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

  const toggleEmployee = (employeeId: string, nextChecked: boolean) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (nextChecked) next.add(employeeId);
      else next.delete(employeeId);
      if (next.size === 0) return prev;
      return Array.from(next);
    });
  };

  const openCreateEmployeeDialog = () => {
    setEmployeeDialogMode("create");
    setEditingEmployeeId(null);
    setEmployeeForm({
      name: "",
      specialty: "",
      slotDurationMin: 30,
      color: getNextEmployeeColor(employees),
    });
    setEmployeeDialogOpen(true);
  };

  const openEditEmployeeDialog = (employee: BookingEmployee) => {
    setEmployeeDialogMode("edit");
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      name: employee.name || "",
      specialty: employee.specialty || "",
      slotDurationMin: employee.slotDurationMin || 30,
      color: employee.color || getEmployeeColorFallback(employee.id),
    });
    setEmployeeDialogOpen(true);
  };

  const openCreateAppointmentFromSlot = (draft: SlotDraft) => {
    const normalizedDraft: SlotDraft =
      draft.candidateSlots && draft.candidateSlots.length
        ? (() => {
          const selected =
            draft.candidateSlots.find((slot) => slot.employeeId === draft.employeeId) || draft.candidateSlots[0];
          return {
            ...draft,
            employeeId: selected.employeeId,
            startsAt: selected.startsAt,
            endsAt: selected.endsAt,
          };
        })()
        : draft;
    setSlotDraft(normalizedDraft);
    const slotStepMin = getEmployeeSlotStepMin(normalizedDraft.employeeId);
    const draftDuration = alignDurationToStep(
      getDurationMinBetween(normalizedDraft.startsAt, normalizedDraft.endsAt),
      slotStepMin,
      slotStepMin,
    );
    setActiveAppointmentId(null);
    setAppointmentDialogMode("create");
    setAppointmentForm({
      clientName: normalizedPrefill.clientName,
      clientPhone: normalizedPrefill.clientPhone,
      clientIin: normalizedPrefill.clientIin,
      clientComment: normalizedPrefill.clientComment,
      durationMin: draftDuration,
    });
    setSlotAvailabilityDurationMin(draftDuration);
    setAppointmentDialogOpen(true);
  };

  const openExistingAppointmentDialog = (appointment: BookingAppointment) => {
    const durationMin =
      appointment.durationMin ||
      Math.max(1, Math.round((new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime()) / (60 * 1000)));
    setActiveAppointmentId(appointment.id);
    setAppointmentDialogMode("view");
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
    });
    setAppointmentDialogOpen(true);
  };

  const handleAppointmentDialogOpenChange = (open: boolean) => {
    setAppointmentDialogOpen(open);
    if (!open) {
      setAppointmentDialogMode("create");
      setActiveAppointmentId(null);
      setSlotDraft(null);
      setSlotAvailabilityDurationMin(null);
      setResizingAppointmentDraft(null);
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
        slotDurationMin: 30,
        color: getNextEmployeeColor(employees),
      });
    }
  };

  const patchAppointmentForm = (patch: Partial<typeof appointmentForm>) => {
    setAppointmentForm((prev) => ({ ...prev, ...patch }));
  };

  const startEditingAppointmentFromDialog = () => {
    if (!activeAppointmentId) return;
    setAppointmentDialogMode("edit");
  };

  const handleAppointmentSlotEmployeeChange = (nextEmployeeId: string) => {
    const nextSlotStepMin = getEmployeeSlotStepMin(nextEmployeeId || null);
    const nextDurationMin = alignDurationToStep(appointmentForm.durationMin, nextSlotStepMin, nextSlotStepMin);
    patchAppointmentForm({ durationMin: nextDurationMin });
    if (appointmentDialogMode === "create") {
      setSlotAvailabilityDurationMin(nextDurationMin);
    }
    setSlotDraft((prev) => {
      if (!prev) return prev;
      const targetDayKey = toDateKeyLocal(new Date(prev.startsAt));
      const slotsForEmployeeDay = (calendarData?.slots || [])
        .filter((slot) => {
          if (slot.employeeId !== nextEmployeeId) return false;
          const startsAt = new Date(slot.startsAt);
          if (Number.isNaN(startsAt.getTime())) return false;
          return toDateKeyLocal(startsAt) === targetDayKey;
        })
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
      const nextSlot =
        slotsForEmployeeDay.find((item) => item.startsAt === prev.startsAt) ||
        slotsForEmployeeDay[0] ||
        prev.candidateSlots?.find((item) => item.employeeId === nextEmployeeId);
      const nextStartsAt = nextSlot?.startsAt || prev.startsAt;
      return {
        ...prev,
        employeeId: nextEmployeeId || null,
        startsAt: nextStartsAt,
        endsAt: addMinutesToIso(nextStartsAt, nextDurationMin),
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
      await replaceBookingEmployeeWorkRules(scheduleEmployeeId, workRules);
      await replaceBookingEmployeeBreakRules(scheduleEmployeeId, breakRules);
      toast({ title: "Регулярный график сохранён" });
      setScheduleDialogOpen(false);
      refreshCalendar();
    } catch (error) {
      toast({ title: "Ошибка сохранения графика", description: getErrorMessage(error) });
    } finally {
      setScheduleSaving(false);
    }
  };

  const moveAppointmentToAvailableSlot = async (slot: { startsAt: string; endsAt: string; employeeId: string }) => {
    if (!draggingAppointment) return;
    if (draggingAppointment.id === movingAppointmentId) return;
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

    setMovingAppointmentId(draggingAppointment.id);
    try {
      await updateBookingAppointment(draggingAppointment.id, {
        employeeId: slot.employeeId,
        startsAt: nextStart.toISOString(),
        endsAt: nextEnd.toISOString(),
      });
      toast({ title: "Запись перенесена" });
      refreshCalendar();
    } catch (error) {
      const err = error as BookingApiError;
      toast({
        title: getBookingErrorTitleRu(err.code) || "Не удалось перенести запись",
        description: getErrorMessage(error),
      });
    } finally {
      setMovingAppointmentId(null);
      setDragHoverSlot(null);
      setDraggingAppointment(null);
    }
  };

  const commitAppointmentResize = async (appointment: BookingAppointment, nextEndsAt: string) => {
    const durationStepMin = getEmployeeSlotStepMin(appointment.employeeId);
    const nextDurationMin = alignDurationToStep(
      getDurationMinBetween(appointment.startsAt, nextEndsAt),
      durationStepMin,
      durationStepMin,
    );
    const normalizedEndsAt = addMinutesToIso(appointment.startsAt, nextDurationMin);
    setResizingAppointmentId(appointment.id);
    try {
      await updateBookingAppointment(appointment.id, {
        endsAt: normalizedEndsAt,
        durationMin: nextDurationMin,
      });
      toast({ title: "Длительность записи обновлена" });
      refreshCalendar();
    } catch (error) {
      const err = error as BookingApiError;
      toast({
        title: getBookingErrorTitleRu(err.code) || "Не удалось изменить длительность",
        description: getErrorMessage(error),
      });
    } finally {
      setResizingAppointmentId(null);
      setResizingAppointmentDraft(null);
    }
  };

  const startAppointmentResize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    appointment: BookingAppointment,
    slotHeightPx: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (movingAppointmentId || resizingAppointmentId) return;

    const startClientY = event.clientY;
    const durationStepMin = getEmployeeSlotStepMin(appointment.employeeId);
    const baseDurationMin = alignDurationToStep(
      getDurationMinBetween(appointment.startsAt, appointment.endsAt),
      durationStepMin,
      durationStepMin,
    );
    let nextDurationMin = baseDurationMin;
    setDragHoverSlot(null);
    setDraggingAppointment(null);
    setResizingAppointmentDraft({
      appointmentId: appointment.id,
      endsAt: appointment.endsAt,
    });

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startClientY;
      const resizeStepPx = Math.max(2, (slotHeightPx * durationStepMin) / TIMELINE_STEP_MIN);
      const deltaSteps = Math.round(deltaY / resizeStepPx);
      const candidateDurationMin = alignDurationToStep(
        baseDurationMin + deltaSteps * durationStepMin,
        durationStepMin,
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
    const durationStepMin = getEmployeeSlotStepMin(selectedSlot.employeeId);
    const durationMin = activeAppointmentId
      ? clampAppointmentDurationMin(appointmentForm.durationMin)
      : alignDurationToStep(appointmentForm.durationMin, durationStepMin, durationStepMin);
    if (!appointmentForm.clientName.trim()) {
      toast({ title: "Укажите имя клиента" });
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
    setAppointmentSaving(true);
    try {
      const computedEndsAt = addMinutesToIso(selectedSlot.startsAt, durationMin);
      if (activeAppointmentId) {
        await updateBookingAppointment(activeAppointmentId, {
          employeeId: selectedSlot.employeeId,
          startsAt: selectedSlot.startsAt,
          endsAt: computedEndsAt,
          durationMin,
          clientName: appointmentForm.clientName.trim(),
          clientPhone: appointmentForm.clientPhone.trim() || undefined,
          clientIin: iinNormalized || undefined,
          clientComment: appointmentForm.clientComment.trim() || undefined,
        });
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
        });
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
    if (employeeDialogMode === "create") {
      if (
        !Number.isFinite(slotDurationMin) ||
        slotDurationMin < BOOKING_STEP_MIN ||
        slotDurationMin > 720 ||
        slotDurationMin % BOOKING_STEP_MIN !== 0
      ) {
        toast({ title: "Слот должен быть от 10 до 720 минут и кратным 10" });
        return;
      }
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
        });
        setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, result.employee.id])));
        toast({ title: `Сотрудник обновлён: ${result.employee.name}` });
      } else {
        const result = await createBookingEmployee({
          name: employeeForm.name.trim(),
          specialty: employeeForm.specialty.trim() || undefined,
          color: employeeForm.color,
          slotDurationMin,
        });
        setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, result.employee.id])));
        toast({ title: `Сотрудник создан: ${result.employee.name}` });
      }
      setEmployeeDialogOpen(false);
      setEmployeeDialogMode("create");
      setEditingEmployeeId(null);
      setEmployeeForm({
        name: "",
        specialty: "",
        slotDurationMin: 30,
        color: getNextEmployeeColor(employees),
      });
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
      await createBookingHoliday({
        date: holidayDate,
        title: holidayForm.title.trim(),
        isRecurringYearly: holidayForm.isRecurringYearly,
        isWorkingDayOverride: holidayForm.isWorkingDayOverride,
      });
      toast({ title: "Праздник добавлен" });
      setHolidayDialogOpen(false);
      refreshCalendar();
    } catch (error) {
      toast({ title: "Ошибка добавления праздника", description: getErrorMessage(error) });
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
      await createBookingTimeOff({
        employeeId: timeOffForm.employeeId === "all" ? null : timeOffForm.employeeId,
        type: timeOffForm.type,
        startsAt,
        endsAt,
        title: timeOffForm.title.trim() || undefined,
        notes: timeOffForm.notes.trim() || undefined,
      });
      toast({ title: "Блокировка времени добавлена" });
      setTimeOffDialogOpen(false);
      refreshCalendar();
    } catch (error) {
      toast({ title: "Ошибка добавления блокировки", description: getErrorMessage(error) });
    } finally {
      setTimeOffSaving(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      await cancelBookingAppointment(appointmentId);
      toast({ title: "Запись отменена" });
      refreshCalendar();
    } catch (error) {
      toast({ title: "Ошибка отмены", description: getErrorMessage(error) });
    }
  };

  const daySlotHeightClass = "h-8";
  const weekSlotHeightClass = "min-h-10";
  const dayTimeRowClass = "flex h-8 items-start justify-end bg-background border-t px-2 pt-0.5 text-xs text-muted-foreground";
  const weekTimeRowClass = "flex min-h-10 items-start justify-end bg-background border-t px-2 py-1 text-xs text-muted-foreground";
  const now = new Date();
  const nowDateKey = toDateKeyLocal(now);
  const nowMinuteOfDay = now.getHours() * 60 + now.getMinutes();
  const isCurrentTimelineSlot = (day: Date, minuteOfDay: number) =>
    toDateKeyLocal(day) === nowDateKey && nowMinuteOfDay >= minuteOfDay && nowMinuteOfDay < minuteOfDay + TIMELINE_STEP_MIN;

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

    const employeeWorkRules = (workRulesByEmployee[employee.id] || []) as BookingWorkRule[];
    const employeeBreakRules = (breakRulesByEmployee[employee.id] || []) as BookingBreakRule[];
    const weekday = cellStart.getDay();
    const holiday = blockingHolidayByDateKey.get(dayKey);
    const workOverride = holidayWorkOverrideDateKeys.has(dayKey);

    const inWork = employeeWorkRules.some(
      (rule) =>
        rule.isActive &&
        rule.weekday === weekday &&
        minuteOfDay >= rule.startMinute &&
        minuteOfDay + TIMELINE_STEP_MIN <= rule.endMinute,
    );
    const onBreak = employeeBreakRules.find(
      (rule) =>
        rule.isActive &&
        rule.weekday === weekday &&
        minuteOfDay < rule.endMinute &&
        minuteOfDay + TIMELINE_STEP_MIN > rule.startMinute,
    );

    const timeOff = timeOffByEmployeeCellKey.get(employeeCellKey) || globalTimeOffByCellKey.get(cellDayMinuteKey);
    const appointment = appointmentByEmployeeCellKey.get(employeeCellKey);

    const availableCandidates = (availableCandidatesByDayMinuteKey.get(cellDayMinuteKey) || []).filter(
      (slot) => slot.employeeId === employee.id,
    );
    const available = availableCandidates[0];
    const cellSlotKey = available
      ? slotKey(available.employeeId, available.startsAt)
      : `${employee.id}|${dayKey}|${minuteOfDay}`;
    const isDropHover = dragHoverSlot === cellSlotKey;

    const appointmentStartMinuteOfDay = appointment
      ? (() => {
        const startsAt = new Date(appointment.startsAt);
        if (Number.isNaN(startsAt.getTime()) || toDateKeyLocal(startsAt) !== dayKey) return null;
        return startsAt.getHours() * 60 + startsAt.getMinutes();
      })()
      : null;
    const appointmentStartsHere =
      appointmentStartMinuteOfDay !== null &&
      appointmentStartMinuteOfDay >= minuteOfDay &&
      appointmentStartMinuteOfDay < minuteOfDay + TIMELINE_STEP_MIN;
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

        const previousVisibleMinute = timeRows[currentRowIndex - 1];
        if (previousVisibleMinute === undefined) return true;

        const prevDayMinuteKey = dayMinuteKeyLocal(dayKey, previousVisibleMinute);
        const prevEmployeeCellKey = employeeCellKeyLocal(employee.id, dayKey, previousVisibleMinute);
        const prevTimeOff =
          timeOffByEmployeeCellKey.get(prevEmployeeCellKey) || globalTimeOffByCellKey.get(prevDayMinuteKey);
        return prevTimeOff?.id !== timeOff.id;
      })()
      : false;
    const isCurrentSlot = isCurrentTimelineSlot(day, minuteOfDay);
    const resizingDraftEndsAt =
      appointment && resizingAppointmentDraft?.appointmentId === appointment.id
        ? resizingAppointmentDraft.endsAt
        : appointment?.endsAt;
    const appointmentDurationMinForRender =
      appointment && resizingDraftEndsAt
        ? getDurationMinBetween(appointment.startsAt, resizingDraftEndsAt)
        : 0;
    const appointmentStartOffsetMin =
      appointmentStartsHere && appointmentStartMinuteOfDay !== null
        ? appointmentStartMinuteOfDay - minuteOfDay
        : 0;
    const slotHeightPx = layout === "week" ? 40 : 32;
    const exactSlotFactor = appointmentDurationMinForRender / TIMELINE_STEP_MIN;
    const appointmentBlockHeightPx = Math.max(6, Math.round(slotHeightPx * exactSlotFactor) - 2);
    const appointmentBlockTopPx = 0.5 + Math.round((slotHeightPx * appointmentStartOffsetMin) / TIMELINE_STEP_MIN);
    const showAppointmentName = appointmentBlockHeightPx >= 9;
    const showAppointmentPhone = layout === "day" && appointmentBlockHeightPx >= 22;
    const showResizeHandle = layout === "day" && appointmentBlockHeightPx >= 12;
    const appointmentSpansMultipleTimelineRows =
      appointmentStartsHere && appointmentStartOffsetMin + appointmentDurationMinForRender > TIMELINE_STEP_MIN;
    const showWeekWrapIcon = layout === "week" && showAppointmentName && appointmentSpansMultipleTimelineRows;
    const isResizingThisAppointment =
      Boolean(appointment && resizingAppointmentDraft?.appointmentId === appointment.id) ||
      Boolean(appointment && resizingAppointmentId === appointment.id);

    let state: "off" | "working" | "break" | "holiday" | "timeoff" | "appointment" | "available" = "off";
    if (holiday && !workOverride) state = "holiday";
    else if (appointment) state = "appointment";
    else if (timeOff) state = "timeoff";
    else if (onBreak) state = "break";
    else if (available) state = "available";
    else if (inWork) state = "working";

    const baseClass = cn(
      "relative overflow-hidden border-l border-t p-0.5 text-left transition-colors first:border-l-0",
      layout === "week" ? weekSlotHeightClass : daySlotHeightClass,
    );
    const className = cn(
      baseClass,
      state === "off" && "bg-background/40",
      state === "working" && "bg-muted/25",
      state === "break" && "bg-amber-50 text-amber-900",
      state === "holiday" && "bg-rose-50/60 text-rose-700",
      state === "timeoff" && "bg-amber-50 text-amber-900",
      state === "appointment" && "bg-transparent",
      state === "available" && "cursor-pointer bg-sky-50 hover:bg-sky-100",
      appointment && appointmentStartsHere && "overflow-visible",
      isCurrentSlot && "ring-1 ring-sky-300/80 ring-inset",
      isDropHover && "ring-2 ring-sky-500 ring-inset",
      (movingAppointmentId || resizingAppointmentId) && "transition-opacity",
    );

    if (state === "available" && available) {
      return (
        <button
          key={employee.id + cellStart.toISOString()}
          type="button"
          className={className}
          onDragOver={(event) => {
            if (!draggingAppointment || resizingAppointmentDraft || resizingAppointmentId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDragEnter={(event) => {
            if (!draggingAppointment || resizingAppointmentDraft || resizingAppointmentId) return;
            event.preventDefault();
            setDragHoverSlot(cellSlotKey);
          }}
          onDragLeave={() => {
            if (dragHoverSlot === cellSlotKey) setDragHoverSlot(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragHoverSlot(null);
            void moveAppointmentToAvailableSlot(available);
          }}
          onClick={() =>
            openCreateAppointmentFromSlot({
              employeeId: employee.id,
              startsAt: available.startsAt,
              endsAt: available.endsAt,
            })
          }
          title={`Создать запись: ${employee.name}, ${formatMinuteLabel(minuteOfDay)}`}>
          {isCurrentSlot ? <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-sky-500" /> : null}
          <span className="text-[10px] text-sky-700">+</span>
        </button>
      );
    }

    return (
      <div key={employee.id + cellStart.toISOString()} className={className}>
        {isCurrentSlot ? <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-sky-500" /> : null}
        {appointment && appointmentStartsHere ? (
          <div
            className={cn(
              "absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-md border px-1 py-0.5 text-white",
              "flex min-w-0 flex-col justify-center",
              "cursor-grab active:cursor-grabbing",
              movingAppointmentId === appointment.id && "opacity-50",
              isResizingThisAppointment && layout === "day" && "cursor-row-resize ring-1 ring-white/80",
            )}
            style={{
              backgroundColor: employee.color || "#10b981",
              borderColor: employee.color || "#10b981",
              top: `${appointmentBlockTopPx}px`,
              height: `${appointmentBlockHeightPx}px`,
            }}
            draggable={movingAppointmentId !== appointment.id && !isResizingThisAppointment}
            onDragStart={(event) => {
              if (isResizingThisAppointment) {
                event.preventDefault();
                return;
              }
              setDraggingAppointment({
                id: appointment.id,
                employeeId: appointment.employeeId,
                startsAt: appointment.startsAt,
                endsAt: appointment.endsAt,
                clientName: appointment.clientName,
              });
              event.dataTransfer.effectAllowed = "move";
              try {
                event.dataTransfer.setData("text/plain", appointment.id);
              } catch { }
            }}
            onDragEnd={() => {
              setDragHoverSlot(null);
              setDraggingAppointment(null);
            }}
            onClick={(event) => {
              event.stopPropagation();
              openExistingAppointmentDialog(appointment);
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
                <span className="min-w-0 truncate">{appointment.clientName}</span>
              </span>
            ) : null}
            {showAppointmentPhone ? (
              <span className="mt-0.5 truncate text-[10px] leading-none text-white/90">
                {appointment.clientPhone || "Без номера"}
              </span>
            ) : null}
            {showResizeHandle ? (
              <button
                type="button"
                className="absolute inset-x-0 bottom-0 flex h-2.5 items-center justify-center cursor-row-resize"
                onPointerDown={(event) => startAppointmentResize(event, appointment, slotHeightPx)}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                aria-label="Изменить длительность записи"
                title="Потяните вниз или вверх, чтобы изменить длительность"
              >
                <span className="h-0.5 w-5 rounded bg-white/90" />
              </button>
            ) : null}
          </div>
        ) : null}
        {!appointment && timeOff && timeOffLabelStartsHere ? (
          <div className="relative z-0 truncate px-1 text-[10px] font-medium">
            {timeOff.title || getTimeOffTypeLabelRu(timeOff.type)}
          </div>
        ) : null}
        {!appointment && !timeOff && onBreak ? (
          <div className="relative z-0 truncate px-1 text-[10px]">{onBreak.title || "Перерыв"}</div>
        ) : null}
        {!appointment && !timeOff && !onBreak && holiday ? (
          <div className="relative z-0 truncate px-1 text-[10px]">{holiday.title}</div>
        ) : null}
      </div>
    );
  };

  const renderWeekAggregateCell = (day: Date, minuteOfDay: number) => {
    const cellStart = createCellDate(day, minuteOfDay);
    const cellEnd = new Date(cellStart);
    cellEnd.setMinutes(cellEnd.getMinutes() + TIMELINE_STEP_MIN);
    const dayKey = toDateKeyLocal(day);
    const cellDayMinuteKey = dayMinuteKeyLocal(dayKey, minuteOfDay);
    const key = `week-${toDateKeyLocal(day)}-${minuteOfDay}`;

    const holiday = blockingHolidayByDateKey.get(dayKey);

    const appointmentsOverlapping = appointmentsOverlappingByDayMinuteKey.get(cellDayMinuteKey) || [];
    const overlappingTimeOff = timeOffOverlappingByDayMinuteKey.get(cellDayMinuteKey) || [];
    const availableCandidates = availableCandidatesByDayMinuteKey.get(cellDayMinuteKey) || [];
    const availableSlotsCount = availableCandidates.length;

    const hiddenAppointments = Math.max(0, appointmentsOverlapping.length - 2);
    const isCurrentSlot = isCurrentTimelineSlot(day, minuteOfDay);

    const className = cn(
      "relative overflow-hidden border-l border-t px-0.5 py-0.5 first:border-l-0",
      weekSlotHeightClass,
      holiday ? "bg-rose-50/60" : "bg-background/40",
      appointmentsOverlapping.length > 0 && "bg-background",
      availableSlotsCount > 0 && appointmentsOverlapping.length === 0 && !holiday && "bg-sky-50/40",
      isCurrentSlot && "ring-1 ring-sky-300/80 ring-inset",
    );
    const canCreateInSlot = availableSlotsCount > 0;

    return (
      <div key={key} className={className} title={holiday?.title || undefined}>
        {isCurrentSlot ? <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-sky-500" /> : null}
        {appointmentsOverlapping.length > 0 || canCreateInSlot ? (
          <div className="flex flex-col gap-1">
            {appointmentsOverlapping.slice(0, 2).map((appointment) => {
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
                  key={`${appointment.id}-${cellDayMinuteKey}`}
                  className="flex h-[18px] max-w-full items-center gap-1 rounded-[4px] px-1.5 text-[10px] leading-none text-white hover:brightness-95"
                  style={{ backgroundColor: employee?.color || "#0ea5e9" }}
                  title={`${employee?.name || "Сотрудник"} · ${appointment.clientName}${appointment.clientPhone ? ` · ${appointment.clientPhone}` : ""
                    }`}
                  onClick={() => openExistingAppointmentDialog(appointment)}
                >
                  {showWrapIcon ? <CornerDownRight className="size-2.5 shrink-0" /> : null}
                  <span className="min-w-0 truncate font-semibold">{appointment.clientName}</span>
                </button>
              );
            })}
            {hiddenAppointments > 0 ? (
              <div className="text-muted-foreground flex items-center gap-1 truncate text-[10px] leading-none">
                <CornerDownRight className="size-3 shrink-0" />
                <span className="truncate">+ ещё {hiddenAppointments}</span>
              </div>
            ) : null}
            {canCreateInSlot ? (
              <button
                type="button"
                className="flex h-[18px] max-w-full items-center gap-1 rounded-[4px] border border-sky-200/80 bg-sky-100/80 px-1.5 text-[10px] leading-none text-sky-900 hover:bg-sky-200/70"
                title={`Создать запись (${availableSlotsCount}/${Math.max(visibleEmployees.length, 1)} свободно)`}
                onClick={() =>
                  openCreateAppointmentFromSlot({
                    employeeId: availableCandidates[0]?.employeeId || null,
                    startsAt: availableCandidates[0]?.startsAt || cellStart.toISOString(),
                    endsAt: availableCandidates[0]?.endsAt || cellEnd.toISOString(),
                    candidateSlots: availableCandidates,
                  })
                }>
                <Plus className="size-3 shrink-0" />
                <span className="font-semibold text-sky-900">
                  {availableSlotsCount}/{Math.max(visibleEmployees.length, 1)}
                </span>
              </button>
            ) : null}
          </div>
        ) : overlappingTimeOff.length > 0 ? (
          <div className="truncate text-[10px] text-amber-800">
            {overlappingTimeOff.length === 1
              ? overlappingTimeOff[0].title || getTimeOffTypeLabelRu(overlappingTimeOff[0].type)
              : `Блокировки: ${overlappingTimeOff.length}`}
          </div>
        ) : holiday ? (
          <div className="truncate text-[10px] text-rose-700">{holiday.title}</div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid min-[1100px]:grid-cols-[280px_minmax(0,1fr)] min-[1400px]:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="min-w-0 border-slate-200/80 gap-4 py-4">
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
              <ScrollArea className="h-56 rounded-md">
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
              </ScrollArea>
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
                        const dayHolidays = blockedHolidaysByDateKey.get(dayKey) || [];
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
                              "min-h-24 rounded-xl border p-2 text-left transition hover:border-slate-400 hover:bg-muted/20 bg-background",
                              !isSameMonth(day, anchorDate) && "opacity-45",
                              isToday && "border-slate-900 shadow-sm",
                              dayHolidays.length > 0 && "border-rose-200 bg-rose-50/60",
                            )}>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm font-semibold">{day.getDate()}</span>
                              <div className="flex items-center gap-1">
                                {dayHolidays.length > 0 ? (
                                  <span className="inline-block size-2 rounded-full bg-rose-500" title={dayHolidays.map((h) => h.title).join(", ")} />
                                ) : null}
                                {isToday ? <Badge variant="outline">Сегодня</Badge> : null}
                              </div>
                            </div>
                            <div className="pt-1">
                              {dayHolidays.length > 0 ? (
                                <div
                                  className="mb-1 truncate rounded-md bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700"
                                  title={dayHolidays.map((h) => h.title).join(", ")}
                                >
                                  {dayHolidays[0]?.title}
                                  {dayHolidays.length > 1 ? ` +${dayHolidays.length - 1}` : ""}
                                </div>
                              ) : null}
                              <div className="rounded-md bg-card px-2 py-1 text-[11px]">
                                <span className="text-muted-foreground">Записано:</span>{" "}
                                <span className="font-semibold text-foreground">{appointmentsCount}</span>
                                <span className="text-muted-foreground"> · Свободно:</span>{" "}
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
                    timeRows={timeRows}
                    weekGridMinWidth={weekGridMinWidth}
                    weekTimeColumnWidth={weekTimeColumnWidth}
                    weekDaysCount={weekDaysCount}
                    weekDayMinColumnWidth={weekDayMinColumnWidth}
                    weekTimeRowClass={weekTimeRowClass}
                    blockedHolidaysByDateKey={blockedHolidaysByDateKey}
                    toDateKeyLocal={toDateKeyLocal}
                    weekdayShortRu={WEEKDAY_SHORT_RU}
                    formatMinuteLabel={formatMinuteLabel}
                    isCurrentTimelineSlot={isCurrentTimelineSlot}
                    renderTimelineCell={renderTimelineCell}
                    renderWeekAggregateCell={renderWeekAggregateCell}
                  />
                ) : (
                  <DayTimeline
                    dayListForTimeline={dayListForTimeline}
                    visibleEmployees={visibleEmployees}
                    timeRows={timeRows}
                    blockedHolidaysByDateKey={blockedHolidaysByDateKey}
                    toDateKeyLocal={toDateKeyLocal}
                    weekdayShortRu={WEEKDAY_SHORT_RU}
                    dayTimeColumnWidth={dayTimeColumnWidth}
                    dayEmployeeMinColumnWidth={dayEmployeeMinColumnWidth}
                    dayTimeRowClass={dayTimeRowClass}
                    daySlotHeightClass={daySlotHeightClass}
                    formatMinuteLabel={formatMinuteLabel}
                    isCurrentTimelineSlot={isCurrentTimelineSlot}
                    renderTimelineCell={renderTimelineCell}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="list" className="mt-0">
              <Card className="border-slate-200/80 bg-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Список записей {view === "day" ? "на день" : "в диапазоне"}</CardTitle>
                  <CardDescription>Быстрый просмотр и отмена записей</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedDayAppointments.length === 0 ? (
                      <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
                        Пока нет записей в выбранном диапазоне.
                      </div>
                    ) : (
                      selectedDayAppointments.slice(0, 20).map((appointment) => {
                        const employee = employeesById.get(appointment.employeeId);
                        return (
                          <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block size-2.5 rounded-full"
                                  style={{ backgroundColor: employee?.color || "#0ea5e9" }}
                                />
                                <span className="truncate font-medium">{appointment.clientName}</span>
                                <Badge variant="success">{getStatusLabelRu(appointment.status)}</Badge>
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
                            <Button variant="outline" size="sm" onClick={() => handleCancelAppointment(appointment.id)}>
                              Отменить
                            </Button>
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

      <AppointmentDialog
        open={appointmentDialogOpen}
        onOpenChange={handleAppointmentDialogOpenChange}
        mode={appointmentDialogMode}
        onStartEdit={startEditingAppointmentFromDialog}
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
                min={10}
                step={10}
                disabled={employeeDialogMode === "edit"}
                value={employeeForm.slotDurationMin}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setEmployeeForm((prev) => ({
                    ...prev,
                    slotDurationMin: Number.isFinite(next) ? next : BOOKING_STEP_MIN,
                  }));
                }}
              />
              {employeeDialogMode === "edit" ? (
                <div className="text-muted-foreground text-xs">Слот фиксируется при создании сотрудника.</div>
              ) : null}
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
                        selected ? "ring-2 ring-offset-2 ring-slate-500 border-slate-700" : "border-slate-200",
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
                        <CalendarPlus className="size-4 text-rose-600" />
                        <div className="text-sm font-semibold">Праздники (в текущем диапазоне)</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setHolidayForm((prev) => ({ ...prev, date: toDateKeyLocal(anchorDate) }));
                          setHolidayDialogOpen(true);
                        }}>
                        Добавить
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {scheduleHolidayPreview.length === 0 ? (
                        <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
                          Нет праздников в текущем диапазоне.
                        </div>
                      ) : (
                        scheduleHolidayPreview.map((holiday) => (
                          <div key={holiday.id} className="rounded-md border bg-rose-50/60 px-3 py-2 text-sm">
                            <div className="font-medium">{holiday.title}</div>
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
                        <Clock3 className="size-4 text-amber-700" />
                        <div className="text-sm font-semibold">Отпуска и блокировки</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTimeOffForm((prev) => ({
                            ...prev,
                            employeeId: scheduleEmployeeId || "all",
                          }));
                          setTimeOffDialogOpen(true);
                        }}>
                        Добавить
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {scheduleTimeOffPreview.length === 0 ? (
                        <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
                          Нет блокировок для выбранного сотрудника / диапазона.
                        </div>
                      ) : (
                        scheduleTimeOffPreview.map((item) => (
                          <div key={item.id} className="rounded-md border bg-amber-50/70 px-3 py-2 text-sm">
                            <div className="font-medium">{item.title || item.typeLabel}</div>
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

      <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Добавить праздник</DialogTitle>
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
            <Button variant="outline" onClick={() => setHolidayDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={submitHoliday} disabled={holidaySaving}>
              {holidaySaving ? "Сохраняю..." : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={timeOffDialogOpen} onOpenChange={setTimeOffDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Отпуск / перерыв / блок времени</DialogTitle>
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
                    minuteStep={10}
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
                    minuteStep={10}
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
            <Button variant="outline" onClick={() => setTimeOffDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={submitTimeOff} disabled={timeOffSaving}>
              {timeOffSaving ? "Сохраняю..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
