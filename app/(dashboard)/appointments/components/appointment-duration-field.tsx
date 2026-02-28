"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AppointmentDurationField({
  durationMin,
  presets,
  previewEndIso,
  minDurationMin,
  stepMin,
  onPresetSelect,
  onInputChange,
  disabled = false,
}: {
  durationMin: number;
  presets: number[];
  previewEndIso: string | null;
  minDurationMin: number;
  stepMin: number;
  onPresetSelect: (durationMin: number) => void;
  onInputChange: (raw: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label>Длительность</Label>
      <div className="grid gap-2 sm:grid-cols-[1fr_104px]">
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <Button
              key={`dur-${preset}`}
              type="button"
              size="sm"
              variant={durationMin === preset ? "default" : "outline"}
              className="h-8 px-2 text-xs"
              onClick={() => onPresetSelect(preset)}
              disabled={disabled}>
              {preset >= 60 ? `${preset / 60}ч` : `${preset}м`}
            </Button>
          ))}
        </div>
        <Input
          type="number"
          min={minDurationMin}
          max={720}
          step={stepMin}
          value={durationMin}
          onChange={(e) => onInputChange(e.target.value)}
          aria-label="Длительность в минутах"
          disabled={disabled}
        />
      </div>
      {previewEndIso ? (
        <div className="text-muted-foreground text-xs">
          Завершение: {new Date(previewEndIso).toLocaleString("ru-RU")}
          {" · "}
          Полный интервал проверяется сервером при сохранении
        </div>
      ) : null}
    </div>
  );
}
