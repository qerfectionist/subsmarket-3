import { errorLabels, statusLabels } from "./labels";
import type { FamilyService } from "./types";

export function serviceTitle(service: FamilyService) {
  return `${service.name}${service.variant ? ` ${service.variant}` : ""}`;
}

export function statusText(status: string) {
  return statusLabels[status] ?? status;
}

export function normalizeText(value: string | null) {
  const next = value?.trim();
  return next ? next : null;
}

export function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Неизвестная ошибка";
  }

  const code = extractApiErrorCode(error.message);
  return code ? errorLabels[code] ?? error.message : error.message;
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
