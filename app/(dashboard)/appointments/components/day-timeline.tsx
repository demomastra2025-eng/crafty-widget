"use client";

import { Fragment, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { BookingEmployee, BookingHoliday } from "@/lib/booking-api";
import { cn } from "@/lib/utils";

const EMPLOYEE_NAME_MAX_LENGTH = 20;
const EMPLOYEE_SPECIALTY_MAX_LENGTH = 15;
const DAY_SUB_SLOT_COUNT = 6;

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function renderDaySubSlotDividers() {
  return (
    <>
      {Array.from({ length: DAY_SUB_SLOT_COUNT - 1 }, (_, index) => (
        <span
          key={`day-sub-slot-divider-${index}`}
          className="pointer-events-none absolute inset-x-0 h-px bg-border/70"
          style={{ top: `${((index + 1) * 100) / DAY_SUB_SLOT_COUNT}%` }}
        />
      ))}
    </>
  );
}

export function DayTimeline({
  dayListForTimeline,
  visibleEmployees,
  timeRows,
  holidaysByDateKey,
  toDateKeyLocal,
  weekdayShortRu,
  headerControls,
  dayTimeColumnWidth,
  dayEmployeeMinColumnWidth,
  dayTimeRowClass,
  daySlotHeightClass,
  formatMinuteLabel,
  isAutoScrollTimeRow,
  renderTimelineCell,
}: {
  dayListForTimeline: Date[];
  visibleEmployees: BookingEmployee[];
  timeRows: number[];
  holidaysByDateKey: Map<string, BookingHoliday[]>;
  toDateKeyLocal: (date: Date) => string;
  weekdayShortRu: string[];
  headerControls?: ReactNode;
  dayTimeColumnWidth: number;
  dayEmployeeMinColumnWidth: number;
  dayTimeRowClass: string;
  daySlotHeightClass: string;
  formatMinuteLabel: (minuteOfDay: number) => string;
  isAutoScrollTimeRow: (minuteOfDay: number, durationMin?: number) => boolean;
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
        const holidays = holidaysByDateKey.get(toDateKeyLocal(day)) || [];
        return (
          <div key={day.toISOString()} className="overflow-hidden rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-1.5">
              <div>
                <div className="text-sm font-semibold">
                  {weekdayShortRu[day.getDay()]}, {day.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                </div>
                <div className="text-muted-foreground text-[11px] leading-none">
                  {visibleEmployees.length} {visibleEmployees.length === 1 ? "сотрудник" : "сотрудников"}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {headerControls}
                {holidays.map((holiday) => (
                  <Badge
                    key={holiday.id}
                    variant={holiday.isWorkingDayOverride ? "outline" : "destructive"}
                    className={
                      holiday.isWorkingDayOverride
                        ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                        : undefined
                    }
                  >
                    {holiday.title}
                    {holiday.isWorkingDayOverride ? " (с записью)" : ""}
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

              {timeRows.map((minuteOfDay) => {
                const isCurrentRow = isAutoScrollTimeRow(minuteOfDay);
                return (
                  <Fragment key={`${day.toISOString()}-${minuteOfDay}-row`}>
                    <div
                      className={cn(
                        dayTimeRowClass,
                        isCurrentRow && "bg-muted text-primary font-semibold",
                      )}
                      data-current-time-anchor={isCurrentRow ? "true" : undefined}
                    >
                      {formatMinuteLabel(minuteOfDay)}
                    </div>
                    {visibleEmployees.length ? (
                      visibleEmployees.map((employee) => renderTimelineCell(day, minuteOfDay, employee))
                    ) : (
                      <div
                        key={`${day.toISOString()}-${minuteOfDay}-empty`}
                        className={cn("relative", daySlotHeightClass, "border-l border-t bg-background/50")}
                      >
                        {renderDaySubSlotDividers()}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
