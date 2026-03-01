"use client";
import { useEffect, useMemo } from "react";
import { useChatwoot } from "@/hooks/use-chatwoot";
import type { ChatwootContact } from "@/hooks/use-chatwoot";
import { formatDistance } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import AppointmentsPageClient from "../(dashboard)/appointments/appointments-page-client";
import type { AppointmentPrefill } from "../(dashboard)/appointments/appointments-page-client";

type UnknownRecord = Record<string, unknown>;
const BOOKING_COMPANY_STORAGE_KEY = "crafty:booking-company-id";
const BOOKING_AGENT_STORAGE_KEY = "crafty:booking-agent-id";

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function pickString(record: UnknownRecord | null, keys: string[]): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function resolveContactPhone(contact?: ChatwootContact): string | undefined {
  const custom = asRecord(contact?.customAttributes);
  const additional = asRecord(contact?.additionalAttributes);

  return (
    contact?.phoneNumber ||
    pickString(custom, ["phone", "phone_number", "phoneNumber", "mobile", "whatsapp", "whatsapp_number"]) ||
    pickString(additional, ["phone", "phone_number", "phoneNumber", "mobile", "whatsapp", "whatsapp_number"])
  );
}

function resolveContactIin(contact?: ChatwootContact): string | undefined {
  const custom = asRecord(contact?.customAttributes);
  const additional = asRecord(contact?.additionalAttributes);

  return (
    pickString(custom, ["iin", "client_iin", "patient_iin", "national_id", "id_number"]) ||
    pickString(additional, ["iin", "client_iin", "patient_iin", "national_id", "id_number"])
  );
}

export default function ChatwootDashboardPage() {
  const [loaded, payload, error] = useChatwoot();
  const contact = payload?.contact;
  const conversationId = payload?.conversation?.id;
  const accountId = payload?.account?.id;
  const currentAgentId = payload?.currentAgent?.id;
  const hasCalendarKassaAccess =
    payload?.account?.features?.calendar_kassa_access !== false;
  const theme = payload?.theme;
  const hasAccountContext = String(accountId ?? "").trim().length > 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (hasAccountContext) {
        localStorage.setItem(BOOKING_COMPANY_STORAGE_KEY, String(accountId));
      } else {
        localStorage.removeItem(BOOKING_COMPANY_STORAGE_KEY);
      }
      if (currentAgentId !== undefined && currentAgentId !== null) {
        localStorage.setItem(BOOKING_AGENT_STORAGE_KEY, String(currentAgentId));
      } else {
        localStorage.removeItem(BOOKING_AGENT_STORAGE_KEY);
      }
    } catch {
      // ignore localStorage errors
    }
  }, [accountId, currentAgentId, hasAccountContext]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const html = document.documentElement;
    const resolvedTheme = String(theme?.resolved || theme?.selected || "").trim().toLowerCase();
    const isDark =
      typeof theme?.isDark === "boolean"
        ? theme.isDark
        : resolvedTheme === "dark";

    html.classList.toggle("dark", isDark);
    html.style.colorScheme = isDark ? "dark" : "light";

    if (theme?.selected) html.dataset.themeSelected = String(theme.selected);
    else delete html.dataset.themeSelected;

    if (theme?.resolved) html.dataset.themeResolved = String(theme.resolved);
    else delete html.dataset.themeResolved;
  }, [theme?.isDark, theme?.resolved, theme?.selected]);

  const appointmentPrefill = useMemo<AppointmentPrefill>(
    () => ({
      clientName: contact?.name || "",
      clientPhone: resolveContactPhone(contact) || "",
      clientIin: resolveContactIin(contact) || "",
      clientComment: "",
      source: "chatwoot",
      externalRef: conversationId ? `chatwoot:conversation:${conversationId}` : undefined,
    }),
    [contact, conversationId],
  );
  const bookingRequestContext = {
    companyId: hasAccountContext ? String(accountId) : undefined,
    agentId:
      currentAgentId !== undefined && currentAgentId !== null
        ? String(currentAgentId)
        : undefined,
  };

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Ошибка интеграции с Chatwoot: {error.message}
      </div>
    );
  }
  if (!loaded) {
    return <div className="p-4 text-muted-foreground w-full h-screen flex items-center justify-center">Загрузка данных виджета...</div>;
  }
  if (!hasAccountContext) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="space-y-2 p-6">
            <div className="text-base font-semibold">Календарь недоступен</div>
            <div className="text-muted-foreground text-sm">
              Chatwoot не передал `accountId`, поэтому виджет не может определить tenant календаря.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!hasCalendarKassaAccess) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="space-y-2 p-6">
            <div className="text-base font-semibold">Календарь недоступен</div>
            <div className="text-muted-foreground text-sm">
              Администратор аккаунта не выдал доступ к календарю и кассе для этого аккаунта.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <main className="w-full min-h-screen flex flex-col bg-muted/10">
      {contact && (
        <section className="p-4 border-b bg-background">
          <Card className="shadow-sm border-none">
            <CardContent className="p-4 flex items-center space-x-4">
              <Avatar className="w-14 h-14">
                <AvatarImage src={contact.thumbnail} alt={contact.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {contact.name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold">{contact.name}</h1>
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  {contact.email && <span>{contact.email}</span>}
                  {contact.lastActivityAt && (
                    <span className="text-xs">
                      (Был(а) {formatDistance(contact.lastActivityAt * 1000, new Date(), { addSuffix: true })})
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
      <section className="flex-1 overflow-auto">
        <AppointmentsPageClient
          prefill={appointmentPrefill}
          requestContext={bookingRequestContext}
        />
      </section>
    </main>
  );
}
