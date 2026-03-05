"use client";

import { useEffect, useState } from "react";
import { addDays, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ChevronDown,
  Clock3,
  Receipt,
  SlidersHorizontal,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  addBookingAppointmentPayment,
  BookingAppointment,
  BookingCalendarViewResponse,
  BookingExpense,
  BookingPayment,
  BookingPaymentKind,
  BookingPaymentMethod,
  BookingPaymentStatus,
  cancelBookingAppointmentPayment,
  BookingRequestContext,
  fetchBookingCalendarView,
  markBookingExpensePaid,
  payAllBookingExpenses,
} from "@/lib/booking-api";
import { cn } from "@/lib/utils";
import { useKassaDerivedData } from "./hooks/use-kassa-derived-data";

type KassaPageClientProps = {
  requestContext?: BookingRequestContext;
};

const PAYMENT_STATUS_LABEL_RU: Record<BookingPaymentStatus | string, string> = {
  awaiting_payment: "Ожидает оплаты",
  prepaid: "Предоплачен",
  paid: "Оплачен",
  cancelled: "Отменен",
};

const PAYMENT_METHOD_LABEL_RU: Record<BookingPaymentMethod | string, string> = {
  kaspi_transfer: "Kaspi перевод",
  kaspi_qr: "Kaspi QR",
  cash: "Наличка",
  bank_transfer: "Безналичная оплата",
};

const PAYMENT_KIND_LABEL_RU: Record<BookingPaymentKind | string, string> = {
  prepaid: "Предоплата",
  payment: "Оплата",
  adjustment: "Корректировка",
};

const PAYMENT_METHOD_OPTIONS: Array<{ value: BookingPaymentMethod; label: string }> = [
  { value: "kaspi_transfer", label: PAYMENT_METHOD_LABEL_RU.kaspi_transfer },
  { value: "kaspi_qr", label: PAYMENT_METHOD_LABEL_RU.kaspi_qr },
  { value: "cash", label: PAYMENT_METHOD_LABEL_RU.cash },
  { value: "bank_transfer", label: PAYMENT_METHOD_LABEL_RU.bank_transfer },
];

function toDateKeyLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.max(0, Math.round(value || 0)));
}

function formatCompensationLabel(type?: string | null, value?: number | null) {
  const amount = Math.max(0, Math.round(value || 0));
  if (type === "fixed") return `${formatAmount(amount)} тг`;
  return `${amount}%`;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "Без даты";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  const local =
    digits.length >= 11 && (digits.startsWith("7") || digits.startsWith("8"))
      ? digits.slice(1, 11)
      : digits.slice(0, 10);
  return local ? `+7 ${local}` : null;
}

function getReceivedAmount(appointment: BookingAppointment) {
  if (appointment.paymentStatus === "cancelled") return 0;
  return (appointment.prepaidAmount || 0) + (appointment.settlementAmount || 0);
}

function getRemainingAmount(appointment: BookingAppointment) {
  if (appointment.paymentStatus === "cancelled") return 0;
  return Math.max((appointment.serviceAmount || 0) - getReceivedAmount(appointment), 0);
}

function getPaymentStatusLabel(status?: string | null) {
  if (!status) return PAYMENT_STATUS_LABEL_RU.awaiting_payment;
  return PAYMENT_STATUS_LABEL_RU[status] || status;
}

function getPaymentBadgeClassName(status?: string | null) {
  if (status === "paid") return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (status === "prepaid") return "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300";
  if (status === "cancelled") return "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300";
  return "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

function getExpenseBadgeClassName(status?: string | null) {
  if (status === "paid") return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  return "border-transparent bg-slate-500/15 text-slate-700 dark:text-slate-300";
}

function sortAppointmentsByTime(items: BookingAppointment[]) {
  return [...items].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
}

function PaymentJournal({
  items,
}: {
  items: BookingPayment[];
}) {
  if (!items.length) return null;

  const totalAmount = items.reduce((sum, payment) => sum + (payment.amount || 0), 0);

  return (
    <details className="group rounded-md bg-background/65 px-2.5 py-2 dark:bg-background/35">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <Receipt className="size-3 shrink-0" />
          <span className="font-medium">Журнал оплат</span>
          <span className="truncate">
            {items.length} · {formatAmount(totalAmount)} тг
          </span>
        </div>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-2 space-y-1">
        {items.map((payment) => (
          <div
            key={payment.id}
            className="flex flex-col gap-1 rounded-md bg-background/85 px-2 py-1.5 text-[10px] text-muted-foreground dark:bg-background/55 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="h-4 rounded-sm px-1 text-[8px]">
                {PAYMENT_KIND_LABEL_RU[payment.paymentKind] || payment.paymentKind}
              </Badge>
              <span className="font-medium text-foreground">{formatAmount(payment.amount)} тг</span>
              <span>{PAYMENT_METHOD_LABEL_RU[payment.paymentMethod] || payment.paymentMethod}</span>
            </div>
            <span>{formatDateTime(payment.createdAt)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function AppointmentIncomeCard({
  appointment,
  employeeName,
  payments,
  actionSaving,
  onAddPayment,
  onCancelPayment,
}: {
  appointment: BookingAppointment;
  employeeName: string;
  payments: BookingPayment[];
  actionSaving: boolean;
  onAddPayment: (appointment: BookingAppointment) => void;
  onCancelPayment: (appointment: BookingAppointment) => void;
}) {
  const receivedAmount = getReceivedAmount(appointment);
  const remainingAmount = getRemainingAmount(appointment);

  return (
    <div className="rounded-lg bg-muted/65 px-3 py-2.5 shadow-sm shadow-black/5 dark:bg-muted/40 dark:shadow-black/25">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-0.5">
            <div className="truncate text-sm font-semibold sm:text-base">
              {employeeName}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">{appointment.clientName || "Без имени"}</span>
              {formatPhone(appointment.clientPhone) ? (
                <>
                  <span className="text-[10px]">·</span>
                  <span className="truncate">{formatPhone(appointment.clientPhone)}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[360px] lg:max-w-[430px] lg:flex-1">
            <div className="rounded-md bg-background/80 px-2.5 py-1.5 dark:bg-background/50">
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Стоимость
              </div>
              <div className="mt-0.5 text-sm font-semibold">{formatAmount(appointment.serviceAmount || 0)} тг</div>
            </div>
            <div className="rounded-md bg-emerald-500/10 px-2.5 py-1.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-emerald-700 dark:text-emerald-300">
                Получено
              </div>
              <div className="mt-0.5 text-sm font-semibold text-emerald-900 dark:text-emerald-100">{formatAmount(receivedAmount)} тг</div>
            </div>
            <div className="rounded-md bg-amber-500/10 px-2.5 py-1.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-amber-700 dark:text-amber-300">
                Остаток
              </div>
              <div className="mt-0.5 text-sm font-semibold text-amber-900 dark:text-amber-100">{formatAmount(remainingAmount)} тг</div>
            </div>
          </div>
        </div>

        <PaymentJournal items={payments} />

        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-medium">
              <Clock3 className="size-3.5 shrink-0" />
              <span>{formatTime(appointment.startsAt)} - {formatTime(appointment.endsAt)}</span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "rounded-sm border px-2 py-0 text-[10px] font-medium",
                getPaymentBadgeClassName(appointment.paymentStatus),
              )}
            >
              {getPaymentStatusLabel(appointment.paymentStatus)}
            </Badge>
          </div>

          {remainingAmount > 0 || appointment.paymentStatus !== "cancelled" ? (
            <div className="flex flex-wrap justify-end gap-2">
              {remainingAmount > 0 && appointment.paymentStatus !== "cancelled" ? (
                <Button size="sm" className="h-8 rounded-md px-3" onClick={() => onAddPayment(appointment)}>
                  Добавить оплату
                </Button>
              ) : null}
              {appointment.paymentStatus !== "cancelled" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-md px-3"
                  onClick={() => onCancelPayment(appointment)}
                  disabled={actionSaving}
                >
                  {actionSaving ? "Сохраняю..." : "Отменить"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function KassaPageClient({
  requestContext,
}: KassaPageClientProps = {}) {
  const { toast } = useToast();
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [section, setSection] = useState<"income" | "expense">("income");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | BookingPaymentStatus>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<"all" | BookingPaymentMethod>("all");
  const [showPaidAppointments, setShowPaidAppointments] = useState(true);
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [refreshTick, setRefreshTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [calendarData, setCalendarData] = useState<BookingCalendarViewResponse | null>(null);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentDialogAppointmentId, setPaymentDialogAppointmentId] = useState<string | null>(null);
  const [paymentCancelDialogOpen, setPaymentCancelDialogOpen] = useState(false);
  const [paymentCancelAppointmentId, setPaymentCancelAppointmentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod>("kaspi_transfer");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [expenseBulkTarget, setExpenseBulkTarget] = useState<"all" | string | null>(null);
  const [expenseSavingId, setExpenseSavingId] = useState<string | null>(null);
  const [appointmentStatusSavingId, setAppointmentStatusSavingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const from = startOfDay(anchorDate);
    const to = addDays(from, 1);

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetchBookingCalendarView(
          {
            view: "day",
            from: from.toISOString(),
            to: to.toISOString(),
            includeSlots: false,
          },
          requestContext,
        );

        if (!active) return;
        setCalendarData(response);
      } catch (error) {
        if (!active) return;
        setCalendarData(null);
        toast({
          title: "Не удалось загрузить кассу",
          description: error instanceof Error ? error.message : "Повторите попытку",
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [anchorDate, refreshTick, requestContext?.agentId, requestContext?.companyId, toast]);

  useEffect(() => {
    const employeeIds = (calendarData?.employees || []).map((employee) => employee.id);
    if (!employeeIds.length) {
      setSelectedEmployeeIds([]);
      return;
    }

    setSelectedEmployeeIds((current) => {
      const available = new Set(employeeIds);
      const preserved = current.filter((id) => available.has(id));
      if (preserved.length) return preserved;
      return employeeIds;
    });
  }, [calendarData?.employees]);
  const {
    appointments,
    expenses,
    employeesById,
    appointmentsById,
    paymentsByAppointmentId,
    selectedEmployeeIdSet,
    filteredAppointments,
    searchedAppointments,
    filteredExpenses,
    groupedExpenses,
    visibleUnpaidExpenseCount,
    incomeTotals,
    expenseTotals,
    allEmployees,
  } = useKassaDerivedData({
    calendarData,
    selectedEmployeeIds,
    paymentStatusFilter,
    paymentMethodFilter,
    showPaidAppointments,
    expenseStatusFilter,
    sortAppointmentsByTime,
    getReceivedAmount,
    getRemainingAmount,
  });

  const selectedPaymentAppointment = paymentDialogAppointmentId
    ? appointmentsById.get(paymentDialogAppointmentId) || null
    : null;
  const selectedPaymentCancelAppointment = paymentCancelAppointmentId
    ? appointmentsById.get(paymentCancelAppointmentId) || null
    : null;

  const refresh = () => setRefreshTick((value) => value + 1);

  const openPaymentDialog = (appointment: BookingAppointment) => {
    const remainingAmount = getRemainingAmount(appointment);
    setPaymentDialogAppointmentId(appointment.id);
    setPaymentAmount(remainingAmount);
    setPaymentAmountInput(remainingAmount > 0 ? String(remainingAmount) : "");
    setPaymentMethod("kaspi_transfer");
    setPaymentDialogOpen(true);
  };

  const handlePaymentDialogOpenChange = (open: boolean) => {
    setPaymentDialogOpen(open);
    if (open) return;
    setPaymentDialogAppointmentId(null);
    setPaymentAmount(0);
    setPaymentAmountInput("");
    setPaymentMethod("kaspi_transfer");
  };

  const handlePaymentCancelDialogOpenChange = (open: boolean) => {
    if (!open && appointmentStatusSavingId) return;
    setPaymentCancelDialogOpen(open);
    if (open) return;
    setPaymentCancelAppointmentId(null);
  };

  const submitPayment = async () => {
    if (!selectedPaymentAppointment) return;

    const amount = Math.max(0, Math.round(Number(paymentAmount) || 0));
    if (amount <= 0) {
      toast({ title: "Сумма оплаты должна быть больше 0" });
      return;
    }

    setPaymentSaving(true);
    try {
      await addBookingAppointmentPayment(
        selectedPaymentAppointment.id,
        {
          amount,
          paymentMethod,
        },
        requestContext,
      );
      handlePaymentDialogOpenChange(false);
      refresh();
      toast({ title: "Оплата добавлена" });
    } catch (error) {
      toast({
        title: "Не удалось добавить оплату",
        description: error instanceof Error ? error.message : "Повторите попытку",
      });
    } finally {
      setPaymentSaving(false);
    }
  };

  const openCancelPaymentDialog = (appointment: BookingAppointment) => {
    setPaymentCancelAppointmentId(appointment.id);
    setPaymentCancelDialogOpen(true);
  };

  const confirmCancelPayment = async () => {
    if (!paymentCancelAppointmentId) return;
    setAppointmentStatusSavingId(paymentCancelAppointmentId);
    try {
      await cancelBookingAppointmentPayment(paymentCancelAppointmentId, requestContext);
      handlePaymentCancelDialogOpenChange(false);
      refresh();
      toast({ title: "Оплата отменена" });
    } catch (error) {
      toast({
        title: "Не удалось отменить оплату",
        description: error instanceof Error ? error.message : "Повторите попытку",
      });
    } finally {
      setAppointmentStatusSavingId(null);
    }
  };

  const payExpense = async (expense: BookingExpense) => {
    setExpenseSavingId(expense.id);
    try {
      await markBookingExpensePaid(expense.id, requestContext);
      refresh();
      toast({ title: "Расход оплачен" });
    } catch (error) {
      toast({
        title: "Не удалось оплатить расход",
        description: error instanceof Error ? error.message : "Повторите попытку",
      });
    } finally {
      setExpenseSavingId(null);
    }
  };

  const payGroupedExpenses = async (
    employeeIds?: string[],
    successTitle = "Все расходы за день оплачены",
    savingTarget: "all" | string = "all",
  ) => {
    const from = startOfDay(anchorDate);
    const to = addDays(from, 1);
    setExpenseBulkTarget(savingTarget);
    try {
      await payAllBookingExpenses(
        {
          from: from.toISOString(),
          to: to.toISOString(),
          employeeIds,
        },
        requestContext,
      );
      refresh();
      toast({ title: successTitle });
    } catch (error) {
      toast({
        title: "Не удалось провести массовую выплату",
        description: error instanceof Error ? error.message : "Повторите попытку",
      });
    } finally {
      setExpenseBulkTarget(null);
    }
  };

  const payAllExpensesForDay = async () => {
    if (visibleUnpaidExpenseCount <= 0) {
      toast({ title: "Нет невыплаченных расходов по текущим фильтрам" });
      return;
    }
    const allEmployeeIds = (calendarData?.employees || []).map((employee) => employee.id);
    const employeeIds =
      selectedEmployeeIds.length > 0 && selectedEmployeeIds.length < allEmployeeIds.length
        ? selectedEmployeeIds
        : undefined;

    await payGroupedExpenses(employeeIds, "Все расходы за день оплачены", "all");
  };

  const payExpensesForEmployee = async (employeeId: string, employeeName: string) => {
    await payGroupedExpenses([employeeId], `Выплата для ${employeeName} проведена`, employeeId);
  };

  const toggleEmployee = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds((current) => {
      if (checked) {
        if (current.includes(employeeId)) return current;
        return [...current, employeeId];
      }

      const next = current.filter((id) => id !== employeeId);
      return next.length ? next : current;
    });
  };

  return (
    <main className="space-y-3">
      <div className="grid min-[1100px]:grid-cols-[280px_minmax(0,1fr)] min-[1400px]:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-full min-w-0 gap-4 border-transparent bg-muted/20 py-4 shadow-none">
          <CardContent className="flex h-full flex-col gap-4 px-4 min-[1400px]:px-6">
            <Tabs value={section} onValueChange={(value) => setSection(value as "income" | "expense")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="income">Доходы</TabsTrigger>
                <TabsTrigger value="expense">Расходы</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="rounded-lg p-2">
              <Calendar
                mode="single"
                locale={ru}
                selected={anchorDate}
                onSelect={(date) => date && setAnchorDate(date)}
                month={anchorDate}
                onMonthChange={setAnchorDate}
                className="mx-auto rounded-lg [--cell-size:2.05rem] min-[1100px]:[--cell-size:2.2rem] min-[1400px]:[--cell-size:2.45rem]"
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Сотрудники</Label>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => setSelectedEmployeeIds(allEmployees.map((employee) => employee.id))}
                  >
                    Все
                  </Button>
                </div>
              </div>

              <div className="rounded-md">
                <div className="space-y-1 p-2">
                  {allEmployees.length === 0 ? (
                    <div className="text-muted-foreground px-2 py-6 text-center text-sm">
                      Сотрудников пока нет.
                    </div>
                  ) : (
                    allEmployees.map((employee) => {
                      const checked = selectedEmployeeIdSet.has(employee.id);
                      return (
                        <label
                          key={employee.id}
                          className="group hover:bg-accent flex items-center gap-3 rounded-sm bg-muted px-2 py-2"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleEmployee(employee.id, value === true)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{employee.name || "Сотрудник"}</div>
                            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                              <span
                                className="inline-block size-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: employee.color || "#0ea5e9" }}
                              />
                              <span className="truncate">{employee.specialty || "Без специализации"}</span>
                              <Badge variant="outline" className="h-4 shrink-0 rounded-sm px-1 text-[10px] font-normal">
                                {formatCompensationLabel(employee.compensationType, employee.compensationValue)}
                              </Badge>
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 rounded-xl bg-background px-2 pb-2 pt-5">
          <div className="space-y-3">
            <div className="mt-1 rounded-lg bg-muted/30 p-1">
              <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md bg-muted/65 px-3 py-2 shadow-sm shadow-black/5 dark:bg-muted/40 dark:shadow-black/25">
                  <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    {section === "income" ? "Записей" : "Расходов"}
                  </div>
                  <div className="mt-0.5 text-base font-semibold tracking-tight">
                    {section === "income" ? searchedAppointments.length : filteredExpenses.length}
                  </div>
                </div>

                <div className="rounded-md bg-muted/65 px-3 py-2 shadow-sm shadow-black/5 dark:bg-muted/40 dark:shadow-black/25">
                  <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    {section === "income" ? "Начислено" : "Всего расходов"}
                  </div>
                  <div className="mt-0.5 text-base font-semibold tracking-tight">
                    {formatAmount(section === "income" ? incomeTotals.serviceAmount : expenseTotals.total)} тг
                  </div>
                </div>

                <div className="rounded-md bg-muted/65 px-3 py-2 shadow-sm shadow-black/5 dark:bg-muted/40 dark:shadow-black/25">
                  <div
                    className={cn(
                      "text-[9px] font-medium uppercase tracking-[0.06em]",
                      section === "income"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-sky-700 dark:text-sky-300",
                    )}
                  >
                    {section === "income" ? "Получено" : "Выплачено"}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-base font-semibold tracking-tight",
                      section === "income"
                        ? "text-emerald-900 dark:text-emerald-100"
                        : "text-sky-900 dark:text-sky-100",
                    )}
                  >
                    {formatAmount(section === "income" ? incomeTotals.receivedAmount : expenseTotals.paid)} тг
                  </div>
                </div>

                <div className="rounded-md bg-muted/65 px-3 py-2 shadow-sm shadow-black/5 dark:bg-muted/40 dark:shadow-black/25">
                  <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-amber-700 dark:text-amber-300">
                    {section === "income" ? "Остаток" : "К выплате"}
                  </div>
                  <div className="mt-0.5 text-base font-semibold tracking-tight text-amber-900 dark:text-amber-100">
                    {formatAmount(section === "income" ? incomeTotals.remainingAmount : expenseTotals.unpaid)} тг
                  </div>
                </div>
              </div>
            </div>

            {section === "income" ? (
              <div className="space-y-3">
                <Card className="border-transparent bg-muted/15 shadow-none">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-base">Доходы за день</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2">
                    <div className="rounded-xl bg-background/40 px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex shrink-0 items-center gap-2 pr-1">
                          <SlidersHorizontal className="size-4 text-muted-foreground" />
                          <div className="text-sm font-medium">Фильтры</div>
                        </div>

                        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md bg-background/70 px-3">
                          <span className="shrink-0 text-xs text-muted-foreground">Статус</span>
                          <select
                            className="h-9 min-w-0 flex-1 border-0 bg-transparent pr-8 text-sm outline-none"
                            value={paymentStatusFilter}
                            onChange={(event) =>
                              setPaymentStatusFilter(event.target.value as "all" | BookingPaymentStatus)
                            }
                          >
                            <option value="all">Все</option>
                            <option value="awaiting_payment">{PAYMENT_STATUS_LABEL_RU.awaiting_payment}</option>
                            <option value="prepaid">{PAYMENT_STATUS_LABEL_RU.prepaid}</option>
                            <option value="paid">{PAYMENT_STATUS_LABEL_RU.paid}</option>
                            <option value="cancelled">{PAYMENT_STATUS_LABEL_RU.cancelled}</option>
                          </select>
                        </div>

                        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md bg-background/70 px-3">
                          <span className="shrink-0 text-xs text-muted-foreground">Оплата</span>
                          <select
                            className="h-9 min-w-0 flex-1 border-0 bg-transparent pr-8 text-sm outline-none"
                            value={paymentMethodFilter}
                            onChange={(event) =>
                              setPaymentMethodFilter(event.target.value as "all" | BookingPaymentMethod)
                            }
                          >
                            <option value="all">Все способы</option>
                            {PAYMENT_METHOD_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <label className="flex h-9 shrink-0 items-center gap-3 rounded-md bg-background/70 px-3 text-sm">
                          <Checkbox
                            checked={showPaidAppointments}
                            onCheckedChange={(checked) => setShowPaidAppointments(checked === true)}
                          />
                          <span>Оплаченные</span>
                        </label>
                      </div>
                    </div>

                    {loading ? (
                      <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-center text-sm">
                        Загрузка кассы...
                      </div>
                    ) : searchedAppointments.length === 0 ? (
                      <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-center text-sm">
                        По текущим фильтрам записей не найдено.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {searchedAppointments.map((appointment) => (
                          <AppointmentIncomeCard
                            key={appointment.id}
                            appointment={appointment}
                            employeeName={employeesById.get(appointment.employeeId)?.name || "Сотрудник"}
                            payments={paymentsByAppointmentId.get(appointment.id) || []}
                            actionSaving={appointmentStatusSavingId === appointment.id}
                            onAddPayment={openPaymentDialog}
                            onCancelPayment={openCancelPaymentDialog}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-transparent bg-muted/15 shadow-none">
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-base">Список выплат врачам</CardTitle>
                      <CardDescription>
                        Расходы сгруппированы по сотрудникам: можно выплатить сразу по врачу, по отдельному приему или всем.
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => void payAllExpensesForDay()}
                      disabled={expenseBulkTarget !== null || visibleUnpaidExpenseCount === 0}
                    >
                      {expenseBulkTarget === "all" ? "Провожу выплату..." : "Выплата всем"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 rounded-xl bg-background/40 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex shrink-0 items-center gap-2 pr-1">
                        <SlidersHorizontal className="size-4 text-muted-foreground" />
                        <div className="text-sm font-medium">Фильтры</div>
                      </div>

                      <div className="flex min-w-[240px] items-center gap-2 rounded-md bg-background/70 px-3">
                        <span className="shrink-0 text-xs text-muted-foreground">Статус</span>
                        <select
                          className="h-9 min-w-0 flex-1 border-0 bg-transparent pr-8 text-sm outline-none"
                          value={expenseStatusFilter}
                          onChange={(event) =>
                            setExpenseStatusFilter(event.target.value as "all" | "unpaid" | "paid")
                          }
                        >
                          <option value="all">Все</option>
                          <option value="unpaid">Не оплачено</option>
                          <option value="paid">Оплачено</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {loading ? (
                    <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
                      Загрузка расходов...
                    </div>
                  ) : filteredExpenses.length === 0 ? (
                    <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
                      По текущим фильтрам расходов не найдено.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groupedExpenses.map((group) => (
                        <details
                          key={group.employeeId}
                          open
                          className="group overflow-hidden rounded-lg bg-muted/30 shadow-sm shadow-black/5 dark:bg-muted/20 dark:shadow-black/20"
                        >
                          <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                            <div className="flex flex-col gap-3 bg-muted/65 px-4 py-3 shadow-sm shadow-black/5 dark:bg-muted/40 dark:shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className="inline-block size-2.5 rounded-full"
                                    style={{ backgroundColor: group.employeeColor }}
                                  />
                                  <span className="font-medium">{group.employeeName}</span>
                                  <Badge variant="outline" className="rounded-sm border-transparent bg-background/70 dark:bg-background/45">
                                    Приемов: {group.items.length}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "rounded-sm border-transparent",
                                      group.unpaidCount > 0
                                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                                    )}
                                  >
                                    {group.unpaidCount > 0 ? `К выплате: ${group.unpaidCount}` : "Все оплачено"}
                                  </Badge>
                                </div>

                                <div className="text-muted-foreground mt-1 text-xs">
                                  Всего: {formatAmount(group.totalAmount)} тг
                                  {" · "}
                                  Не выплачено: {formatAmount(group.unpaidAmount)} тг
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                {group.unpaidCount > 0 ? (
                                  <Button
                                    size="sm"
                                    className="h-8 rounded-md px-3"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      void payExpensesForEmployee(group.employeeId, group.employeeName);
                                    }}
                                    disabled={expenseBulkTarget !== null}
                                  >
                                    {expenseBulkTarget === group.employeeId ? "Провожу выплату..." : "Оплата сотруднику"}
                                  </Button>
                                ) : null}
                                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                              </div>
                            </div>
                          </summary>

                          <div className="space-y-2 p-4">
                            {group.items.map((expense) => {
                              const appointment = appointmentsById.get(expense.appointmentId);
                              const isSaving = expenseSavingId === expense.id;

                              return (
                                <div
                                  key={expense.id}
                                  className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/65 px-3 py-2.5 shadow-sm shadow-black/5 dark:bg-muted/40 dark:shadow-black/20"
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className={cn("rounded-sm text-[10px]", getExpenseBadgeClassName(expense.status))}
                                      >
                                        {expense.status === "paid" ? "Оплачено" : "Не оплачено"}
                                      </Badge>
                                    </div>

                                    <div className="text-muted-foreground mt-1 text-xs">
                                      {appointment
                                        ? `${formatTime(appointment.startsAt)} · ${appointment.clientName || "Без имени"}`
                                        : "Прием не найден"}
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                      <div className="inline-flex items-center gap-1.5 rounded-md bg-background/75 px-2.5 py-1.5 dark:bg-background/45">
                                        <Receipt className="size-3.5 text-muted-foreground" />
                                        <span className="font-medium text-foreground">{formatAmount(expense.amount || 0)} тг</span>
                                      </div>
                                      <span className="text-muted-foreground">
                                        {expense.paidAt ? `Оплачено: ${formatDateTime(expense.paidAt)}` : "Ожидает выплаты"}
                                      </span>
                                    </div>
                                  </div>

                                  {expense.status !== "paid" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 rounded-md px-3"
                                      onClick={() => void payExpense(expense)}
                                      disabled={isSaving || expenseBulkTarget !== null}
                                    >
                                      {isSaving ? "Сохраняю..." : "Оплатить"}
                                    </Button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={paymentDialogOpen} onOpenChange={handlePaymentDialogOpenChange}>
        <DialogContent className="border-border/80 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить оплату</DialogTitle>
            <DialogDescription>
              {selectedPaymentAppointment
                ? `Оплата по остатку для приема ${selectedPaymentAppointment.clientName || "Без имени"}`
                : "Укажите сумму и способ оплаты"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Сумма</Label>
              <Input
                className="h-11 rounded-xl"
                type="text"
                inputMode="numeric"
                value={paymentAmountInput}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "");
                  setPaymentAmountInput(digits);
                  setPaymentAmount(digits ? Math.max(0, Math.round(Number(digits) || 0)) : 0);
                }}
              />
            </div>

            <div className="grid gap-2">
              <Label>Способ оплаты</Label>
              <select
                className="border-input bg-background h-11 rounded-xl border pl-3 pr-10 text-sm"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as BookingPaymentMethod)}
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedPaymentAppointment ? (
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm">
                Остаток: {formatAmount(getRemainingAmount(selectedPaymentAppointment))} тг
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => handlePaymentDialogOpenChange(false)}>
              Отмена
            </Button>
            <Button className="rounded-xl" onClick={() => void submitPayment()} disabled={paymentSaving}>
              {paymentSaving ? "Сохраняю..." : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentCancelDialogOpen} onOpenChange={handlePaymentCancelDialogOpenChange}>
        <DialogContent className="border-border/80 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Отменить оплату?</DialogTitle>
            <DialogDescription>
              {selectedPaymentCancelAppointment
                ? `Прием: ${selectedPaymentCancelAppointment.clientName || "Без имени"} · ${formatTime(selectedPaymentCancelAppointment.startsAt)}`
                : "Подтвердите отмену оплаты по выбранному приему."}
            </DialogDescription>
          </DialogHeader>

          {selectedPaymentCancelAppointment ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm">
              Будет отменено: {formatAmount(getReceivedAmount(selectedPaymentCancelAppointment))} тг
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => handlePaymentCancelDialogOpenChange(false)}
              disabled={Boolean(appointmentStatusSavingId)}
            >
              Назад
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => void confirmCancelPayment()}
              disabled={Boolean(appointmentStatusSavingId)}
            >
              {appointmentStatusSavingId ? "Отменяю..." : "Подтвердить отмену"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
