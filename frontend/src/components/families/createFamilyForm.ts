import { bankLabels } from "../../labels";
import type { FamilyCreate, FamilyService } from "../../types";

const PHONE_RE = /^\+?7\d{10}$/;
// Mirrors the backend limit in FamilyCreate.total_price_kzt.
export const MAX_FAMILY_PRICE_KZT = 1_000_000;

export type CreateSection = "service" | "price" | "schedule" | "payment" | "details";

export const CREATE_SECTIONS: { id: CreateSection; title: string; required: boolean }[] = [
  { id: "service", title: "Сервис", required: true },
  { id: "price", title: "Цена и места", required: true },
  { id: "schedule", title: "День оплаты", required: true },
  { id: "payment", title: "Реквизиты", required: true },
  { id: "details", title: "Описание и правила", required: false }
];

export interface FieldErrors {
  plan_name?: string;
  payment_phone?: string;
  total_price_kzt?: string;
  payment_day?: string;
  next_payment_date?: string;
  max_members?: string;
}

const SECTION_FIELDS: Record<CreateSection, (keyof FieldErrors)[]> = {
  service: ["plan_name"],
  price: ["total_price_kzt", "max_members"],
  schedule: ["payment_day", "next_payment_date"],
  payment: ["payment_phone"],
  details: []
};

export function getTodayKz(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
}

export function validateCreateForm(
  form: FamilyCreate,
  service: FamilyService | null
): FieldErrors {
  const errors: FieldErrors = {};
  if (service?.family_type === "tariff" && !form.plan_name?.trim()) {
    errors.plan_name = "Укажите название тарифа";
  }
  if (!form.payment_phone.trim()) {
    errors.payment_phone = "Укажите номер телефона";
  } else if (!PHONE_RE.test(form.payment_phone.replace(/[\s()-]/g, ""))) {
    errors.payment_phone = "Формат: +7 и 10 цифр, например +77001234567";
  }
  if (form.total_price_kzt <= 0) {
    errors.total_price_kzt = "Цена должна быть больше нуля";
  } else if (form.total_price_kzt > MAX_FAMILY_PRICE_KZT) {
    errors.total_price_kzt = "Цена не может быть больше 1 000 000 ₸";
  }
  if (service && (form.max_members < 2 || form.max_members > service.max_members)) {
    errors.max_members = `От 2 до ${service.max_members} мест`;
  }
  if (form.payment_day < 1 || form.payment_day > 31) {
    errors.payment_day = "Число от 1 до 31";
  }
  if (!form.next_payment_date) {
    errors.next_payment_date = "Выберите дату";
  } else if (form.next_payment_date < getTodayKz()) {
    errors.next_payment_date = "Дата не может быть в прошлом";
  }
  return errors;
}

export function sectionHasErrors(section: CreateSection, errors: FieldErrors) {
  return SECTION_FIELDS[section].some((key) => key in errors);
}

export function calculatePreviewShare(totalPriceKzt: number, maxMembers: number) {
  if (totalPriceKzt <= 0 || maxMembers <= 0) {
    return 0;
  }
  return Math.ceil(Math.ceil(totalPriceKzt / maxMembers) / 50) * 50;
}

export function formatKzt(value: number) {
  return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
}

export function pluralRu(value: number, one: string, few: string, many: string) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function periodPhrase(period: FamilyCreate["period"]) {
  return period === "yearly" ? "в год" : "в месяц";
}

export function periodOptionLabel(period: FamilyCreate["period"]) {
  return period === "yearly" ? "Раз в год" : "Раз в месяц";
}

function formatDayMonth(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(
    new Date(year, month - 1, day)
  );
}

/** One-line summary shown under a finished section in the step list. */
export function sectionSummary(
  section: CreateSection,
  form: FamilyCreate,
  serviceName: string | null
): string {
  switch (section) {
    case "service": {
      return [serviceName, form.plan_name?.trim()].filter(Boolean).join(" · ");
    }
    case "price": {
      const seats = `${form.max_members} ${pluralRu(form.max_members, "место", "места", "мест")}`;
      const share = calculatePreviewShare(form.total_price_kzt, form.max_members);
      return `${formatKzt(form.total_price_kzt)} ${periodPhrase(form.period)} · ${seats} · по ${formatKzt(share)}`;
    }
    case "schedule":
      return `${form.payment_day}-го числа · ближайшая ${formatDayMonth(form.next_payment_date)}`;
    case "payment":
      return `${bankLabels[form.payment_bank]} · ${form.payment_phone.trim()}`;
    case "details": {
      const hasDescription = Boolean(form.description?.trim());
      const hasRules = Boolean(form.owner_rules?.trim());
      if (hasDescription && hasRules) return "Описание и правила добавлены";
      if (hasDescription) return "Описание добавлено";
      if (hasRules) return "Правила добавлены";
      return SECTION_HINTS.details;
    }
  }
}

/** Hint shown under a section that is not finished yet. */
export const SECTION_HINTS: Record<CreateSection, string> = {
  service: "Что вы оплачиваете вместе",
  price: "Сколько стоит и сколько вас",
  schedule: "Когда участники переводят долю",
  payment: "Банк и номер телефона",
  details: "Необязательно"
};

/** Lead line at the top of an opened section. */
export const SECTION_LEADS: Record<CreateSection, string> = {
  service: "Что вы оплачиваете вместе. После создания сервис не поменять.",
  price:
    "Полная цена и сколько человек в семье, считая вас. Период и число мест после создания не поменять.",
  schedule:
    "К этому числу участники переводят вам свою долю. Если в месяце нет такого числа, оплата в последний день месяца.",
  payment:
    "Номер увидят только участники, которым вы подтвердили доступ.",
  details:
    "Расскажите, что входит в подписку и как подключиться. Правила после создания не поменять."
};

/** A section is finished when its fields are valid and the owner has looked at it.
 * The service is preselected and price and dates have guessed defaults, so those
 * need a visit; the phone has no default, so a valid value is enough. */
export function isSectionDone(
  section: CreateSection,
  errors: FieldErrors,
  confirmed: ReadonlySet<CreateSection>,
  form: FamilyCreate
) {
  if (sectionHasErrors(section, errors)) return false;
  if (section === "service") return Boolean(form.service_id) && confirmed.has(section);
  if (section === "payment") return true;
  if (section === "details") return Boolean(form.description?.trim() || form.owner_rules?.trim());
  return confirmed.has(section);
}

export function firstSectionError(section: CreateSection, errors: FieldErrors) {
  const key = SECTION_FIELDS[section].find((field) => field in errors);
  return key ? errors[key] : undefined;
}

/** The next date that falls on `day`, after today. Days 29–31 fall back to the
 * last day of a shorter month, as the backend does. */
export function nextPaymentDateFor(day: number, todayIso: string = getTodayKz()): string {
  const [year, month, today] = todayIso.split("-").map(Number);
  const safeDay = Math.min(31, Math.max(1, Math.trunc(day) || 1));
  const build = (y: number, m: number) => {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const d = Math.min(safeDay, lastDay);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  const thisMonth = build(year, month);
  if (Number(thisMonth.slice(8)) > today) return thisMonth;
  return month === 12 ? build(year + 1, 1) : build(year, month + 1);
}

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  video_streaming: "Видео",
  music_audio: "Музыка",
  education_books: "Обучение и книги",
  cloud_productivity: "Облако и офис",
  security_utilities: "Защита и VPN",
  mobile_tariffs: "Операторы"
};

const SERVICE_CATEGORY_ORDER = [
  "video_streaming",
  "music_audio",
  "cloud_productivity",
  "education_books",
  "security_utilities",
  "mobile_tariffs"
];

export function serviceCategoryOrder(category: string) {
  const index = SERVICE_CATEGORY_ORDER.indexOf(category);
  return index === -1 ? SERVICE_CATEGORY_ORDER.length : index;
}

export function serviceCategoryLabel(category: string) {
  return SERVICE_CATEGORY_LABELS[category] ?? "Другое";
}

export function matchesServiceQuery(service: FamilyService, query: string) {
  const needle = query.trim().toLocaleLowerCase("ru-RU");
  if (!needle) return true;
  const aliases = service.service_metadata?.aliases;
  const haystack = [
    service.name,
    service.variant ?? "",
    ...(Array.isArray(aliases) ? aliases.map(String) : [])
  ]
    .join(" ")
    .toLocaleLowerCase("ru-RU");
  return haystack.includes(needle);
}
