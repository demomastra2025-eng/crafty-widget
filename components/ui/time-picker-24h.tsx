"use client";

import { Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function parseTime(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function toTimeString(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function TimePicker24h({
  value,
  onChange,
  disabled,
  placeholder = "Выберите время",
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
  const parsed = parseTime(value);
  const step = Math.max(1, Math.min(30, minuteStep));
  const minuteOptions = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step).filter((m) => m < 60);

  const currentHour = parsed?.hour ?? 9;
  const currentMinute = parsed?.minute ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start pl-3 text-left font-normal",
            !parsed && "text-muted-foreground",
            buttonClassName,
          )}>
          {parsed ? toTimeString(parsed.hour, parsed.minute) : <span>{placeholder}</span>}
          <Clock3 className="ml-auto size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col divide-y sm:h-[260px] sm:flex-row sm:divide-x sm:divide-y-0">
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
                    onClick={() => onChange(toTimeString(hour, currentMinute))}>
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
                  onClick={() => onChange(toTimeString(currentHour, minute))}>
                  {String(minute).padStart(2, "0")}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="sm:hidden" />
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
