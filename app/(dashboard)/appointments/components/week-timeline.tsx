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
  weekTimeRowClass,
  blockedHolidaysByDateKey,
  toDateKeyLocal,
  weekdayShortRu,
  formatMinuteLabel,
  isCurrentTimelineSlot,
  renderTimelineCell,
  renderWeekAggregateCell,
}: {
  visibleEmployees: BookingEmployee[];
  dayListForTimeline: Date[];
  timeRows: number[];
  weekGridMinWidth: number;
  weekTimeColumnWidth: number;
  weekDaysCount: number;
  weekDayMinColumnWidth: number;
  weekTimeRowClass: string;
  blockedHolidaysByDateKey: Map<string, BookingHoliday[]>;
  toDateKeyLocal: (date: Date) => string;
  weekdayShortRu: string[];
  formatMinuteLabel: (minuteOfDay: number) => string;
  isCurrentTimelineSlot: (day: Date, minuteOfDay: number) => boolean;
  renderTimelineCell: (
    day: Date,
    minuteOfDay: number,
    employee: BookingEmployee,
    layout?: "day" | "week",
  ) => ReactNode;
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
              const holidays = blockedHolidaysByDateKey.get(toDateKeyLocal(day)) || [];
              return (
                <div key={`${day.toISOString()}-week-h`} className="border-l border-b bg-background px-2 py-2">
                  <div className="truncate text-xs font-semibold">
                    {weekdayShortRu[day.getDay()]}, {day.getDate()}
                  </div>
                  {holidays[0] ? (
                    <div className="truncate text-[10px] text-rose-700" title={holidays.map((h) => h.title).join(", ")}>
                      {holidays[0].title}
                      {holidays.length > 1 ? ` +${holidays.length - 1}` : ""}
                    </div>
                  ) : (
                    <div className="text-muted-foreground truncate text-[10px]">
                      {visibleEmployees.length === 1 ? "1 сотрудник" : `${visibleEmployees.length} сотрудников`}
                    </div>
                  )}
                </div>
              );
            })}

            {timeRows.map((minuteOfDay) => (
              <Fragment key={`week-row-${minuteOfDay}`}>
                <div
                  className={cn(
                    weekTimeRowClass,
                    dayListForTimeline.some((day) => isCurrentTimelineSlot(day, minuteOfDay)) &&
                      "bg-muted text-primary font-semibold",
                  )}
                >
                  {formatMinuteLabel(minuteOfDay)}
                </div>
                {dayListForTimeline.map((day) =>
                  visibleEmployees.length === 1
                    ? renderTimelineCell(day, minuteOfDay, visibleEmployees[0]!, "week")
                    : renderWeekAggregateCell(day, minuteOfDay),
                )}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

