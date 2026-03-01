"use client";

import { useEffect } from "react";

import { useChatwoot } from "@/hooks/use-chatwoot";
import KassaPageClient from "@/app/(dashboard)/kassa/kassa-page-client";
import { Card, CardContent } from "@/components/ui/card";

const BOOKING_COMPANY_STORAGE_KEY = "crafty:booking-company-id";
const BOOKING_AGENT_STORAGE_KEY = "crafty:booking-agent-id";

export default function WidgetsKassaPage() {
  const [loaded, payload, error] = useChatwoot();
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
  }, [theme?.isDark, theme?.resolved, theme?.selected]);

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Ошибка интеграции с Chatwoot: {error.message}
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4 text-muted-foreground">
        Загрузка данных виджета...
      </div>
    );
  }

  if (!hasAccountContext) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="space-y-2 p-6">
            <div className="text-base font-semibold">Касса недоступна</div>
            <div className="text-sm text-muted-foreground">
              Chatwoot не передал `accountId`, поэтому не удалось определить tenant.
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
            <div className="text-base font-semibold">Касса недоступна</div>
            <div className="text-sm text-muted-foreground">
              Администратор аккаунта не выдал доступ к календарю и кассе для этого аккаунта.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <KassaPageClient
      requestContext={{
        companyId: String(accountId),
        agentId: currentAgentId !== undefined && currentAgentId !== null ? String(currentAgentId) : undefined,
      }}
    />
  );
}
