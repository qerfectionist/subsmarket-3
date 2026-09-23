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
import {
  AccountTradeRequestCard,
  GigabytesTradeRequestCard,
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
  useRemindMarketplaceRequest
} from "../hooks/useApi";
import { formatDate, formatDateTime, memberCardStatus, statusText } from "../format";
import { triggerTelegramSelection, triggerTelegramImpact, openTelegramUser } from "../telegram";
import { useFeedSnap } from "../hooks/useFeedSnap";
import type {
  FamilyMember,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyRequest,
  MyFamily,
  OwnerFamilyDetails,
  PaymentRequisite
} from "../types";

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
  if (filter === "all") return true;
  const isActive = ["pending", "accepted"].includes(status);
  return filter === "pending" ? isActive : !isActive;
}

export function isFamilyRequestStatusMatch(status: string, filter: ActionsStatusFilter) {
  if (filter === "all") return true;
  const isActive = ["pending", "accepted"].includes(status);
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

  const sellerGbRequestsQuery = useMarketplaceRequests("seller", true);
  const buyerGbRequestsQuery = useMarketplaceRequests("buyer", true);
  const sellerAccountRequestsQuery = useAccountRequests("seller", true);
  const buyerAccountRequestsQuery = useAccountRequests("buyer", true);

  const sellerGbRequests = sellerGbRequestsQuery.data ?? [];
  const buyerGbRequests = buyerGbRequestsQuery.data ?? [];
  const sellerAccountRequests = sellerAccountRequestsQuery.data ?? [];
  const buyerAccountRequests = buyerAccountRequestsQuery.data ?? [];

  async function handleAcceptGbRequest(id: string) {
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
    try {
      setTradeBusyId(id);
      await rejectMarketplaceRequest.mutateAsync({ id });
      toast.success({ title: "Заявка отклонена" });
    } catch {
      toast.error({ title: "Не удалось отклонить заявку" });
    } finally {
      setTradeBusyId(null);
    }
  }

  async function handleCloseGbRequest(id: string, outcome: "sold" | "not_sold") {
    try {
      setTradeBusyId(id);
      await closeMarketplaceRequest.mutateAsync({ id, outcome });
      toast.success({ title: outcome === "sold" ? "Сделка завершена" : "Заявка закрыта" });
    } catch {
      toast.error({ title: "Не удалось закрыть сделку" });
    } finally {
      setTradeBusyId(null);
    }
  }

  async function handleCancelGbRequest(id: string) {
    try {
      setTradeBusyId(id);
      await cancelMarketplaceRequest.mutateAsync({ id });
      toast.success({ title: "Заявка отменена" });
    } catch {
      toast.error({ title: "Не удалось отменить заявку" });
    } finally {
      setTradeBusyId(null);
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
    try {
      setTradeBusyId(id);
      await rejectAccountRequest.mutateAsync({ id });
      toast.success({ title: "Запрос отклонён" });
    } catch {
      toast.error({ title: "Не удалось отклонить запрос" });
    } finally {
      setTradeBusyId(null);
    }
  }

  async function handleCloseAccountRequest(id: string, outcome: "sold" | "not_sold") {
    try {
      setTradeBusyId(id);
      await closeAccountRequest.mutateAsync({ id, outcome });
      toast.success({ title: outcome === "sold" ? "Контакт завершён" : "Контакт закрыт" });
    } catch {
      toast.error({ title: "Не удалось закрыть контакт" });
    } finally {
      setTradeBusyId(null);
    }
  }

  async function handleCancelAccountRequest(id: string) {
    try {
      setTradeBusyId(id);
      await cancelAccountRequest.mutateAsync({ id });
      toast.success({ title: "Запрос отменён" });
    } catch {
      toast.error({ title: "Не удалось отменить запрос" });
    } finally {
      setTradeBusyId(null);
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

  const pendingRequestCount = requests.filter((request) => request.status === "pending").length;
  const ownerRequestCount = families.reduce(
    (total, item) => total + item.pending_requests_count,
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

  const ownerActionFamilies = useMemo(
    () => actionFamilies.filter((item) => item.membership.role === "owner"),
    [actionFamilies]
  );
  const memberActionFamilies = useMemo(
    () => actionFamilies.filter((item) => item.membership.role !== "owner"),
    [actionFamilies]
  );

  const inboxTotalCount =
    sellerGbRequests.length + sellerAccountRequests.length + ownerActionFamilies.length;
  const outboxTotalCount =
    buyerGbRequests.length +
    buyerAccountRequests.length +
    requests.length +
    memberActionFamilies.length;

  const userSelectedTabRef = useRef<boolean>(false);
  const [actionsTab, setActionsTab] = useState<ActionsTab>(
    () => initialActionsTab ?? (inboxTotalCount === 0 && outboxTotalCount > 0 ? "outbox" : "inbox")
  );
  const [actionsCategory, setActionsCategory] = useState<ActionsCategoryFilter>("all");
  const [actionsStatus, setActionsStatus] = useState<ActionsStatusFilter>("all");
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

  const filteredSellerGbRequests = sellerGbRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "gigabytes") &&
      isTradeRequestStatusMatch(item.status, actionsStatus)
  );

  const filteredSellerAccountRequests = sellerAccountRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "accounts") &&
      isTradeRequestStatusMatch(item.status, actionsStatus)
  );

  const filteredOwnerActionFamilies =
    (actionsCategory === "all" || actionsCategory === "families") &&
    isFamilyActionStatusMatch(actionsStatus)
      ? ownerActionFamilies
      : [];

  const visibleInboxCount =
    filteredSellerGbRequests.length +
    filteredSellerAccountRequests.length +
    filteredOwnerActionFamilies.length;

  const filteredBuyerGbRequests = buyerGbRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "gigabytes") &&
      isTradeRequestStatusMatch(item.status, actionsStatus)
  );

  const filteredBuyerAccountRequests = buyerAccountRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "accounts") &&
      isTradeRequestStatusMatch(item.status, actionsStatus)
  );

  const filteredFamilyRequests = requests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "families") &&
      isFamilyRequestStatusMatch(item.status, actionsStatus)
  );

  const filteredMemberActionFamilies =
    (actionsCategory === "all" || actionsCategory === "families") &&
    isFamilyActionStatusMatch(actionsStatus)
      ? memberActionFamilies
      : [];

  const visibleOutboxCount =
    filteredBuyerGbRequests.length +
    filteredBuyerAccountRequests.length +
    filteredFamilyRequests.length +
    filteredMemberActionFamilies.length;

  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<"all" | "successful" | "cancelled">("all");

  const archiveItems = useMemo<ActionsArchiveItem[]>(() => {
    const items: ActionsArchiveItem[] = [];

    if (actionsTab === "inbox") {
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
            title: req.title ? `${req.service_name} · ${req.title}` : req.service_name,
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
                title: fam.family.service_name,
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
    } else {
      for (const req of buyerGbRequests) {
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
            title: req.title ? `${req.service_name} · ${req.title}` : req.service_name,
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
            title: req.service_name ?? "Заявка в семью",
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
    }

    return items.sort((a, b) => (b.rawDate || "").localeCompare(a.rawDate || ""));
  }, [
    actionsTab,
    sellerGbRequests,
    sellerAccountRequests,
    buyerGbRequests,
    buyerAccountRequests,
    families,
    ownerDetails,
    requests
  ]);

  const [displayArchiveItems, setDisplayArchiveItems] = useState(archiveItems);
  useEffect(() => {
    if (archiveItems.length > 0 || isArchiveOpen) {
      setDisplayArchiveItems(archiveItems);
    }
  }, [archiveItems, isArchiveOpen]);

  const [selectedArchiveDayISO, setSelectedArchiveDayISO] = useState<string | null>(null);

  const kpiStats = useMemo(() => {
    const successfulItems = displayArchiveItems.filter((it) => it.status === "successful");
    const cancelledItems = displayArchiveItems.filter((it) => it.status === "cancelled");
    const totalTurnover = successfulItems.reduce((acc, it) => acc + (it.amountKzt || 0), 0);
    return {
      totalDeals: successfulItems.length,
      turnover: totalTurnover,
      rejectedCount: cancelledItems.length
    };
  }, [displayArchiveItems]);


  const filteredArchiveItems = displayArchiveItems.filter((item) => {
    if (archiveFilter !== "all" && item.status !== archiveFilter) return false;
    if (selectedArchiveDayISO && !(item.rawDate || "").startsWith(selectedArchiveDayISO)) return false;
    return true;
  });

  const [expandedArchiveId, setExpandedArchiveId] = useState<string | null>(null);

  const groupedArchiveItems = useMemo(() => {
    const groups: { dateHeader: string; items: ActionsArchiveItem[] }[] = [];
    const map = new Map<string, ActionsArchiveItem[]>();
    for (const item of filteredArchiveItems) {
      const header = getArchiveDateHeader(item.rawDate);
      let list = map.get(header);
      if (!list) {
        list = [];
        map.set(header, list);
        groups.push({ dateHeader: header, items: list });
      }
      list.push(item);
    }
    return groups;
  }, [filteredArchiveItems]);

  const inboxFeedSnap = useFeedSnap({
    enabled: actionsTab === "inbox",
    itemCount: visibleInboxCount
  });
  const outboxFeedSnap = useFeedSnap({
    enabled: actionsTab === "outbox",
    itemCount: visibleOutboxCount
  });

  const renderFamilyList = (items: MyFamily[]) => (
    <>
      {items.map((item) => {
        const details = ownerDetails[item.family.id];
        return (
          <article
            className="family-workspace"
            data-family-id={item.family.id}
            data-testid="family-workspace"
            key={item.membership.id}
          >
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
          <button
            type="button"
            className={`my-screen-context-action${isArchiveOpen ? " is-active" : ""}`}
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
        }
      >
        <div className="actions-screen-filters">
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
                  <span className="my-family-section-count">{filteredArchiveItems.length}</span>
                </div>
                <ActionsArchiveFilterChip value={archiveFilter} onChange={setArchiveFilter} />
              </div>

              <div className="actions-archive-content">
                {/* LAYER 1: Summary Cards matching SubsMarket metrics */}
                <div className="actions-archive-summary">
                  <div>
                    <span>{actionsTab === "inbox" ? "Сделок" : "Покупок"}</span>
                    <strong>{kpiStats.totalDeals}</strong>
                  </div>
                  <div>
                    <span>{actionsTab === "inbox" ? "Доход" : "Потрачено"}</span>
                    <strong className={actionsTab === "inbox" && kpiStats.turnover > 0 ? "is-positive" : ""}>
                      {kpiStats.turnover > 0
                        ? `${actionsTab === "inbox" ? "+" : ""}${kpiStats.turnover.toLocaleString("ru-RU")} ₸`
                        : "0 ₸"}
                    </strong>
                  </div>
                  <div>
                    <span>Отказов</span>
                    <strong className={kpiStats.rejectedCount > 0 ? "is-negative" : ""}>
                      {kpiStats.rejectedCount}
                    </strong>
                  </div>
                </div>

                {/* LAYER 2: PaymentCalendar adaptation for Archive */}
                <ActionsArchiveCalendar
                  items={displayArchiveItems}
                  selectedDateKey={selectedArchiveDayISO}
                  onSelectDate={setSelectedArchiveDayISO}
                  mode={actionsTab}
                />

                {filteredArchiveItems.length === 0 ? (
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
                    {selectedArchiveDayISO
                      ? "Попробуйте выбрать другой день или нажмите «Показать все»."
                      : actionsTab === "inbox"
                        ? "Здесь будут отображаться завершённые и отклонённые входящие запросы."
                        : "Здесь будут отображаться ваши завершённые и закрытые исходящие заявки."}
                  </EmptyState>
                ) : (
                  <div className="actions-archive-list-wrap" data-testid="actions-archive-list">
                    {groupedArchiveItems.map((group) => (
                      <div className="actions-archive-date-group" key={group.dateHeader}>
                        <div className="actions-archive-date-header">{group.dateHeader}</div>
                        <div className="my-trade-request-list">
                          {group.items.map((item) => {
                            const isExpanded = expandedArchiveId === item.id;
                            return (
                              <article
                                className={`my-trade-request${isExpanded ? " is-expanded" : ""}`}
                                key={item.id}
                                data-testid="actions-archive-item"
                              >
                                <div
                                  className="my-trade-request-body"
                                  onClick={() => {
                                    triggerTelegramSelection();
                                    setExpandedArchiveId((prev) => (prev === item.id ? null : item.id));
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  aria-expanded={isExpanded}
                                >
                                  <div className="trade-card-source-row">
                                    <span className={`trade-source-badge is-${item.category}`}>
                                      <SystemSymbol
                                        name={
                                          item.category === "gigabytes"
                                            ? "antenna.radiowaves.left.and.right"
                                            : item.category === "accounts"
                                              ? "person.crop.circle"
                                              : "person.2"
                                        }
                                        size={12}
                                      />
                                      <span>{item.categoryLabel}</span>
                                    </span>

                                    <span className={`my-trade-request-status is-${item.status}`}>
                                      <span className="my-trade-request-dot" aria-hidden />
                                      <span>{item.status === "successful" ? "Успешно" : (item.statusLabel || "Отклонено")}</span>
                                    </span>
                                  </div>

                                  <div className="my-trade-request-top">
                                    <strong className="my-trade-request-title">{item.title}</strong>
                                    {item.amountKzt != null && (
                                      <span className="my-trade-request-price">
                                        {item.status === "successful"
                                          ? `+${item.amountKzt.toLocaleString("ru-RU")} ₸`
                                          : `${item.amountKzt.toLocaleString("ru-RU")} ₸`}
                                      </span>
                                    )}
                                  </div>

                                  <div className="my-trade-request-sub">
                                    <span className="my-trade-request-service">
                                      {item.dateTime || item.date} • {item.orderNumber}
                                    </span>
                                  </div>
                                </div>

                                <div className="my-trade-request-footer">
                                  <span
                                    className="my-trade-request-seller"
                                    aria-label={actionsTab === "inbox" ? `Покупатель: ${item.counterparty}` : `Продавец: ${item.counterparty}`}
                                  >
                                    <span className="my-trade-request-avatar" aria-hidden>
                                      {item.counterpartyUsername ? (
                                        item.counterpartyUsername.replace(/^@/, "").slice(0, 1).toUpperCase()
                                      ) : (
                                        <SystemSymbol name="person.crop.circle" size={14} />
                                      )}
                                    </span>
                                    <strong className="my-trade-request-username">
                                      {item.counterpartyUsername ? `@${item.counterpartyUsername}` : item.counterparty}
                                    </strong>
                                  </span>

                                  {item.counterpartyUsername ? (
                                    <button
                                      type="button"
                                      className="my-trade-request-chat-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerTelegramImpact("light");
                                        openTelegramUser(item.counterpartyUsername!);
                                      }}
                                    >
                                      <SystemSymbol name="message" size={13} />
                                      <span>Написать</span>
                                    </button>
                                  ) : null}
                                </div>

                                {isExpanded && (
                                  <div
                                    className="my-trade-request-actions"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {item.rejectionReason && (
                                      <div className="actions-archive-reason-card">
                                        <span className="actions-archive-reason-label">Причина:</span>
                                        <span className="actions-archive-reason-text">{item.rejectionReason}</span>
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        triggerTelegramImpact("light");
                                        toast.info({ title: `Повтор: ${item.title}` });
                                      }}
                                    >
                                      <SystemSymbol name="arrow.clockwise" size={14} />
                                      <span>Повторить</span>
                                    </button>
                                    {item.counterpartyUsername && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          triggerTelegramImpact("light");
                                          openTelegramUser(item.counterpartyUsername!);
                                        }}
                                      >
                                        <SystemSymbol name="message" size={14} />
                                        <span>Чат @{item.counterpartyUsername}</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="my-family-filter-row">
          <div className="my-family-section-heading">
            <h2 className="my-family-section-title">Заявки</h2>
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
                      Когда покупатель запросит гигабайты или аккаунт, либо кандидат подаст заявку в семью, они появятся здесь.
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
                              onAccept={(id) => void handleAcceptAccountRequest(id)}
                              onReject={(id) => void handleRejectAccountRequest(id)}
                              onClose={(id, outcome) => void handleCloseAccountRequest(id, outcome)}
                            />
                          ))}
                        </section>
                      )}

                      {filteredOwnerActionFamilies.length > 0 && (
                        <section className="actions-feed-group">
                          {renderFamilyList(filteredOwnerActionFamilies)}
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
                    title="Нет исходящих заявок"
                  >
                    Здесь отображаются ваши запросы на покупку гигабайтов, аккаунтов и заявки в семьи.
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
                          onCancelRequest={onCancelRequest}
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
  ariaLabel = "Разделы заявок"
}: {
  value: ActionsTab;
  onChange: (value: ActionsTab) => void;
  renderPane: (scope: ActionsTab) => ReactNode;
  onDragPositionChange?: (position: number, isDragging: boolean) => void;
  ariaLabel?: string;
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
      data-testid="actions-scope-swipe-viewport"
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
