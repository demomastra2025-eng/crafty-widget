"use client";

import { type ReactNode } from "react";

import type { BookingEmployee, BookingHoliday } from "@/lib/booking-api";
import { cn } from "@/lib/utils";

const COLLAPSED_WEEK_ROW_HEIGHT_PX = 28;
const DEFAULT_WEEK_ROW_DURATION_MIN = 30;

export function WeekTimeline({
  visibleEmployees,
  dayListForTimeline,
  timeRows,
  weekGridMinWidth,
  weekTimeColumnWidth,
  weekDaysCount,
  weekDayMinColumnWidth,
  weekHeaderTitle,
  weekHeaderSubtitle,
  weekTimeRowClass,
  weekRowHeightPx,
  holidaysByDateKey,
  toDateKeyLocal,
  weekdayShortRu,
  weekDayEmployeeLabelByDateKey,
  weekCollapsedRangeByMinute,
  headerControls,
  formatMinuteLabel,
  renderWeekTimelineRow,
  renderWeekTimelineDayOverlay,
}: {
  visibleEmployees: BookingEmployee[];
  dayListForTimeline: Date[];
  timeRows: number[];
  weekGridMinWidth: number;
  weekTimeColumnWidth: number;
  weekDaysCount: number;
  weekDayMinColumnWidth: number;
  weekHeaderTitle: string;
  weekHeaderSubtitle: string;
  weekTimeRowClass: string;
  weekRowHeightPx: number;
  holidaysByDateKey: Map<string, BookingHoliday[]>;
  toDateKeyLocal: (date: Date) => string;
  weekdayShortRu: string[];
  weekDayEmployeeLabelByDateKey: Map<string, string>;
  weekCollapsedRangeByMinute: Map<number, { isStart: boolean; endMinute: number }>;
  headerControls?: ReactNode;
  formatMinuteLabel: (minuteOfDay: number) => string;
  renderWeekTimelineRow: (
    day: Date,
    minuteOfDay: number,
    options?: {
      durationMin?: number;
      isCollapsed?: boolean;
    },
  ) => ReactNode;
  renderWeekTimelineDayOverlay: (
    day: Date,
    getOffsetTopPx: (minuteOfDay: number) => number,
    columnHeightPx: number,
  ) => ReactNode;
}) {
  const gridStyle = {
    minWidth: `${weekGridMinWidth}px`,
    gridTemplateColumns: `${weekTimeColumnWidth}px repeat(${weekDaysCount}, minmax(${weekDayMinColumnWidth}px, 1fr))`,
  };
  const defaultRowDurationMin =
    timeRows.length > 1 ? Math.max(1, (timeRows[1] || 0) - (timeRows[0] || 0)) : DEFAULT_WEEK_ROW_DURATION_MIN;
  const displayRows = timeRows.reduce<Array<{
    startMinute: number;
    endMinute: number;
    heightPx: number;
    topPx: number;
    isCollapsed: boolean;
  }>>((rows, minuteOfDay) => {
    const collapsedRange = weekCollapsedRangeByMinute.get(minuteOfDay);
    if (collapsedRange && !collapsedRange.isStart) {
      return rows;
    }

    const isCollapsed = Boolean(collapsedRange?.isStart);
    const endMinute = isCollapsed && collapsedRange ? collapsedRange.endMinute : minuteOfDay + defaultRowDurationMin;
    const heightPx = isCollapsed ? COLLAPSED_WEEK_ROW_HEIGHT_PX : weekRowHeightPx;
    const topPx = rows.length > 0 ? rows[rows.length - 1]!.topPx + rows[rows.length - 1]!.heightPx : 0;

    rows.push({
      startMinute: minuteOfDay,
      endMinute,
      heightPx,
      topPx,
      isCollapsed,
    });

    return rows;
  }, []);
  const dayColumnHeightPx = displayRows.length > 0 ? displayRows[displayRows.length - 1]!.topPx + displayRows[displayRows.length - 1]!.heightPx : 0;
  const getOffsetTopPx = (minuteOfDay: number) => {
    if (!displayRows.length) return 0;
    if (minuteOfDay <= displayRows[0]!.startMinute) return 0;

    for (const row of displayRows) {
      if (minuteOfDay < row.endMinute) {
        const durationMin = Math.max(1, row.endMinute - row.startMinute);
        return row.topPx + (row.heightPx * (minuteOfDay - row.startMinute)) / durationMin;
      }
    }

    return dayColumnHeightPx;
  };

  return (
    <div className="h-full min-h-0 space-y-4 overflow-auto px-4 pb-4">
      {visibleEmployees.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          Выберите сотрудников в фильтре слева.
        </div>
      ) : (
        <div className="border bg-background">
          <div className="sticky top-0 z-30">
            <div className="-mx-px -mt-px overflow-hidden border-x border-t bg-background">
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b bg-background px-3 py-1">
                <div>
                  <div className="text-[13px] leading-tight font-semibold">{weekHeaderTitle}</div>
                  <div className="text-muted-foreground text-[10px] leading-none">{weekHeaderSubtitle}</div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">{headerControls}</div>
              </div>
              <div className="grid isolate border-b bg-background" style={gridStyle}>
                <div className="bg-background px-1 py-1 text-[11px] font-medium leading-none text-muted-foreground">
                  Время
                </div>
                {dayListForTimeline.map((day) => {
                  const holidays = holidaysByDateKey.get(toDateKeyLocal(day)) || [];
                  const hasHoliday = holidays.length > 0;
                  const hasBlockingHoliday = holidays.some((holiday) => !holiday.isWorkingDayOverride);
                  const holidayTitle = holidays
                    .map((holiday) => `${holiday.title}${holiday.isWorkingDayOverride ? " (с записью)" : ""}`)
                    .join(", ");
                  const employeeLabel = weekDayEmployeeLabelByDateKey.get(toDateKeyLocal(day));
                  const secondaryLabel = [
                    hasHoliday ? (hasBlockingHoliday ? "Выходной" : "С записью") : null,
                    employeeLabel || null,
                  ]
                    .filter((value): value is string => Boolean(value))
                    .join(", ");

                  return (
                    <div key={`${day.toISOString()}-week-h`} className="border-l bg-background px-2 py-1">
                      <div className="min-w-0 leading-tight" title={holidayTitle || undefined}>
                        <div className="flex min-w-0 items-center gap-1 text-xs font-medium leading-tight">
                          <span className="truncate">
                            {weekdayShortRu[day.getDay()]}, {day.getDate()}
                          </span>
                          {hasHoliday ? (
                            <span
                              className={cn(
                                "inline-block size-2 shrink-0 rounded-full",
                                hasBlockingHoliday ? "bg-rose-500 dark:bg-rose-400" : "bg-amber-500 dark:bg-amber-300",
                              )}
                            />
                          ) : null}
                        </div>
                        {secondaryLabel ? (
                          <div className="text-muted-foreground truncate text-[10px] leading-tight" title={secondaryLabel}>
                            {secondaryLabel}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid isolate" style={gridStyle}>
            <div className="bg-background">
              {displayRows.map((row) => {
                return (
                  <div
                    key={`week-time-${row.startMinute}`}
                    className={weekTimeRowClass}
                    style={{ height: `${row.heightPx}px` }}
                  >
                    {row.isCollapsed ? (
                      `${formatMinuteLabel(row.startMinute)}...`
                    ) : (
                      formatMinuteLabel(row.startMinute)
                    )}
                  </div>
                );
              })}
            </div>

            {dayListForTimeline.map((day) => (
              <div key={`${day.toISOString()}-week-column`} className="border-l bg-background">
                <div className="relative" style={{ height: `${dayColumnHeightPx}px` }}>
                  {displayRows.map((row) => (
                    <div
                      key={`${day.toISOString()}-${row.startMinute}-week-row`}
                      className="absolute inset-x-0"
                      style={{
                        top: `${row.topPx}px`,
                        height: `${row.heightPx}px`,
                      }}
                    >
                      {renderWeekTimelineRow(day, row.startMinute, {
                        durationMin: row.endMinute - row.startMinute,
                        isCollapsed: row.isCollapsed,
                      })}
                    </div>
                  ))}
                  {renderWeekTimelineDayOverlay(day, getOffsetTopPx, dayColumnHeightPx)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
