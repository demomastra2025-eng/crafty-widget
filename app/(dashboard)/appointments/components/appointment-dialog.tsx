"use client";

import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BookingEmployee } from "@/lib/booking-api";
import { AppointmentDurationField } from "./appointment-duration-field";

type SlotDraftLike = {
  employeeId: string | null;
  startsAt: string;
  endsAt: string;
  candidateSlots?: Array<{
    employeeId: string;
    startsAt: string;
    endsAt: string;
  }>;
};

type AppointmentFormState = {
  clientName: string;
  clientPhone: string;
  clientIin: string;
  clientComment: string;
  durationMin: number;
};

type AppointmentIinPreview =
  | {
      error: string;
    }
  | {
      birthDate: string;
      gender: string;
    }
  | null;

export function AppointmentDialog({
  open,
  onOpenChange,
  mode,
  onStartEdit,
  slotDraft,
  employees,
  appointmentPreviewStartIso,
  appointmentPreviewEndIso,
  appointmentDurationMin,
  appointmentDurationStepMin,
  formatDurationRu,
  durationPresets,
  appointmentForm,
  patchAppointmentForm,
  appointmentIinPreview,
  getGenderLabelRu,
  onSlotEmployeeChange,
  startTimeOptions,
  onStartTimeChange,
  onDurationPresetSelect,
  onDurationInputChange,
  normalizeIin,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "view" | "edit";
  onStartEdit?: () => void;
  slotDraft: SlotDraftLike | null;
  employees: BookingEmployee[];
  appointmentPreviewStartIso: string | null;
  appointmentPreviewEndIso: string | null;
  appointmentDurationMin: number;
  appointmentDurationStepMin: number;
  formatDurationRu: (durationMin: number) => string;
  durationPresets: number[];
  appointmentForm: AppointmentFormState;
  patchAppointmentForm: (patch: Partial<AppointmentFormState>) => void;
  appointmentIinPreview: AppointmentIinPreview;
  getGenderLabelRu: (value?: string | null) => string;
  onSlotEmployeeChange: (employeeId: string) => void;
  startTimeOptions?: Array<{ value: string; label: string }>;
  onStartTimeChange?: (startsAt: string) => void;
  onDurationPresetSelect: (preset: number) => void;
  onDurationInputChange: (raw: string) => void;
  normalizeIin: (value: string) => string;
  onSubmit: () => void;
  saving: boolean;
}) {
  const isReadOnly = mode === "view";
  const title = mode === "create" ? "Создать запись по слоту" : isReadOnly ? "Запись" : "Редактировать запись";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>{title}</DialogTitle>
            {mode !== "create" && isReadOnly ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onStartEdit}
                title="Редактировать"
                aria-label="Редактировать"
              >
                <Pencil className="size-4" />
              </Button>
            ) : null}
          </div>
          <DialogDescription>
            {slotDraft ? (
              <span>
                {slotDraft.employeeId
                  ? employees.find((e) => e.id === slotDraft.employeeId)?.name || slotDraft.employeeId
                  : "Выберите сотрудника"}{" "}
                ·{" "}
                {appointmentPreviewStartIso
                  ? new Date(appointmentPreviewStartIso).toLocaleString("ru-RU")
                  : new Date(slotDraft.startsAt).toLocaleString("ru-RU")}
                {appointmentPreviewEndIso
                  ? ` - ${new Date(appointmentPreviewEndIso).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : ""}
                {` · ${formatDurationRu(appointmentDurationMin)}`}
              </span>
            ) : (
              "Выберите слот"
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {slotDraft?.candidateSlots && slotDraft.candidateSlots.length > 1 ? (
            <div className="grid gap-2">
              <Label>Сотрудник</Label>
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={slotDraft.employeeId || ""}
                onChange={(e) => onSlotEmployeeChange(e.target.value)}
                disabled={isReadOnly}
              >
                {slotDraft.candidateSlots.map((candidate) => {
                  const employee = employees.find((e) => e.id === candidate.employeeId);
                  return (
                    <option key={candidate.employeeId} value={candidate.employeeId}>
                      {employee?.name || candidate.employeeId}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : null}

          {mode === "create" && slotDraft?.employeeId && startTimeOptions && startTimeOptions.length > 1 ? (
            <div className="grid gap-2">
              <Label>Время</Label>
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={slotDraft.startsAt}
                onChange={(e) => onStartTimeChange?.(e.target.value)}
                disabled={isReadOnly}
              >
                {startTimeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <AppointmentDurationField
            durationMin={appointmentDurationMin}
            presets={durationPresets}
            previewEndIso={appointmentPreviewEndIso}
            minDurationMin={appointmentDurationStepMin}
            stepMin={appointmentDurationStepMin}
            onPresetSelect={onDurationPresetSelect}
            onInputChange={onDurationInputChange}
            disabled={isReadOnly}
          />

          <div className="grid gap-2">
            <Label htmlFor="appt-client">Имя клиента</Label>
            <Input
              id="appt-client"
              value={appointmentForm.clientName}
              onChange={(e) => patchAppointmentForm({ clientName: e.target.value })}
              placeholder="Например, Айдана С."
              readOnly={isReadOnly}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="appt-phone">Телефон</Label>
            <Input
              id="appt-phone"
              value={appointmentForm.clientPhone}
              onChange={(e) => patchAppointmentForm({ clientPhone: e.target.value })}
              placeholder="+7 ..."
              readOnly={isReadOnly}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="appt-iin">ИИН</Label>
            <Input
              id="appt-iin"
              inputMode="numeric"
              maxLength={12}
              value={appointmentForm.clientIin}
              onChange={(e) => patchAppointmentForm({ clientIin: normalizeIin(e.target.value).slice(0, 12) })}
              placeholder="12 цифр"
              readOnly={isReadOnly}
            />
            {appointmentForm.clientIin ? (
              appointmentIinPreview && "error" in appointmentIinPreview ? (
                <div className="text-xs text-rose-600">{appointmentIinPreview.error}</div>
              ) : appointmentIinPreview ? (
                <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-2">
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Дата рождения</Label>
                    <Input value={appointmentIinPreview.birthDate} readOnly className="h-8 bg-background" />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Пол</Label>
                    <Input
                      value={getGenderLabelRu(appointmentIinPreview.gender)}
                      readOnly
                      className="h-8 bg-background"
                    />
                  </div>
                </div>
              ) : null
            ) : (
              <div className="text-xs text-muted-foreground">
                Если указать ИИН, дата рождения и пол заполнятся автоматически.
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="appt-comment">Комментарий</Label>
            <Textarea
              id="appt-comment"
              value={appointmentForm.clientComment}
              onChange={(e) => patchAppointmentForm({ clientComment: e.target.value })}
              placeholder="Жалобы, пожелания, услуга"
              readOnly={isReadOnly}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isReadOnly ? "Закрыть" : "Отмена"}
          </Button>
          {!isReadOnly ? (
            <Button onClick={onSubmit} disabled={saving}>
              {saving ? "Сохраняю..." : mode === "create" ? "Создать запись" : "Сохранить"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
