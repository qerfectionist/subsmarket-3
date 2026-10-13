import { useState, useEffect } from "react";
import { SystemSymbol } from "../SystemSymbol";
import type { MarketplaceListingRequest, AccountRequest } from "../../types";

export function formatTradeKzt(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
}

export function formatTradeGb(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("ru-KZ", { maximumFractionDigits: 0 });
}

export function parseTimestamp(val: string) {
  if (!val) return 0;
  const normalized = /Z|[+-]\d{2}:?\d{2}$/i.test(val)
    ? val
    : val.includes("T")
      ? `${val}Z`
      : `${val.replace(" ", "T")}Z`;
  const ms = new Date(normalized).getTime();
  return Number.isNaN(ms) ? new Date(val).getTime() : ms;
}

export const REQUEST_EXPIRED_EVENT = "sm:request-expired";

export function isRequestExpired(
  status?: string | null,
  createdAt?: string | null,
  expiresAt?: string | null
): boolean {
  if (status === "expired") return true;
  if (status && status !== "pending") return false;
  // Requests without an explicit expiresAt (e.g. GB / accounts) do not have a client TTL.
  // Only requests with expiresAt (e.g. Family requests with 5h deadline) or status === "expired" expire.
  if (!expiresAt) return false;
  const now = Date.now();
  const deadline = parseTimestamp(expiresAt);
  return deadline <= now;
}

export function formatTimeRemainingHuman(diffMs: number): string {
  if (diffMs <= 0) return "Срок истёк";
  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hours > 0) {
    if (hours === 1) return "1 час остался";
    if (hours >= 2 && hours <= 4) return `${hours} часа осталось`;
    return `${hours} часов осталось`;
  }
  if (mins > 0) {
    return `${mins} мин осталось`;
  }
  return `${secs} сек осталось`;
}

export function resolveRequestExpiresAt(
  createdAt?: string | null,
  expiresAt?: string | null,
  requestId?: string | null
): string | null {
  if (expiresAt) return expiresAt;
  if (!requestId && !createdAt) return null;
  if (typeof window === "undefined") return null;

  const storageKey = requestId ? `sm_req_expiry_${requestId}` : null;
  if (storageKey) {
    try {
      const cached = window.sessionStorage.getItem(storageKey);
      if (cached) return cached;
    } catch {
      // ignore
    }
  }

  const createdMs = createdAt ? parseTimestamp(createdAt) : Date.now();
  const elapsedMs = Date.now() - createdMs;
  // Response window: 15 minutes for pending trade requests
  const deadlineMs =
    elapsedMs > 0 && elapsedMs < 15 * 60 * 1000
      ? createdMs + 15 * 60 * 1000
      : Date.now() + 15 * 60 * 1000;
  const iso = new Date(deadlineMs).toISOString();

  if (storageKey) {
    try {
      window.sessionStorage.setItem(storageKey, iso);
    } catch {
      // ignore
    }
  }
  return iso;
}

export function useRequestTimeRemaining(
  createdAt?: string | null,
  expiresAt?: string | null,
  requestId?: string | null
) {
  const effectiveExpiresAt = resolveRequestExpiresAt(createdAt, expiresAt, requestId);

  const calculate = () => {
    if (!effectiveExpiresAt) {
      return { text: "", humanText: "", progress: 1, isExpired: false };
    }
    const now = Date.now();
    const start = createdAt ? parseTimestamp(createdAt) : 0;
    const deadline = parseTimestamp(effectiveExpiresAt);
    const totalDuration = start && deadline > start ? deadline - start : 15 * 60 * 1000;
    const diffMs = deadline - now;

    if (diffMs <= 0) {
      return { text: "Срок истёк", humanText: "Срок истёк", progress: 0, isExpired: true };
    }

    const progress = Math.max(0, Math.min(1, diffMs / totalDuration));
    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");
    const text = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    const humanText = formatTimeRemainingHuman(diffMs);

    return { text, humanText, progress, isExpired: false };
  };

  const [data, setData] = useState(calculate);

  useEffect(() => {
    if (!effectiveExpiresAt) return;

    const initial = calculate();
    setData(initial);
    if (initial.isExpired && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(REQUEST_EXPIRED_EVENT));
    }

    let lastExpired = initial.isExpired;
    const interval = setInterval(() => {
      const next = calculate();
      if (!lastExpired && next.isExpired) {
        lastExpired = true;
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(REQUEST_EXPIRED_EVENT));
        }
      }
      setData(next);
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt, effectiveExpiresAt]);

  return data;
}

export function PendingRequestTimerBadge({
  timeRemaining,
  role = "seller"
}: {
  timeRemaining: { humanText?: string; text: string; isExpired?: boolean };
  role?: "seller" | "buyer";
}) {
  if (timeRemaining.isExpired) {
    return (
      <span className="my-trade-request-status is-expired">
        <SystemSymbol name="clock" size={12} className="my-trade-request-clock-icon" />
        <span>{role === "seller" ? "Вы не ответили" : "Продавец не ответил"}</span>
      </span>
    );
  }

  const label = timeRemaining.humanText || timeRemaining.text;
  return (
    <span className="my-trade-request-status is-pending" title={`Осталось: ${label}`}>
      <SystemSymbol name="clock" size={12} className="my-trade-request-clock-icon" />
      <span>{label}</span>
    </span>
  );
}

export function CircularCountdownTimer({
  text,
  progress,
  label = "Ждёт ответа"
}: {
  text: string;
  progress: number;
  label?: string;
}) {
  const circumference = 44;
  const offset = circumference * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <span
      className="timer-circular-wrap"
      title={`${label} · осталось ${text}`}
      aria-label={`${label}, осталось ${text}`}
      data-testid="circular-countdown-timer"
    >
      <svg className="timer-ring-svg" viewBox="0 0 18 18" aria-hidden="true">
        <circle
          className="timer-ring-bg"
          cx="9"
          cy="9"
          r="7"
          fill="none"
          strokeWidth="2.2"
        />
        <circle
          className="timer-ring-val"
          cx="9"
          cy="9"
          r="7"
          fill="none"
          strokeWidth="2.2"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span>{text}</span>
    </span>
  );
}

export function gbRequestStatus(status: MarketplaceListingRequest["status"], role?: "seller" | "buyer") {
  if (status === "rejected") {
    return role === "buyer" ? "Продавец отклонил" : "Вы отклонили";
  }
  return (
    {
      pending: "Ждёт ответа",
      accepted: "Можно написать",
      rejected: "Вы отклонили",
      cancelled: "Отменена",
      closed: "Закрыта",
      expired: "Срок истёк"
    } as const
  )[status];
}

export function accountRequestStatus(status: AccountRequest["status"], role?: "seller" | "buyer") {
  if (status === "rejected") {
    return role === "buyer" ? "Продавец отклонил" : "Вы отклонили";
  }
  return (
    {
      pending: "Ждёт ответа",
      accepted: "Принята",
      rejected: "Вы отклонили",
      cancelled: "Отменена",
      closed: "Закрыта",
      expired: "Срок истёк"
    } as const
  )[status];
}

export function useRequestContacted(requestId: string) {
  const key = `sm_contacted_${requestId}`;
  const [hasContacted, setHasContacted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  });

  const markContacted = () => {
    setHasContacted(true);
    try {
      localStorage.setItem(key, "true");
    } catch {
      // ignore
    }
  };

  return { hasContacted, markContacted };
}
