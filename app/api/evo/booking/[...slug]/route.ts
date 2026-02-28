import { NextRequest, NextResponse } from "next/server";

import {
  BookingServiceError,
  cancelBookingAppointment,
  createBookingAppointment,
  createBookingEmployee,
  createBookingHoliday,
  createBookingTimeOff,
  fetchBookingCalendarView,
  listBookingEmployees,
  listBookingHolidays,
  replaceBookingEmployeeBreakRules,
  replaceBookingEmployeeWorkRules,
  updateBookingEmployee,
  updateBookingAppointment,
} from "@/lib/server/booking-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_COMPANY_ID = "default";
const COMPANY_HEADER_KEYS = [
  "x-booking-company-id",
  "x-chatwoot-account-id",
  "x-account-id",
  "x-tenant-id",
];
const AGENT_HEADER_KEYS = ["x-booking-agent-id", "x-chatwoot-agent-id", "x-user-id"];

type RouteParams = { slug?: string[] };
type RouteContext = { params: Promise<RouteParams> };
type CreateEmployeePayload = Parameters<typeof createBookingEmployee>[1];
type UpdateEmployeePayload = Parameters<typeof updateBookingEmployee>[2];
type CreateAppointmentPayload = Parameters<typeof createBookingAppointment>[1];
type UpdateAppointmentPayload = Parameters<typeof updateBookingAppointment>[2];
type WorkRulesPayload = Parameters<typeof replaceBookingEmployeeWorkRules>[2];
type BreakRulesPayload = Parameters<typeof replaceBookingEmployeeBreakRules>[2];
type CreateHolidayPayload = Parameters<typeof createBookingHoliday>[1];
type CreateTimeOffPayload = Parameters<typeof createBookingTimeOff>[1];

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return null;
}

function resolveCompanyId(request: NextRequest): string {
  const headerValue = firstNonEmpty(COMPANY_HEADER_KEYS.map((key) => request.headers.get(key)));
  const queryValue = firstNonEmpty([
    request.nextUrl.searchParams.get("companyId"),
    request.nextUrl.searchParams.get("accountId"),
    request.nextUrl.searchParams.get("tenantId"),
  ]);
  return headerValue || queryValue || DEFAULT_COMPANY_ID;
}

function resolveAgentId(request: NextRequest): string | null {
  return (
    firstNonEmpty(AGENT_HEADER_KEYS.map((key) => request.headers.get(key))) ||
    firstNonEmpty([request.nextUrl.searchParams.get("agentId"), request.nextUrl.searchParams.get("userId")])
  );
}

function parseBoolean(raw: string | null): boolean | undefined {
  if (raw === null) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function parseNumber(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

async function resolveSlug(context: RouteContext): Promise<string[]> {
  const params = await context.params;
  return params.slug || [];
}

function errorResponse(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return NextResponse.json(
    {
      error: message,
      code,
      details,
      response: {
        message: [message],
      },
    },
    { status },
  );
}

function mapError(error: unknown) {
  if (error instanceof BookingServiceError) {
    return errorResponse(error.status, error.code, error.message, error.details);
  }

  const pgLike = error as {
    code?: string;
    constraint?: string;
    detail?: string;
    message?: string;
  };

  if (pgLike?.code === "23505") {
    if (pgLike.constraint?.includes("uq_calendar_appointments_external_ref")) {
      return errorResponse(409, "DUPLICATE_EXTERNAL_REF", "externalRef must be unique within company");
    }
    if (pgLike.constraint?.includes("uq_calendar_appointments_idempotency")) {
      return errorResponse(409, "DUPLICATE_IDEMPOTENCY_KEY", "idempotencyKey must be unique within company");
    }
    return errorResponse(409, "CONFLICT", pgLike.message || "Resource conflict");
  }

  if (pgLike?.code === "23503") {
    if (pgLike.detail?.includes("employee_id")) {
      return errorResponse(404, "EMPLOYEE_NOT_FOUND", "Employee not found");
    }
    return errorResponse(409, "FOREIGN_KEY_CONFLICT", pgLike.message || "Foreign key conflict");
  }

  if (pgLike?.code === "22P02" || pgLike?.code === "23514") {
    return errorResponse(400, "VALIDATION_ERROR", pgLike.message || "Invalid request payload");
  }

  return errorResponse(500, "INTERNAL_ERROR", "Internal booking API error");
}

function notFound() {
  return errorResponse(404, "NOT_FOUND", "Booking endpoint not found");
}

async function dispatchGet(request: NextRequest, slug: string[], companyId: string) {
  if (slug.length === 1 && slug[0] === "employees") {
    const includeInactive = parseBoolean(request.nextUrl.searchParams.get("includeInactive")) || false;
    const result = await listBookingEmployees(companyId, { includeInactive });
    return NextResponse.json(result);
  }

  if (slug.length === 2 && slug[0] === "calendar" && slug[1] === "view") {
    const result = await fetchBookingCalendarView(companyId, {
      view: String(request.nextUrl.searchParams.get("view") || "") as "day" | "week" | "month",
      from: String(request.nextUrl.searchParams.get("from") || ""),
      to: String(request.nextUrl.searchParams.get("to") || ""),
      employeeIds: parseCsv(request.nextUrl.searchParams.get("employeeIds")),
      includeSlots: parseBoolean(request.nextUrl.searchParams.get("includeSlots")),
      durationMin: parseNumber(request.nextUrl.searchParams.get("durationMin")),
    });
    return NextResponse.json(result);
  }

  if (slug.length === 1 && slug[0] === "holidays") {
    const result = await listBookingHolidays(companyId, {
      year: parseNumber(request.nextUrl.searchParams.get("year")),
      from: request.nextUrl.searchParams.get("from") || undefined,
      to: request.nextUrl.searchParams.get("to") || undefined,
    });
    return NextResponse.json(result);
  }

  return notFound();
}

async function dispatchPost(request: NextRequest, slug: string[], companyId: string, agentId: string | null) {
  const body = await readJsonBody(request);

  if (slug.length === 1 && slug[0] === "employees") {
    const result = await createBookingEmployee(companyId, body as CreateEmployeePayload);
    return NextResponse.json(result, { status: 201 });
  }

  if (slug.length === 1 && slug[0] === "appointments") {
    const appointmentPayload = body as CreateAppointmentPayload;
    const payload = {
      ...appointmentPayload,
      createdByUserId:
        (appointmentPayload.createdByUserId
          ? String(appointmentPayload.createdByUserId)
          : undefined) ||
        agentId ||
        undefined,
    };
    const result = await createBookingAppointment(companyId, payload);
    return NextResponse.json(result, { status: 201 });
  }

  if (slug.length === 3 && slug[0] === "appointments" && slug[2] === "cancel") {
    const result = await cancelBookingAppointment(companyId, slug[1]);
    return NextResponse.json(result);
  }

  if (slug.length === 1 && slug[0] === "holidays") {
    const result = await createBookingHoliday(companyId, body as CreateHolidayPayload);
    return NextResponse.json(result, { status: 201 });
  }

  if (slug.length === 1 && slug[0] === "time-off") {
    const result = await createBookingTimeOff(companyId, body as CreateTimeOffPayload);
    return NextResponse.json(result, { status: 201 });
  }

  return notFound();
}

async function dispatchPut(request: NextRequest, slug: string[], companyId: string) {
  const body = await readJsonBody(request);

  if (slug.length === 3 && slug[0] === "employees" && slug[2] === "work-rules") {
    const rules = Array.isArray(body.workRules) ? body.workRules : [];
    const result = await replaceBookingEmployeeWorkRules(companyId, slug[1], rules as WorkRulesPayload);
    return NextResponse.json(result);
  }

  if (slug.length === 3 && slug[0] === "employees" && slug[2] === "break-rules") {
    const rules = Array.isArray(body.breakRules) ? body.breakRules : [];
    const result = await replaceBookingEmployeeBreakRules(companyId, slug[1], rules as BreakRulesPayload);
    return NextResponse.json(result);
  }

  return notFound();
}

async function dispatchPatch(request: NextRequest, slug: string[], companyId: string, agentId: string | null) {
  if (slug.length === 2 && slug[0] === "employees") {
    const body = await readJsonBody(request);
    const result = await updateBookingEmployee(companyId, slug[1], body as UpdateEmployeePayload);
    return NextResponse.json(result);
  }

  if (!(slug.length === 2 && slug[0] === "appointments")) {
    return notFound();
  }
  const body = await readJsonBody(request);
  const payload =
    body.createdByUserId === undefined && agentId
      ? {
          ...body,
          createdByUserId: agentId,
        }
      : body;
  const result = await updateBookingAppointment(companyId, slug[1], payload as UpdateAppointmentPayload);
  return NextResponse.json(result);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  const companyId = resolveCompanyId(request);
  try {
    return await dispatchGet(request, slug, companyId);
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  const companyId = resolveCompanyId(request);
  const agentId = resolveAgentId(request);
  try {
    return await dispatchPost(request, slug, companyId, agentId);
  } catch (error) {
    return mapError(error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  const companyId = resolveCompanyId(request);
  try {
    return await dispatchPut(request, slug, companyId);
  } catch (error) {
    return mapError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  const companyId = resolveCompanyId(request);
  const agentId = resolveAgentId(request);
  try {
    return await dispatchPatch(request, slug, companyId, agentId);
  } catch (error) {
    return mapError(error);
  }
}
