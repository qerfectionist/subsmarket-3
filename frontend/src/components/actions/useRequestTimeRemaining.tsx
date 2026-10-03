import { useState, useEffect } from "react";
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

export function useRequestTimeRemaining(createdAt?: string | null, expiresAt?: string | null) {
  const calculate = () => {
    if (!createdAt && !expiresAt) return { text: "", progress: 1, isExpired: false };
    const now = Date.now();
    const start = parseTimestamp(createdAt!);
    const totalDuration = 5 * 60 * 60 * 1000;
    const maxDeadline = start ? start + totalDuration : (expiresAt ? parseTimestamp(expiresAt) : now + totalDuration);
    const deadline = expiresAt
      ? Math.min(parseTimestamp(expiresAt), maxDeadline)
      : maxDeadline;
    const diffMs = deadline - now;

    if (diffMs <= 0) {
      return { text: "Срок истёк", progress: 0, isExpired: true };
    }

    const progress = Math.max(0, Math.min(1, diffMs / totalDuration));
    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");
    const text = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;

    return { text, progress, isExpired: false };
  };

  const [data, setData] = useState(calculate);

  useEffect(() => {
    if (!createdAt && !expiresAt) return;

    setData(calculate());
    const interval = setInterval(() => {
      setData(calculate());
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt, expiresAt]);

  return data;
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

export function gbRequestStatus(status: MarketplaceListingRequest["status"]) {
  return (
    {
      pending: "Ждёт ответа",
      accepted: "Можно написать",
      rejected: "Отклонена",
      cancelled: "Отменена",
      closed: "Закрыта",
      expired: "Срок истёк"
    } as const
  )[status];
}

export function accountRequestStatus(status: AccountRequest["status"]) {
  return (
    {
      pending: "Ждёт ответа",
      accepted: "Принята",
      rejected: "Отклонена",
      cancelled: "Отменена",
      closed: "Закрыта",
      expired: "Истекла"
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
