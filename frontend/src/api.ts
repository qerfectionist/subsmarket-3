import type {
  AccessConfirmationResult,
  Family,
  FamilyAuditLog,
  FamilyCreate,
  FamilyCreateResult,
  FamilyMember,
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

  return response.json() as Promise<T>;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
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
  return request<Family[]>(`/api/families${query}`);
}

export function getFamilyView(familyId: string): Promise<FamilyView> {
  return request<FamilyView>(`/api/families/${familyId}/view`);
}

export function getFamilyAuditLog(familyId: string): Promise<FamilyAuditLog[]> {
  return request<FamilyAuditLog[]>(`/api/families/${familyId}/audit-log`);
}

export function createFamily(payload: FamilyCreate): Promise<FamilyCreateResult> {
  return post<FamilyCreateResult>("/api/families", payload);
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

export function closeFamily(familyId: string): Promise<Family> {
  return post<Family>(`/api/families/${familyId}/close`);
}

export function acknowledgeFamilyClosing(familyId: string): Promise<FamilyMember> {
  return post<FamilyMember>(`/api/families/${familyId}/acknowledge-closing`);
}

export function createFamilyRequest(familyId: string): Promise<FamilyRequest> {
  return post<FamilyRequest>(`/api/families/${familyId}/requests`);
}

export function getMyFamilyRequests(): Promise<FamilyRequest[]> {
  return request<FamilyRequest[]>("/api/families/requests/me");
}

export function cancelFamilyRequest(requestId: string): Promise<FamilyRequest> {
  return post<FamilyRequest>(`/api/families/requests/${requestId}/cancel`);
}

export function getOwnerFamilyRequests(
  familyId: string
): Promise<OwnerFamilyRequest[]> {
  return request<OwnerFamilyRequest[]>(`/api/families/${familyId}/requests`);
}

export function approveFamilyRequest(requestId: string): Promise<FamilyRequest> {
  return post<FamilyRequest>(`/api/families/requests/${requestId}/approve`);
}

export function rejectFamilyRequest(requestId: string): Promise<FamilyRequest> {
  return post<FamilyRequest>(`/api/families/requests/${requestId}/reject`);
}

export function getMyFamilies() {
  return request<MyFamily[]>("/api/families/me");
}

export function getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  return request<FamilyMember[]>(`/api/families/${familyId}/members`);
}

export function markAccessProvided(memberId: string): Promise<FamilyMember> {
  return post<FamilyMember>(`/api/families/members/${memberId}/access-provided`);
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
  return post<AccessConfirmationResult>(
    `/api/families/members/${memberId}/access-confirmed`
  );
}

export function leaveFamily(memberId: string): Promise<FamilyMember> {
  return post<FamilyMember>(`/api/families/members/${memberId}/leave`);
}

export function scheduleMemberRemoval(memberId: string): Promise<FamilyMember> {
  return post<FamilyMember>(`/api/families/members/${memberId}/remove`);
}

export function acknowledgeMemberRemoval(memberId: string): Promise<FamilyMember> {
  return post<FamilyMember>(
    `/api/families/members/${memberId}/acknowledge-removal`
  );
}

export function revokeMemberRemoval(memberId: string): Promise<FamilyMember> {
  return post<FamilyMember>(`/api/families/members/${memberId}/revoke-removal`);
}

export function getPaymentRequisite(memberId: string): Promise<PaymentRequisite> {
  return request<PaymentRequisite>(
    `/api/families/members/${memberId}/payment-requisite`
  );
}

export function getMemberPayments(memberId: string): Promise<FamilyPayment[]> {
  return request<FamilyPayment[]>(`/api/families/members/${memberId}/payments`);
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
  return post<FamilyPayment>(`/api/families/payments/${paymentId}/report-paid`);
}

export function cancelPaymentReport(paymentId: string): Promise<FamilyPayment> {
  return post<FamilyPayment>(`/api/families/payments/${paymentId}/cancel-report`);
}

export function confirmPaymentReceived(
  paymentId: string
): Promise<PaymentConfirmationResult> {
  return post<PaymentConfirmationResult>(
    `/api/families/payments/${paymentId}/confirm`
  );
}

export function markPaymentNotReceived(paymentId: string): Promise<FamilyPayment> {
  return post<FamilyPayment>(`/api/families/payments/${paymentId}/not-received`);
}
