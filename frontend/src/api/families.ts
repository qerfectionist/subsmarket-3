import { patch, post, postIdempotent, request } from "./client";
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
  FamilyType,
  FamilyView,
  MyFamily,
  OwnerFamilyRequest,
  PaymentConfirmationResult,
  PaymentRequisite
} from "../types";

function pagePath(
  path: string,
  params: Record<string, string | null | undefined> = {}
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

async function collectCursorItems<T>(
  fetchPage: (cursor: string | null) => Promise<CursorPage<T>>
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  do {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor);
  return items;
}

export function getFamiliesPage({
  familyType,
  cursor = null
}: {
  familyType?: FamilyType;
  cursor?: string | null;
} = {}): Promise<CursorPage<Family>> {
  return request<CursorPage<Family>>(
    pagePath("/api/families/page", {
      family_type: familyType,
      cursor
    })
  );
}

export function getFamilies(familyType?: FamilyType): Promise<Family[]> {
  return collectCursorItems((cursor) => getFamiliesPage({ familyType, cursor }));
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

export function getFamilyAuditLogPage(
  familyId: string,
  cursor: string | null = null
): Promise<CursorPage<FamilyAuditLog>> {
  return request<CursorPage<FamilyAuditLog>>(
    pagePath(`/api/families/${familyId}/audit-log/page`, { cursor })
  );
}

export function getFamilyAuditLog(familyId: string): Promise<FamilyAuditLog[]> {
  return collectCursorItems((cursor) => getFamilyAuditLogPage(familyId, cursor));
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

export function getMyFamilyRequestsPage(
  cursor: string | null = null
): Promise<CursorPage<FamilyRequest>> {
  return request<CursorPage<FamilyRequest>>(
    pagePath("/api/families/requests/me/page", { cursor })
  );
}

export function getMyFamilyRequests(): Promise<FamilyRequest[]> {
  return collectCursorItems(getMyFamilyRequestsPage);
}

export function cancelFamilyRequest(requestId: string): Promise<FamilyRequest> {
  return post<FamilyRequest>(`/api/families/requests/${requestId}/cancel`);
}

export function getOwnerFamilyRequestsPage(
  familyId: string,
  cursor: string | null = null
): Promise<CursorPage<OwnerFamilyRequest>> {
  return request<CursorPage<OwnerFamilyRequest>>(
    pagePath(`/api/families/${familyId}/requests/page`, { cursor })
  );
}

export function getOwnerFamilyRequests(
  familyId: string
): Promise<OwnerFamilyRequest[]> {
  return collectCursorItems((cursor) =>
    getOwnerFamilyRequestsPage(familyId, cursor)
  );
}

export function approveFamilyRequest(requestId: string): Promise<FamilyRequest> {
  return post<FamilyRequest>(`/api/families/requests/${requestId}/approve`);
}

export function rejectFamilyRequest(requestId: string): Promise<FamilyRequest> {
  return post<FamilyRequest>(`/api/families/requests/${requestId}/reject`);
}

export function getMyFamiliesPage(
  cursor: string | null = null
): Promise<CursorPage<MyFamily>> {
  return request<CursorPage<MyFamily>>(
    pagePath("/api/families/me/page", { cursor })
  );
}

export function getMyFamilies(): Promise<MyFamily[]> {
  return collectCursorItems(getMyFamiliesPage);
}

export function getFamilyMembersPage(
  familyId: string,
  cursor: string | null = null
): Promise<CursorPage<FamilyMember>> {
  return request<CursorPage<FamilyMember>>(
    pagePath(`/api/families/${familyId}/members/page`, { cursor })
  );
}

export function getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  return collectCursorItems((cursor) => getFamilyMembersPage(familyId, cursor));
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

export function removeMember(
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

export function getMemberPaymentsPage(
  memberId: string,
  cursor: string | null = null
): Promise<CursorPage<FamilyPayment>> {
  return request<CursorPage<FamilyPayment>>(
    pagePath(`/api/families/members/${memberId}/payments/page`, { cursor })
  );
}

export function getMemberPayments(memberId: string): Promise<FamilyPayment[]> {
  return collectCursorItems((cursor) => getMemberPaymentsPage(memberId, cursor));
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
