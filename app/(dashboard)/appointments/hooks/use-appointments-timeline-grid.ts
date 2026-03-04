"use client";

import { useMemo } from "react";

import type {
  BookingAppointment,
  BookingEmployee,
  BookingWorkRule,
  BookingWorkdayOverride,
} from "@/lib/booking-api";

type UseAppointmentsTimelineGridParams = {
  employees: BookingEmployee[];
  selectionInitialized: boolean;
  selectedEmployeeIds: string[];
  workRules: BookingWorkRule[];
  workdayOverrides: BookingWorkdayOverride[];
  activeAppointments: BookingAppointment[];
  baseTimelineStepMin: number;
  bookingStepMin: number;
  weekCascadeVisibleEmployees: number;
};

export function useAppointmentsTimelineGrid({
  employees,
  selectionInitialized,
  selectedEmployeeIds,
  workRules,
  workdayOverrides,
  activeAppointments,
  baseTimelineStepMin,
  bookingStepMin,
  weekCascadeVisibleEmployees,
}: UseAppointmentsTimelineGridParams) {
  const selectedSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);

  const visibleEmployees = useMemo(
    () => (selectionInitialized ? employees.filter((employee) => selectedSet.has(employee.id)) : []),
    [employees, selectedSet, selectionInitialized],
  );

  const timelineStepMin = useMemo(() => {
    if (!visibleEmployees.length) return baseTimelineStepMin;

    return visibleEmployees.reduce((smallestStep, employee) => {
      const rawStep = Math.round(Number(employee.slotDurationMin) || 0);
      const normalizedStep = Math.max(bookingStepMin, rawStep || baseTimelineStepMin);
      return Math.min(smallestStep, normalizedStep);
    }, baseTimelineStepMin);
  }, [baseTimelineStepMin, bookingStepMin, visibleEmployees]);

  const weekTimelineStepMin = timelineStepMin;
  const daySubSlotCount = Math.max(1, Math.round(timelineStepMin / bookingStepMin));

  const visibleEmployeeIdSet = useMemo(
    () => new Set(visibleEmployees.map((employee) => employee.id)),
    [visibleEmployees],
  );

  const visibleEmployeeIndexById = useMemo(
    () => new Map(visibleEmployees.map((employee, index) => [employee.id, index] as const)),
    [visibleEmployees],
  );

  const weekVisibleEmployeeCascadeCount = Math.max(
    1,
    Math.min(visibleEmployees.length, weekCascadeVisibleEmployees),
  );

  const timelineRange = useMemo(() => {
    let minMinute = 8 * 60;
    let maxMinute = 20 * 60;
    const currentMinuteOfDay = (() => {
      const now = new Date();
      return now.getHours() * 60 + now.getMinutes();
    })();

    const workRulesByEmployee = new Map<string, BookingWorkRule[]>();
    for (const rule of workRules) {
      const list = workRulesByEmployee.get(rule.employeeId) || [];
      list.push(rule);
      workRulesByEmployee.set(rule.employeeId, list);
    }

    for (const employee of visibleEmployees) {
      const rules = workRulesByEmployee.get(employee.id) || [];
      for (const rule of rules) {
        minMinute = Math.min(minMinute, Math.max(0, rule.startMinute - 30));
        maxMinute = Math.max(maxMinute, Math.min(24 * 60, rule.endMinute + 30));
      }
    }

    for (const item of workdayOverrides) {
      if (!visibleEmployeeIdSet.has(item.employeeId)) continue;
      minMinute = Math.min(minMinute, Math.max(0, item.startMinute - 30));
      maxMinute = Math.max(maxMinute, Math.min(24 * 60, item.endMinute + 30));
    }

    for (const appointment of activeAppointments) {
      if (!visibleEmployeeIdSet.has(appointment.employeeId)) continue;
      const start = new Date(appointment.startsAt);
      const end = new Date(appointment.endsAt);
      minMinute = Math.min(minMinute, start.getHours() * 60 + start.getMinutes() - 30);
      maxMinute = Math.max(maxMinute, end.getHours() * 60 + end.getMinutes() + 30);
    }

    minMinute = Math.min(minMinute, currentMinuteOfDay - timelineStepMin);
    maxMinute = Math.max(maxMinute, currentMinuteOfDay + timelineStepMin);
    minMinute = Math.max(0, Math.floor(minMinute / timelineStepMin) * timelineStepMin);
    maxMinute = Math.min(24 * 60, Math.ceil(maxMinute / timelineStepMin) * timelineStepMin);

    return { minMinute, maxMinute };
  }, [activeAppointments, timelineStepMin, visibleEmployeeIdSet, visibleEmployees, workRules, workdayOverrides]);

  const dayTimeRows = useMemo(() => {
    const rows: number[] = [];
    for (let minute = timelineRange.minMinute; minute < timelineRange.maxMinute; minute += timelineStepMin) {
      rows.push(minute);
    }
    return rows;
  }, [timelineRange, timelineStepMin]);

  const weekTimeRows = useMemo(() => {
    const minMinute = Math.max(
      0,
      Math.floor(timelineRange.minMinute / weekTimelineStepMin) * weekTimelineStepMin,
    );
    const maxMinute = Math.min(
      24 * 60,
      Math.ceil(timelineRange.maxMinute / weekTimelineStepMin) * weekTimelineStepMin,
    );
    const rows: number[] = [];
    for (let minute = minMinute; minute < maxMinute; minute += weekTimelineStepMin) {
      rows.push(minute);
    }
    return rows;
  }, [timelineRange, weekTimelineStepMin]);

  const timeRowIndexByMinute = useMemo(
    () => new Map(dayTimeRows.map((minute, index) => [minute, index] as const)),
    [dayTimeRows],
  );

  const weekTimeRowIndexByMinute = useMemo(
    () => new Map(weekTimeRows.map((minute, index) => [minute, index] as const)),
    [weekTimeRows],
  );

  return {
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
  };
}
