"use client";

import { useMemo } from "react";

import type {
  BookingAppointment,
  BookingBreakRule,
  BookingCalendarViewResponse,
  BookingEmployee,
  BookingHoliday,
  BookingSlot,
  BookingWorkRule,
  BookingTimeOff,
} from "@/lib/booking-api";

type MonthStat = { appointments: number; availableSlots: number; holidays: number; timeOff: number };
type RuleGroup = Record<string, Array<BookingWorkRule | BookingBreakRule>>;

export type AppointmentCalendarIndexes = {
  slotMap: Map<string, Pick<BookingSlot, "employeeId" | "startsAt" | "endsAt">>;
  workRulesByEmployee: RuleGroup;
  breakRulesByEmployee: RuleGroup;
  monthStats: Map<string, MonthStat>;
  holidaysByDateKey: Map<string, BookingHoliday[]>;
  blockedHolidaysByDateKey: Map<string, BookingHoliday[]>;
  blockingHolidayByDateKey: Map<string, BookingHoliday>;
  holidayWorkOverrideDateKeys: Set<string>;
  appointmentByEmployeeCellKey: Map<string, BookingAppointment>;
  appointmentStartByEmployeeCellKey: Map<string, BookingAppointment>;
  timeOffByEmployeeCellKey: Map<string, BookingTimeOff>;
  timeOffStartByEmployeeCellKey: Map<string, BookingTimeOff>;
  globalTimeOffByCellKey: Map<string, BookingTimeOff>;
  globalTimeOffStartByCellKey: Map<string, BookingTimeOff>;
  appointmentsStartingByDayMinuteKey: Map<string, BookingAppointment[]>;
  appointmentsOverlappingByDayMinuteKey: Map<string, BookingAppointment[]>;
  timeOffOverlappingByDayMinuteKey: Map<string, BookingTimeOff[]>;
  availableCandidatesByDayMinuteKey: Map<string, Array<Pick<BookingSlot, "employeeId" | "startsAt" | "endsAt">>>;
};

const MS_MINUTE = 60 * 1000;

function toDateKeyLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function minuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function slotKey(employeeId: string, startsAtIso: string) {
  return `${employeeId}|${startsAtIso}`;
}

function dayMinuteKey(dateKey: string, minuteOfDay: number) {
  return `${dateKey}|${minuteOfDay}`;
}

function employeeCellKey(employeeId: string, dateKey: string, minuteOfDay: number) {
  return `${employeeId}|${dateKey}|${minuteOfDay}`;
}

function pushMapArray<T>(map: Map<string, T[]>, key: string, value: T) {
  const current = map.get(key);
  if (current) current.push(value);
  else map.set(key, [value]);
}

function holidayMatchesDate(holiday: BookingHoliday, date: Date) {
  const dateKey = toDateKeyLocal(date);
  if (!holiday.isRecurringYearly) return holiday.date === dateKey;
  return holiday.date.slice(5) === dateKey.slice(5);
}

function indexIntervalBySlots(
  startsAtIso: string,
  endsAtIso: string,
  slotStepMin: number,
  cb: (dateKey: string, minute: number) => void,
) {
  const startsAt = new Date(startsAtIso);
  const endsAt = new Date(endsAtIso);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return;

  const stepMs = slotStepMin * MS_MINUTE;
  const firstSlotMs = Math.floor(startsAt.getTime() / stepMs) * stepMs;
  for (let t = firstSlotMs; t < endsAt.getTime(); t += stepMs) {
    const cellStart = new Date(t);
    const cellEnd = new Date(t + stepMs);
    if (cellStart < endsAt && cellEnd > startsAt) {
      cb(toDateKeyLocal(cellStart), minuteOfDay(cellStart));
    }
  }
}

function groupRulesByEmployee<T extends BookingWorkRule | BookingBreakRule>(rules: T[]) {
  const grouped: RuleGroup = {};
  for (const rule of rules) {
    if (!grouped[rule.employeeId]) grouped[rule.employeeId] = [];
    grouped[rule.employeeId].push(rule);
  }
  return grouped;
}

export function useAppointmentsCalendarIndexes(params: {
  calendarData: BookingCalendarViewResponse | null;
  activeAppointments: BookingAppointment[];
  visibleEmployees: BookingEmployee[];
  monthDays: Date[];
  timelineDays: Date[];
  slotStepMin: number;
}) {
  const visibleEmployeeIdsKey = params.visibleEmployees.map((e) => e.id).join(",");
  const monthDaysKey = params.monthDays.map((d) => d.toISOString().slice(0, 10)).join(",");
  const timelineDaysKey = params.timelineDays.map((d) => d.toISOString().slice(0, 10)).join(",");

  return useMemo<AppointmentCalendarIndexes>(() => {
    const slotMap = new Map<string, Pick<BookingSlot, "employeeId" | "startsAt" | "endsAt">>();
    const availableCandidatesByDayMinuteKey = new Map<
      string,
      Array<Pick<BookingSlot, "employeeId" | "startsAt" | "endsAt">>
    >();
    const workRulesByEmployee = groupRulesByEmployee(params.calendarData?.workRules || []);
    const breakRulesByEmployee = groupRulesByEmployee(params.calendarData?.breakRules || []);

    const holidaysByDateKey = new Map<string, BookingHoliday[]>();
    const blockedHolidaysByDateKey = new Map<string, BookingHoliday[]>();
    const blockingHolidayByDateKey = new Map<string, BookingHoliday>();
    const holidayWorkOverrideDateKeys = new Set<string>();

    const appointmentByEmployeeCellKey = new Map<string, BookingAppointment>();
    const appointmentStartByEmployeeCellKey = new Map<string, BookingAppointment>();
    const timeOffByEmployeeCellKey = new Map<string, BookingTimeOff>();
    const timeOffStartByEmployeeCellKey = new Map<string, BookingTimeOff>();
    const globalTimeOffByCellKey = new Map<string, BookingTimeOff>();
    const globalTimeOffStartByCellKey = new Map<string, BookingTimeOff>();
    const appointmentsStartingByDayMinuteKey = new Map<string, BookingAppointment[]>();
    const appointmentsOverlappingByDayMinuteKey = new Map<string, BookingAppointment[]>();
    const timeOffOverlappingByDayMinuteKey = new Map<string, BookingTimeOff[]>();

    const monthStats = new Map<string, MonthStat>();
    const visibleEmployeeIdSet = new Set(params.visibleEmployees.map((e) => e.id));

    for (const day of params.monthDays) {
      monthStats.set(toDateKeyLocal(day), { appointments: 0, availableSlots: 0, holidays: 0, timeOff: 0 });
    }

    for (const slot of params.calendarData?.slots || []) {
      slotMap.set(slotKey(slot.employeeId, slot.startsAt), {
        employeeId: slot.employeeId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      });
      if (visibleEmployeeIdSet.size && !visibleEmployeeIdSet.has(slot.employeeId)) continue;
      const date = new Date(slot.startsAt);
      if (Number.isNaN(date.getTime())) continue;
      const dayStat = monthStats.get(toDateKeyLocal(date));
      if (dayStat) dayStat.availableSlots += 1;
      const slotMinute = minuteOfDay(date);
      const bucketMinute = Math.floor(slotMinute / params.slotStepMin) * params.slotStepMin;
      const dayKey = dayMinuteKey(toDateKeyLocal(date), bucketMinute);
      const existing = availableCandidatesByDayMinuteKey.get(dayKey);
      if (existing?.some((item) => item.employeeId === slot.employeeId)) continue;
      pushMapArray(availableCandidatesByDayMinuteKey, dayKey, {
        employeeId: slot.employeeId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      });
    }

    const uniqueVisibleDays = new Map<string, Date>();
    for (const day of params.monthDays) uniqueVisibleDays.set(toDateKeyLocal(day), day);
    for (const day of params.timelineDays) {
      const key = toDateKeyLocal(day);
      if (!uniqueVisibleDays.has(key)) uniqueVisibleDays.set(key, day);
    }

    for (const day of uniqueVisibleDays.values()) {
      const dateKey = toDateKeyLocal(day);
      const matched = (params.calendarData?.holidays || []).filter((holiday) => holidayMatchesDate(holiday, day));
      if (!matched.length) continue;
      holidaysByDateKey.set(dateKey, matched);
      const blocked = matched.filter((holiday) => !holiday.isWorkingDayOverride);
      if (blocked.length) {
        blockedHolidaysByDateKey.set(dateKey, blocked);
        blockingHolidayByDateKey.set(dateKey, blocked[0]!);
      }
      if (matched.some((holiday) => holiday.isWorkingDayOverride)) {
        holidayWorkOverrideDateKeys.add(dateKey);
      }
    }

    for (const appointment of params.activeAppointments) {
      if (visibleEmployeeIdSet.has(appointment.employeeId)) {
        const startDate = new Date(appointment.startsAt);
        if (!Number.isNaN(startDate.getTime())) {
          const dateKey = toDateKeyLocal(startDate);
          const stat = monthStats.get(dateKey);
          if (stat) stat.appointments += 1;
          pushMapArray(
            appointmentsStartingByDayMinuteKey,
            dayMinuteKey(dateKey, minuteOfDay(startDate)),
            appointment,
          );
        }

        indexIntervalBySlots(appointment.startsAt, appointment.endsAt, params.slotStepMin, (dateKey, minute) => {
          pushMapArray(
            appointmentsOverlappingByDayMinuteKey,
            dayMinuteKey(dateKey, minute),
            appointment,
          );
        });
      }

      const startDate = new Date(appointment.startsAt);
      if (!Number.isNaN(startDate.getTime())) {
        appointmentStartByEmployeeCellKey.set(
          employeeCellKey(appointment.employeeId, toDateKeyLocal(startDate), minuteOfDay(startDate)),
          appointment,
        );
      }

      indexIntervalBySlots(appointment.startsAt, appointment.endsAt, params.slotStepMin, (dateKey, minute) => {
        const key = employeeCellKey(appointment.employeeId, dateKey, minute);
        if (!appointmentByEmployeeCellKey.has(key)) {
          appointmentByEmployeeCellKey.set(key, appointment);
        }
      });
    }

    for (const items of appointmentsStartingByDayMinuteKey.values()) {
      items.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    }
    for (const items of appointmentsOverlappingByDayMinuteKey.values()) {
      items.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    }

    for (const item of params.calendarData?.timeOff || []) {
      const startDate = new Date(item.startsAt);
      if (!Number.isNaN(startDate.getTime())) {
        const stat = monthStats.get(toDateKeyLocal(startDate));
        if (stat) stat.timeOff += 1;
      }

      const isVisibleForAggregate = !item.employeeId || visibleEmployeeIdSet.has(item.employeeId);
      if (!item.employeeId && !Number.isNaN(startDate.getTime())) {
        globalTimeOffStartByCellKey.set(
          dayMinuteKey(toDateKeyLocal(startDate), minuteOfDay(startDate)),
          item,
        );
      } else if (item.employeeId && !Number.isNaN(startDate.getTime())) {
        timeOffStartByEmployeeCellKey.set(
          employeeCellKey(item.employeeId, toDateKeyLocal(startDate), minuteOfDay(startDate)),
          item,
        );
      }

      indexIntervalBySlots(item.startsAt, item.endsAt, params.slotStepMin, (dateKey, minute) => {
        const cellKey = dayMinuteKey(dateKey, minute);
        if (item.employeeId) {
          const empKey = employeeCellKey(item.employeeId, dateKey, minute);
          if (!timeOffByEmployeeCellKey.has(empKey)) timeOffByEmployeeCellKey.set(empKey, item);
        } else if (!globalTimeOffByCellKey.has(cellKey)) {
          globalTimeOffByCellKey.set(cellKey, item);
        }
        if (isVisibleForAggregate) {
          pushMapArray(timeOffOverlappingByDayMinuteKey, cellKey, item);
        }
      });
    }

    for (const day of params.monthDays) {
      const stat = monthStats.get(toDateKeyLocal(day));
      if (!stat) continue;
      stat.holidays += blockedHolidaysByDateKey.get(toDateKeyLocal(day))?.length || 0;
    }

    return {
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
      timeOffStartByEmployeeCellKey,
      globalTimeOffByCellKey,
      globalTimeOffStartByCellKey,
      appointmentsStartingByDayMinuteKey,
      appointmentsOverlappingByDayMinuteKey,
      timeOffOverlappingByDayMinuteKey,
      availableCandidatesByDayMinuteKey,
    };
  }, [
    params.calendarData,
    params.activeAppointments,
    visibleEmployeeIdsKey,
    monthDaysKey,
    timelineDaysKey,
    params.slotStepMin,
  ]);
}
