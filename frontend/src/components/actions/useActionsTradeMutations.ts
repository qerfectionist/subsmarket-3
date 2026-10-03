import { useState, type Dispatch, type SetStateAction } from "react";
import { useToast } from "../ui";
import {
  useAcceptMarketplaceRequest,
  useRejectMarketplaceRequest,
  useCancelMarketplaceRequest,
  useCloseMarketplaceRequest,
  useRemindMarketplaceRequest,
  useAcceptAccountRequest,
  useRejectAccountRequest,
  useCancelAccountRequest,
  useCloseAccountRequest,
  useRemindAccountRequest,
  useCreateFamilyRequest,
  useCreateMarketplaceRequest,
  useCreateAccountRequest
} from "../../hooks/useApi";
import {
  triggerTelegramImpact,
  triggerTelegramNotification,
  showTelegramConfirm
} from "../../telegram";
import type { DevTestCardsState } from "./useActionsDevCards";
import type { ActionsArchiveItem } from "../families";
import type { ActionsTab } from "./ActionsScopePager";
import type { OwnerFamilyRequest, FamilyRequest } from "../../types";
import {
  createRandomDevBuyerFamilyRequest,
  createRandomDevAccountRequest,
  createRandomDevGbRequest
} from "../../utils/devTestCards";

export interface UseActionsTradeMutationsOptions {
  devCards: DevTestCardsState;
  setDevCards: Dispatch<SetStateAction<DevTestCardsState>>;
  onCancelRequest?: (requestId: string) => void;
  onApproveRequest: (familyId: string, request: any) => Promise<unknown>;
  onRejectRequest: (familyId: string, request: any) => Promise<unknown>;
  setIsArchiveOpen: (open: boolean) => void;
  setActionsTab: (tab: ActionsTab) => void;
}

export function useActionsTradeMutations({
  setDevCards,
  onCancelRequest,
  onApproveRequest,
  onRejectRequest,
  setIsArchiveOpen,
  setActionsTab
}: UseActionsTradeMutationsOptions) {
  const { toast } = useToast();
  const [tradeBusyId, setTradeBusyId] = useState<string | null>(null);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(() => new Set());
  const [isArchivePulsing, setIsArchivePulsing] = useState(false);
  const [reapplyingId, setReapplyingId] = useState<string | null>(null);

  const acceptMarketplaceRequest = useAcceptMarketplaceRequest();
  const rejectMarketplaceRequest = useRejectMarketplaceRequest();
  const cancelMarketplaceRequest = useCancelMarketplaceRequest();
  const closeMarketplaceRequest = useCloseMarketplaceRequest();
  const remindMarketplaceRequest = useRemindMarketplaceRequest();

  const acceptAccountRequest = useAcceptAccountRequest();
  const rejectAccountRequest = useRejectAccountRequest();
  const cancelAccountRequest = useCancelAccountRequest();
  const closeAccountRequest = useCloseAccountRequest();
  const remindAccountRequest = useRemindAccountRequest();

  const createFamilyRequestMutation = useCreateFamilyRequest();
  const createMarketplaceRequestMutation = useCreateMarketplaceRequest();
  const createAccountRequestMutation = useCreateAccountRequest();

  async function handleAcceptGbRequest(id: string) {
    if (id.startsWith("test-")) {
      setTradeBusyId(id);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setDevCards((prev) => ({
        ...prev,
        sellerGb: prev.sellerGb.map((r) => (r.id === id ? { ...r, status: "accepted" as const } : r)),
        buyerGb: prev.buyerGb.map((r) => (r.id === id ? { ...r, status: "accepted" as const } : r))
      }));
      setTradeBusyId(null);
      triggerTelegramImpact("light");
      toast.success({ title: "Заявка принята" });
      return;
    }
    try {
      setTradeBusyId(id);
      await acceptMarketplaceRequest.mutateAsync(id);
      toast.success({ title: "Заявка принята" });
    } catch {
      toast.error({ title: "Не удалось принять заявку" });
    } finally {
      setTradeBusyId(null);
    }
  }

  async function handleRejectGbRequest(id: string) {
    if (id.startsWith("test-")) {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("light");
      await new Promise((resolve) => setTimeout(resolve, 450));
      setDevCards((prev) => ({
        ...prev,
        sellerGb: prev.sellerGb.filter((r) => r.id !== id),
        buyerGb: prev.buyerGb.filter((r) => r.id !== id)
      }));
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
      toast.success({ title: "Заявка отклонена" });
      return;
    }
    try {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("light");
      await Promise.all([
        rejectMarketplaceRequest.mutateAsync({ id }),
        new Promise((resolve) => setTimeout(resolve, 450))
      ]);
      toast.success({ title: "Заявка отклонена" });
    } catch {
      toast.error({ title: "Не удалось отклонить заявку" });
    } finally {
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
    }
  }

  async function handleCloseGbRequest(id: string, outcome: "sold" | "not_sold") {
    const confirmMessage =
      outcome === "sold"
        ? "Завершить сделку? Покупатель оплатил и получил товар."
        : "Отменить сделку как несостоявшуюся? Заявка будет закрыта.";
    const confirmed = await showTelegramConfirm(confirmMessage);
    if (!confirmed) return;

    if (id.startsWith("test-")) {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("light");
      await new Promise((resolve) => setTimeout(resolve, 450));
      setDevCards((prev) => ({
        ...prev,
        sellerGb: prev.sellerGb.filter((r) => r.id !== id),
        buyerGb: prev.buyerGb.filter((r) => r.id !== id)
      }));
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
      toast.success({ title: outcome === "sold" ? "Сделка завершена" : "Заявка закрыта" });
      return;
    }
    try {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("light");
      await Promise.all([
        closeMarketplaceRequest.mutateAsync({ id, outcome }),
        new Promise((resolve) => setTimeout(resolve, 450))
      ]);
      toast.success({ title: outcome === "sold" ? "Сделка завершена" : "Заявка закрыта" });
    } catch {
      toast.error({ title: "Не удалось закрыть сделку" });
    } finally {
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
    }
  }

  async function handleCancelGbRequest(id: string) {
    if (id.startsWith("test-")) {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("medium");
      await new Promise((resolve) => setTimeout(resolve, 450));
      setDevCards((prev) => ({
        ...prev,
        sellerGb: prev.sellerGb.filter((r) => r.id !== id),
        buyerGb: prev.buyerGb.filter((r) => r.id !== id)
      }));
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
      toast.success({ title: "Заявка отменена и перемещена в архив" });
      return;
    }
    try {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("medium");
      await Promise.all([
        cancelMarketplaceRequest.mutateAsync({ id }),
        new Promise((resolve) => setTimeout(resolve, 450))
      ]);
      toast.success({ title: "Заявка отменена и перемещена в архив" });
    } catch {
      toast.error({ title: "Не удалось отменить заявку" });
    } finally {
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
    }
  }

  async function handleRemindGbRequest(id: string) {
    try {
      setTradeBusyId(id);
      await remindMarketplaceRequest.mutateAsync(id);
      toast.success({ title: "Напоминание отправлено" });
    } catch {
      toast.error({ title: "Не удалось отправить напоминание" });
    } finally {
      setTradeBusyId(null);
    }
  }

  async function handleAcceptAccountRequest(id: string) {
    if (id.startsWith("test-")) {
      setTradeBusyId(id);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setDevCards((prev) => ({
        ...prev,
        sellerAccounts: prev.sellerAccounts.map((r) => (r.id === id ? { ...r, status: "accepted" as const } : r)),
        buyerAccounts: prev.buyerAccounts.map((r) => (r.id === id ? { ...r, status: "accepted" as const } : r))
      }));
      setTradeBusyId(null);
      triggerTelegramImpact("light");
      toast.success({ title: "Запрос принят" });
      return;
    }
    try {
      setTradeBusyId(id);
      await acceptAccountRequest.mutateAsync(id);
      toast.success({ title: "Запрос принят" });
    } catch {
      toast.error({ title: "Не удалось принять запрос" });
    } finally {
      setTradeBusyId(null);
    }
  }

  async function handleRejectAccountRequest(id: string) {
    if (id.startsWith("test-")) {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("light");
      await new Promise((resolve) => setTimeout(resolve, 450));
      setDevCards((prev) => ({
        ...prev,
        sellerAccounts: prev.sellerAccounts.filter((r) => r.id !== id),
        buyerAccounts: prev.buyerAccounts.filter((r) => r.id !== id)
      }));
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
      toast.success({ title: "Запрос отклонён" });
      return;
    }
    try {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("light");
      await Promise.all([
        rejectAccountRequest.mutateAsync({ id }),
        new Promise((resolve) => setTimeout(resolve, 450))
      ]);
      toast.success({ title: "Запрос отклонён" });
    } catch {
      toast.error({ title: "Не удалось отклонить запрос" });
    } finally {
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
    }
  }

  async function handleCloseAccountRequest(id: string, outcome: "sold" | "not_sold") {
    const confirmMessage =
      outcome === "sold"
        ? "Завершить сделку? Покупатель оплатил и получил аккаунт."
        : "Отменить сделку как несостоявшуюся? Заявка будет закрыта.";
    const confirmed = await showTelegramConfirm(confirmMessage);
    if (!confirmed) return;

    if (id.startsWith("test-")) {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("light");
      await new Promise((resolve) => setTimeout(resolve, 450));
      setDevCards((prev) => ({
        ...prev,
        sellerAccounts: prev.sellerAccounts.filter((r) => r.id !== id),
        buyerAccounts: prev.buyerAccounts.filter((r) => r.id !== id)
      }));
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
      toast.success({ title: outcome === "sold" ? "Контакт завершён" : "Контакт закрыт" });
      return;
    }
    try {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("light");
      await Promise.all([
        closeAccountRequest.mutateAsync({ id, outcome }),
        new Promise((resolve) => setTimeout(resolve, 450))
      ]);
      toast.success({ title: outcome === "sold" ? "Контакт завершён" : "Контакт закрыт" });
    } catch {
      toast.error({ title: "Не удалось закрыть контакт" });
    } finally {
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
    }
  }

  async function handleCancelAccountRequest(id: string) {
    if (id.startsWith("test-")) {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("medium");
      await new Promise((resolve) => setTimeout(resolve, 450));
      setDevCards((prev) => ({
        ...prev,
        sellerAccounts: prev.sellerAccounts.filter((r) => r.id !== id),
        buyerAccounts: prev.buyerAccounts.filter((r) => r.id !== id)
      }));
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
      toast.success({ title: "Запрос отменён и перемещён в архив" });
      return;
    }
    try {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("medium");
      await Promise.all([
        cancelAccountRequest.mutateAsync({ id }),
        new Promise((resolve) => setTimeout(resolve, 450))
      ]);
      toast.success({ title: "Запрос отменён и перемещён в архив" });
    } catch {
      toast.error({ title: "Не удалось отменить запрос" });
    } finally {
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
    }
  }

  async function handleRemindAccountRequest(id: string) {
    try {
      setTradeBusyId(id);
      await remindAccountRequest.mutateAsync(id);
      toast.success({ title: "Напоминание отправлено" });
    } catch {
      toast.error({ title: "Не удалось отправить напоминание" });
    } finally {
      setTradeBusyId(null);
    }
  }

  async function handleCancelFamilyRequest(id: string) {
    if (id.startsWith("test-")) {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("medium");
      await new Promise((resolve) => setTimeout(resolve, 450));
      setDevCards((prev) => ({
        ...prev,
        buyerFamilies: prev.buyerFamilies.filter((r) => r.id !== id)
      }));
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
      toast.success({ title: "Заявка отменена и перемещена в архив" });
      return;
    }
    if (!onCancelRequest) return;
    try {
      setTradeBusyId(id);
      setCancellingIds((prev) => new Set(prev).add(id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("medium");
      await Promise.all([
        Promise.resolve(onCancelRequest(id)),
        new Promise((resolve) => setTimeout(resolve, 450))
      ]);
    } finally {
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
    }
  }

  async function handleApproveCandidateRequest(familyId: string, request: OwnerFamilyRequest) {
    if (request.id.startsWith("test-")) {
      setTradeBusyId(request.id);
      setCancellingIds((prev) => new Set(prev).add(request.id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("light");
      await new Promise((resolve) => setTimeout(resolve, 450));
      setDevCards((prev) => ({
        ...prev,
        candidates: prev.candidates.filter((c) => c.request.id !== request.id)
      }));
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(request.id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
      toast.success({ title: "Заявка принята" });
      return;
    }
    try {
      setTradeBusyId(request.id);
      setCancellingIds((prev) => new Set(prev).add(request.id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("light");
      await Promise.all([
        onApproveRequest(familyId, request),
        new Promise((resolve) => setTimeout(resolve, 450))
      ]);
      toast.success({ title: "Заявка принята" });
    } catch {
      toast.error({ title: "Не удалось принять заявку" });
    } finally {
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(request.id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
    }
  }

  async function handleRejectCandidateRequest(familyId: string, request: OwnerFamilyRequest) {
    if (request.id.startsWith("test-")) {
      setTradeBusyId(request.id);
      setCancellingIds((prev) => new Set(prev).add(request.id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("light");
      await new Promise((resolve) => setTimeout(resolve, 450));
      setDevCards((prev) => ({
        ...prev,
        candidates: prev.candidates.filter((c) => c.request.id !== request.id)
      }));
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(request.id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
      toast.success({ title: "Заявка отклонена" });
      return;
    }
    try {
      setTradeBusyId(request.id);
      setCancellingIds((prev) => new Set(prev).add(request.id));
      setIsArchivePulsing(true);
      triggerTelegramImpact("light");
      await Promise.all([
        onRejectRequest(familyId, request),
        new Promise((resolve) => setTimeout(resolve, 450))
      ]);
      toast.success({ title: "Заявка отклонена" });
    } catch {
      toast.error({ title: "Не удалось отклонить заявку" });
    } finally {
      setTradeBusyId(null);
      setTimeout(() => {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(request.id);
          return next;
        });
        setIsArchivePulsing(false);
      }, 500);
    }
  }

  async function handleReapply(item: ActionsArchiveItem) {
    if (reapplyingId) return;
    setReapplyingId(item.id);
    triggerTelegramImpact("medium");

    try {
      if (item.id.startsWith("test-") || item.originalId?.startsWith("test-") || (!item.familyId && !item.listingId)) {
        if (item.category === "families") {
          const itemReq = createRandomDevBuyerFamilyRequest();
          if (item.serviceName) itemReq.service_name = item.serviceName;
          setDevCards((prev) => ({ ...prev, buyerFamilies: [itemReq, ...prev.buyerFamilies] }));
        } else if (item.category === "accounts") {
          const itemReq = createRandomDevAccountRequest("buyer");
          if (item.serviceName) itemReq.service_name = item.serviceName;
          setDevCards((prev) => ({ ...prev, buyerAccounts: [itemReq, ...prev.buyerAccounts] }));
        } else if (item.category === "gigabytes") {
          const itemReq = createRandomDevGbRequest("buyer");
          if (item.serviceName) itemReq.operator_name = item.serviceName;
          setDevCards((prev) => ({ ...prev, buyerGb: [itemReq, ...prev.buyerGb] }));
        }
        setIsArchiveOpen(false);
        setActionsTab("outbox");
        triggerTelegramNotification("success");
        toast.success({ title: "Заявка отправлена повторно" });
        return;
      }

      if (item.category === "families" && item.familyId) {
        await createFamilyRequestMutation.mutateAsync(item.familyId);
      } else if (item.category === "gigabytes" && item.listingId) {
        await createMarketplaceRequestMutation.mutateAsync({
          listingId: item.listingId,
          amountGb: item.amountGb || "1"
        });
      } else if (item.category === "accounts" && item.listingId) {
        await createAccountRequestMutation.mutateAsync(item.listingId);
      }

      setIsArchiveOpen(false);
      setActionsTab("outbox");
      triggerTelegramNotification("success");
      toast.success({ title: "Заявка отправлена повторно" });
    } catch (err: any) {
      triggerTelegramNotification("warning");
      const rawDetail = err?.response?.data?.detail || err?.detail || err?.message || "";
      const msg = typeof rawDetail === "string" ? rawDetail : "";
      if (msg.includes("ALREADY_PENDING")) {
        toast.error({ title: "Заявка уже на рассмотрении" });
      } else if (msg.includes("NOT_JOINABLE") || msg.includes("FULL")) {
        toast.error({ title: "В семье сейчас нет свободных мест" });
      } else {
        toast.error({ title: "Не удалось отправить заявку повторно" });
      }
    } finally {
      setReapplyingId(null);
    }
  }

  return {
    tradeBusyId,
    cancellingIds,
    isArchivePulsing,
    reapplyingId,
    handleAcceptGbRequest,
    handleRejectGbRequest,
    handleCloseGbRequest,
    handleCancelGbRequest,
    handleRemindGbRequest,
    handleAcceptAccountRequest,
    handleRejectAccountRequest,
    handleCloseAccountRequest,
    handleCancelAccountRequest,
    handleRemindAccountRequest,
    handleCancelFamilyRequest,
    handleApproveCandidateRequest,
    handleRejectCandidateRequest,
    handleReapply
  };
}
