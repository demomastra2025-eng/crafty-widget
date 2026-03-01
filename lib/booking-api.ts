export type BookingView = 'day' | 'week' | 'month';
export type BookingPaymentMethod = 'kaspi_transfer' | 'kaspi_qr' | 'cash' | 'bank_transfer';
export type BookingPaymentStatus = 'awaiting_payment' | 'prepaid' | 'paid' | 'cancelled';
export type BookingExpenseStatus = 'unpaid' | 'paid';
export type BookingCompensationType = 'percent' | 'fixed';
export type BookingPaymentKind = 'prepaid' | 'payment' | 'adjustment';

export type BookingEmployee = {
  id: string;
  companyId: string;
  name: string;
  specialty?: string | null;
  color?: string | null;
  timezone: string;
  slotDurationMin: number;
  compensationType: BookingCompensationType | string;
  compensationValue: number;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type BookingWorkRule = {
  id: string;
  employeeId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
};

export type BookingBreakRule = {
  id: string;
  companyId?: string;
  employeeId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  title?: string | null;
  isActive: boolean;
};

export type BookingHoliday = {
  id: string;
  companyId: string;
  date: string;
  title: string;
  isRecurringYearly: boolean;
  isWorkingDayOverride: boolean;
};

export type BookingTimeOff = {
  id: string;
  companyId: string;
  employeeId?: string | null;
  type: string;
  startsAt: string;
  endsAt: string;
  title?: string | null;
  notes?: string | null;
};

export type BookingAppointment = {
  id: string;
  companyId: string;
  employeeId: string;
  startsAt: string;
  endsAt: string;
  durationMin?: number | null;
  status: string;
  clientName: string;
  clientPhone?: string | null;
  clientIin?: string | null;
  clientBirthDate?: string | null;
  clientGender?: 'male' | 'female' | string | null;
  clientComment?: string | null;
  source: string;
  externalRef?: string | null;
  idempotencyKey?: string | null;
  createdByUserId?: string | null;
  serviceAmount: number;
  prepaidAmount: number;
  prepaidPaymentMethod?: BookingPaymentMethod | string | null;
  settlementAmount: number;
  settlementPaymentMethod?: BookingPaymentMethod | string | null;
  paymentStatus: BookingPaymentStatus | string;
};

export type BookingExpense = {
  id: string;
  companyId: string;
  appointmentId: string;
  employeeId: string;
  amount: number;
  status: BookingExpenseStatus | string;
  paidAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type BookingPayment = {
  id: string;
  companyId: string;
  appointmentId: string;
  amount: number;
  paymentMethod: BookingPaymentMethod | string;
  paymentKind: BookingPaymentKind | string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type BookingSlot = {
  employeeId: string;
  startsAt: string;
  endsAt: string;
  status: 'available';
};

export type BookingCalendarViewResponse = {
  view: BookingView;
  range: { from: string; to: string };
  employees: BookingEmployee[];
  workRules: BookingWorkRule[];
  breakRules: BookingBreakRule[];
  holidays: BookingHoliday[];
  timeOff: BookingTimeOff[];
  appointments: BookingAppointment[];
  payments: BookingPayment[];
  expenses: BookingExpense[];
  slots: BookingSlot[];
};

export type BookingRuleRangeInput = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  isActive?: boolean;
  title?: string;
};

export type BookingApiError = Error & {
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
};

export type BookingRequestContext = {
  companyId?: string | null;
  agentId?: string | null;
};

const BOOKING_COMPANY_STORAGE_KEY = "crafty:booking-company-id";
const BOOKING_AGENT_STORAGE_KEY = "crafty:booking-agent-id";
const EVO_API_KEY_STORAGE = "crafty:evo-api-key";

function getApiKey() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(EVO_API_KEY_STORAGE);
  } catch {
    return null;
  }
}

const authHeaders = (requestContext?: BookingRequestContext): HeadersInit => {
  if (typeof window === "undefined") return {};

  const headers: Record<string, string> = {};
  const key = getApiKey();
  if (key) headers.apikey = key;

  try {
    const companyId =
      (requestContext?.companyId ? String(requestContext.companyId) : "") ||
      localStorage.getItem(BOOKING_COMPANY_STORAGE_KEY);
    if (companyId) headers["x-booking-company-id"] = companyId;
    const agentId =
      (requestContext?.agentId ? String(requestContext.agentId) : "") ||
      localStorage.getItem(BOOKING_AGENT_STORAGE_KEY);
    if (agentId) headers["x-booking-agent-id"] = agentId;
  } catch {
    const companyId = requestContext?.companyId ? String(requestContext.companyId) : "";
    if (companyId) headers["x-booking-company-id"] = companyId;
    const agentId = requestContext?.agentId ? String(requestContext.agentId) : "";
    if (agentId) headers["x-booking-agent-id"] = agentId;
  }

  return headers;
};

function buildQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  requestContext?: BookingRequestContext,
) {
  const res = await fetch(path, {
    ...options,
    cache: 'no-store',
    headers: {
      ...(options.method && options.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
      ...(authHeaders(requestContext) || {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    const bodyObject = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
    const responseObject =
      bodyObject && typeof bodyObject.response === "object" && bodyObject.response !== null
        ? (bodyObject.response as Record<string, unknown>)
        : null;
    const responseMessage = Array.isArray(responseObject?.message)
      ? String(responseObject?.message[0] || "")
      : "";
    const err = new Error(
      responseMessage ||
        (typeof bodyObject?.error === "string" ? bodyObject.error : "") ||
        (typeof body === "string" ? body : `Request failed: ${res.status}`),
    ) as BookingApiError;
    err.status = res.status;
    if (typeof bodyObject?.code === "string") err.code = bodyObject.code;
    if (bodyObject?.details && typeof bodyObject.details === "object") {
      err.details = bodyObject.details as Record<string, unknown>;
    }
    throw err;
  }

  return (await res.json()) as T;
}

export async function listBookingEmployees(
  includeInactive = false,
  requestContext?: BookingRequestContext,
) {
  return requestJson<{ employees: BookingEmployee[] }>(
    `/api/evo/booking/employees${buildQuery({ includeInactive: includeInactive ? 'true' : undefined })}`,
    {},
    requestContext,
  );
}

export async function createBookingEmployee(payload: {
  name: string;
  specialty?: string;
  color?: string;
  slotDurationMin?: number;
  compensationType?: BookingCompensationType | string;
  compensationValue?: number;
}, requestContext?: BookingRequestContext) {
  return requestJson<{ employee: BookingEmployee }>(`/api/evo/booking/employees`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, requestContext);
}

export async function updateBookingEmployee(
  id: string,
  payload: {
    name?: string;
    specialty?: string | null;
    color?: string | null;
    slotDurationMin?: number;
    compensationType?: BookingCompensationType | string;
    compensationValue?: number;
    isActive?: boolean;
  },
  requestContext?: BookingRequestContext,
) {
  return requestJson<{ employee: BookingEmployee }>(`/api/evo/booking/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, requestContext);
}

export async function replaceBookingEmployeeWorkRules(
  employeeId: string,
  workRules: BookingRuleRangeInput[],
  requestContext?: BookingRequestContext,
) {
  return requestJson<{ workRules: BookingWorkRule[] }>(`/api/evo/booking/employees/${employeeId}/work-rules`, {
    method: 'PUT',
    body: JSON.stringify({ workRules }),
  }, requestContext);
}

export async function replaceBookingEmployeeBreakRules(
  employeeId: string,
  breakRules: BookingRuleRangeInput[],
  requestContext?: BookingRequestContext,
) {
  return requestJson<{ breakRules: BookingBreakRule[] }>(`/api/evo/booking/employees/${employeeId}/break-rules`, {
    method: 'PUT',
    body: JSON.stringify({ breakRules }),
  }, requestContext);
}

export async function fetchBookingCalendarView(params: {
  view: BookingView;
  from: string;
  to: string;
  employeeIds?: string[];
  includeSlots?: boolean;
  durationMin?: number;
}, requestContext?: BookingRequestContext) {
  return requestJson<BookingCalendarViewResponse>(
    `/api/evo/booking/calendar/view${buildQuery({
      view: params.view,
      from: params.from,
      to: params.to,
      employeeIds: params.employeeIds?.length ? params.employeeIds.join(',') : undefined,
      includeSlots: params.includeSlots ?? undefined,
      durationMin: params.durationMin,
    })}`,
    {},
    requestContext,
  );
}

export async function createBookingAppointment(payload: {
  employeeId: string;
  startsAt: string;
  endsAt: string;
  durationMin?: number;
  clientName: string;
  clientPhone?: string;
  clientIin?: string;
  clientComment?: string;
  source?: string;
  externalRef?: string;
  idempotencyKey?: string;
  serviceAmount?: number;
  prepaidAmount?: number;
  prepaidPaymentMethod?: BookingPaymentMethod | string;
  settlementAmount?: number;
  settlementPaymentMethod?: BookingPaymentMethod | string;
  paymentStatus?: BookingPaymentStatus | string;
}, requestContext?: BookingRequestContext) {
  return requestJson<{ appointment: BookingAppointment }>(`/api/evo/booking/appointments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, requestContext);
}

export async function updateBookingAppointment(
  id: string,
  payload: Partial<BookingAppointment>,
  requestContext?: BookingRequestContext,
) {
  return requestJson<{ appointment: BookingAppointment }>(`/api/evo/booking/appointments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, requestContext);
}

export async function cancelBookingAppointment(id: string, requestContext?: BookingRequestContext) {
  return requestJson<{ appointment: BookingAppointment }>(`/api/evo/booking/appointments/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, requestContext);
}

export async function addBookingAppointmentPayment(
  id: string,
  payload: {
    amount?: number;
    paymentMethod: BookingPaymentMethod | string;
  },
  requestContext?: BookingRequestContext,
) {
  return requestJson<{ appointment: BookingAppointment }>(`/api/evo/booking/appointments/${id}/payment`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, requestContext);
}

export async function cancelBookingAppointmentPayment(id: string, requestContext?: BookingRequestContext) {
  return requestJson<{ appointment: BookingAppointment }>(`/api/evo/booking/appointments/${id}/payment/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, requestContext);
}

export async function markBookingExpensePaid(id: string, requestContext?: BookingRequestContext) {
  return requestJson<{ expense: BookingExpense }>(`/api/evo/booking/expenses/${id}/pay`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, requestContext);
}

export async function payAllBookingExpenses(
  payload: {
    from?: string;
    to?: string;
    employeeIds?: string[];
  },
  requestContext?: BookingRequestContext,
) {
  return requestJson<{ expenses: BookingExpense[] }>(`/api/evo/booking/expenses/pay-all`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, requestContext);
}

export async function listBookingHolidays(
  params: { year?: number; from?: string; to?: string },
  requestContext?: BookingRequestContext,
) {
  return requestJson<{ holidays: BookingHoliday[] }>(
    `/api/evo/booking/holidays${buildQuery({ year: params.year, from: params.from, to: params.to })}`,
    {},
    requestContext,
  );
}

export async function createBookingHoliday(payload: {
  date: string;
  title: string;
  isRecurringYearly?: boolean;
  isWorkingDayOverride?: boolean;
}, requestContext?: BookingRequestContext) {
  return requestJson<{ holiday: BookingHoliday }>(`/api/evo/booking/holidays`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, requestContext);
}

export async function updateBookingHoliday(
  id: string,
  payload: {
    date?: string;
    title?: string;
    isRecurringYearly?: boolean;
    isWorkingDayOverride?: boolean;
  },
  requestContext?: BookingRequestContext,
) {
  return requestJson<{ holiday: BookingHoliday }>(`/api/evo/booking/holidays/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, requestContext);
}

export async function deleteBookingHoliday(id: string, requestContext?: BookingRequestContext) {
  return requestJson<{ holiday: BookingHoliday }>(`/api/evo/booking/holidays/${id}`, {
    method: 'DELETE',
  }, requestContext);
}

export async function createBookingTimeOff(payload: {
  employeeId?: string | null;
  type: string;
  startsAt: string;
  endsAt: string;
  title?: string;
  notes?: string;
}, requestContext?: BookingRequestContext) {
  return requestJson<{ item: BookingTimeOff }>(`/api/evo/booking/time-off`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, requestContext);
}

export async function updateBookingTimeOff(
  id: string,
  payload: {
    employeeId?: string | null;
    type?: string;
    startsAt?: string;
    endsAt?: string;
    title?: string | null;
    notes?: string | null;
  },
  requestContext?: BookingRequestContext,
) {
  return requestJson<{ item: BookingTimeOff }>(`/api/evo/booking/time-off/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, requestContext);
}

export async function deleteBookingTimeOff(id: string, requestContext?: BookingRequestContext) {
  return requestJson<{ item: BookingTimeOff }>(`/api/evo/booking/time-off/${id}`, {
    method: 'DELETE',
  }, requestContext);
}
