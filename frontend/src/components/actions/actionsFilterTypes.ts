import type { SystemSymbolName } from "../SystemSymbol";
import { formatAccountTitle } from "../../format";

export type ActionsCategoryFilter = "all" | "families" | "accounts" | "gigabytes";

export const actionsCategoryFilterOptions: readonly {
  value: ActionsCategoryFilter;
  label: string;
  icon: SystemSymbolName;
}[] = [
  { value: "all", label: "Все", icon: "sort" },
  { value: "families", label: "Подписки", icon: "person.2" },
  { value: "accounts", label: "Аккаунты", icon: "person.crop.circle" },
  { value: "gigabytes", label: "Гигабайты", icon: "globe" }
];

export type ActionsStatusFilter = "all" | "pending" | "settled";

export const actionsStatusFilterOptions: readonly {
  value: ActionsStatusFilter;
  label: string;
  icon: SystemSymbolName;
}[] = [
  { value: "all", label: "Все статусы", icon: "clock" },
  { value: "pending", label: "Ожидают", icon: "clock" },
  { value: "settled", label: "Завершенные", icon: "checkmark" }
];

export type ActionsArchiveFilter = "all" | "successful" | "cancelled";

export const actionsArchiveFilterOptions: readonly {
  value: ActionsArchiveFilter;
  label: string;
  icon: SystemSymbolName;
}[] = [
  { value: "all", label: "Все", icon: "archive" },
  { value: "successful", label: "Успешные", icon: "checkmark" },
  { value: "cancelled", label: "Отклонённые", icon: "xmark" }
];

export function isTradeRequestStatusMatch(status: string, filter: ActionsStatusFilter) {
  const isActive = ["pending", "accepted"].includes(status);
  if (filter === "all") return isActive;
  return filter === "pending" ? isActive : !isActive;
}

export function isFamilyRequestStatusMatch(status: string, filter: ActionsStatusFilter) {
  const isActive = ["pending", "approved"].includes(status);
  if (filter === "all") return isActive;
  return filter === "pending" ? isActive : !isActive;
}

export function isFamilyActionStatusMatch(filter: ActionsStatusFilter) {
  if (filter === "all") return true;
  return filter === "pending";
}

export function getOrderNumber(id: string): string {
  const digits = id.replace(/\D/g, "");
  if (digits.length >= 3) {
    return `#SM-${digits.slice(-4)}`;
  }
  const clean = id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
  return `#SM-${clean || "8401"}`;
}

export function formatArchiveAccountTitle(serviceName: string, title?: string | null): string {
  return formatAccountTitle(serviceName, title);
}

export function getArchiveDateHeader(dateStr?: string): string {
  if (!dateStr) return "Ранее";
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (dateStr.startsWith(todayStr)) return "Сегодня";
  if (dateStr.startsWith(yesterdayStr)) return "Вчера";

  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    }
  } catch {
    // fallback
  }
  return "Ранее";
}

export function formatArchiveCardDate(rawDate?: string, fallback?: string): string {
  if (!rawDate) return fallback || "";
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return fallback || "";
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayISO = yesterday.toISOString().slice(0, 10);

    const hasTime = rawDate.includes("T") || rawDate.includes(":");
    const timeStr = hasTime
      ? new Intl.DateTimeFormat("ru-KZ", { hour: "2-digit", minute: "2-digit" }).format(d)
      : "";
    const timeSuffix = timeStr ? `, ${timeStr}` : "";

    if (rawDate.startsWith(todayISO)) {
      return `Сегодня${timeSuffix}`;
    }
    if (rawDate.startsWith(yesterdayISO)) {
      return `Вчера${timeSuffix}`;
    }

    const isCurrentYear = d.getFullYear() === now.getFullYear();
    const dateFormatted = new Intl.DateTimeFormat("ru-KZ", {
      day: "numeric",
      month: "short",
      ...(isCurrentYear ? {} : { year: "numeric" })
    }).format(d).replace(/\s*г\./, "");

    return `${dateFormatted}${timeSuffix}`;
  } catch {
    return fallback || "";
  }
}

export {
  ActionsCategoryChip,
  ActionsStatusChip,
  ActionsArchiveFilterChip
} from "./ActionsFilterChips";
