"use client";

import { Fragment, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { BookingEmployee, BookingHoliday } from "@/lib/booking-api";
import { cn } from "@/lib/utils";

const EMPLOYEE_NAME_MAX_LENGTH = 20;
const EMPLOYEE_SPECIALTY_MAX_LENGTH = 15;

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export function DayTimeline({
  dayListForTimeline,
  visibleEmployees,
  timeRows,
  blockedHolidaysByDateKey,
  toDateKeyLocal,
  weekdayShortRu,
  dayTimeColumnWidth,
  dayEmployeeMinColumnWidth,
  dayTimeRowClass,
  daySlotHeightClass,
  formatMinuteLabel,
  isCurrentTimelineSlot,
  renderTimelineCell,
}: {
  dayListForTimeline: Date[];
  visibleEmployees: BookingEmployee[];
  timeRows: number[];
  blockedHolidaysByDateKey: Map<string, BookingHoliday[]>;
  toDateKeyLocal: (date: Date) => string;
  weekdayShortRu: string[];
  dayTimeColumnWidth: number;
  dayEmployeeMinColumnWidth: number;
  dayTimeRowClass: string;
  daySlotHeightClass: string;
  formatMinuteLabel: (minuteOfDay: number) => string;
  isCurrentTimelineSlot: (day: Date, minuteOfDay: number) => boolean;
  renderTimelineCell: (
    day: Date,
    minuteOfDay: number,
    employee: BookingEmployee,
    layout?: "day" | "week",
  ) => ReactNode;
}) {
  return (
    <div className="space-y-4 overflow-x-auto px-4 pb-4">
      {dayListForTimeline.map((day) => {
        const holidays = blockedHolidaysByDateKey.get(toDateKeyLocal(day)) || [];
        return (
          <div key={day.toISOString()} className="overflow-hidden rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2">
              <div>
                <div className="text-sm font-semibold">
                  {weekdayShortRu[day.getDay()]}, {day.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                </div>
                <div className="text-muted-foreground text-xs">
                  {visibleEmployees.length} {visibleEmployees.length === 1 ? "сотрудник" : "сотрудников"}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {holidays.map((holiday) => (
                  <Badge key={holiday.id} variant="destructive">
                    {holiday.title}
                  </Badge>
                ))}
              </div>
            </div>

            <div
              className="grid isolate"
              style={{
                minWidth: `${dayTimeColumnWidth + Math.max(visibleEmployees.length, 1) * dayEmployeeMinColumnWidth}px`,
                gridTemplateColumns: `${dayTimeColumnWidth}px repeat(${Math.max(visibleEmployees.length, 1)}, minmax(${dayEmployeeMinColumnWidth}px, 1fr))`,
              }}
            >
              <div className="border-b bg-background px-1 py-2 text-xs font-medium text-muted-foreground">Время</div>
              {visibleEmployees.length ? (
                visibleEmployees.map((employee) => (
                  <div key={`${day.toISOString()}-${employee.id}-h`} className="border-l border-b bg-background px-2 py-2">
                    <div className="px-2 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {truncateText(employee.name || "Сотрудник", EMPLOYEE_NAME_MAX_LENGTH)}
                        </div>
                        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                          <span
                            className="inline-block size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: employee.color || "#0ea5e9" }}
                          />
                          <span className="truncate">
                            {truncateText(employee.specialty || "Без специализации", EMPLOYEE_SPECIALTY_MAX_LENGTH)}
                          </span>
                          <Badge
                            variant="outline"
                            className="h-4 shrink-0 rounded-sm px-1 text-[10px] font-normal leading-none"
                          >
                            {employee.slotDurationMin}м
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="border-l border-b px-3 py-2 text-sm text-muted-foreground">
                  Выберите сотрудников в фильтре слева.
                </div>
              )}

              {timeRows.map((minuteOfDay) => (
                <Fragment key={`${day.toISOString()}-${minuteOfDay}-row`}>
                  <div
                    key={`${day.toISOString()}-${minuteOfDay}-time`}
                    className={cn(
                      dayTimeRowClass,
                      isCurrentTimelineSlot(day, minuteOfDay) && "bg-muted text-primary font-semibold",
                    )}
                  >
                    {formatMinuteLabel(minuteOfDay)}
                  </div>
                  {visibleEmployees.length ? (
                    visibleEmployees.map((employee) => renderTimelineCell(day, minuteOfDay, employee))
                  ) : (
                    <div
                      key={`${day.toISOString()}-${minuteOfDay}-empty`}
                      className={cn(daySlotHeightClass, "border-l border-t bg-background/50")}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
