"use client";

import { Fragment, type ReactNode } from "react";

import type { BookingEmployee, BookingHoliday } from "@/lib/booking-api";
import { cn } from "@/lib/utils";

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
  rowDurationMin,
  holidaysByDateKey,
  toDateKeyLocal,
  weekdayShortRu,
  headerControls,
  formatMinuteLabel,
  isAutoScrollTimeRow,
  renderWeekAggregateCell,
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
  rowDurationMin: number;
  holidaysByDateKey: Map<string, BookingHoliday[]>;
  toDateKeyLocal: (date: Date) => string;
  weekdayShortRu: string[];
  headerControls?: ReactNode;
  formatMinuteLabel: (minuteOfDay: number) => string;
  isAutoScrollTimeRow: (minuteOfDay: number, durationMin?: number) => boolean;
  renderWeekAggregateCell: (day: Date, minuteOfDay: number) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto px-4 pb-4">
      {visibleEmployees.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          Выберите сотрудников в фильтре слева.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-1.5">
            <div>
              <div className="text-sm font-semibold">{weekHeaderTitle}</div>
              <div className="text-muted-foreground text-[11px] leading-none">{weekHeaderSubtitle}</div>
            </div>
            {headerControls}
          </div>
          <div
            className="grid"
            style={{
              minWidth: `${weekGridMinWidth}px`,
              gridTemplateColumns: `${weekTimeColumnWidth}px repeat(${weekDaysCount}, minmax(${weekDayMinColumnWidth}px, 1fr))`,
            }}
          >
            <div className="border-b bg-background px-1 py-2 text-right text-xs font-medium text-muted-foreground">
              Время
            </div>
            {dayListForTimeline.map((day) => {
              const holidays = holidaysByDateKey.get(toDateKeyLocal(day)) || [];
              const hasHoliday = holidays.length > 0;
              const hasBlockingHoliday = holidays.some((holiday) => !holiday.isWorkingDayOverride);
              const holidayTitle = holidays
                .map((holiday) => `${holiday.title}${holiday.isWorkingDayOverride ? " (с записью)" : ""}`)
                .join(", ");
              return (
                <div key={`${day.toISOString()}-week-h`} className="border-l border-b bg-background px-3 py-2">
                  <div className="flex items-start gap-1.5 text-xs font-medium" title={holidayTitle || undefined}>
                    <span className="leading-tight">
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
                </div>
              );
            })}

            {timeRows.map((minuteOfDay) => {
              const isCurrentRow = isAutoScrollTimeRow(minuteOfDay, rowDurationMin);
              return (
                <Fragment key={`week-row-${minuteOfDay}`}>
                  <div
                    className={cn(
                      weekTimeRowClass,
                      isCurrentRow && "bg-muted text-primary font-semibold",
                    )}
                    data-current-time-anchor={isCurrentRow ? "true" : undefined}
                  >
                    {formatMinuteLabel(minuteOfDay)}
                  </div>
                  {dayListForTimeline.map((day) => renderWeekAggregateCell(day, minuteOfDay))}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
