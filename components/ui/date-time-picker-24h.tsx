"use client";

import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function parseDateTimeLocal(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateTimeLocalString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function DateTimePicker24h({
  value,
  onChange,
  disabled,
  placeholder = "Выберите дату и время",
  minuteStep = 5,
  buttonClassName,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minuteStep?: number;
  buttonClassName?: string;
}) {
  const selectedDate = parseDateTimeLocal(value);
  const step = Math.max(1, Math.min(30, minuteStep));
  const minuteOptions = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step).filter((m) => m < 60);

  const commitDate = (nextDate: Date) => onChange(toDateTimeLocalString(nextDate));

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const base = selectedDate || new Date();
    const next = new Date(date);
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    commitDate(next);
  };

  const handleHourChange = (hour: number) => {
    const base = selectedDate || new Date();
    const next = new Date(base);
    next.setHours(hour, next.getMinutes(), 0, 0);
    commitDate(next);
  };

  const handleMinuteChange = (minute: number) => {
    const base = selectedDate || new Date();
    const next = new Date(base);
    next.setMinutes(minute, 0, 0);
    commitDate(next);
  };

  const currentHour = selectedDate?.getHours() ?? 9;
  const currentMinute = selectedDate?.getMinutes() ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start pl-3 text-left font-normal",
            !selectedDate && "text-muted-foreground",
            buttonClassName,
          )}>
          {selectedDate ? format(selectedDate, "dd.MM.yyyy HH:mm") : <span>{placeholder}</span>}
          <CalendarIcon className="ml-auto size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="sm:flex">
          <Calendar
            mode="single"
            selected={selectedDate || undefined}
            onSelect={handleDateSelect}
            initialFocus
          />
          <div className="flex flex-col divide-y sm:h-[300px] sm:flex-row sm:divide-x sm:divide-y-0">
            <ScrollArea
              className="w-64 sm:h-full sm:w-auto"
              onWheelCapture={(event) => event.stopPropagation()}
            >
              <div className="flex p-2 sm:flex-col">
                {Array.from({ length: 24 }, (_, i) => i)
                  .reverse()
                  .map((hour) => (
                    <Button
                      key={`hour-${hour}`}
                      type="button"
                      size="icon"
                      variant={currentHour === hour ? "default" : "ghost"}
                      className="aspect-square shrink-0 sm:w-full"
                      onClick={() => handleHourChange(hour)}>
                      {String(hour).padStart(2, "0")}
                    </Button>
                  ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
            <ScrollArea
              className="w-64 sm:h-full sm:w-auto"
              onWheelCapture={(event) => event.stopPropagation()}
            >
              <div className="flex p-2 sm:flex-col">
                {minuteOptions.map((minute) => (
                  <Button
                    key={`minute-${minute}`}
                    type="button"
                    size="icon"
                    variant={currentMinute === minute ? "default" : "ghost"}
                    className="aspect-square shrink-0 sm:w-full"
                    onClick={() => handleMinuteChange(minute)}>
                    {String(minute).padStart(2, "0")}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
