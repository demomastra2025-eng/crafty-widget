"use client";

import { useEffect, useState } from "react";

const DASHBOARD_APP_HANDSHAKE_EVENT = "chatwoot-dashboard-app:fetch-info";
const EXTERNAL_APP_HANDSHAKE_EVENT = "chatwoot-external-app:fetch-info";
const DEV_MOCK_PATH = "/mocks/chatwoot.json";
const CONTEXT_FALLBACK_TIMEOUT_MS = 2500;

type UnknownRecord = Record<string, unknown>;
export type ChatwootFeatureFlags = Record<string, boolean>;

export type ChatwootContact = {
  id?: number | string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  identifier?: string;
  thumbnail?: string;
  lastActivityAt?: number;
  customAttributes?: UnknownRecord;
  additionalAttributes?: UnknownRecord;
};

export type ChatwootConversation = {
  id?: number | string;
  inboxId?: number | string;
  customAttributes?: UnknownRecord;
  additionalAttributes?: UnknownRecord;
  meta?: UnknownRecord;
};

export type ChatwootCurrentAgent = {
  id?: number | string;
  name?: string;
  email?: string;
};

export type ChatwootAccount = {
  id?: number | string;
  name?: string;
  features?: ChatwootFeatureFlags;
};

export type ChatwootTheme = {
  selected?: string;
  resolved?: string;
  isDark?: boolean;
};

export type ChatwootPayload = {
  event?: string;
  account?: ChatwootAccount;
  contact?: ChatwootContact;
  conversation?: ChatwootConversation;
  currentAgent?: ChatwootCurrentAgent;
  theme?: ChatwootTheme;
};

function mergeChatwootPayload(previous: ChatwootPayload | null, next: ChatwootPayload): ChatwootPayload {
  if (!previous) return next;

  return {
    event: next.event ?? previous.event,
    account: next.account ?? previous.account,
    contact: next.contact ?? previous.contact,
    conversation: next.conversation ?? previous.conversation,
    currentAgent: next.currentAgent ?? previous.currentAgent,
    theme: next.theme ?? previous.theme,
  };
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function readString(record: UnknownRecord | null, keys: string[]): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function readNumber(record: UnknownRecord | null, keys: string[]): number | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function readBoolean(record: UnknownRecord | null, keys: string[]): boolean | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }
  return undefined;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function readRecord(record: UnknownRecord | null, keys: string[]): UnknownRecord | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const nested = asRecord(record[key]);
    if (nested) return nested;
  }
  return undefined;
}

function normalizeContact(input: unknown): ChatwootContact | undefined {
  const record = asRecord(input);
  if (!record) return undefined;

  const id = (record.id as number | string | undefined) ?? undefined;
  const lastActivityAt = readNumber(record, ["lastActivityAt", "last_activity_at"]);

  return {
    id,
    name: readString(record, ["name"]),
    email: readString(record, ["email"]),
    phoneNumber: readString(record, ["phoneNumber", "phone_number"]),
    identifier: readString(record, ["identifier"]),
    thumbnail: readString(record, ["thumbnail"]),
    lastActivityAt,
    customAttributes: readRecord(record, ["customAttributes", "custom_attributes"]),
    additionalAttributes: readRecord(record, ["additionalAttributes", "additional_attributes"]),
  };
}

function normalizeConversation(input: unknown): ChatwootConversation | undefined {
  const record = asRecord(input);
  if (!record) return undefined;

  return {
    id: (record.id as number | string | undefined) ?? undefined,
    inboxId: (record.inboxId as number | string | undefined) ?? (record.inbox_id as number | string | undefined),
    customAttributes: readRecord(record, ["customAttributes", "custom_attributes"]),
    additionalAttributes: readRecord(record, ["additionalAttributes", "additional_attributes"]),
    meta: readRecord(record, ["meta"]),
  };
}

function normalizeCurrentAgent(input: unknown): ChatwootCurrentAgent | undefined {
  const record = asRecord(input);
  if (!record) return undefined;

  return {
    id: (record.id as number | string | undefined) ?? undefined,
    name: readString(record, ["name"]),
    email: readString(record, ["email"]),
  };
}

function normalizeFeatureFlags(input: unknown): ChatwootFeatureFlags | undefined {
  const record = asRecord(input);
  if (!record) return undefined;

  const features = Object.entries(record).reduce<ChatwootFeatureFlags>((result, [key, value]) => {
    const normalized = normalizeBoolean(value);
    if (normalized !== undefined) result[key] = normalized;
    return result;
  }, {});

  return Object.keys(features).length > 0 ? features : undefined;
}

function normalizeAccount(input: unknown): ChatwootAccount | undefined {
  const record = asRecord(input);
  if (!record) return undefined;

  return {
    id: (record.id as number | string | undefined) ?? undefined,
    name: readString(record, ["name"]),
    features: normalizeFeatureFlags(record.features),
  };
}

function normalizeTheme(input: unknown): ChatwootTheme | undefined {
  const record = asRecord(input);
  if (!record) return undefined;

  const selected = readString(record, ["selected"]);
  const resolved = readString(record, ["resolved"]);
  const isDark = readBoolean(record, ["isDark", "is_dark"]);

  if (!selected && !resolved && isDark === undefined) return undefined;

  return {
    selected,
    resolved,
    isDark,
  };
}

function parseChatwootPayload(raw: unknown): ChatwootPayload | null {
  let parsed: unknown = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  const root = asRecord(parsed);
  if (!root) return null;

  const data = readRecord(root, ["data"]) || root;
  const account = normalizeAccount(data.account);
  const conversation = normalizeConversation(data.conversation);
  const metaSender = normalizeContact(readRecord(conversation?.meta || null, ["sender"]));
  const contact = normalizeContact(data.contact) || metaSender;
  const currentAgent = normalizeCurrentAgent(data.currentAgent);
  const theme = normalizeTheme(data.theme) || normalizeTheme(root.theme);

  if (!account && !contact && !conversation && !currentAgent && !theme) return null;

  return {
    event: readString(root, ["event"]),
    account,
    contact,
    conversation,
    currentAgent,
    theme,
  };
}

export function useChatwoot(): [boolean, ChatwootPayload | null, Error | null] {
  const [loaded, setLoaded] = useState(false);
  const [payload, setPayload] = useState<ChatwootPayload | null>(null);

  useEffect(() => {
    let isActive = true;
    let hasContext = false;

    const applyPayload = (next: ChatwootPayload) => {
      if (!isActive) return;
      hasContext = true;
      setPayload((previous) => mergeChatwootPayload(previous, next));
      setLoaded(true);
    };

    const onMessage = (event: MessageEvent) => {
      if (window.parent && window.parent !== window && event.source !== window.parent) {
        return;
      }

      const payload = event.data;
      if (
        payload == null ||
        (typeof payload !== "string" &&
          typeof payload !== "object" &&
          !Array.isArray(payload))
      ) {
        return;
      }

      if (typeof payload === "string") {
        const trimmed = payload.trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
          return;
        }
      }

      const next = parseChatwootPayload(event.data);
      if (!next) return;
      applyPayload(next);
    };

    const requestContext = () => {
      try {
        window.parent?.postMessage(DASHBOARD_APP_HANDSHAKE_EVENT, "*");
        window.parent?.postMessage(EXTERNAL_APP_HANDSHAKE_EVENT, "*");
      } catch {
        // ignore cross-origin postMessage errors
      }
    };

    window.addEventListener("message", onMessage);

    const isEmbedded = window.parent !== window;
    if (isEmbedded) {
      requestContext();
    }

    const fallbackTimer = window.setTimeout(() => {
      if (!isActive || hasContext) return;
      setLoaded(true);
    }, CONTEXT_FALLBACK_TIMEOUT_MS);

    if (!isEmbedded && process.env.NODE_ENV === "development") {
      void fetch(DEV_MOCK_PATH, { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) return null;
          return parseChatwootPayload(await res.json());
        })
        .then((next) => {
          if (next) applyPayload(next);
        })
        .catch(() => undefined)
        .finally(() => {
          if (isActive && !hasContext) setLoaded(true);
        });
    }

    return () => {
      isActive = false;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  return [loaded, payload, null];
}
