"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AppointmentDurationField({
  durationMin,
  inputValue,
  presets,
  previewEndIso,
  showPreviewSummary = true,
  onPresetSelect,
  onInputChange,
  onInputBlur,
  disabled = false,
}: {
  durationMin: number;
  inputValue: string;
  presets: number[];
  previewEndIso: string | null;
  showPreviewSummary?: boolean;
  minDurationMin: number;
  stepMin: number;
  onPresetSelect: (durationMin: number) => void;
  onInputChange: (raw: string) => void;
  onInputBlur?: () => void;
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
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onBlur={onInputBlur}
          aria-label="Длительность в минутах"
          disabled={disabled}
        />
      </div>
      {showPreviewSummary && previewEndIso ? (
        <div className="text-muted-foreground text-xs">
          Завершение: {new Date(previewEndIso).toLocaleString("ru-RU")}
          {" · "}
          Полный интервал проверяется сервером при сохранении
        </div>
      ) : null}
    </div>
  );
}
