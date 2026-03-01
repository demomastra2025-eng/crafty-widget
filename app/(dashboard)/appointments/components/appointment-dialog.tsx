"use client";

import { Pencil, Trash2, X } from "lucide-react";

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
import type { BookingEmployee, BookingPaymentMethod } from "@/lib/booking-api";
import { cn } from "@/lib/utils";
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
  serviceAmount: number;
  prepaidAmount: number;
  prepaidPaymentMethod: BookingPaymentMethod;
};

type AmountInputField = {
  value: string;
  onChange: (raw: string) => void;
  onBlur: () => void;
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
  onRequestDelete,
  appointmentStatus,
  appointmentStatusLabel,
  paymentStatusLabel,
  paymentMethodOptions,
  statusOptions,
  onStatusChange,
  onAdvanceStatus,
  nextStatusActionLabel,
  statusActionSaving,
  slotDraft,
  employees,
  appointmentPreviewStartIso,
  appointmentPreviewEndIso,
  appointmentDurationMin,
  appointmentDurationStepMin,
  formatDurationRu,
  durationPresets,
  appointmentForm,
  serviceAmountInput,
  prepaidAmountInput,
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
  onRequestDelete?: () => void;
  appointmentStatus?: string | null;
  appointmentStatusLabel?: string;
  paymentStatusLabel?: string;
  paymentMethodOptions?: Array<{ value: BookingPaymentMethod; label: string }>;
  statusOptions?: Array<{ value: string; label: string }>;
  onStatusChange?: (status: string) => void;
  onAdvanceStatus?: () => void;
  nextStatusActionLabel?: string | null;
  statusActionSaving?: boolean;
  slotDraft: SlotDraftLike | null;
  employees: BookingEmployee[];
  appointmentPreviewStartIso: string | null;
  appointmentPreviewEndIso: string | null;
  appointmentDurationMin: number;
  appointmentDurationStepMin: number;
  formatDurationRu: (durationMin: number) => string;
  durationPresets: number[];
  appointmentForm: AppointmentFormState;
  serviceAmountInput: AmountInputField;
  prepaidAmountInput: AmountInputField;
  patchAppointmentForm: (patch: Partial<AppointmentFormState>) => void;
  appointmentIinPreview: AppointmentIinPreview;
  getGenderLabelRu: (value?: string | null) => string;
  onSlotEmployeeChange: (employeeId: string) => void;
  startTimeOptions?: Array<{ value: string; label: string; disabled?: boolean }>;
  onStartTimeChange?: (startsAt: string) => void;
  onDurationPresetSelect: (preset: number) => void;
  onDurationInputChange: (raw: string) => void;
  normalizeIin: (value: string) => string;
  onSubmit: () => void;
  saving: boolean;
}) {
  const isReadOnly = mode === "view";
  const title = mode === "create" ? "Создать запись" : isReadOnly ? "Запись" : "Редактировать запись";
  const hasEditableEmployee = Boolean(slotDraft && !isReadOnly && employees.length > 0);
  const hasEditableStatus = Boolean(!isReadOnly && appointmentStatus && statusOptions && statusOptions.length > 0);
  const hasEditableStartTime = Boolean(!isReadOnly && slotDraft?.employeeId && startTimeOptions && startTimeOptions.length > 0);
  const hasEditablePaymentMethod = Boolean(!isReadOnly && paymentMethodOptions?.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl",
          isReadOnly && "[&>button:last-child]:hidden",
        )}
      >
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>{title}</DialogTitle>
            {mode !== "create" && isReadOnly ? (
              <div className="flex items-center gap-1">
                {onRequestDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={onRequestDelete}
                    title="Удалить"
                    aria-label="Удалить"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => onOpenChange(false)}
                  title="Закрыть"
                  aria-label="Закрыть"
                >
                  <X className="size-4" />
                </Button>
              </div>
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
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {!isReadOnly && (hasEditableEmployee || hasEditableStatus) ? (
            <div
              className={cn(
                "grid gap-3",
                hasEditableEmployee && hasEditableStatus && "sm:grid-cols-2",
              )}
            >
              {hasEditableEmployee ? (
                <div className="grid min-w-0 gap-2">
                  <Label>Сотрудник</Label>
                  <select
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    value={slotDraft?.employeeId || ""}
                    onChange={(e) => onSlotEmployeeChange(e.target.value)}
                    disabled={isReadOnly}
                  >
                    {!slotDraft?.employeeId ? <option value="">Выберите сотрудника</option> : null}
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name || employee.id}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {hasEditableStatus ? (
                <div className="grid min-w-0 gap-2">
                  <Label>Статус записи</Label>
                  <select
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    value={appointmentStatus || "scheduled"}
                    onChange={(e) => onStatusChange?.(e.target.value)}
                  >
                    {statusOptions?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isReadOnly ? (
            <>
              <div
                className={cn(
                  "grid gap-3",
                  hasEditableStartTime && "sm:grid-cols-2",
                )}
              >
                {hasEditableStartTime ? (
                <div className="grid min-w-0 gap-2">
                  <Label>Время начала</Label>
                  <select
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    value={slotDraft?.startsAt}
                    onChange={(e) => onStartTimeChange?.(e.target.value)}
                    disabled={isReadOnly}
                  >
                    {startTimeOptions?.map((option) => (
                      <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                ) : null}

                <div className="min-w-0">
                  <AppointmentDurationField
                    durationMin={appointmentDurationMin}
                    presets={durationPresets}
                    previewEndIso={appointmentPreviewEndIso}
                    showPreviewSummary={false}
                    minDurationMin={appointmentDurationStepMin}
                    stepMin={appointmentDurationStepMin}
                    onPresetSelect={onDurationPresetSelect}
                    onInputChange={onDurationInputChange}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {appointmentPreviewEndIso ? (
                <div className="text-muted-foreground text-xs">
                  Завершение: {new Date(appointmentPreviewEndIso).toLocaleString("ru-RU")}
                  {" · "}
                  Полный интервал проверяется сервером при сохранении
                </div>
              ) : null}
            </>
          ) : null}

          {isReadOnly && appointmentStatusLabel ? (
            <div className="grid gap-2">
              <Label>Статус записи</Label>
              <div className="border-input bg-muted/20 min-h-9 rounded-md border px-3 py-2 text-sm">
                {appointmentStatusLabel}
              </div>
            </div>
          ) : null}

          {isReadOnly ? (
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
          ) : null}

          <div className="rounded-lg border border-border/70 bg-muted/10 px-3 py-3">
            {hasEditablePaymentMethod || paymentStatusLabel ? (
              <div className={cn("grid gap-3", hasEditablePaymentMethod && paymentStatusLabel && "sm:grid-cols-2")}>
                {hasEditablePaymentMethod ? (
                <div className="grid min-w-0 gap-2">
                  <Label>Способ оплаты</Label>
                  <select
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    value={appointmentForm.prepaidPaymentMethod}
                    onChange={(e) => patchAppointmentForm({ prepaidPaymentMethod: e.target.value as BookingPaymentMethod })}
                    disabled={isReadOnly || !paymentMethodOptions?.length}
                  >
                    {(paymentMethodOptions || []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                ) : null}

                {paymentStatusLabel ? (
                <div className="grid min-w-0 gap-2">
                  <Label>Статус оплаты</Label>
                  <div className="border-input bg-muted/20 min-h-9 rounded-md border px-3 py-2 text-sm">
                    {paymentStatusLabel}
                  </div>
                </div>
                ) : null}
              </div>
            ) : null}

            <div className={cn("grid gap-3 sm:grid-cols-2", (hasEditablePaymentMethod || paymentStatusLabel) && "mt-3")}>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="appt-service-amount">Стоимость приема</Label>
                <Input
                  id="appt-service-amount"
                  type="text"
                  inputMode="numeric"
                  value={serviceAmountInput.value}
                  onChange={(e) => serviceAmountInput.onChange(e.target.value)}
                  onBlur={serviceAmountInput.onBlur}
                  readOnly={isReadOnly}
                />
              </div>

              <div className="grid min-w-0 gap-2">
                <Label htmlFor="appt-prepaid-amount">Предоплата</Label>
                <Input
                  id="appt-prepaid-amount"
                  type="text"
                  inputMode="numeric"
                  value={prepaidAmountInput.value}
                  onChange={(e) => prepaidAmountInput.onChange(e.target.value)}
                  onBlur={prepaidAmountInput.onBlur}
                  readOnly={isReadOnly}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="appt-client">Имя клиента</Label>
              <Input
                id="appt-client"
                value={appointmentForm.clientName}
                onChange={(e) => patchAppointmentForm({ clientName: e.target.value })}
                placeholder="Например, Айдана С."
                readOnly={isReadOnly}
              />
            </div>

            <div className="grid min-w-0 gap-2">
              <Label htmlFor="appt-phone">Телефон</Label>
              <Input
                id="appt-phone"
                value={appointmentForm.clientPhone}
                onChange={(e) => patchAppointmentForm({ clientPhone: e.target.value })}
                placeholder="+7 ..."
                readOnly={isReadOnly}
              />
            </div>
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
                <div className="text-xs text-rose-600 dark:text-rose-300">{appointmentIinPreview.error}</div>
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
        {!isReadOnly ? (
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={onSubmit} disabled={saving}>
              {saving ? "Сохраняю..." : mode === "create" ? "Создать запись" : "Сохранить"}
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Закрыть
            </Button>
            {onAdvanceStatus && nextStatusActionLabel ? (
              <Button onClick={onAdvanceStatus} disabled={statusActionSaving}>
                {statusActionSaving ? "Сохраняю..." : nextStatusActionLabel}
              </Button>
            ) : null}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
