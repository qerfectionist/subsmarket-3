import { errorLabels, statusLabels } from "./labels";
import type { Family, FamilyRequest, FamilyService, MyFamily } from "./types";

export function serviceTitle(service: FamilyService) {
  return `${service.name}${service.variant ? ` ${service.variant}` : ""}`;
}

export function familyTitle(
  family: Pick<
    Family | FamilyRequest,
    "family_type" | "service_name" | "service_variant" | "plan_name"
  >
) {
  if (family.family_type === "tariff" && family.plan_name) {
    return `${family.service_name} ${family.plan_name}`;
  }
  return `${family.service_name}${family.service_variant ? ` ${family.service_variant}` : ""}`;
}

export function statusText(status: string) {
  return statusLabels[status] ?? status;
}

export function getDaysUntil(dateStr: string): number {
  const parts = dateStr.slice(0, 10).split("-").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return 999;
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDaysUntilPayment(days: number): string {
  if (days <= 0) return "Оплата сегодня";
  if (days === 1) return "1 день до оплаты";
  if (days >= 2 && days <= 4) return `${days} дня до оплаты`;
  return `${days} дней до оплаты`;
}

export function memberCardStatus(item: MyFamily): string {
  if (item.membership.status !== "active") {
    return statusText(item.membership.status);
  }

  const openPayment = item.payments?.find((p) =>
    ["due", "payment_due", "overdue", "payment_reported"].includes(p.status)
  );
  if (openPayment) {
    if (openPayment.status === "payment_reported") {
      return "На проверке";
    }
    if (openPayment.status === "overdue") {
      return "Просрочено";
    }
    return "Ждет оплату";
  }

  const paidPayments = (item.payments || []).filter(
    (p) => p.status === "paid" && p.period_end
  );
  const latestPaidEnd = paidPayments
    .map((p) => p.period_end)
    .sort()
    .reverse()[0];

  const targetDate =
    latestPaidEnd && latestPaidEnd > item.family.next_payment_date
      ? latestPaidEnd
      : item.family.next_payment_date;

  if (!targetDate) {
    return "Оплачен";
  }

  const days = getDaysUntil(targetDate);
  if (days <= 3) {
    return formatDaysUntilPayment(days);
  }

  return "Оплачен";
}

export function normalizeText(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

export function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Неизвестная ошибка";
  }

  const validationMessage = extractApiValidationMessage(error.message);
  if (validationMessage) {
    return validationMessage;
  }

  const code = extractApiErrorCode(error.message);
  if (code) {
    return errorLabels[code] ?? "Не удалось выполнить действие. Попробуйте ещё раз.";
  }

  const apiDetail = error.message.match(/^API \d+:\s*(.+)$/s)?.[1]?.trim();
  if (apiDetail && !apiDetail.startsWith("[") && !apiDetail.startsWith("{")) {
    return apiDetail;
  }
  return error.message.startsWith("API ")
    ? "Не удалось выполнить действие. Попробуйте ещё раз."
    : error.message;
}

function extractApiValidationMessage(message: string) {
  const apiMatch = message.match(/^API (\d+):\s*(.+)$/s);
  if (!apiMatch) {
    return null;
  }

  const status = Number(apiMatch[1]);
  const rawDetail = apiMatch[2];
  if (status !== 422) {
    return null;
  }

  try {
    const detail = JSON.parse(rawDetail) as unknown;
    if (!Array.isArray(detail)) {
      return null;
    }

    const fieldMessages = detail
      .map((item) => validationErrorMessage(item))
      .filter((item): item is string => Boolean(item));
    if (fieldMessages.length > 0) {
      return fieldMessages.join(" ");
    }
  } catch {
    return null;
  }

  return "Проверьте заполненные поля и попробуйте ещё раз.";
}

function validationErrorMessage(item: unknown) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const payload = item as {
    loc?: unknown[];
    msg?: unknown;
    type?: unknown;
  };
  const field = payload.loc?.[payload.loc.length - 1];

  if (field === "payment_phone") {
    return "Укажите номер телефона для оплаты. Номера карт и IBAN запрещены.";
  }
  if (field === "total_price_kzt") {
    return "Укажите общую цену подписки больше нуля.";
  }
  if (field === "max_members") {
    return "Проверьте количество участников.";
  }
  if (field === "payment_day") {
    return "День оплаты должен быть от 1 до 31.";
  }
  if (field === "next_payment_date") {
    return "Проверьте дату следующей оплаты.";
  }

  if (typeof payload.msg === "string") {
    return payload.msg;
  }
  return null;
}

function extractApiErrorCode(message: string) {
  const apiMatch = message.match(/^API \d+:\s*([A-Z0-9_]+)$/);
  if (apiMatch) {
    return apiMatch[1];
  }

  return /^[A-Z0-9_]+$/.test(message) ? message : null;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-KZ").format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-KZ", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function futureDateISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
