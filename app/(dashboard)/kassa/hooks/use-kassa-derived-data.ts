"use client";

import { useMemo } from "react";

import type {
  BookingAppointment,
  BookingCalendarViewResponse,
  BookingExpense,
  BookingPayment,
  BookingPaymentMethod,
  BookingPaymentStatus,
} from "@/lib/booking-api";

type UseKassaDerivedDataParams = {
  calendarData: BookingCalendarViewResponse | null;
  selectedEmployeeIds: string[];
  paymentStatusFilter: "all" | BookingPaymentStatus;
  paymentMethodFilter: "all" | BookingPaymentMethod;
  showPaidAppointments: boolean;
  expenseStatusFilter: "all" | "unpaid" | "paid";
  sortAppointmentsByTime: (items: BookingAppointment[]) => BookingAppointment[];
  getReceivedAmount: (appointment: BookingAppointment) => number;
  getRemainingAmount: (appointment: BookingAppointment) => number;
};

export function useKassaDerivedData({
  calendarData,
  selectedEmployeeIds,
  paymentStatusFilter,
  paymentMethodFilter,
  showPaidAppointments,
  expenseStatusFilter,
  sortAppointmentsByTime,
  getReceivedAmount,
  getRemainingAmount,
}: UseKassaDerivedDataParams) {
  const appointments = useMemo(
    () => sortAppointmentsByTime(calendarData?.appointments || []),
    [calendarData?.appointments, sortAppointmentsByTime],
  );

  const appointmentStartTimeById = useMemo(
    () =>
      new Map(
        appointments.map((appointment) => [appointment.id, new Date(appointment.startsAt).getTime()] as const),
      ),
    [appointments],
  );

  const expenses = useMemo(
    () =>
      [...(calendarData?.expenses || [])].sort(
        (left, right) =>
          (appointmentStartTimeById.get(left.appointmentId) ?? 0) -
          (appointmentStartTimeById.get(right.appointmentId) ?? 0),
      ),
    [appointmentStartTimeById, calendarData?.expenses],
  );

  const employeesById = useMemo(
    () => new Map((calendarData?.employees || []).map((employee) => [employee.id, employee] as const)),
    [calendarData?.employees],
  );

  const appointmentsById = useMemo(
    () => new Map(appointments.map((appointment) => [appointment.id, appointment] as const)),
    [appointments],
  );

  const paymentsByAppointmentId = useMemo(() => {
    const map = new Map<string, BookingPayment[]>();
    for (const payment of calendarData?.payments || []) {
      const list = map.get(payment.appointmentId) || [];
      list.push(payment);
      map.set(payment.appointmentId, list);
    }
    return map;
  }, [calendarData?.payments]);

  const selectedEmployeeIdSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);

  const filteredAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        const matchesEmployee =
          selectedEmployeeIdSet.size === 0 || selectedEmployeeIdSet.has(appointment.employeeId);
        if (!matchesEmployee) return false;
        if (!showPaidAppointments && appointment.paymentStatus === "paid") return false;
        if (paymentStatusFilter === "all") return true;
        return appointment.paymentStatus === paymentStatusFilter;
      }),
    [appointments, paymentStatusFilter, selectedEmployeeIdSet, showPaidAppointments],
  );

  const searchedAppointments = useMemo(
    () =>
      filteredAppointments.filter((appointment) => {
        if (paymentMethodFilter === "all") return true;
        return (paymentsByAppointmentId.get(appointment.id) || []).some(
          (payment) => payment.paymentMethod === paymentMethodFilter,
        );
      }),
    [filteredAppointments, paymentMethodFilter, paymentsByAppointmentId],
  );

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        const matchesEmployee =
          selectedEmployeeIdSet.size === 0 || selectedEmployeeIdSet.has(expense.employeeId);
        if (!matchesEmployee) return false;
        if (expenseStatusFilter !== "all" && expense.status !== expenseStatusFilter) return false;
        return true;
      }),
    [expenseStatusFilter, expenses, selectedEmployeeIdSet],
  );

  const groupedExpenses = useMemo(() => {
    const groups = new Map<
      string,
      {
        employeeId: string;
        employeeName: string;
        employeeColor: string;
        items: BookingExpense[];
        totalAmount: number;
        unpaidAmount: number;
        unpaidCount: number;
      }
    >();

    const sorted = [...filteredExpenses].sort(
      (left, right) =>
        (appointmentStartTimeById.get(left.appointmentId) ?? 0) -
        (appointmentStartTimeById.get(right.appointmentId) ?? 0),
    );

    for (const expense of sorted) {
      const employee = employeesById.get(expense.employeeId);
      const key = expense.employeeId || "__unknown__";
      const existing =
        groups.get(key) ||
        {
          employeeId: expense.employeeId,
          employeeName: employee?.name || "Сотрудник",
          employeeColor: employee?.color || "#0ea5e9",
          items: [],
          totalAmount: 0,
          unpaidAmount: 0,
          unpaidCount: 0,
        };

      existing.items.push(expense);
      existing.totalAmount += expense.amount || 0;
      if (expense.status !== "paid") {
        existing.unpaidAmount += expense.amount || 0;
        existing.unpaidCount += 1;
      }
      groups.set(key, existing);
    }

    return Array.from(groups.values()).sort((left, right) =>
      left.employeeName.localeCompare(right.employeeName, "ru"),
    );
  }, [appointmentStartTimeById, employeesById, filteredExpenses]);

  const visibleUnpaidExpenseCount = useMemo(
    () => filteredExpenses.filter((expense) => expense.status !== "paid").length,
    [filteredExpenses],
  );

  const incomeTotals = useMemo(() => {
    let serviceAmount = 0;
    let receivedAmount = 0;
    let remainingAmount = 0;
    for (const appointment of searchedAppointments) {
      serviceAmount += appointment.serviceAmount || 0;
      receivedAmount += getReceivedAmount(appointment);
      remainingAmount += getRemainingAmount(appointment);
    }
    return { serviceAmount, receivedAmount, remainingAmount };
  }, [getReceivedAmount, getRemainingAmount, searchedAppointments]);

  const expenseTotals = useMemo(() => {
    let total = 0;
    let unpaid = 0;
    for (const expense of filteredExpenses) {
      total += expense.amount || 0;
      if (expense.status !== "paid") unpaid += expense.amount || 0;
    }
    return { total, unpaid, paid: Math.max(total - unpaid, 0) };
  }, [filteredExpenses]);

  const allEmployees = calendarData?.employees || [];

  return {
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
  };
}
