"use client";

import { Fragment, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { BookingEmployee, BookingHoliday } from "@/lib/booking-api";
import { cn } from "@/lib/utils";

const EMPLOYEE_NAME_MAX_LENGTH = 20;
const EMPLOYEE_SPECIALTY_MAX_LENGTH = 15;
const COLLAPSED_DAY_ROW_HEIGHT_PX = 28;

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function renderDaySubSlotDividers(daySubSlotCount: number) {
  return (
    <>
      {Array.from({ length: Math.max(0, daySubSlotCount - 1) }, (_, index) => (
        <span
          key={`day-sub-slot-divider-${index}`}
          className="pointer-events-none absolute inset-x-0 h-px bg-border/70"
          style={{ top: `${((index + 1) * 100) / daySubSlotCount}%` }}
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
  dayCollapsedRangeByDayMinuteKey,
  daySubSlotCount,
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
  dayCollapsedRangeByDayMinuteKey: Map<string, { isStart: boolean; endMinute: number }>;
  daySubSlotCount: number;
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
    options?: {
      durationMin?: number;
      rowHeightPx?: number;
    },
  ) => ReactNode;
}) {
  return (
    <div className="h-full min-h-0 space-y-4 overflow-auto px-4 pb-4">
      {dayListForTimeline.map((day) => {
        const holidays = holidaysByDateKey.get(toDateKeyLocal(day)) || [];
        const gridStyle = {
          minWidth: `${dayTimeColumnWidth + Math.max(visibleEmployees.length, 1) * dayEmployeeMinColumnWidth}px`,
          gridTemplateColumns: `${dayTimeColumnWidth}px repeat(${Math.max(visibleEmployees.length, 1)}, minmax(${dayEmployeeMinColumnWidth}px, 1fr))`,
        };
        return (
          <div key={day.toISOString()} className="border bg-background">
            <div className="sticky top-0 z-30">
              <div className="-mx-px -mt-px overflow-hidden border-x border-t bg-background">
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b bg-background px-3 py-1">
                  <div>
                    <div className="text-[13px] leading-tight font-semibold">
                      {weekdayShortRu[day.getDay()]}, {day.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                    </div>
                    <div className="text-muted-foreground text-[10px] leading-none">
                      {visibleEmployees.length} {visibleEmployees.length === 1 ? "сотрудник" : "сотрудников"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
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
                  className="grid isolate border-b bg-background"
                  style={gridStyle}
                >
                  <div className="bg-background px-1 py-1 text-[11px] font-medium leading-none text-muted-foreground">Время</div>
                  {visibleEmployees.length ? (
                    visibleEmployees.map((employee) => (
                      <div key={`${day.toISOString()}-${employee.id}-h`} className="border-l bg-background px-2 py-1">
                        <div className="min-w-0 leading-tight">
                            <div className="truncate text-xs font-medium leading-tight">
                              {truncateText(employee.name || "Сотрудник", EMPLOYEE_NAME_MAX_LENGTH)}
                            </div>
                            <div className="text-muted-foreground flex min-w-0 items-center gap-1 text-[10px] leading-tight">
                              <span
                                className="inline-block size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: employee.color || "#0ea5e9" }}
                              />
                              <span className="truncate">
                                {truncateText(employee.specialty || "Без специализации", EMPLOYEE_SPECIALTY_MAX_LENGTH)}
                              </span>
                              <Badge
                                variant="outline"
                                className="h-3.5 shrink-0 rounded-sm px-1 text-[9px] font-normal leading-none"
                              >
                                {employee.slotDurationMin}м
                              </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="border-l px-3 py-1 text-xs text-muted-foreground">
                      Выберите сотрудников в фильтре слева.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className="grid isolate"
              style={gridStyle}
            >
              {timeRows.map((minuteOfDay) => {
                const collapsedRange = dayCollapsedRangeByDayMinuteKey.get(`${toDateKeyLocal(day)}|${minuteOfDay}`);
                const isCollapsedStart = Boolean(collapsedRange?.isStart);
                const isCollapsedHidden = Boolean(collapsedRange && !collapsedRange.isStart);
                const rowDurationMin =
                  isCollapsedStart && collapsedRange ? collapsedRange.endMinute - minuteOfDay : undefined;
                const isCurrentRow = isAutoScrollTimeRow(minuteOfDay, rowDurationMin);

                if (isCollapsedHidden) {
                  return null;
                }

                return (
                  <Fragment key={`${day.toISOString()}-${minuteOfDay}-row`}>
                    <div
                      className={cn(
                        dayTimeRowClass,
                        isCurrentRow && "bg-muted text-primary font-semibold",
                      )}
                      style={isCollapsedStart ? { height: `${COLLAPSED_DAY_ROW_HEIGHT_PX}px` } : undefined}
                    >
                      {isCollapsedStart && collapsedRange ? (
                        `${formatMinuteLabel(minuteOfDay)}...`
                      ) : (
                        formatMinuteLabel(minuteOfDay)
                      )}
                    </div>
                    {visibleEmployees.length ? (
                      visibleEmployees.map((employee) =>
                        renderTimelineCell(day, minuteOfDay, employee, "day", {
                          durationMin: rowDurationMin,
                          rowHeightPx: isCollapsedStart ? COLLAPSED_DAY_ROW_HEIGHT_PX : undefined,
                        }),
                      )
                    ) : (
                      <div
                        key={`${day.toISOString()}-${minuteOfDay}-empty`}
                        className={cn("relative", daySlotHeightClass, "border-l border-t bg-background/50")}
                        style={isCollapsedStart ? { height: `${COLLAPSED_DAY_ROW_HEIGHT_PX}px` } : undefined}
                      >
                        {!isCollapsedStart ? renderDaySubSlotDividers(daySubSlotCount) : null}
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
