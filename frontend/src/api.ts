import type {
  AccessConfirmationResult,
  CursorPage,
  Family,
  FamilyAuditLog,
  FamilyCreate,
  FamilyCreateResult,
  FamilyInvite,
  FamilyMember,
  FamilyMemberPayments,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyRequest,
  FamilyService,
  FamilyType,
  FamilyView,
  MeResponse,
  MyFamily,
  OwnerFamilyRequest,
  PaymentConfirmationResult,
  PaymentRequisite
} from "./types";
import { getTelegramInitData, initTelegramShell } from "./telegram";

export { initTelegramShell };

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const DEV_TELEGRAM_USER_KEY = "subsmarket.devTelegramUser";
const pendingIdempotency = new Map<string, { fingerprint: string; key: string }>();

export type DevTelegramUser = {
  id: number;
  username: string;
  firstName: string;
  label: string;
};

export const DEV_TELEGRAM_USERS: DevTelegramUser[] = [
  {
    id: 200001,
    username: "demo_owner",
    firstName: "Demo Owner",
    label: "Owner"
  },
  {
    id: 200002,
    username: "demo_member",
    firstName: "Demo Member",
    label: "Member"
  }
];

export function isDevAuthEnabled() {
  return import.meta.env.DEV && !getTelegramInitData();
}

export function getActiveDevTelegramUser() {
  if (!isDevAuthEnabled()) {
    return null;
  }
  const storedId = Number(window.localStorage.getItem(DEV_TELEGRAM_USER_KEY));
  return (
    DEV_TELEGRAM_USERS.find((user) => user.id === storedId) ?? DEV_TELEGRAM_USERS[0]
  );
}

export function setActiveDevTelegramUser(user: DevTelegramUser) {
  window.localStorage.setItem(DEV_TELEGRAM_USER_KEY, String(user.id));
}

function authHeaders(): HeadersInit {
  const initData = getTelegramInitData();
  if (initData) {
    return { "X-Telegram-Init-Data": initData };
  }

  const devUser = getActiveDevTelegramUser();
  if (!devUser) {
    return {};
  }

  return {
    "X-Dev-Telegram-User-Id": String(devUser.id),
    "X-Dev-Telegram-Username": devUser.username,
    "X-Dev-Telegram-First-Name": devUser.firstName
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    let detail = await response.text();
    try {
      const json = JSON.parse(detail) as { detail?: unknown };
      detail =
        typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail);
    } catch {
      // Keep raw response text.
    }
    throw new Error(`API ${response.status}: ${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function post<T>(path: string, body?: unknown, headers?: HeadersInit): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers
  });
}

async function postIdempotent<T>(
  scope: string,
  path: string,
  body?: unknown
): Promise<T> {
  const fingerprint = JSON.stringify(body ?? null);
  const pending = pendingIdempotency.get(scope);
  const key =
    pending?.fingerprint === fingerprint ? pending.key : createIdempotencyKey();
  pendingIdempotency.set(scope, { fingerprint, key });
  const result = await post<T>(path, body, { "Idempotency-Key": key });
  if (pendingIdempotency.get(scope)?.key === key) {
    pendingIdempotency.delete(scope);
  }
  return result;
}

function createIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export function getMe(): Promise<MeResponse> {
  return request<MeResponse>("/api/me");
}

export function refreshTelegramProfile(): Promise<MeResponse> {
  return patch<MeResponse>("/api/me/refresh-telegram-profile");
}

export function getFamilyServices(familyType?: FamilyType): Promise<FamilyService[]> {
  const query = familyType ? `?family_type=${familyType}` : "";
  return request<FamilyService[]>(`/api/catalog/family-services${query}`);
}

export async function importFamilyServices(): Promise<void> {
  await post("/api/catalog/import-family-services");
}

export function getFamilies(familyType?: FamilyType): Promise<Family[]> {
  const query = familyType ? `?family_type=${familyType}` : "";
  return request<CursorPage<Family>>(`/api/families/page${query}`).then(
    (page) => page.items
  );
}

export function getFamilyView(familyId: string): Promise<FamilyView> {
  return request<FamilyView>(`/api/families/${familyId}/view`);
}

export function getFamilyByInviteCode(code: string): Promise<FamilyView> {
  return request<FamilyView>(`/api/families/invites/${code}`);
}

export function getFamilyInvite(familyId: string): Promise<FamilyInvite | null> {
  return request<FamilyInvite | null>(`/api/families/${familyId}/invite`);
}

export function createFamilyInvite(familyId: string): Promise<FamilyInvite> {
  return post<FamilyInvite>(`/api/families/${familyId}/invite`);
}

export function rotateFamilyInvite(familyId: string): Promise<FamilyInvite> {
  return post<FamilyInvite>(`/api/families/${familyId}/invite/rotate`);
}

export function disableFamilyInvite(familyId: string): Promise<void> {
  return post<void>(`/api/families/${familyId}/invite/disable`);
}

export function updateFamilyVisibility(
  familyId: string,
  isSearchVisible: boolean
): Promise<Family> {
  return patch<Family>(`/api/families/${familyId}/visibility`, {
    is_search_visible: isSearchVisible
  });
}

export function confirmFamilyAvailability(familyId: string): Promise<Family> {
  return post<Family>(`/api/families/${familyId}/confirm-availability`);
}

export function getFamilyAuditLog(familyId: string): Promise<FamilyAuditLog[]> {
  return request<CursorPage<FamilyAuditLog>>(
    `/api/families/${familyId}/audit-log/page`
  ).then((page) => page.items);
}

export function createFamily(payload: FamilyCreate): Promise<FamilyCreateResult> {
  return postIdempotent<FamilyCreateResult>(
    "family.create",
    "/api/families",
    payload
  );
}

export function updateFamilyDescription(
  familyId: string,
  description: string | null
): Promise<Family> {
  return patch<Family>(`/api/families/${familyId}/description`, { description });
}

export function updateFamilyPrice(
  familyId: string,
  totalPriceKzt: number
): Promise<Family> {
  return patch<Family>(`/api/families/${familyId}/price`, {
    total_price_kzt: totalPriceKzt
  });
}

export function updateFamilyPaymentDay(
  familyId: string,
  paymentDay: number,
  nextPaymentDate: string
): Promise<Family> {
  return patch<Family>(`/api/families/${familyId}/payment-day`, {
    payment_day: paymentDay,
    next_payment_date: nextPaymentDate
  });
}

export function closeFamily(familyId: string, closesOn: string): Promise<Family> {
  return postIdempotent<Family>(
    `family.close:${familyId}`,
    `/api/families/${familyId}/close`,
    { closes_on: closesOn }
  );
}

export function acknowledgeFamilyClosing(familyId: string): Promise<FamilyMember> {
  return post<FamilyMember>(`/api/families/${familyId}/acknowledge-closing`);
}

export function createFamilyRequest(familyId: string): Promise<FamilyRequest> {
  return postIdempotent<FamilyRequest>(
    `family_request.create:${familyId}`,
    `/api/families/${familyId}/requests`
  );
}

export function getMyFamilyRequests(): Promise<FamilyRequest[]> {
  return request<CursorPage<FamilyRequest>>("/api/families/requests/me/page").then(
    (page) => page.items
  );
}

export function cancelFamilyRequest(requestId: string): Promise<FamilyRequest> {
  return post<FamilyRequest>(`/api/families/requests/${requestId}/cancel`);
}

export function getOwnerFamilyRequests(
  familyId: string
): Promise<OwnerFamilyRequest[]> {
  return request<CursorPage<OwnerFamilyRequest>>(
    `/api/families/${familyId}/requests/page`
  ).then((page) => page.items);
}

export function approveFamilyRequest(requestId: string): Promise<FamilyRequest> {
  return post<FamilyRequest>(`/api/families/requests/${requestId}/approve`);
}

export function rejectFamilyRequest(requestId: string): Promise<FamilyRequest> {
  return post<FamilyRequest>(`/api/families/requests/${requestId}/reject`);
}

export function getMyFamilies() {
  return request<CursorPage<MyFamily>>("/api/families/me/page").then(
    (page) => page.items
  );
}

export function getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  return request<CursorPage<FamilyMember>>(
    `/api/families/${familyId}/members/page`
  ).then((page) => page.items);
}

export function getFamilyMemberPayments(
  familyId: string
): Promise<FamilyMemberPayments[]> {
  return request<FamilyMemberPayments[]>(`/api/families/${familyId}/payments`);
}

export function markAccessProvided(memberId: string): Promise<FamilyMember> {
  return postIdempotent<FamilyMember>(
    `family_member.provide_access:${memberId}`,
    `/api/families/members/${memberId}/access-provided`
  );
}

export function remindAccessConfirmation(memberId: string): Promise<FamilyMember> {
  return post<FamilyMember>(
    `/api/families/members/${memberId}/remind-access-confirmation`
  );
}

export function cancelMemberBeforeAccess(memberId: string): Promise<FamilyMember> {
  return post<FamilyMember>(
    `/api/families/members/${memberId}/cancel-before-access`
  );
}

export function confirmAccessReceived(
  memberId: string
): Promise<AccessConfirmationResult> {
  return postIdempotent<AccessConfirmationResult>(
    `family_member.confirm_access:${memberId}`,
    `/api/families/members/${memberId}/access-confirmed`
  );
}

export function leaveFamily(memberId: string): Promise<FamilyMember> {
  return post<FamilyMember>(`/api/families/members/${memberId}/leave`);
}

export function scheduleMemberRemoval(
  memberId: string,
  reason: FamilyMemberRemovalReason
): Promise<FamilyMember> {
  return postIdempotent<FamilyMember>(
    `family_member.remove:${memberId}`,
    `/api/families/members/${memberId}/remove`,
    { reason }
  );
}

export function getPaymentRequisite(memberId: string): Promise<PaymentRequisite> {
  return request<PaymentRequisite>(
    `/api/families/members/${memberId}/payment-requisite`
  );
}

export function getMemberPayments(memberId: string): Promise<FamilyPayment[]> {
  return request<CursorPage<FamilyPayment>>(
    `/api/families/members/${memberId}/payments/page`
  ).then((page) => page.items);
}

export function createMemberPrepayment(memberId: string): Promise<FamilyPayment> {
  return post<FamilyPayment>(`/api/families/members/${memberId}/prepayments`);
}

export function recordOwnerPrepaidPeriods(
  memberId: string,
  periods: number
): Promise<FamilyPayment[]> {
  return post<FamilyPayment[]>(
    `/api/families/members/${memberId}/prepayments/record-paid`,
    { periods }
  );
}

export function reportPaymentPaid(paymentId: string): Promise<FamilyPayment> {
  return postIdempotent<FamilyPayment>(
    `family_payment.report_paid:${paymentId}`,
    `/api/families/payments/${paymentId}/report-paid`
  );
}

export function cancelPaymentReport(paymentId: string): Promise<FamilyPayment> {
  return post<FamilyPayment>(`/api/families/payments/${paymentId}/cancel-report`);
}

export function confirmPaymentReceived(
  paymentId: string
): Promise<PaymentConfirmationResult> {
  return postIdempotent<PaymentConfirmationResult>(
    `family_payment.confirm_received:${paymentId}`,
    `/api/families/payments/${paymentId}/confirm`
  );
}

export function markPaymentNotReceived(paymentId: string): Promise<FamilyPayment> {
  return post<FamilyPayment>(`/api/families/payments/${paymentId}/not-received`);
}
