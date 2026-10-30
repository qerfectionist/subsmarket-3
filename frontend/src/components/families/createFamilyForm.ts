import type { FamilyCreate, FamilyService } from "../../types";

const PHONE_RE = /^\+?7\d{10}$/;
// Mirrors the backend limits in FamilyCreate.
export const MAX_FAMILY_PRICE_KZT = 1_000_000;
export const MAX_FULL_SPEED_GB = 5000;

export type CreateStep = "service" | "terms" | "payout";

export const CREATE_STEPS: { id: CreateStep; title: string }[] = [
  { id: "service", title: "Сервис" },
  { id: "terms", title: "Цена и места" },
  { id: "payout", title: "Выплата" }
];

export interface FieldErrors {
  service_id?: string;
  plan_name?: string;
  full_speed_gb?: string;
  total_price_kzt?: string;
  max_members?: string;
  payment_day?: string;
  next_payment_date?: string;
  payment_phone?: string;
  payment_recipient_name?: string;
}

const STEP_FIELDS: Record<CreateStep, (keyof FieldErrors)[]> = {
  service: ["service_id"],
  terms: [
    "plan_name",
    "full_speed_gb",
    "total_price_kzt",
    "max_members",
    "payment_day",
    "next_payment_date"
  ],
  payout: ["payment_phone", "payment_recipient_name"]
};

/** Short name of the field, used in «Чтобы создать семью, исправьте …». */
export const FIELD_NAMES: Record<keyof FieldErrors, string> = {
  service_id: "сервис",
  plan_name: "название тарифа",
  full_speed_gb: "полную скорость",
  total_price_kzt: "цену",
  max_members: "число мест",
  payment_day: "день оплаты",
  next_payment_date: "дату оплаты",
  payment_phone: "номер телефона",
  payment_recipient_name: "имя получателя"
};

/** «Осталось 3 цифры»: how many of the ten digits after +7 are still missing. */
function phoneShortfall(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const missing = 10 - (phone.trim().startsWith("+7") ? digits.slice(1) : digits).length;
  if (missing <= 0) return "Проверьте номер: после +7 нужно 10 цифр";
  const word = missing === 1 ? "цифра" : missing <= 4 ? "цифры" : "цифр";
  return `Номер неполный: ${missing === 1 ? "осталась" : "осталось"} ${missing} ${word}`;
}

export function getTodayKz(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
}

export function validateCreateForm(
  form: FamilyCreate,
  service: FamilyService | null
): FieldErrors {
  const errors: FieldErrors = {};
  if (!service) {
    errors.service_id = "Выберите сервис";
  }
  if (service?.family_type === "tariff") {
    if (!form.plan_name?.trim()) {
      errors.plan_name = "Укажите название тарифа";
    }
    const gb = form.full_speed_gb ?? 0;
    if (!Number.isInteger(gb) || gb < 1) {
      errors.full_speed_gb = "Сколько ГБ семья получает на полной скорости";
    } else if (gb > MAX_FULL_SPEED_GB) {
      errors.full_speed_gb = `Не больше ${MAX_FULL_SPEED_GB} ГБ`;
    }
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
  if (!form.payment_phone.trim()) {
    errors.payment_phone = "Укажите номер телефона";
  } else if (!PHONE_RE.test(form.payment_phone.replace(/[\s()-]/g, ""))) {
    errors.payment_phone = phoneShortfall(form.payment_phone);
  }
  // The name is optional; when given it must look like a name.
  const recipient = (form.payment_recipient_name ?? "").trim();
  if (recipient && /\d/.test(recipient)) {
    errors.payment_recipient_name = "Только имя и буква фамилии, без цифр";
  } else if (recipient && recipient.length < 2) {
    errors.payment_recipient_name = "Слишком короткое имя";
  }
  return errors;
}

export function stepHasErrors(step: CreateStep, errors: FieldErrors) {
  return STEP_FIELDS[step].some((key) => key in errors);
}

export function stepErrorFields(step: CreateStep, errors: FieldErrors) {
  return STEP_FIELDS[step].filter((key) => key in errors);
}

/** «Чтобы создать семью, проверьте номер телефона и имя получателя». */
export function fixHint(fields: (keyof FieldErrors)[], action: string) {
  if (fields.length === 0) return null;
  const names = fields.map((field) => FIELD_NAMES[field]);
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} и ${names[names.length - 1]}`;
  return `Чтобы ${action}, проверьте ${list}`;
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

export function formatDayMonth(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(
    new Date(year, month - 1, day)
  );
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

/** Text hints stored in the catalog for a service. */
export function serviceStrings(service: FamilyService | null, key: string): string[] {
  const value = service?.service_metadata?.[key];
  return Array.isArray(value) ? value.map(String) : [];
}

export type ServiceCategoryChip = { id: string; label: string; categories: string[] };

export const SERVICE_CATEGORY_CHIPS: ServiceCategoryChip[] = [
  { id: "all", label: "Все", categories: [] },
  { id: "video", label: "Видео", categories: ["video_streaming"] },
  { id: "music", label: "Музыка", categories: ["music_audio"] },
  { id: "cloud", label: "Облако", categories: ["cloud_productivity"] },
  { id: "study", label: "Обучение", categories: ["education_books"] },
  { id: "vpn", label: "VPN", categories: ["security_utilities"] },
  { id: "operators", label: "Операторы", categories: ["mobile_tariffs"] }
];

const SERVICE_CATEGORY_ORDER = SERVICE_CATEGORY_CHIPS.flatMap((chip) => chip.categories);

/** What families in Kazakhstan are made for most often: first in «Популярное» and in each category. */
const POPULAR_SERVICE_SLUGS = [
  "youtube-premium",
  "yandex-plus",
  "spotify-family",
  "netflix-premium",
  "apple-music",
  "icloud-plus-2tb",
  "tele2-family-tariff",
  "beeline-family-tariff",
  "activ-family-tariff",
  "google-one",
  "microsoft-365-family",
  "duolingo-super",
  "ivi",
  "okko",
  "kaspersky-standard",
  "adguard-vpn"
];

/** How many tiles «Популярное» shows: two rows of three. */
export const POPULAR_SERVICE_COUNT = 6;

export function servicePopularity(slug: string) {
  const index = POPULAR_SERVICE_SLUGS.indexOf(slug);
  return index === -1 ? POPULAR_SERVICE_SLUGS.length : index;
}

export function serviceCategoryOrder(category: string) {
  const index = SERVICE_CATEGORY_ORDER.indexOf(category);
  return index === -1 ? SERVICE_CATEGORY_ORDER.length : index;
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
