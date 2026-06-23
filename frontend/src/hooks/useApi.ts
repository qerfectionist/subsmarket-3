import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acknowledgeFamilyClosing,
  approveFamilyRequest,
  cancelFamilyRequest,
  cancelMemberBeforeAccess,
  cancelPaymentReport,
  closeFamily,
  confirmFamilyAvailability,
  confirmAccessReceived,
  confirmPaymentReceived,
  createFamily,
  createFamilyInvite,
  createFamilyRequest,
  createMemberPrepayment,
  disableFamilyInvite,
  getFamilies,
  getFamilyByInviteCode,
  getFamilyInvite,
  getFamilyAuditLog,
  getFamilyMemberPayments,
  getFamilyView,
  getFamilyMembers,
  getFamilyServices,
  getMe,
  getMyFamilies,
  getMyFamilyRequests,
  getOwnerFamilyRequests,
  getPaymentRequisite,
  importFamilyServices,
  leaveFamily,
  markAccessProvided,
  markPaymentNotReceived,
  refreshTelegramProfile,
  recordOwnerPrepaidPeriods,
  remindAccessConfirmation,
  rejectFamilyRequest,
  reportPaymentPaid,
  rotateFamilyInvite,
  scheduleMemberRemoval,
  revokeMemberRemoval,
  updateFamilyDescription,
  updateFamilyPaymentDay,
  updateFamilyPrice,
  updateFamilyVisibility
} from "../api";
import type {
  FamilyCreate,
  FamilyMemberRemovalReason
} from "../types";

export const queryKeys = {
  me: ["me"] as const,
  services: (familyType?: string) => ["services", familyType ?? "all"] as const,
  families: (familyType?: string) => ["families", familyType ?? "all"] as const,
  myFamilies: ["myFamilies"] as const,
  myRequests: ["myRequests"] as const,
  familyView: (familyId: string) => ["familyView", familyId] as const,
  familyAuditLog: (familyId: string) => ["familyAuditLog", familyId] as const,
  familyInvite: (familyId: string) => ["familyInvite", familyId] as const,
  ownerRequests: (familyId: string) => ["ownerRequests", familyId] as const,
  familyMembers: (familyId: string) => ["familyMembers", familyId] as const,
  familyMemberPayments: (familyId: string) => ["familyMemberPayments", familyId] as const
};

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: getMe });
}

export function useFamilyServices(familyType?: string) {
  return useQuery({
    queryKey: queryKeys.services(familyType),
    queryFn: () => getFamilyServices(familyType as undefined)
  });
}

export function useFamilies(familyType?: string) {
  return useQuery({
    queryKey: queryKeys.families(familyType),
    queryFn: () => getFamilies(familyType as undefined)
  });
}

export function useMyFamilies() {
  return useQuery({ queryKey: queryKeys.myFamilies, queryFn: getMyFamilies });
}

export function useMyFamilyRequests() {
  return useQuery({ queryKey: queryKeys.myRequests, queryFn: getMyFamilyRequests });
}

export function useFamilyView(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.familyView(familyId ?? ""),
    queryFn: () => getFamilyView(familyId!),
    enabled: familyId !== null
  });
}

export function useFamilyAuditLog(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.familyAuditLog(familyId ?? ""),
    queryFn: () => getFamilyAuditLog(familyId!),
    enabled: familyId !== null
  });
}

export function useFamilyInvite(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.familyInvite(familyId ?? ""),
    queryFn: () => getFamilyInvite(familyId!),
    enabled: familyId !== null
  });
}

export function useOwnerFamilyRequests(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.ownerRequests(familyId ?? ""),
    queryFn: () => getOwnerFamilyRequests(familyId!),
    enabled: familyId !== null
  });
}

export function useFamilyMembers(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.familyMembers(familyId ?? ""),
    queryFn: () => getFamilyMembers(familyId!),
    enabled: familyId !== null
  });
}

export function useFamilyMemberPayments(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.familyMemberPayments(familyId ?? ""),
    queryFn: () => getFamilyMemberPayments(familyId!),
    enabled: familyId !== null
  });
}

export function useRefreshTelegramProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: refreshTelegramProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.me })
  });
}

export function useImportFamilyServices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importFamilyServices,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] })
  });
}

export function useCreateFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FamilyCreate) => createFamily(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myFamilies })
  });
}

export function useUpdateFamilyDescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, description }: { familyId: string; description: string | null }) =>
      updateFamilyDescription(familyId, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myFamilies })
  });
}

export function useUpdateFamilyPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, totalPriceKzt }: { familyId: string; totalPriceKzt: number }) =>
      updateFamilyPrice(familyId, totalPriceKzt),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myFamilies })
  });
}

export function useUpdateFamilyPaymentDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, paymentDay, nextPaymentDate }: { familyId: string; paymentDay: number; nextPaymentDate: string }) =>
      updateFamilyPaymentDay(familyId, paymentDay, nextPaymentDate),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myFamilies })
  });
}

export function useUpdateFamilyVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, isSearchVisible }: { familyId: string; isSearchVisible: boolean }) =>
      updateFamilyVisibility(familyId, isSearchVisible),
    onSuccess: (_data, { familyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.families() });
      qc.invalidateQueries({ queryKey: queryKeys.familyView(familyId) });
    }
  });
}

export function useCloseFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, closesOn }: { familyId: string; closesOn: string }) =>
      closeFamily(familyId, closesOn),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myFamilies })
  });
}

export function useConfirmFamilyAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (familyId: string) => confirmFamilyAvailability(familyId),
    onSuccess: (_data, familyId) => {
      qc.invalidateQueries({ queryKey: queryKeys.myFamilies });
      qc.invalidateQueries({ queryKey: queryKeys.families() });
      qc.invalidateQueries({ queryKey: queryKeys.familyView(familyId) });
    }
  });
}

export function useCreateFamilyInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (familyId: string) => createFamilyInvite(familyId),
    onSuccess: (_data, familyId) =>
      qc.invalidateQueries({ queryKey: queryKeys.familyInvite(familyId) })
  });
}

export function useRotateFamilyInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (familyId: string) => rotateFamilyInvite(familyId),
    onSuccess: (_data, familyId) =>
      qc.invalidateQueries({ queryKey: queryKeys.familyInvite(familyId) })
  });
}

export function useDisableFamilyInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (familyId: string) => disableFamilyInvite(familyId),
    onSuccess: (_data, familyId) =>
      qc.invalidateQueries({ queryKey: queryKeys.familyInvite(familyId) })
  });
}

export function useCreateFamilyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (familyId: string) => createFamilyRequest(familyId),
    onSuccess: (_data, familyId) => {
      qc.invalidateQueries({ queryKey: queryKeys.myRequests });
      qc.invalidateQueries({ queryKey: queryKeys.familyView(familyId) });
    }
  });
}

export function useCancelFamilyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => cancelFamilyRequest(requestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myRequests })
  });
}

export function useApproveFamilyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, requestId }: { familyId: string; requestId: string }) =>
      approveFamilyRequest(requestId),
    onSuccess: (_data, { familyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.ownerRequests(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyView(familyId) });
    }
  });
}

export function useRejectFamilyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, requestId }: { familyId: string; requestId: string }) =>
      rejectFamilyRequest(requestId),
    onSuccess: (_data, { familyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.ownerRequests(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyView(familyId) });
    }
  });
}

export function useMarkAccessProvided() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, memberId }: { familyId: string; memberId: string }) =>
      markAccessProvided(memberId),
    onSuccess: (_data, { familyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.ownerRequests(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyView(familyId) });
    }
  });
}

export function useRemindAccessConfirmation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, memberId }: { familyId: string; memberId: string }) =>
      remindAccessConfirmation(memberId),
    onSuccess: (_data, { familyId }) =>
      qc.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) })
  });
}

export function useCancelMemberBeforeAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, memberId }: { familyId: string; memberId: string }) =>
      cancelMemberBeforeAccess(memberId),
    onSuccess: (_data, { familyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.ownerRequests(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) });
    }
  });
}

export function useConfirmAccessReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => confirmAccessReceived(memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myFamilies });
      qc.invalidateQueries({ queryKey: queryKeys.myRequests });
    }
  });
}

export function useLeaveFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => leaveFamily(memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myFamilies })
  });
}

export function useScheduleMemberRemoval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, memberId, reason }: { familyId: string; memberId: string; reason: FamilyMemberRemovalReason }) =>
      scheduleMemberRemoval(memberId, reason),
    onSuccess: (_data, { familyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.ownerRequests(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) });
    }
  });
}

export function useRevokeMemberRemoval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, memberId }: { familyId: string; memberId: string }) =>
      revokeMemberRemoval(memberId),
    onSuccess: (_data, { familyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.ownerRequests(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) });
    }
  });
}

export function useAcknowledgeFamilyClosing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (familyId: string) => acknowledgeFamilyClosing(familyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myFamilies })
  });
}

export function useCreateMemberPrepayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => createMemberPrepayment(memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myFamilies })
  });
}

export function useRecordOwnerPrepaidPeriods() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, memberId, periods }: { familyId: string; memberId: string; periods: number }) =>
      recordOwnerPrepaidPeriods(memberId, periods),
    onSuccess: (_data, { familyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.ownerRequests(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) });
    }
  });
}

export function useReportPaymentPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => reportPaymentPaid(paymentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myFamilies });
      qc.invalidateQueries({ queryKey: queryKeys.myRequests });
    }
  });
}

export function useCancelPaymentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => cancelPaymentReport(paymentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myFamilies });
      qc.invalidateQueries({ queryKey: queryKeys.myRequests });
    }
  });
}

export function useConfirmPaymentReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, paymentId }: { familyId: string; paymentId: string }) =>
      confirmPaymentReceived(paymentId),
    onSuccess: (_data, { familyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.ownerRequests(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyView(familyId) });
    }
  });
}

export function useMarkPaymentNotReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, paymentId }: { familyId: string; paymentId: string }) =>
      markPaymentNotReceived(paymentId),
    onSuccess: (_data, { familyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.ownerRequests(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) });
    }
  });
}

export function useGetPaymentRequisite() {
  return useMutation({ mutationFn: (memberId: string) => getPaymentRequisite(memberId) });
}

export function useResolveInviteCode() {
  return useMutation({ mutationFn: (code: string) => getFamilyByInviteCode(code) });
}
