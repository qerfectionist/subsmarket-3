import { useCallback, useState } from "react";
import { useToast } from "../components/ui";
import {
  getFamilyMemberPayments,
  getFamilyMembers,
  getOwnerFamilyRequests
} from "../api";
import { formatError } from "../format";
import {
  useAcknowledgeFamilyClosing,
  useApproveFamilyRequest,
  useCancelFamilyRequest,
  useCancelMemberBeforeAccess,
  useCancelPaymentReport,
  useCloseFamily,
  useConfirmAccessReceived,
  useConfirmFamilyAvailability,
  useConfirmPaymentReceived,
  useCreateFamilyInvite,
  useCreateFamilyRequest,
  useCreateMemberPrepayment,
  useDisableFamilyInvite,
  useGetPaymentRequisite,
  useLeaveFamily,
  useMarkAccessProvided,
  useMarkPaymentNotReceived,
  useRecordOwnerPrepaidPeriods,
  useRemindAccessConfirmation,
  useRejectFamilyRequest,
  useReportPaymentPaid,
  useRotateFamilyInvite,
  useRemoveMember,
  useUpdateFamilyDescription,
  useUpdateFamilyPaymentDay,
  useUpdateFamilyPrice,
  useUpdateFamilyVisibility
} from "./useApi";
import {
  showTelegramConfirm,
  triggerTelegramNotification,
  triggerTelegramSelection
} from "../telegram";
import type {
  FamilyMember,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyRequest,
  OwnerFamilyDetails,
  PaymentRequisite
} from "../types";

export type MutationOutcome = "success" | "cancelled" | "error";
export type MutationConfirmation = () => Promise<boolean>;

export function useFamilyActionHandlers() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ownerDetails, setOwnerDetails] = useState<Record<string, OwnerFamilyDetails>>({});
  const [requisites, setRequisites] = useState<Record<string, PaymentRequisite>>({});

  const toastMessage = useCallback((label: string): string => {
    const messages: Record<string, string> = {
      "create-family": "Семья создана",
      "create-request": "Заявка отправлена",
      "cancel-request": "Заявка отменена",
      "approve-request": "Заявка принята",
      "reject-request": "Заявка отклонена",
      "close-family": "Семья закрывается",
      "leave-family": "Вы вышли из семьи",
      "remove-member": "Участник удалён",
      "confirm-access": "Доступ подтверждён",
      "confirm-payment": "Оплата подтверждена",
      "report-paid": "Оплата отмечена",
      "cancel-report": "Отметка отменена",
      "not-received": "Отмечено: не получено",
      "create-prepayment": "Предоплата создана",
      "record-prepayment": "Предоплата отмечена",
      "create-invite": "Приглашение создано",
      "rotate-invite": "Код обновлён",
      "disable-invite": "Приглашение отключено",
      "update-description": "Описание обновлено",
      "update-price": "Цена обновлена",
      "update-payment-day": "День оплаты обновлён",
      "update-visibility": "Видимость обновлена",
      "confirm-availability": "Доступность подтверждена",
      "ack-closing": "Закрытие подтверждено",
      "access-provided": "Доступ выдан",
      "remind-access": "Напоминание отправлено",
      "cancel-before-access": "Вступление отменено",
      "import-catalog": "Каталог импортирован",
      "refresh-profile": "Профиль обновлён",
      "get-requisite": "Реквизиты загружены",
      "owner-details": "Детали загружены"
    };
    return messages[label] ?? "Готово";
  }, []);

  const runMutation = useCallback(
    async (
      label: string,
      mutation: () => Promise<unknown>,
      confirm?: MutationConfirmation
    ): Promise<MutationOutcome> => {
      try {
        setBusy(label);
        if (confirm && !(await confirm())) {
          return "cancelled";
        }
        triggerTelegramSelection();
        setError(null);
        await mutation();
        triggerTelegramNotification("success");
        toast.success({ title: toastMessage(label) });
        return "success";
      } catch (err) {
        triggerTelegramNotification("error");
        setError(formatError(err));
        return "error";
      } finally {
        setBusy(null);
      }
    },
    [toast, toastMessage]
  );

  const loadOwnerDetails = useCallback(async (familyId: string) => {
    try {
      setBusy("owner-details");
      setError(null);
      const [requests, members, memberPayments] = await Promise.all([
        getOwnerFamilyRequests(familyId),
        getFamilyMembers(familyId),
        getFamilyMemberPayments(familyId)
      ]);
      setOwnerDetails((current) => ({
        ...current,
        [familyId]: {
          requests,
          members,
          paymentsByMemberId: Object.fromEntries(
            memberPayments.map((item) => [item.member_id, item.payments])
          )
        }
      }));
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(null);
    }
  }, []);

  const updateDescriptionMutation = useUpdateFamilyDescription();
  const updatePriceMutation = useUpdateFamilyPrice();
  const updatePaymentDayMutation = useUpdateFamilyPaymentDay();
  const updateVisibilityMutation = useUpdateFamilyVisibility();
  const closeFamilyMutation = useCloseFamily();
  const confirmAvailabilityMutation = useConfirmFamilyAvailability();
  const createInviteMutation = useCreateFamilyInvite();
  const rotateInviteMutation = useRotateFamilyInvite();
  const disableInviteMutation = useDisableFamilyInvite();
  const createRequestMutation = useCreateFamilyRequest();
  const cancelRequestMutation = useCancelFamilyRequest();
  const approveRequestMutation = useApproveFamilyRequest();
  const rejectRequestMutation = useRejectFamilyRequest();
  const markAccessMutation = useMarkAccessProvided();
  const remindAccessMutation = useRemindAccessConfirmation();
  const cancelBeforeAccessMutation = useCancelMemberBeforeAccess();
  const confirmAccessMutation = useConfirmAccessReceived();
  const removeMemberMutation = useRemoveMember();
  const ackClosingMutation = useAcknowledgeFamilyClosing();
  const createPrepaymentMutation = useCreateMemberPrepayment();
  const recordPrepaymentMutation = useRecordOwnerPrepaidPeriods();
  const reportPaymentMutation = useReportPaymentPaid();
  const cancelReportMutation = useCancelPaymentReport();
  const confirmPaymentMutation = useConfirmPaymentReceived();
  const notReceivedMutation = useMarkPaymentNotReceived();
  const getRequisiteMutation = useGetPaymentRequisite();
  const actualLeaveMutation = useLeaveFamily();

  const familyActionHandlers = {
    onLoadOwnerDetails: loadOwnerDetails,
    onUpdateDescription: (familyId: string, description: string | null) =>
      void runMutation("update-description", () =>
        updateDescriptionMutation.mutateAsync({ familyId, description })
      ),
    onUpdatePrice: (familyId: string, totalPriceKzt: number) =>
      void runMutation("update-price", () =>
        updatePriceMutation.mutateAsync({ familyId, totalPriceKzt })
      ),
    onUpdatePaymentDay: (familyId: string, paymentDay: number, nextPaymentDate: string) =>
      void runMutation("update-payment-day", () =>
        updatePaymentDayMutation.mutateAsync({ familyId, paymentDay, nextPaymentDate })
      ),
    onCloseFamily: (familyId: string, closesOn: string) =>
      void runMutation(
        "close-family",
        () => closeFamilyMutation.mutateAsync({ familyId, closesOn }),
        () => showTelegramConfirm("Закрыть семью? Доступ для участников закроется в выбранную дату.")
      ),
    onConfirmAvailability: (familyId: string) =>
      void runMutation("confirm-availability", () =>
        confirmAvailabilityMutation.mutateAsync(familyId)
      ),
    onConfirmAccess: (memberId: string) =>
      void runMutation("confirm-access", async () => {
        const result = await confirmAccessMutation.mutateAsync(memberId);
        setRequisites((current) => ({
          ...current,
          [memberId]: result.payment_requisite
        }));
      }),
    onGetRequisite: (memberId: string) =>
      void runMutation("get-requisite", async () => {
        const requisite = await getRequisiteMutation.mutateAsync(memberId);
        setRequisites((current) => ({
          ...current,
          [memberId]: requisite
        }));
      }),
    onAcknowledgeClosing: (familyId: string) =>
      void runMutation("ack-closing", () => ackClosingMutation.mutateAsync(familyId)),
    onLeaveFamily: (memberId: string) =>
      void runMutation(
        "leave-family",
        () => actualLeaveMutation.mutateAsync(memberId),
        () =>
          showTelegramConfirm(
            "Покинуть семью? Будущие платежи отменятся, место освободится."
          )
      ),
    onCreatePrepayment: (memberId: string) =>
      void runMutation("create-prepayment", () =>
        createPrepaymentMutation.mutateAsync(memberId)
      ),
    onReportPayment: (payment: FamilyPayment) =>
      runMutation("report-paid", () => reportPaymentMutation.mutateAsync(payment.id)),
    onCancelPaymentReport: (payment: FamilyPayment) =>
      runMutation("cancel-report", () => cancelReportMutation.mutateAsync(payment.id)),
    onApproveRequest: (familyId: string, request: FamilyRequest) =>
      runMutation("approve-request", () =>
        approveRequestMutation.mutateAsync({ familyId, requestId: request.id })
      ).then((outcome) =>
        outcome === "success" ? loadOwnerDetails(familyId) : undefined
      ),
    onRejectRequest: (familyId: string, request: FamilyRequest) =>
      runMutation("reject-request", () =>
        rejectRequestMutation.mutateAsync({ familyId, requestId: request.id })
      ).then((outcome) =>
        outcome === "success" ? loadOwnerDetails(familyId) : undefined
      ),
    onAccessProvided: (familyId: string, member: FamilyMember) =>
      runMutation("access-provided", () =>
        markAccessMutation.mutateAsync({ familyId, memberId: member.id })
      ).then((outcome) =>
        outcome === "success" ? loadOwnerDetails(familyId) : undefined
      ),
    onRemindAccess: (familyId: string, member: FamilyMember) =>
      runMutation("remind-access", () =>
        remindAccessMutation.mutateAsync({ familyId, memberId: member.id })
      ).then((outcome) =>
        outcome === "success" ? loadOwnerDetails(familyId) : undefined
      ),
    onCancelBeforeAccess: (familyId: string, member: FamilyMember) =>
      runMutation("cancel-before-access", () =>
        cancelBeforeAccessMutation.mutateAsync({ familyId, memberId: member.id })
      ).then((outcome) =>
        outcome === "success" ? loadOwnerDetails(familyId) : undefined
      ),
    onRemoveMember: (familyId: string, member: FamilyMember, reason: FamilyMemberRemovalReason) =>
      runMutation(
        "remove-member",
        () =>
          removeMemberMutation.mutateAsync({
            familyId,
            memberId: member.id,
            reason
          }),
        () =>
          showTelegramConfirm(
            `Удалить @${member.user.username} из семьи? Причина: ${reason}.`
          )
      ).then((outcome) =>
        outcome === "success" ? loadOwnerDetails(familyId) : undefined
      ),
    onConfirmPayment: (familyId: string, payment: FamilyPayment) =>
      runMutation("confirm-payment", () =>
        confirmPaymentMutation.mutateAsync({ familyId, paymentId: payment.id })
      ).then((outcome) =>
        outcome === "success" ? loadOwnerDetails(familyId) : undefined
      ),
    onNotReceived: (familyId: string, payment: FamilyPayment) =>
      runMutation("not-received", () =>
        notReceivedMutation.mutateAsync({ familyId, paymentId: payment.id })
      ).then((outcome) =>
        outcome === "success" ? loadOwnerDetails(familyId) : undefined
      ),
    onRecordPrepayment: (familyId: string, member: FamilyMember, periods: number) =>
      runMutation("record-prepayment", () =>
        recordPrepaymentMutation.mutateAsync({ familyId, memberId: member.id, periods })
      ).then((outcome) =>
        outcome === "success" ? loadOwnerDetails(familyId) : undefined
      ),
    onCancelRequest: (requestId: string) =>
      void runMutation("cancel-request", () => cancelRequestMutation.mutateAsync(requestId))
  };

  return {
    busy,
    setBusy,
    error,
    setError,
    ownerDetails,
    setOwnerDetails,
    requisites,
    setRequisites,
    runMutation,
    loadOwnerDetails,
    familyActionHandlers,
    mutations: {
      updateDescriptionMutation,
      updatePriceMutation,
      updatePaymentDayMutation,
      updateVisibilityMutation,
      closeFamilyMutation,
      confirmAvailabilityMutation,
      createInviteMutation,
      rotateInviteMutation,
      disableInviteMutation,
      createRequestMutation,
      cancelRequestMutation,
      approveRequestMutation,
      rejectRequestMutation,
      markAccessMutation,
      remindAccessMutation,
      cancelBeforeAccessMutation,
      confirmAccessMutation,
      removeMemberMutation,
      ackClosingMutation,
      createPrepaymentMutation,
      recordPrepaymentMutation,
      reportPaymentMutation,
      cancelReportMutation,
      confirmPaymentMutation,
      notReceivedMutation,
      getRequisiteMutation,
      actualLeaveMutation
    }
  };
}
