import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";

import {
  acknowledgeFamilyClosing,
  approveFamilyRequest,
  cancelFamilyRequest,
  cancelMemberBeforeAccess,
  cancelPaymentReport,
  closeFamily,
  confirmAccessReceived,
  confirmFamilyAvailability,
  confirmPaymentReceived,
  createFamily,
  createFamilyInvite,
  createFamilyRequest,
  createMemberPrepayment,
  disableFamilyInvite,
  getPaymentRequisite,
  leaveFamily,
  markAccessProvided,
  markPaymentNotReceived,
  recordOwnerPrepaidPeriods,
  remindAccessConfirmation,
  rejectFamilyRequest,
  reportPaymentPaid,
  rotateFamilyInvite,
  removeMember,
  updateFamilyDescription,
  updateFamilyPaymentDay,
  updateFamilyPrice,
  updateFamilyVisibility
} from "../../api";
import type {
  CursorPage,
  FamilyCreate,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyView,
  MyFamily
} from "../../types";
import { queryKeys } from "./queryKeys";

function patchFamilyViewPayment(qc: ReturnType<typeof useQueryClient>, payment: FamilyPayment) {
  qc.setQueryData<FamilyView>(queryKeys.familyView(payment.family_id), (current) => {
    if (!current) return current;
    const index = current.my_payments.findIndex((item) => item.id === payment.id);
    if (index === -1) {
      return {
        ...current,
        my_payments: [...current.my_payments, payment]
      };
    }
    return {
      ...current,
      my_payments: current.my_payments.map((item) =>
        item.id === payment.id ? payment : item
      )
    };
  });
}

function patchMyFamilyPayment(qc: ReturnType<typeof useQueryClient>, payment: FamilyPayment) {
  qc.setQueryData<InfiniteData<CursorPage<MyFamily>, string | null>>(
    queryKeys.myFamilies,
    (current) => {
      if (!current) return current;
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => {
            if (item.family.id !== payment.family_id) return item;
            const hasPayment = item.payments.some((entry) => entry.id === payment.id);
            if (!hasPayment) return item;
            return {
              ...item,
              payments: item.payments.map((entry) =>
                entry.id === payment.id ? payment : entry
              )
            };
          })
        }))
      };
    }
  );
}

export function useCreateFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FamilyCreate) => createFamily(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.myFamilies });
      await qc.refetchQueries({ queryKey: queryKeys.myFamilies });
    }
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
    mutationFn: ({
      familyId,
      paymentDay,
      nextPaymentDate
    }: {
      familyId: string;
      paymentDay: number;
      nextPaymentDate: string;
    }) => updateFamilyPaymentDay(familyId, paymentDay, nextPaymentDate),
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
    onSuccess: async (result) => {
      patchFamilyViewPayment(qc, result.payment);
      patchMyFamilyPayment(qc, result.payment);
      await qc.invalidateQueries({ queryKey: queryKeys.myFamilies });
      await qc.invalidateQueries({ queryKey: queryKeys.myRequests });
      await qc.invalidateQueries({
        queryKey: queryKeys.familyView(result.payment.family_id)
      });
      await qc.invalidateQueries({
        queryKey: queryKeys.familyMemberPayments(result.payment.family_id)
      });
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

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      familyId,
      memberId,
      reason
    }: {
      familyId: string;
      memberId: string;
      reason: FamilyMemberRemovalReason;
    }) => removeMember(memberId, reason),
    onSuccess: (_data, { familyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.ownerRequests(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyView(familyId) });
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
    mutationFn: ({
      familyId,
      memberId,
      periods
    }: {
      familyId: string;
      memberId: string;
      periods: number;
    }) => recordOwnerPrepaidPeriods(memberId, periods),
    onSuccess: (_data, { familyId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.ownerRequests(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyMemberPayments(familyId) });
    }
  });
}

export function useReportPaymentPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => reportPaymentPaid(paymentId),
    onSuccess: async (payment) => {
      patchFamilyViewPayment(qc, payment);
      patchMyFamilyPayment(qc, payment);
      await qc.invalidateQueries({ queryKey: queryKeys.myFamilies });
      await qc.invalidateQueries({ queryKey: queryKeys.myRequests });
      await qc.invalidateQueries({ queryKey: ["familyView"] });
    }
  });
}

export function useCancelPaymentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => cancelPaymentReport(paymentId),
    onSuccess: async (payment) => {
      patchFamilyViewPayment(qc, payment);
      patchMyFamilyPayment(qc, payment);
      await qc.invalidateQueries({ queryKey: queryKeys.myFamilies });
      await qc.invalidateQueries({ queryKey: queryKeys.myRequests });
      await qc.invalidateQueries({ queryKey: ["familyView"] });
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
      qc.invalidateQueries({ queryKey: queryKeys.familyMemberPayments(familyId) });
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
      qc.invalidateQueries({ queryKey: queryKeys.familyMemberPayments(familyId) });
      qc.invalidateQueries({ queryKey: queryKeys.familyView(familyId) });
    }
  });
}

export function useGetPaymentRequisite() {
  return useMutation({ mutationFn: (memberId: string) => getPaymentRequisite(memberId) });
}
