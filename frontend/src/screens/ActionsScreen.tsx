import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { Button as AppButton, useToast } from "../components/ui";
import {
  FamilyCard,
  OwnerDetails,
  PaymentList,
  OwnerActions,
  MemberActions,
  MemberNextStep,
  OwnerWorkSummary,
  hasPendingFamilyAction,
  MyRequestsSection,
  ActionsArchiveCalendar,
  type ActionsArchiveItem
} from "../components/families";
import { ServiceLogo } from "../components/branding";
import { FamilyListingCard } from "../components/ListingCard";
import {
  AccountTradeRequestCard,
  GigabytesTradeRequestCard,
  FamilyCandidateRequestCard,
  formatTradeGb
} from "../components/TradeRequestCard";
import { SystemSymbol, type SystemSymbolName } from "../components/SystemSymbol";
import { Badge, EmptyState, Panel } from "../components/layout";
import { RequisiteBox } from "../components/RequisiteBox";
import { FamilyListSkeleton } from "../components/skeleton";
import {
  useAcceptAccountRequest,
  useAcceptMarketplaceRequest,
  useAccountRequests,
  useCancelAccountRequest,
  useCancelMarketplaceRequest,
  useCloseAccountRequest,
  useCloseMarketplaceRequest,
  useMarketplaceRequests,
  useRejectAccountRequest,
  useRejectMarketplaceRequest,
  useRemindAccountRequest,
  useRemindMarketplaceRequest,
  useCreateFamilyRequest,
  useCreateMarketplaceRequest,
  useCreateAccountRequest
} from "../hooks/useApi";
import { formatDate, formatDateTime, formatAccountTitle, familyTitle, memberCardStatus, statusText } from "../format";
import { triggerTelegramSelection, triggerTelegramImpact, triggerTelegramNotification, openTelegramUser } from "../telegram";
import { useFeedSnap } from "../hooks/useFeedSnap";
import type {
  Family,
  FamilyMember,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyRequest,
  MyFamily,
  OwnerFamilyDetails,
  OwnerFamilyRequest,
  PaymentRequisite,
  MarketplaceListingRequest,
  AccountRequest
} from "../types";
import {
  createRandomDevCandidate,
  createRandomDevAccountRequest,
  createRandomDevGbRequest,
  createRandomDevBuyerFamilyRequest
} from "../utils/devTestCards";

const DEV_TEST_CARDS_STORAGE_KEY = "sm_dev_test_cards_v1";

interface DevTestCardsState {
  candidates: Array<{ family: Family; request: OwnerFamilyRequest }>;
  sellerAccounts: AccountRequest[];
  buyerAccounts: AccountRequest[];
  sellerGb: MarketplaceListingRequest[];
  buyerGb: MarketplaceListingRequest[];
  buyerFamilies: FamilyRequest[];
}


export type ActionsCategoryFilter = "all" | "families" | "accounts" | "gigabytes";

export const actionsCategoryFilterOptions: readonly {
  value: ActionsCategoryFilter;
  label: string;
  icon: SystemSymbolName;
}[] = [
  { value: "all", label: "Все", icon: "sort" },
  { value: "families", label: "Подписки", icon: "person.2" },
  { value: "accounts", label: "Аккаунты", icon: "person.crop.circle" },
  { value: "gigabytes", label: "Гигабайты", icon: "globe" }
];

export type ActionsStatusFilter = "all" | "pending" | "settled";

export const actionsStatusFilterOptions: readonly {
  value: ActionsStatusFilter;
  label: string;
  icon: SystemSymbolName;
}[] = [
  { value: "all", label: "Все", icon: "sort" },
  { value: "pending", label: "Ожидают", icon: "clock" },
  { value: "settled", label: "Завершенные", icon: "checkmark" }
];

export function isTradeRequestStatusMatch(status: string, filter: ActionsStatusFilter) {
  const isActive = ["pending", "accepted"].includes(status);
  if (filter === "all") return isActive;
  return filter === "pending" ? isActive : !isActive;
}

export function isFamilyRequestStatusMatch(status: string, filter: ActionsStatusFilter) {
  const isActive = ["pending", "approved"].includes(status);
  if (filter === "all") return isActive;
  return filter === "pending" ? isActive : !isActive;
}

export function isFamilyActionStatusMatch(filter: ActionsStatusFilter) {
  if (filter === "all") return true;
  return filter === "pending";
}

export function getOrderNumber(id: string): string {
  const digits = id.replace(/\D/g, "");
  if (digits.length >= 3) {
    return `#SM-${digits.slice(-4)}`;
  }
  const clean = id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
  return `#SM-${clean || "8401"}`;
}

export function formatArchiveAccountTitle(serviceName: string, title?: string | null): string {
  return formatAccountTitle(serviceName, title);
}

export function getArchiveDateHeader(dateStr?: string): string {
  if (!dateStr) return "Ранее";
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (dateStr.startsWith(todayStr)) return "Сегодня";
  if (dateStr.startsWith(yesterdayStr)) return "Вчера";

  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    }
  } catch {
    // fallback
  }
  return "Ранее";
}

export function formatArchiveCardDate(rawDate?: string, fallback?: string): string {
  if (!rawDate) return fallback || "";
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return fallback || "";
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayISO = yesterday.toISOString().slice(0, 10);

    const hasTime = rawDate.includes("T") || rawDate.includes(":");
    const timeStr = hasTime
      ? new Intl.DateTimeFormat("ru-KZ", { hour: "2-digit", minute: "2-digit" }).format(d)
      : "";
    const timeSuffix = timeStr ? `, ${timeStr}` : "";

    if (rawDate.startsWith(todayISO)) {
      return `Сегодня${timeSuffix}`;
    }
    if (rawDate.startsWith(yesterdayISO)) {
      return `Вчера${timeSuffix}`;
    }

    const isCurrentYear = d.getFullYear() === now.getFullYear();
    const dateFormatted = new Intl.DateTimeFormat("ru-KZ", {
      day: "numeric",
      month: "short",
      ...(isCurrentYear ? {} : { year: "numeric" })
    }).format(d).replace(/\s*г\./, "");

    return `${dateFormatted}${timeSuffix}`;
  } catch {
    return fallback || "";
  }
}


export function ActionsCategoryChip({
  value,
  onChange
}: {
  value: ActionsCategoryFilter;
  onChange: (value: ActionsCategoryFilter) => void;
}) {
  const activeOption =
    actionsCategoryFilterOptions.find((option) => option.value === value) ??
    actionsCategoryFilterOptions[0];
  const activeIndex = actionsCategoryFilterOptions.findIndex(
    (option) => option.value === activeOption.value
  );

  return (
    <button
      type="button"
      className={`sm-market-filter-chip${value !== "all" ? " is-active" : ""}`}
      aria-pressed={value !== "all"}
      aria-label={`Категория заявок: ${activeOption.label}. Нажмите для переключения`}
      data-testid="actions-category-filter-chip"
      onClick={() =>
        onChange(
          actionsCategoryFilterOptions[
            (activeIndex + 1) % actionsCategoryFilterOptions.length
          ].value
        )
      }
    >
      <SystemSymbol name={activeOption.icon} size={14} />
      <span data-testid="actions-category-filter-label">{activeOption.label}</span>
    </button>
  );
}

export function ActionsStatusChip({
  value,
  onChange
}: {
  value: ActionsStatusFilter;
  onChange: (value: ActionsStatusFilter) => void;
}) {
  const activeOption =
    actionsStatusFilterOptions.find((option) => option.value === value) ??
    actionsStatusFilterOptions[0];
  const activeIndex = actionsStatusFilterOptions.findIndex(
    (option) => option.value === activeOption.value
  );

  return (
    <div className="my-family-filter-actions">
      <button
        type="button"
        className={`sm-market-filter-chip${value !== "all" ? " is-active" : ""}`}
        aria-pressed={value !== "all"}
        aria-label={`Статус действий: ${activeOption.label}. Нажмите для переключения`}
        data-testid="actions-status-filter-chip"
        onClick={() =>
          onChange(
            actionsStatusFilterOptions[
              (activeIndex + 1) % actionsStatusFilterOptions.length
            ].value
          )
        }
      >
        <SystemSymbol name={activeOption.icon} size={14} />
        <span data-testid="actions-status-filter-label">{activeOption.label}</span>
      </button>
    </div>
  );
}

export type ActionsArchiveFilter = "all" | "successful" | "cancelled";

export const actionsArchiveFilterOptions: readonly {
  value: ActionsArchiveFilter;
  label: string;
  icon: SystemSymbolName;
}[] = [
  { value: "all", label: "Все", icon: "archive" },
  { value: "successful", label: "Успешные", icon: "checkmark" },
  { value: "cancelled", label: "Отклонённые", icon: "xmark" }
];

export function ActionsArchiveFilterChip({
  value,
  onChange
}: {
  value: ActionsArchiveFilter;
  onChange: (value: ActionsArchiveFilter) => void;
}) {
  const activeOption =
    actionsArchiveFilterOptions.find((option) => option.value === value) ??
    actionsArchiveFilterOptions[0];
  const activeIndex = actionsArchiveFilterOptions.findIndex(
    (option) => option.value === activeOption.value
  );

  return (
    <div className="my-family-filter-actions">
      <button
        type="button"
        className={`sm-market-filter-chip${value !== "all" ? " is-active" : ""}`}
        aria-pressed={value !== "all"}
        aria-label={`Статус архива: ${activeOption.label}. Нажмите для переключения`}
        data-testid="actions-archive-filter-chip"
        onClick={() => {
          triggerTelegramSelection();
          onChange(
            actionsArchiveFilterOptions[
              (activeIndex + 1) % actionsArchiveFilterOptions.length
            ].value
          );
        }}
      >
        <SystemSymbol name={activeOption.icon} size={14} />
        <span data-testid="actions-archive-filter-label">{activeOption.label}</span>
      </button>
    </div>
  );
}

export type ActionsScreenProps = {
  initialActionsTab?: "inbox" | "outbox";
  families: MyFamily[];
  ownerDetails: Record<string, OwnerFamilyDetails>;
  requisites: Record<string, PaymentRequisite>;
  requests: FamilyRequest[];
  busy: string | null;
  isLoading?: boolean;
  requestsLoading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  hasMoreRequests?: boolean;
  isLoadingMoreRequests?: boolean;
  onLoadMoreRequests?: () => void;
  onOpenFamily: (familyId: string) => void;
  onLoadOwnerDetails: (familyId: string) => void;
  onUpdateDescription: (familyId: string, description: string | null) => void;
  onUpdatePrice: (familyId: string, totalPriceKzt: number) => void;
  onUpdatePaymentDay: (
    familyId: string,
    paymentDay: number,
    nextPaymentDate: string
  ) => void;
  onCloseFamily: (familyId: string, closesOn: string) => void;
  onConfirmAvailability: (familyId: string) => void;
  onConfirmAccess: (memberId: string) => void;
  onGetRequisite: (memberId: string) => void;
  onAcknowledgeClosing: (familyId: string) => void;
  onLeaveFamily: (memberId: string) => void;
  onCreatePrepayment: (memberId: string) => void;
  onReportPayment: (payment: FamilyPayment) => Promise<unknown>;
  onCancelPaymentReport: (payment: FamilyPayment) => Promise<unknown>;
  onApproveRequest: (familyId: string, request: FamilyRequest) => Promise<unknown>;
  onRejectRequest: (familyId: string, request: FamilyRequest) => Promise<unknown>;
  onAccessProvided: (familyId: string, member: FamilyMember) => Promise<unknown>;
  onRemindAccess: (familyId: string, member: FamilyMember) => Promise<unknown>;
  onCancelBeforeAccess: (familyId: string, member: FamilyMember) => Promise<unknown>;
  onRemoveMember: (
    familyId: string,
    member: FamilyMember,
    reason: FamilyMemberRemovalReason
  ) => Promise<unknown>;
  onConfirmPayment: (familyId: string, payment: FamilyPayment) => Promise<unknown>;
  onNotReceived: (familyId: string, payment: FamilyPayment) => Promise<unknown>;
  onRecordPrepayment: (
    familyId: string,
    member: FamilyMember,
    periods: number
  ) => Promise<unknown>;
  onCancelRequest: (requestId: string) => void;
  marketplaceSalesActionCount?: number;
  marketplacePurchaseActionCount?: number;
  accountSalesActionCount?: number;
  accountPurchaseActionCount?: number;
  onOpenMarketplaceSalesActions?: () => void;
  onOpenMarketplacePurchaseActions?: () => void;
  onOpenAccountSalesActions?: () => void;
  onOpenAccountPurchaseActions?: () => void;
};

export const actionsTabOrder = ["inbox", "outbox"] as const;
export type ActionsTab = (typeof actionsTabOrder)[number];

export function ActionsScreen({
  initialActionsTab,
  families,
  ownerDetails,
  requisites,
  requests,
  busy,
  isLoading,
  requestsLoading,
  loadError,
  onRetry,
  hasMoreRequests,
  isLoadingMoreRequests,
  onLoadMoreRequests,
  onOpenFamily,
  onLoadOwnerDetails,
  onUpdateDescription,
  onUpdatePrice,
  onUpdatePaymentDay,
  onCloseFamily,
  onConfirmAvailability,
  onConfirmAccess,
  onGetRequisite,
  onAcknowledgeClosing,
  onLeaveFamily,
  onCreatePrepayment,
  onReportPayment,
  onCancelPaymentReport,
  onApproveRequest,
  onRejectRequest,
  onAccessProvided,
  onRemindAccess,
  onCancelBeforeAccess,
  onRemoveMember,
  onConfirmPayment,
  onNotReceived,
  onRecordPrepayment,
  onCancelRequest,
  marketplaceSalesActionCount = 0,
  marketplacePurchaseActionCount = 0,
  accountSalesActionCount = 0,
  accountPurchaseActionCount = 0,
  onOpenMarketplaceSalesActions,
  onOpenMarketplacePurchaseActions,
  onOpenAccountSalesActions,
  onOpenAccountPurchaseActions
}: ActionsScreenProps) {
  const actionFamilies = families.filter(hasPendingFamilyAction);
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);
  const { toast } = useToast();
  const [tradeBusyId, setTradeBusyId] = useState<string | null>(null);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(() => new Set());
  const [isArchivePulsing, setIsArchivePulsing] = useState(false);

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
  const [reapplyingId, setReapplyingId] = useState<string | null>(null);

  const sellerGbRequestsQuery = useMarketplaceRequests("seller", true);
  const buyerGbRequestsQuery = useMarketplaceRequests("buyer", true);
  const sellerAccountRequestsQuery = useAccountRequests("seller", true);
  const buyerAccountRequestsQuery = useAccountRequests("buyer", true);

  const [isConstructorOpen, setIsConstructorOpen] = useState(false);
  const [devCards, setDevCards] = useState<DevTestCardsState>(() => {
    if (typeof window === "undefined") {
      return { candidates: [], sellerAccounts: [], buyerAccounts: [], sellerGb: [], buyerGb: [], buyerFamilies: [] };
    }
    try {
      const raw = localStorage.getItem(DEV_TEST_CARDS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return { candidates: [], sellerAccounts: [], buyerAccounts: [], sellerGb: [], buyerGb: [], buyerFamilies: [] };
  });

  useEffect(() => {
    try {
      localStorage.setItem(DEV_TEST_CARDS_STORAGE_KEY, JSON.stringify(devCards));
    } catch {
      // ignore
    }
  }, [devCards]);

  const [timerPrototype, setTimerPrototype] = useState<1 | 2 | 3 | 4>(() => {
    if (typeof window === "undefined") return 1;
    try {
      const saved = localStorage.getItem("sm_timer_proto");
      if (saved && ["1", "2", "3", "4"].includes(saved)) {
        return Number(saved) as 1 | 2 | 3 | 4;
      }
    } catch {
      // ignore
    }
    return 1;
  });

  const handleSelectTimerPrototype = (proto: 1 | 2 | 3 | 4) => {
    setTimerPrototype(proto);
    try {
      localStorage.setItem("sm_timer_proto", String(proto));
    } catch {
      // ignore
    }
    triggerTelegramSelection();
  };

  const devCardsTotalCount =
    devCards.candidates.length +
    devCards.sellerAccounts.length +
    devCards.buyerAccounts.length +
    devCards.sellerGb.length +
    devCards.buyerGb.length +
    devCards.buyerFamilies.length;

  const sellerGbRequests = sellerGbRequestsQuery.data ?? [];
  const buyerGbRequests = buyerGbRequestsQuery.data ?? [];
  const sellerAccountRequests = sellerAccountRequestsQuery.data ?? [];
  const buyerAccountRequests = buyerAccountRequestsQuery.data ?? [];

  const allSellerGbRequests = useMemo(
    () => [...devCards.sellerGb, ...sellerGbRequests],
    [devCards.sellerGb, sellerGbRequests]
  );
  const allBuyerGbRequests = useMemo(
    () => [...devCards.buyerGb, ...buyerGbRequests],
    [devCards.buyerGb, buyerGbRequests]
  );
  const allSellerAccountRequests = useMemo(
    () => [...devCards.sellerAccounts, ...sellerAccountRequests],
    [devCards.sellerAccounts, sellerAccountRequests]
  );
  const allBuyerAccountRequests = useMemo(
    () => [...devCards.buyerAccounts, ...buyerAccountRequests],
    [devCards.buyerAccounts, buyerAccountRequests]
  );
  const allBuyerFamilyRequests = useMemo(
    () => [...devCards.buyerFamilies, ...requests],
    [devCards.buyerFamilies, requests]
  );

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

  const loadingOwnerDetailsRef = useRef(new Set<string>());
  useEffect(() => {
    if (!onLoadOwnerDetails) return;
    families.forEach((item) => {
      if (
        item.membership.role === "owner" &&
        item.pending_requests_count > 0 &&
        !ownerDetails[item.family.id] &&
        !loadingOwnerDetailsRef.current.has(item.family.id)
      ) {
        loadingOwnerDetailsRef.current.add(item.family.id);
        Promise.resolve(onLoadOwnerDetails(item.family.id)).finally(() => {
          loadingOwnerDetailsRef.current.delete(item.family.id);
        });
      }
    });
  }, [families, ownerDetails, onLoadOwnerDetails]);

  const ownerCandidateRequests = useMemo(() => {
    const list: Array<{
      family: Family;
      request: OwnerFamilyRequest;
    }> = [];

    for (const item of families) {
      if (item.membership.role !== "owner") continue;
      const details = ownerDetails[item.family.id];
      if (details?.requests) {
        for (const req of details.requests) {
          if (req.status === "pending" || cancellingIds.has(req.id)) {
            list.push({
              family: item.family,
              request: req
            });
          }
        }
      }
    }
    return list;
  }, [families, ownerDetails, cancellingIds]);

  const combinedOwnerCandidateRequests = useMemo(() => {
    return [...devCards.candidates, ...ownerCandidateRequests];
  }, [devCards.candidates, ownerCandidateRequests]);

  const pendingRequestCount = requests.filter((request) => request.status === "pending").length;
  const ownerRequestCount = families.reduce(
    (total, item) => total + (item.membership.role === "owner" ? item.pending_requests_count : 0),
    0
  );

  const ownerReportedPaymentsCount = families.reduce(
    (total, item) =>
      total +
      (item.membership.role === "owner"
        ? item.payments.filter((payment) => payment.status === "payment_reported").length
        : 0),
    0
  );

  const ownerCandidateTotalCount = Math.max(
    combinedOwnerCandidateRequests.filter((r) => !cancellingIds.has(r.request.id)).length,
    ownerRequestCount
  );

  const memberActionFamilies = useMemo(
    () => actionFamilies.filter((item) => item.membership.role !== "owner"),
    [actionFamilies]
  );

  const inboxTotalCount =
    allSellerGbRequests.filter((r) => ["pending", "accepted"].includes(r.status)).length +
    allSellerAccountRequests.filter((r) => ["pending", "accepted"].includes(r.status)).length +
    ownerCandidateTotalCount;
  const outboxTotalCount =
    allBuyerGbRequests.filter((r) => ["pending", "accepted"].includes(r.status)).length +
    allBuyerAccountRequests.filter((r) => ["pending", "accepted"].includes(r.status)).length +
    allBuyerFamilyRequests.filter((r) => ["pending", "approved"].includes(r.status)).length +
    memberActionFamilies.length;

  const userSelectedTabRef = useRef<boolean>(false);
  const [actionsTab, setActionsTab] = useState<ActionsTab>(
    () => initialActionsTab ?? (inboxTotalCount === 0 && outboxTotalCount > 0 ? "outbox" : "inbox")
  );
  const [actionsCategory, setActionsCategory] = useState<ActionsCategoryFilter>("all");
  const [actionsStatus, setActionsStatus] = useState<ActionsStatusFilter>("all");

  function handleAddDevFamily() {
    triggerTelegramImpact("light");
    setActionsStatus("all");
    if (actionsCategory !== "all" && actionsCategory !== "families") {
      setActionsCategory("all");
    }
    if (actionsTab === "outbox") {
      const item = createRandomDevBuyerFamilyRequest();
      setDevCards((prev) => ({ ...prev, buyerFamilies: [item, ...prev.buyerFamilies] }));
      toast.success({ title: `Добавлена заявка: ${item.service_name}` });
    } else {
      const { family, request } = createRandomDevCandidate();
      setDevCards((prev) => ({ ...prev, candidates: [{ family, request }, ...prev.candidates] }));
      toast.success({ title: `Добавлен кандидат: ${family.service_name}` });
    }
  }

  function handleAddDevAccount() {
    triggerTelegramImpact("light");
    setActionsStatus("all");
    if (actionsCategory !== "all" && actionsCategory !== "accounts") {
      setActionsCategory("all");
    }
    const role = actionsTab === "outbox" ? "buyer" : "seller";
    const item = createRandomDevAccountRequest(role);
    if (role === "seller") {
      setDevCards((prev) => ({ ...prev, sellerAccounts: [item, ...prev.sellerAccounts] }));
    } else {
      setDevCards((prev) => ({ ...prev, buyerAccounts: [item, ...prev.buyerAccounts] }));
    }
    toast.success({ title: `Добавлен аккаунт: ${item.service_name}` });
  }

  function handleAddDevGb() {
    triggerTelegramImpact("light");
    setActionsStatus("all");
    if (actionsCategory !== "all" && actionsCategory !== "gigabytes") {
      setActionsCategory("all");
    }
    const role = actionsTab === "outbox" ? "buyer" : "seller";
    const item = createRandomDevGbRequest(role);
    if (role === "seller") {
      setDevCards((prev) => ({ ...prev, sellerGb: [item, ...prev.sellerGb] }));
    } else {
      setDevCards((prev) => ({ ...prev, buyerGb: [item, ...prev.buyerGb] }));
    }
    toast.success({ title: `Добавлен трафик: ${item.operator_name}` });
  }

  function handleAddAllDevCategories() {
    triggerTelegramImpact("medium");
    setActionsCategory("all");
    setActionsStatus("all");
    if (actionsTab === "outbox") {
      const fam = createRandomDevBuyerFamilyRequest();
      const acc = createRandomDevAccountRequest("buyer");
      const gb = createRandomDevGbRequest("buyer");
      setDevCards((prev) => ({
        ...prev,
        buyerFamilies: [fam, ...prev.buyerFamilies],
        buyerAccounts: [acc, ...prev.buyerAccounts],
        buyerGb: [gb, ...prev.buyerGb]
      }));
    } else {
      const { family, request } = createRandomDevCandidate();
      const acc = createRandomDevAccountRequest("seller");
      const gb = createRandomDevGbRequest("seller");
      setDevCards((prev) => ({
        ...prev,
        candidates: [{ family, request }, ...prev.candidates],
        sellerAccounts: [acc, ...prev.sellerAccounts],
        sellerGb: [gb, ...prev.sellerGb]
      }));
    }
    toast.success({ title: "Добавлены все 3 категории!" });
  }

  function handleClearAllDevCards() {
    triggerTelegramImpact("medium");
    setDevCards({
      candidates: [],
      sellerAccounts: [],
      buyerAccounts: [],
      sellerGb: [],
      buyerGb: [],
      buyerFamilies: []
    });
    toast.info({ title: "Все тестовые карточки удалены" });
  }

  const actionsRoleSwitchRef = useRef<HTMLDivElement | null>(null);

  function handleScopePositionChange(position: number, isDragging: boolean) {
    const switchElement = actionsRoleSwitchRef.current;
    if (!switchElement) return;
    const clampedPosition = Math.min(Math.max(position, 0), actionsTabOrder.length - 1);
    switchElement.style.setProperty("--scope-position", String(clampedPosition));
    if (isDragging) {
      switchElement.dataset.scopeDragging = "true";
    } else {
      delete switchElement.dataset.scopeDragging;
    }
  }

  useLayoutEffect(() => {
    handleScopePositionChange(actionsTabOrder.indexOf(actionsTab), false);
  }, [actionsTab]);

  useEffect(() => {
    if (initialActionsTab) {
      setActionsTab(initialActionsTab);
      setActionsCategory("all");
      setActionsStatus("all");
      userSelectedTabRef.current = true;
    } else {
      userSelectedTabRef.current = false;
    }
  }, [initialActionsTab]);

  useEffect(() => {
    if (!userSelectedTabRef.current && !initialActionsTab) {
      if (inboxTotalCount === 0 && outboxTotalCount > 0) {
        setActionsTab("outbox");
        setActionsCategory("all");
        setActionsStatus("all");
      } else if (inboxTotalCount > 0 && outboxTotalCount === 0) {
        setActionsTab("inbox");
        setActionsCategory("all");
        setActionsStatus("all");
      }
    }
  }, [inboxTotalCount, outboxTotalCount, initialActionsTab]);

  const filteredSellerGbRequests = allSellerGbRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "gigabytes") &&
      (isTradeRequestStatusMatch(item.status, actionsStatus) || cancellingIds.has(item.id))
  );

  const filteredSellerAccountRequests = allSellerAccountRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "accounts") &&
      (isTradeRequestStatusMatch(item.status, actionsStatus) || cancellingIds.has(item.id))
  );

  const filteredOwnerCandidateRequests = useMemo(() => {
    return combinedOwnerCandidateRequests.filter(({ request }) => {
      const isCategoryMatch = actionsCategory === "all" || actionsCategory === "families";
      const isStatusMatch = isFamilyRequestStatusMatch(request.status, actionsStatus) || cancellingIds.has(request.id);
      return isCategoryMatch && isStatusMatch;
    });
  }, [combinedOwnerCandidateRequests, actionsCategory, actionsStatus, cancellingIds]);

  const visibleCandidateCount = Math.max(
    filteredOwnerCandidateRequests.filter((r) => !cancellingIds.has(r.request.id)).length,
    (actionsCategory === "all" || actionsCategory === "families") && isFamilyActionStatusMatch(actionsStatus)
      ? ownerRequestCount
      : 0
  );

  const visibleInboxCount =
    filteredSellerGbRequests.filter((r) => !cancellingIds.has(r.id)).length +
    filteredSellerAccountRequests.filter((r) => !cancellingIds.has(r.id)).length +
    visibleCandidateCount;

  const filteredBuyerGbRequests = allBuyerGbRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "gigabytes") &&
      (isTradeRequestStatusMatch(item.status, actionsStatus) || cancellingIds.has(item.id))
  );

  const filteredBuyerAccountRequests = allBuyerAccountRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "accounts") &&
      (isTradeRequestStatusMatch(item.status, actionsStatus) || cancellingIds.has(item.id))
  );

  const filteredFamilyRequests = allBuyerFamilyRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "families") &&
      (isFamilyRequestStatusMatch(item.status, actionsStatus) || cancellingIds.has(item.id))
  );

  const filteredMemberActionFamilies =
    (actionsCategory === "all" || actionsCategory === "families") &&
    isFamilyActionStatusMatch(actionsStatus)
      ? memberActionFamilies
      : [];

  const visibleOutboxCount =
    filteredBuyerGbRequests.filter((r) => !cancellingIds.has(r.id)).length +
    filteredBuyerAccountRequests.filter((r) => !cancellingIds.has(r.id)).length +
    filteredFamilyRequests.filter((r) => !cancellingIds.has(r.id)).length +
    filteredMemberActionFamilies.length;

  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<"all" | "successful" | "cancelled">("all");

  const inboxArchiveItems = useMemo<ActionsArchiveItem[]>(() => {
    const items: ActionsArchiveItem[] = [];
    for (const req of sellerGbRequests) {
      if (req.status === "closed" || req.status === "cancelled" || req.status === "rejected" || req.status === "expired") {
        const isSuccess = req.status === "closed";
        items.push({
          id: `gb-${req.id}`,
          title: `${formatTradeGb(req.amount_gb)} ГБ · ${req.operator_name}`,
          orderNumber: getOrderNumber(req.id),
          category: "gigabytes",
          categoryLabel: "Трафик",
          serviceName: req.operator_name,
          serviceSlug: req.operator_slug ? `${req.operator_slug}-family-tariff` : undefined,
          counterparty: `Покупатель: @${req.counterparty_username ?? "покупатель"}`,
          counterpartyUsername: req.counterparty_username,
          date: req.created_at ? formatDate(req.created_at) : "",
          dateTime: req.created_at ? formatDateTime(req.created_at) : "",
          rawDate: req.created_at ?? "",
          status: isSuccess ? "successful" : "cancelled",
          statusLabel: isSuccess ? "Завершена" : req.status === "rejected" ? "Отклонена" : req.status === "cancelled" ? "Отменена" : "Истекла",
          amountKzt: isSuccess ? req.total_price_kzt : undefined
        });
      }
    }
    for (const req of sellerAccountRequests) {
      if (req.status === "closed" || req.status === "cancelled" || req.status === "rejected" || req.status === "expired") {
        const isSuccess = req.status === "closed";
        items.push({
          id: `acc-${req.id}`,
          title: formatArchiveAccountTitle(req.service_name, req.title),
          orderNumber: getOrderNumber(req.id),
          category: "accounts",
          categoryLabel: "Аккаунт",
          serviceName: req.service_name,
          serviceSlug: req.service_slug,
          counterparty: `Покупатель: @${req.counterparty_username ?? "покупатель"}`,
          counterpartyUsername: req.counterparty_username,
          date: req.created_at ? formatDate(req.created_at) : "",
          dateTime: req.created_at ? formatDateTime(req.created_at) : "",
          rawDate: req.created_at ?? "",
          status: isSuccess ? "successful" : "cancelled",
          statusLabel: isSuccess ? "Завершена" : req.status === "rejected" ? "Отклонён" : req.status === "cancelled" ? "Отменён" : "Истёк",
          amountKzt: isSuccess ? req.price_kzt : undefined
        });
      }
    }
    for (const fam of families) {
      if (fam.membership.role === "owner" && ownerDetails[fam.family.id]) {
        for (const req of ownerDetails[fam.family.id].requests) {
          if (req.status === "approved" || req.status === "rejected" || req.status === "cancelled") {
            const isSuccess = req.status === "approved";
            items.push({
              id: `fam-req-${req.id}`,
              title: familyTitle(fam.family),
              orderNumber: getOrderNumber(req.id),
              category: "families",
              categoryLabel: "Семья",
              serviceName: fam.family.service_name,
              serviceSlug: fam.family.service_slug,
              counterparty: `Кандидат: @${req.candidate?.username ?? "пользователь"}`,
              counterpartyUsername: req.candidate?.username,
              date: req.created_at ? formatDate(req.created_at) : "",
              dateTime: req.created_at ? formatDateTime(req.created_at) : "",
              rawDate: req.created_at ?? "",
              status: isSuccess ? "successful" : "cancelled",
              statusLabel: isSuccess ? "Принята" : req.status === "rejected" ? "Отклонена" : "Отменена"
            });
          }
        }
      }
    }
    return items.sort((a, b) => (b.rawDate || "").localeCompare(a.rawDate || ""));
  }, [sellerGbRequests, sellerAccountRequests, families, ownerDetails]);

  const outboxArchiveItems = useMemo<ActionsArchiveItem[]>(() => {
    const items: ActionsArchiveItem[] = [];
    for (const req of buyerGbRequests) {
      if (req.status === "closed" || req.status === "cancelled" || req.status === "rejected" || req.status === "expired") {
        const isSuccess = req.status === "closed";
        items.push({
          id: `gb-${req.id}`,
          originalId: req.id,
          listingId: req.listing_id,
          amountGb: String(req.amount_gb),
          title: `${formatTradeGb(req.amount_gb)} ГБ · ${req.operator_name}`,
          orderNumber: getOrderNumber(req.id),
          category: "gigabytes",
          categoryLabel: "Трафик",
          serviceName: req.operator_name,
          serviceSlug: req.operator_slug ? `${req.operator_slug}-family-tariff` : undefined,
          counterparty: `Продавец: @${req.counterparty_username ?? "продавец"}`,
          counterpartyUsername: req.counterparty_username,
          date: req.created_at ? formatDate(req.created_at) : "",
          dateTime: req.created_at ? formatDateTime(req.created_at) : "",
          rawDate: req.created_at ?? "",
          status: isSuccess ? "successful" : "cancelled",
          statusLabel: isSuccess ? "Завершена" : req.status === "rejected" ? "Отклонена" : req.status === "cancelled" ? "Отменена" : "Истекла",
          amountKzt: isSuccess ? req.total_price_kzt : undefined
        });
      }
    }
    for (const req of buyerAccountRequests) {
      if (req.status === "closed" || req.status === "cancelled" || req.status === "rejected" || req.status === "expired") {
        const isSuccess = req.status === "closed";
        items.push({
          id: `acc-${req.id}`,
          originalId: req.id,
          listingId: req.listing_id,
          title: formatArchiveAccountTitle(req.service_name, req.title),
          orderNumber: getOrderNumber(req.id),
          category: "accounts",
          categoryLabel: "Аккаунт",
          serviceName: req.service_name,
          serviceSlug: req.service_slug,
          counterparty: `Продавец: @${req.counterparty_username ?? "продавец"}`,
          counterpartyUsername: req.counterparty_username,
          date: req.created_at ? formatDate(req.created_at) : "",
          dateTime: req.created_at ? formatDateTime(req.created_at) : "",
          rawDate: req.created_at ?? "",
          status: isSuccess ? "successful" : "cancelled",
          statusLabel: isSuccess ? "Завершена" : req.status === "rejected" ? "Отклонён" : req.status === "cancelled" ? "Отменён" : "Истёк",
          amountKzt: isSuccess ? req.price_kzt : undefined
        });
      }
    }
    for (const req of requests) {
      if (req.status === "approved" || req.status === "rejected" || req.status === "cancelled") {
        const isSuccess = req.status === "approved";
        items.push({
          id: `fam-req-${req.id}`,
          originalId: req.id,
          familyId: req.family_id,
          title: familyTitle(req),
          orderNumber: getOrderNumber(req.id),
          category: "families",
          categoryLabel: "Семья",
          serviceName: req.service_name ?? "Заявка в семью",
          counterparty: `Организатор: @${req.owner_username ?? "организатор"}`,
          counterpartyUsername: req.owner_username,
          date: req.created_at ? formatDate(req.created_at) : "",
          dateTime: req.created_at ? formatDateTime(req.created_at) : "",
          rawDate: req.created_at ?? "",
          status: isSuccess ? "successful" : "cancelled",
          statusLabel: isSuccess ? "Принята" : req.status === "rejected" ? "Отклонена" : "Отменена"
        });
      }
    }
    return items.sort((a, b) => (b.rawDate || "").localeCompare(a.rawDate || ""));
  }, [buyerGbRequests, buyerAccountRequests, requests]);

  const displayArchiveItems = actionsTab === "inbox" ? inboxArchiveItems : outboxArchiveItems;
  const [selectedArchiveDayISO, setSelectedArchiveDayISO] = useState<string | null>(null);

  const getFilteredArchiveItems = (scope: ActionsTab) => {
    const raw = scope === "inbox" ? inboxArchiveItems : outboxArchiveItems;
    return raw.filter((item) => {
      if (archiveFilter !== "all" && item.status !== archiveFilter) return false;
      if (selectedArchiveDayISO && !(item.rawDate || "").startsWith(selectedArchiveDayISO)) return false;
      return true;
    });
  };

  const activeFilteredArchiveItems = getFilteredArchiveItems(actionsTab);

  const inboxFeedSnap = useFeedSnap({
    enabled: actionsTab === "inbox",
    itemCount: visibleInboxCount
  });
  const outboxFeedSnap = useFeedSnap({
    enabled: actionsTab === "outbox",
    itemCount: visibleOutboxCount
  });

  const renderArchiveCard = (item: ActionsArchiveItem, scope: ActionsTab) => {
    return (
      <article
        className="sm-listing my-trade-request actions-archive-card"
        key={item.id}
        data-testid="actions-archive-item"
      >
        <div className="sm-listing-main">
          <ServiceLogo
            serviceSlug={item.serviceSlug}
            serviceName={item.serviceName || item.title}
            familyType={item.category === "gigabytes" ? "tariff" : "subscription"}
            size={40}
          />
          <div className="sm-listing-copy">
            <strong title={item.title}>{item.title}</strong>
            <div className="actions-archive-card-sub">
              <span>{item.categoryLabel}</span>
              <span className={`my-trade-request-status is-${item.status}`}>
                <span className="my-trade-request-dot" aria-hidden />
                <span>{item.statusLabel || (item.status === "successful" ? "Завершена" : "Отклонена")}</span>
              </span>
            </div>
            {item.rejectionReason && (
              <span className="actions-archive-rejection-text">
                Причина: {item.rejectionReason}
              </span>
            )}
          </div>
          <div className="sm-listing-price">
            {item.amountKzt != null ? (
              <strong
                className={`actions-archive-price${
                  item.status === "successful" && scope === "inbox" ? " is-positive" : ""
                }`}
              >
                {item.status === "successful" && scope === "inbox"
                  ? `+${item.amountKzt.toLocaleString("ru-RU")} ₸`
                  : `${item.amountKzt.toLocaleString("ru-RU")} ₸`}
              </strong>
            ) : null}
          </div>
        </div>

        <div className="sm-listing-footer">
          <span
            className="sm-market-family-owner"
            aria-label={scope === "inbox" ? "Покупатель" : "Продавец"}
          >
            <span className="sm-market-family-owner-avatar" aria-hidden>
              {scope === "inbox" ? "П" : "П"}
            </span>
            <span className="sm-market-family-avatar-name">
              <span className="trade-counterparty-role">
                {scope === "inbox" ? "Покупатель" : "Продавец"}
              </span>
            </span>
          </span>

          <span className="actions-archive-date">
            {formatArchiveCardDate(item.rawDate, item.date)}
          </span>
        </div>

        {scope === "outbox" && item.status === "cancelled" ? (
          <div className="actions-archive-actions">
            <button
              type="button"
              disabled={reapplyingId === item.id}
              className="actions-archive-reapply-btn"
              onClick={() => void handleReapply(item)}
              data-testid="actions-archive-reapply-btn"
            >
              <SystemSymbol name="arrow.clockwise" size={15} />
              <span>{reapplyingId === item.id ? "Отправка..." : "Подать повторно"}</span>
            </button>
          </div>
        ) : null}
      </article>
    );
  };

  const renderArchivePane = (scope: ActionsTab) => {
    const items = getFilteredArchiveItems(scope);
    const groups: { dateHeader: string; items: ActionsArchiveItem[] }[] = [];
    const map = new Map<string, ActionsArchiveItem[]>();
    for (const item of items) {
      const header = getArchiveDateHeader(item.rawDate);
      let list = map.get(header);
      if (!list) {
        list = [];
        map.set(header, list);
        groups.push({ dateHeader: header, items: list });
      }
      list.push(item);
    }

    return (
      <div
        className="actions-archive-feed-scroll"
        data-testid="actions-archive-feed-scroll"
      >
        {items.length === 0 ? (
          <EmptyState
            className="my-account-orders-empty-state"
            icon={<SystemSymbol name="archive" size={32} />}
            title={
              selectedArchiveDayISO
                ? "Нет заявок за выбранный день"
                : archiveFilter === "all"
                  ? "В архиве пока нет заявок"
                  : `Нет заявок со статусом «${actionsArchiveFilterOptions.find((o) => o.value === archiveFilter)?.label.toLowerCase()}»`
            }
          >
            {selectedArchiveDayISO ? (
              <>
                <p>Попробуйте выбрать другой день или сбросьте выбор даты.</p>
                <AppButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    triggerTelegramImpact("light");
                    setSelectedArchiveDayISO(null);
                  }}
                  style={{ marginTop: 12 }}
                >
                  Показать все дни
                </AppButton>
              </>
            ) : scope === "inbox" ? (
              "Здесь будут отображаться завершённые и отклонённые входящие запросы."
            ) : (
              "Здесь будут отображаться ваши завершённые и закрытые исходящие заявки."
            )}
          </EmptyState>
        ) : (
          <div className="actions-archive-list-wrap" data-testid="actions-archive-list">
            {groups.map((group) => (
              <div className="actions-archive-date-group" key={group.dateHeader}>
                <div className="actions-archive-date-header">{group.dateHeader}</div>
                <div className="my-trade-request-list actions-archive-card-list">
                  {group.items.map((item) => renderArchiveCard(item, scope))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderFamilyList = (items: MyFamily[]) => (
    <>
      {items.map((item) => {
        const details = ownerDetails[item.family.id];
        const isExpanded = expandedFamilyId === item.family.id;
        return (
          <article
            className="family-workspace"
            data-family-id={item.family.id}
            data-testid="family-workspace"
            key={item.membership.id}
          >
            <FamilyListingCard
              family={item.family}
              isOwner={item.membership.role === "owner"}
              status={item.membership.role === "owner" ? null : memberCardStatus(item)}
              onClick={() => {
                triggerTelegramImpact("light");
                setExpandedFamilyId((current) => (current === item.family.id ? null : item.family.id));
              }}
            />
            {isExpanded && (
              <>
                <FamilyCard family={item.family}>
                  <Badge>{item.membership.role === "owner" ? statusText(item.membership.status) : memberCardStatus(item)}</Badge>
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="workspace-open-family-button"
                    onClick={() => onOpenFamily(item.family.id)}
                  >
                    Подробнее
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      triggerTelegramImpact("light");
                      setExpandedFamilyId(null);
                    }}
                  >
                    Свернуть
                  </AppButton>
                </FamilyCard>
            {item.membership.role === "owner" && (
              <OwnerWorkSummary
                pendingRequestsCount={item.pending_requests_count}
                activeMembersCount={item.family.active_members_count}
                maxMembers={item.family.max_members}
                freeSlots={item.family.free_slots}
              />
            )}
            {item.membership.role !== "owner" && (
              <MemberNextStep member={item.membership} payments={item.payments} />
            )}
            <div className="workspace-actions">
              {item.membership.role === "owner" ? (
                <OwnerActions
                  family={item.family}
                  busy={busy}
                  onLoadOwnerDetails={onLoadOwnerDetails}
                  onUpdateDescription={onUpdateDescription}
                  onUpdatePrice={onUpdatePrice}
                  onUpdatePaymentDay={onUpdatePaymentDay}
                  onCloseFamily={onCloseFamily}
                  onConfirmAvailability={onConfirmAvailability}
                />
              ) : (
                <MemberActions
                  familyId={item.family.id}
                  member={item.membership}
                  familyStatus={item.family.status}
                  busy={busy}
                  onConfirmAccess={onConfirmAccess}
                  onGetRequisite={onGetRequisite}
                  onAcknowledgeClosing={onAcknowledgeClosing}
                  onLeaveFamily={onLeaveFamily}
                  onCreatePrepayment={onCreatePrepayment}
                />
              )}
            </div>

            {requisites[item.membership.id] && (
              <RequisiteBox requisite={requisites[item.membership.id]} />
            )}

            {item.payments.length > 0 && (
              <PaymentList
                payments={item.payments}
                onReport={onReportPayment}
                onCancel={onCancelPaymentReport}
              />
            )}

            {details && (
              <OwnerDetails
                family={item.family}
                details={details}
                onApprove={(request) => onApproveRequest(item.family.id, request)}
                onReject={(request) => onRejectRequest(item.family.id, request)}
                onAccessProvided={(member) =>
                  onAccessProvided(item.family.id, member)
                }
                onRemindAccess={(member) =>
                  onRemindAccess(item.family.id, member)
                }
                onCancelBeforeAccess={(member) =>
                  onCancelBeforeAccess(item.family.id, member)
                }
                onRemove={(member, reason) =>
                  onRemoveMember(item.family.id, member, reason)
                }
                onConfirmPayment={(payment) =>
                  onConfirmPayment(item.family.id, payment)
                }
                onNotReceived={(payment) => onNotReceived(item.family.id, payment)}
                onRecordPrepayment={(member, periods) =>
                  onRecordPrepayment(item.family.id, member, periods)
                }
              />
            )}
          </>
        )}
      </article>
        );
      })}
    </>
  );

  return (
    <div className="my-screen actions-screen" data-testid="actions-screen">
      {loadError && onRetry && (
        <div className="panel error-panel" data-testid="actions-load-error">
          <p>Не удалось обновить список действий</p>
          <AppButton type="button" size="sm" onClick={onRetry}>Повторить</AppButton>
        </div>
      )}

      {isLoading && families.length === 0 ? (
        <FamilyListSkeleton count={3} />
      ) : null}

      <Panel
        title="Заявки"
        action={
          <div className="actions-header-actions">
            <button
              type="button"
              className={`my-screen-context-action${isConstructorOpen ? " is-active" : ""}`}
              aria-expanded={isConstructorOpen}
              aria-controls="actions-dev-constructor"
              aria-label="Конструктор карточек"
              title="Конструктор карточек"
              data-testid="actions-dev-constructor-trigger"
              onClick={() => {
                triggerTelegramImpact("light");
                setIsConstructorOpen((prev) => !prev);
              }}
            >
              <SystemSymbol name={isConstructorOpen ? "xmark" : "plus"} size={22} />
            </button>
            <button
              type="button"
              className={`my-screen-context-action${isArchiveOpen ? " is-active" : ""}${isArchivePulsing ? " is-receiving-item" : ""}`}
              aria-expanded={isArchiveOpen}
              aria-controls="actions-archive-disclosure"
              aria-label="Архив заявок"
              title="Архив заявок"
              data-testid="actions-archive-trigger"
              onClick={() => {
                triggerTelegramImpact("light");
                setIsArchiveOpen((prev) => !prev);
              }}
            >
              <SystemSymbol name="archive" size={24} />
            </button>
          </div>
        }
      >
        <div className="actions-screen-filters">
          {isConstructorOpen && (
            <div className="actions-dev-constructor" data-testid="actions-dev-constructor">
              <div className="actions-dev-constructor-header">
                <span className="actions-dev-constructor-title">
                  <SystemSymbol name="tuning" size={14} />
                  Конструктор карточек
                </span>
                <span className="actions-dev-constructor-badge">
                  {devCardsTotalCount > 0 ? `${devCardsTotalCount} шт` : "0 шт"}
                </span>
              </div>
              <div className="actions-dev-constructor-grid">
                <button
                  type="button"
                  className="actions-dev-chip"
                  data-testid="dev-add-family"
                  onClick={handleAddDevFamily}
                >
                  <span className="actions-dev-chip-icon">👨‍👩‍👧</span>
                  <span>+ Подписка</span>
                </button>
                <button
                  type="button"
                  className="actions-dev-chip"
                  data-testid="dev-add-account"
                  onClick={handleAddDevAccount}
                >
                  <span className="actions-dev-chip-icon">👤</span>
                  <span>+ Аккаунт</span>
                </button>
                <button
                  type="button"
                  className="actions-dev-chip"
                  data-testid="dev-add-gb"
                  onClick={handleAddDevGb}
                >
                  <span className="actions-dev-chip-icon">📶</span>
                  <span>+ Гигабайты</span>
                </button>
              </div>
              <div className="actions-dev-prototype-bar">
                <span className="actions-dev-prototype-title">
                  <SystemSymbol name="clock" size={13} />
                  Режим таймера карточек:
                </span>
                <div className="actions-dev-prototype-options">
                  <button
                    type="button"
                    className={`actions-dev-proto-btn${timerPrototype === 1 ? " is-active" : ""}`}
                    data-testid="dev-proto-btn-1"
                    onClick={() => handleSelectTimerPrototype(1)}
                  >
                    1. Каноничный
                  </button>
                  <button
                    type="button"
                    className={`actions-dev-proto-btn${timerPrototype === 2 ? " is-active" : ""}`}
                    data-testid="dev-proto-btn-2"
                    onClick={() => handleSelectTimerPrototype(2)}
                  >
                    2. Контекст
                  </button>
                  <button
                    type="button"
                    className={`actions-dev-proto-btn${timerPrototype === 3 ? " is-active" : ""}`}
                    data-testid="dev-proto-btn-3"
                    onClick={() => handleSelectTimerPrototype(3)}
                  >
                    3. «Разово»
                  </button>
                  <button
                    type="button"
                    className={`actions-dev-proto-btn${timerPrototype === 4 ? " is-active" : ""}`}
                    data-testid="dev-proto-btn-4"
                    onClick={() => handleSelectTimerPrototype(4)}
                  >
                    4. Под ценой
                  </button>
                </div>
              </div>
              <div className="actions-dev-constructor-footer">
                <button
                  type="button"
                  className="actions-dev-btn-all"
                  data-testid="dev-add-all-categories"
                  onClick={handleAddAllDevCategories}
                >
                  <span>⚡ Все 3 категории</span>
                </button>
                {devCardsTotalCount > 0 && (
                  <button
                    type="button"
                    className="actions-dev-btn-clear"
                    data-testid="dev-clear-all"
                    onClick={handleClearAllDevCards}
                  >
                    <span>🗑 Очистить</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div
            ref={actionsRoleSwitchRef}
            className="product-scope-switch"
            role="group"
            aria-label="Разделы заявок"
            style={{ "--scope-position": actionsTab === "outbox" ? 1 : 0 } as CSSProperties}
          >
            <AppButton
              type="button"
              size="sm"
              data-testid="actions-tab-inbox"
              aria-pressed={actionsTab === "inbox"}
              variant={actionsTab === "inbox" ? "primary" : "tertiary"}
              onClick={() => {
                triggerTelegramSelection();
                userSelectedTabRef.current = true;
                setActionsTab("inbox");
                setActionsCategory("all");
                setActionsStatus("all");
                inboxFeedSnap.containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
              }}
            >
              Входящие
            </AppButton>
            <AppButton
              type="button"
              size="sm"
              data-testid="actions-tab-outbox"
              aria-pressed={actionsTab === "outbox"}
              variant={actionsTab === "outbox" ? "primary" : "tertiary"}
              onClick={() => {
                triggerTelegramSelection();
                userSelectedTabRef.current = true;
                setActionsTab("outbox");
                setActionsCategory("all");
                setActionsStatus("all");
                outboxFeedSnap.containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
              }}
            >
              Исходящие
            </AppButton>
          </div>
        </div>

        <div
          id="actions-archive-disclosure"
          className={`actions-archive-disclosure${isArchiveOpen ? " is-open" : ""}`}
          aria-hidden={!isArchiveOpen}
          inert={!isArchiveOpen}
        >
          <div className="actions-archive-disclosure-content">
            <section className="my-history-section actions-archive-section" data-testid="actions-archive-section">
              <div className="my-family-filter-row my-generic-section-heading">
                <div className="my-family-section-heading">
                  <h2 className="my-family-section-title">Архив заявок</h2>
                  <span className="my-family-section-count">{activeFilteredArchiveItems.length}</span>
                </div>
                <ActionsArchiveFilterChip value={archiveFilter} onChange={setArchiveFilter} />
              </div>

              <div className="actions-archive-content">
                {/* LAYER 2: PaymentCalendar adaptation for Archive */}
                <ActionsArchiveCalendar
                  items={displayArchiveItems}
                  selectedDateKey={selectedArchiveDayISO}
                  onSelectDate={setSelectedArchiveDayISO}
                  mode={actionsTab}
                />

                <ActionsScopePager
                  value={actionsTab}
                  onChange={(nextTab) => {
                    userSelectedTabRef.current = true;
                    setActionsTab(nextTab);
                    setActionsCategory("all");
                    setActionsStatus("all");
                  }}
                  onDragPositionChange={handleScopePositionChange}
                  ariaLabel="Архив заявок"
                  testId="actions-archive-scope-swipe-viewport"
                  renderPane={(scope) => renderArchivePane(scope)}
                />
              </div>
            </section>
          </div>
        </div>

        <div
          className={`actions-active-view${isArchiveOpen ? " is-hidden" : ""}`}
          aria-hidden={isArchiveOpen}
          inert={isArchiveOpen}
        >
          <div className="my-family-filter-row">
            <div className="my-family-section-heading">
              <h2 className="my-family-section-title">
                {actionsCategory === "families"
                  ? (actionsTab === "inbox" ? "Заявки" : "Мои заявки")
                  : (actionsTab === "inbox" ? "Продажи" : "Покупки")}
              </h2>
              <span className="my-family-section-count">
                {actionsTab === "inbox" ? visibleInboxCount : visibleOutboxCount}
              </span>
            </div>
            <ActionsCategoryChip value={actionsCategory} onChange={setActionsCategory} />
            <ActionsStatusChip value={actionsStatus} onChange={setActionsStatus} />
          </div>

        <ActionsScopePager
          value={actionsTab}
          onChange={(nextTab) => {
            userSelectedTabRef.current = true;
            setActionsTab(nextTab);
            setActionsCategory("all");
            setActionsStatus("all");
          }}
          onDragPositionChange={handleScopePositionChange}
          renderPane={(scope) => {
            if (scope === "inbox") {
              return (
                <div
                  className="actions-tab-content my-feed-scroll"
                  ref={inboxFeedSnap.containerRef}
                  {...inboxFeedSnap.scrollHandlers}
                  data-testid="actions-inbox-pane"
                >
                  {inboxTotalCount === 0 ? (
                    <EmptyState
                      icon={<SystemSymbol name="checklist" size={32} />}
                      title="Нет входящих действий"
                    >
                      {inboxArchiveItems.length > 0 ? (
                        <>
                          <p>Все завершённые сделки и отклонённые запросы находятся в архиве.</p>
                          <AppButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              triggerTelegramImpact("light");
                              setIsArchiveOpen(true);
                            }}
                            style={{ marginTop: 12 }}
                          >
                            Открыть архив ({inboxArchiveItems.length})
                          </AppButton>
                        </>
                      ) : (
                        "Когда покупатель запросит гигабайты или аккаунт, либо кандидат подаст заявку в семью, они появятся здесь."
                      )}
                    </EmptyState>
                  ) : visibleInboxCount === 0 ? (
                    <EmptyState
                      icon={<SystemSymbol name="checklist" size={32} />}
                      title="Ничего не найдено"
                    >
                      Нет входящих действий, соответствующих выбранным фильтрам.
                    </EmptyState>
                  ) : (
                    <div className="sm-market-family-list">
                      {filteredSellerGbRequests.length > 0 && (
                        <section className="actions-feed-group" data-testid="marketplace-actions-card">
                          {filteredSellerGbRequests.map((item) => (
                            <GigabytesTradeRequestCard
                              key={item.id}
                              request={item}
                              busy={tradeBusyId === item.id}
                              isArchiving={cancellingIds.has(item.id)}
                              timerPrototype={timerPrototype}
                              onAccept={(id) => void handleAcceptGbRequest(id)}
                              onReject={(id) => void handleRejectGbRequest(id)}
                              onClose={(id, outcome) => void handleCloseGbRequest(id, outcome)}
                            />
                          ))}
                        </section>
                      )}

                      {filteredSellerAccountRequests.length > 0 && (
                        <section className="actions-feed-group" data-testid="account-sales-actions-card">
                          {filteredSellerAccountRequests.map((item) => (
                            <AccountTradeRequestCard
                              key={item.id}
                              request={item}
                              busy={tradeBusyId === item.id}
                              isArchiving={cancellingIds.has(item.id)}
                              timerPrototype={timerPrototype}
                              onAccept={(id) => void handleAcceptAccountRequest(id)}
                              onReject={(id) => void handleRejectAccountRequest(id)}
                              onClose={(id, outcome) => void handleCloseAccountRequest(id, outcome)}
                            />
                          ))}
                        </section>
                      )}

                      {(filteredOwnerCandidateRequests.length > 0 || (visibleCandidateCount > 0 && filteredOwnerCandidateRequests.length === 0)) && (
                        <section className="actions-feed-group" data-testid="family-sales-actions-card">
                          {filteredOwnerCandidateRequests.length > 0 ? (
                            filteredOwnerCandidateRequests.map(({ family, request }) => (
                              <FamilyCandidateRequestCard
                                key={request.id}
                                family={family}
                                request={request}
                                busy={tradeBusyId === request.id}
                                isArchiving={cancellingIds.has(request.id)}
                                timerPrototype={timerPrototype}
                                onAccept={handleApproveCandidateRequest}
                                onReject={handleRejectCandidateRequest}
                              />
                            ))
                          ) : (
                            <FamilyListSkeleton count={visibleCandidateCount} />
                          )}
                        </section>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                className="actions-tab-content my-feed-scroll"
                ref={outboxFeedSnap.containerRef}
                {...outboxFeedSnap.scrollHandlers}
                data-testid="actions-outbox-pane"
              >
                {outboxTotalCount === 0 ? (
                  <EmptyState
                    icon={<SystemSymbol name="paperplane" size={32} />}
                    title="Нет активных заявок"
                  >
                    {outboxArchiveItems.length > 0 ? (
                      <>
                        <p>Все завершённые и отменённые заявки перемещены в архив.</p>
                        <AppButton
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            triggerTelegramImpact("light");
                            setIsArchiveOpen(true);
                          }}
                          style={{ marginTop: 12 }}
                        >
                          Открыть архив ({outboxArchiveItems.length})
                        </AppButton>
                      </>
                    ) : (
                      "Здесь отображаются ваши запросы на покупку гигабайтов, аккаунтов и заявки в семьи."
                    )}
                  </EmptyState>
                ) : visibleOutboxCount === 0 ? (
                  <EmptyState
                    icon={<SystemSymbol name="paperplane" size={32} />}
                    title="Ничего не найдено"
                  >
                    Нет исходящих заявок, соответствующих выбранным фильтрам.
                  </EmptyState>
                ) : (
                  <div className="sm-market-family-list">
                    {filteredBuyerGbRequests.length > 0 && (
                      <section className="actions-feed-group" data-testid="marketplace-purchase-actions-card">
                        {filteredBuyerGbRequests.map((item) => (
                          <GigabytesTradeRequestCard
                            key={item.id}
                            request={item}
                            busy={tradeBusyId === item.id}
                            isArchiving={cancellingIds.has(item.id)}
                            timerPrototype={timerPrototype}
                            onCancel={(id) => void handleCancelGbRequest(id)}
                            onRemind={(id) => void handleRemindGbRequest(id)}
                          />
                        ))}
                      </section>
                    )}

                    {filteredBuyerAccountRequests.length > 0 && (
                      <section className="actions-feed-group" data-testid="account-purchase-actions-card">
                        {filteredBuyerAccountRequests.map((item) => (
                          <AccountTradeRequestCard
                            key={item.id}
                            request={item}
                            busy={tradeBusyId === item.id}
                            isArchiving={cancellingIds.has(item.id)}
                            timerPrototype={timerPrototype}
                            onCancel={(id) => void handleCancelAccountRequest(id)}
                            onRemind={(id) => void handleRemindAccountRequest(id)}
                          />
                        ))}
                      </section>
                    )}

                    {filteredFamilyRequests.length > 0 && (
                      <>
                        <MyRequestsSection
                          requests={filteredFamilyRequests}
                          busy={busy}
                          isLoading={requestsLoading}
                          cancellingIds={cancellingIds}
                          onCancelRequest={handleCancelFamilyRequest}
                        />
                        {hasMoreRequests && onLoadMoreRequests ? (
                          <AppButton
                            type="button"
                            variant="secondary"
                            fullWidth
                            disabled={isLoadingMoreRequests}
                            onClick={onLoadMoreRequests}
                          >
                            {isLoadingMoreRequests ? "Загружаем заявки..." : "Показать ещё заявки"}
                          </AppButton>
                        ) : null}
                      </>
                    )}

                    {filteredMemberActionFamilies.length > 0 && (
                      <section className="actions-feed-group">
                        {renderFamilyList(filteredMemberActionFamilies)}
                      </section>
                    )}
                  </div>
                )}
              </div>
            );
          }}
        />
        </div>
      </Panel>
    </div>
  );
}

interface ActionsScopePointerState {
  pointerId: number;
  startX: number;
  startY: number;
  originPosition: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  isDragging: boolean;
  cancelled: boolean;
}

function ActionsScopePager({
  value,
  onChange,
  renderPane,
  onDragPositionChange,
  ariaLabel = "Разделы заявок",
  testId = "actions-scope-swipe-viewport"
}: {
  value: ActionsTab;
  onChange: (value: ActionsTab) => void;
  renderPane: (scope: ActionsTab) => ReactNode;
  onDragPositionChange?: (position: number, isDragging: boolean) => void;
  ariaLabel?: string;
  testId?: string;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef(actionsTabOrder.indexOf(value));
  const pointerRef = useRef<ActionsScopePointerState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationTargetRef = useRef<number | null>(null);
  const wasSwipedRef = useRef(false);
  const activeIndex = actionsTabOrder.indexOf(value);
  const pagePercent = 100 / actionsTabOrder.length;
  const SWIPE_GAP = 16;

  function setPosition(position: number) {
    positionRef.current = position;
    if (trackRef.current) {
      const width = viewportRef.current?.clientWidth || 0;
      if (width > 0) {
        trackRef.current.style.transform = `translate3d(${-position * (width + SWIPE_GAP)}px, 0, 0)`;
      } else {
        trackRef.current.style.transform = `translate3d(calc(${-position * pagePercent}% - ${position * ((SWIPE_GAP * (actionsTabOrder.length - 1)) / actionsTabOrder.length)}px), 0, 0)`;
      }
    }
  }

  function stopAnimation() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function animateTo(
    nextPosition: number,
    initialVelocity = 0,
    interaction: "gesture" | "click" = "gesture"
  ) {
    const target = Math.min(Math.max(nextPosition, 0), actionsTabOrder.length - 1);
    stopAnimation();
    animationTargetRef.current = target;
    if (interaction === "click") {
      onDragPositionChange?.(target, false);
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPosition(target);
      onDragPositionChange?.(target, false);
      animationTargetRef.current = null;
      return;
    }

    let position = positionRef.current;
    if (Math.abs(target - position) < 0.001 && Math.abs(initialVelocity) < 0.01) {
      setPosition(target);
      onDragPositionChange?.(target, false);
      animationTargetRef.current = null;
      return;
    }

    let velocity = Math.max(-4, Math.min(4, initialVelocity));
    const stiffness = 260;
    const damping = 32;
    if (interaction === "gesture") {
      onDragPositionChange?.(position, true);
    }
    let previousTime = performance.now();
    const step = (time: number) => {
      const deltaTime = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;
      const acceleration = (target - position) * stiffness - velocity * damping;
      velocity += acceleration * deltaTime;
      position += velocity * deltaTime;
      setPosition(position);
      if (interaction === "gesture") {
        onDragPositionChange?.(position, true);
      }

      if (Math.abs(target - position) < 0.001 && Math.abs(velocity) < 0.01) {
        setPosition(target);
        onDragPositionChange?.(target, false);
        animationTargetRef.current = null;
        animationFrameRef.current = null;
        return;
      }
      animationFrameRef.current = requestAnimationFrame(step);
    };
    animationFrameRef.current = requestAnimationFrame(step);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopAnimation();
    animationTargetRef.current = null;
    wasSwipedRef.current = false;
    pointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originPosition: positionRef.current,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      isDragging: false,
      cancelled: false
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || pointer.cancelled) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (!pointer.isDragging) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX < 8 && absY < 8) return;

      if (absY >= 14 && absY > absX * 1.4) {
        pointer.cancelled = true;
        pointerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }
      if (absX >= 8 && absX * 1.4 >= absY) {
        pointer.isDragging = true;
        wasSwipedRef.current = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {}
        if (viewportRef.current) {
          viewportRef.current.dataset.swiping = "true";
        }
      } else {
        return;
      }
    }

    const now = performance.now();
    const elapsed = Math.max(1, now - pointer.lastTime);
    pointer.velocityX = ((event.clientX - pointer.lastX) / elapsed) * 1000;
    pointer.lastX = event.clientX;
    pointer.lastTime = now;
    const width = viewportRef.current?.clientWidth || 1;
    const stepSize = width + SWIPE_GAP;
    const rawPosition = pointer.originPosition - deltaX / stepSize;
    const lastIndex = actionsTabOrder.length - 1;
    const position = rawPosition < 0
      ? rawPosition * 0.25
      : rawPosition > lastIndex
        ? lastIndex + (rawPosition - lastIndex) * 0.25
        : rawPosition;
    setPosition(position);
    onDragPositionChange?.(position, true);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    if (viewportRef.current) {
      delete viewportRef.current.dataset.swiping;
    }
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    pointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointer.cancelled) {
      setPosition(activeIndex);
      onDragPositionChange?.(activeIndex, false);
      return;
    }
    if (cancelled) {
      animateTo(activeIndex);
      return;
    }
    if (!pointer.isDragging) return;

    const deltaX = event.clientX - pointer.startX;
    const width = viewportRef.current?.clientWidth || 1;
    const stepSize = width + SWIPE_GAP;
    const passedDistance = Math.abs(deltaX) >= width * 0.18;
    const passedVelocity = Math.abs(pointer.velocityX) >= 450;
    let target = Math.round(positionRef.current);
    if (passedDistance || passedVelocity) {
      const direction = passedVelocity
        ? (pointer.velocityX < 0 ? 1 : -1)
        : (deltaX < 0 ? 1 : -1);
      target = Math.round(pointer.originPosition) + direction;
    }
    target = Math.min(Math.max(target, 0), actionsTabOrder.length - 1);
    animateTo(target, -pointer.velocityX / stepSize, "gesture");
    if (target !== activeIndex) {
      triggerTelegramImpact("light");
      onChange(actionsTabOrder[target]);
    }
  }

  useLayoutEffect(() => {
    if (pointerRef.current) return;
    if (animationTargetRef.current === activeIndex) return;
    if (Math.abs(positionRef.current - activeIndex) < 0.001) {
      setPosition(activeIndex);
      onDragPositionChange?.(activeIndex, false);
      return;
    }
    animateTo(activeIndex, 0, "click");
  }, [activeIndex]);

  useEffect(() => () => {
    stopAnimation();
    animationTargetRef.current = null;
    if (viewportRef.current) {
      delete viewportRef.current.dataset.swiping;
    }
  }, []);

  return (
    <div
      className="actions-scope-swipe-viewport"
      ref={viewportRef}
      data-testid={testId}
      role="group"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => handlePointerEnd(event)}
      onPointerCancel={(event) => handlePointerEnd(event, true)}
      onClickCapture={(event) => {
        if (!wasSwipedRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        wasSwipedRef.current = false;
      }}
    >
      <div
        className="actions-scope-swipe-track"
        ref={trackRef}
        data-testid="actions-scope-swipe-track"
        style={{ transform: `translate3d(calc(${-positionRef.current * pagePercent}% - ${positionRef.current * ((SWIPE_GAP * (actionsTabOrder.length - 1)) / actionsTabOrder.length)}px), 0, 0)` }}
      >
        {actionsTabOrder.map((scope) => (
          <div
            key={scope}
            className="actions-scope-swipe-pane"
            data-actions-tab={scope}
            data-scope={scope}
            aria-hidden={scope !== value}
            aria-live={scope === value ? "polite" : undefined}
          >
            {renderPane(scope)}
          </div>
        ))}
      </div>
    </div>
  );
}
