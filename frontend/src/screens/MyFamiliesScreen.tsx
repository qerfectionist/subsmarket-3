import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import {
  Button as AppButton,
  Input,
  Select,
  TextArea,
  Typography,
  useToast
} from "../components/ui";
import { gsap } from "gsap";
import {
  FamilyCard,
  OwnerDetails,
  PaymentList,
  PaymentCalendar,
  OwnerActions,
  MemberActions,
  MemberNextStep,
  OwnerWorkSummary,
  hasPendingFamilyAction,
  hasPendingAccessAction,
  hasPendingPaymentAction,
  MyHistorySection,
  MyTradeRequestsSection,
  MyAccountListingsSection,
  MyGigabytesSection,
  MyRequestsSection,
  formatMyKzt,
  myAccountStatusFilterOptions,
  type MyAccountStatusFilter
} from "../components/families";
import {
  AccountListingCard,
  FamilyListingCard,
  GigabytesListingCard
} from "../components/ListingCard";
import { ListingAuthor } from "../components/ListingAuthor";
import { ServiceLogo } from "../components/branding";
import { AsyncContent } from "../components/AsyncContent";
import { SystemSymbol, type SystemSymbolName } from "../components/SystemSymbol";
import {
  Badge,
  EmptyState,
  Panel,
  ProductScopeSwitch
} from "../components/layout";
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
  useMyAccountListings,
  useMyMarketplaceListings,
  useRejectAccountRequest,
  useRejectMarketplaceRequest,
  useRemindAccountRequest,
  useRemindMarketplaceRequest
} from "../hooks/useApi";
import {
  AccountTradeRequestCard,
  FamilyTradeRequestCard,
  GigabytesTradeRequestCard
} from "../components/TradeRequestCard";
import { familyTitle, formatDate, formatDateTime, memberCardStatus, statusText } from "../format";
import {
  familyKindLabels,
  requestCancelReasonLabels
} from "../labels";
import {
  openTelegramUser,
  triggerTelegramImpact,
  triggerTelegramNotification,
  triggerTelegramSelection
} from "../telegram";
import { useFeedSnap } from "../hooks/useFeedSnap";
import type {
  AccountListing,
  Family,
  FamilyMember,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyRequest,
  AccountRequest,
  MarketplaceListing,
  MarketplaceListingRequest,
  MarketplaceRequestRole,
  MyFamily,
  OwnerFamilyDetails,
  PaymentRequisite
} from "../types";

type MyProductScope = "families" | "accounts" | "gigabytes";
type MyFamilyRoleFilter = "all" | "member" | "owner";

const myFamilyRoleFilterOptions: readonly {
  value: MyFamilyRoleFilter;
  label: string;
  icon: SystemSymbolName;
}[] = [
  {
    value: "all",
    label: "Все роли",
    icon: "person.2"
  },
  {
    value: "member",
    label: "Участвую",
    icon: "person.2"
  },
  {
    value: "owner",
    label: "Организую",
    icon: "person.2.badge.plus"
  }
];

type MyFamilyFilter = "all" | "tariff" | "subscription";

const myFamilyFilterOptions: readonly { value: MyFamilyFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "tariff", label: "Тарифы" },
  { value: "subscription", label: "Сервисы" }
];

type MyAccountStatusFilter = "all" | "active" | "paused";

const myAccountStatusFilterOptions: readonly {
  value: MyAccountStatusFilter;
  label: string;
  icon: SystemSymbolName;
}[] = [
  { value: "all", label: "Все", icon: "sort" },
  { value: "active", label: "Опубликовано", icon: "checkmark" },
  { value: "paused", label: "Приостановлено", icon: "pause.circle" }
];

type ActionsCategoryFilter = "all" | "families" | "accounts" | "gigabytes";

const actionsCategoryFilterOptions: readonly {
  value: ActionsCategoryFilter;
  label: string;
  icon: SystemSymbolName;
}[] = [
  { value: "all", label: "Все", icon: "sort" },
  { value: "families", label: "Подписки", icon: "person.2" },
  { value: "accounts", label: "Аккаунты", icon: "person.crop.circle" },
  { value: "gigabytes", label: "ГБ", icon: "antenna.radiowaves.left.and.right" }
];

type ActionsStatusFilter = "all" | "active" | "completed";

const actionsStatusFilterOptions: readonly {
  value: ActionsStatusFilter;
  label: string;
  icon: SystemSymbolName;
}[] = [
  { value: "all", label: "Все", icon: "checklist" },
  { value: "active", label: "Активные", icon: "checkmark" },
  { value: "completed", label: "Завершены", icon: "clock" }
];

function isTradeRequestStatusMatch(status: string, filter: ActionsStatusFilter) {
  if (filter === "all") return true;
  const isActive = ["pending", "accepted"].includes(status);
  return filter === "active" ? isActive : !isActive;
}

function isFamilyRequestStatusMatch(status: string, filter: ActionsStatusFilter) {
  if (filter === "all") return true;
  const isActive = ["pending", "accepted"].includes(status);
  return filter === "active" ? isActive : !isActive;
}

function isFamilyActionStatusMatch(filter: ActionsStatusFilter) {
  if (filter === "all") return true;
  return filter === "active";
}

const myProductScopeOrder: readonly MyProductScope[] = [

  "families",
  "accounts",
  "gigabytes"
];

type MyProductScopePointerState = {
  pointerId: number;
  startX: number;
  startY: number;
  originPosition: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  isDragging: boolean;
  cancelled: boolean;
};

function formatMyKzt(value: number) {
  return `${value.toLocaleString("ru-KZ")} ₸`;
}

export function MyFamiliesScreen({
  mode = "mine",
  myProductScope = "families",
  families,
  ownerDetails,
  requisites,
  requests,
  busy,
  isLoading,
  requestsLoading,
  loadError,
  onRetry,
  hasMoreFamilies,
  isLoadingMoreFamilies,
  hasMoreRequests,
  isLoadingMoreRequests,
  onLoadMoreFamilies,
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
  onOpenAccountPurchaseActions,
  onChangeProductScope,
  onOpenAccountListing,
  onCreateAccountListing,
  onOpenGigabytesListing,
  onCreateGigabytesListing,
  onOpenMarket,
  initialActionsTab
}: {
  mode?: "mine" | "actions";
  initialActionsTab?: "inbox" | "outbox";
  myProductScope?: MyProductScope;
  families: MyFamily[];
  ownerDetails: Record<string, OwnerFamilyDetails>;
  requisites: Record<string, PaymentRequisite>;
  requests: FamilyRequest[];
  busy: string | null;
  isLoading?: boolean;
  requestsLoading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  hasMoreFamilies?: boolean;
  isLoadingMoreFamilies?: boolean;
  hasMoreRequests?: boolean;
  isLoadingMoreRequests?: boolean;
  onLoadMoreFamilies?: () => void;
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
  onChangeProductScope: (scope: MyProductScope) => void;
  onOpenAccountListing: (listingId: string) => void;
  onCreateAccountListing: () => void;
  onOpenGigabytesListing: (listingId: string) => void;
  onCreateGigabytesListing: () => void;
  onOpenMarket?: () => void;
}) {
  const actionFamilies = families.filter(hasPendingFamilyAction);
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);
  const [familyRoleFilter, setFamilyRoleFilter] = useState<MyFamilyRoleFilter>("all");
  const [familyFilter, setFamilyFilter] = useState<MyFamilyFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const scopeSwitchRef = useRef<HTMLDivElement | null>(null);

  function handleScopePositionChange(position: number, isDragging: boolean) {
    const switchElement = scopeSwitchRef.current;
    if (!switchElement) return;
    const clampedPosition = Math.min(Math.max(position, 0), myProductScopeOrder.length - 1);
    switchElement.style.setProperty("--scope-position", String(clampedPosition));
    if (isDragging) {
      switchElement.dataset.scopeDragging = "true";
    } else {
      delete switchElement.dataset.scopeDragging;
    }
  }
  const prevScopeRef = useRef(myProductScope);
  useEffect(() => {
    if (prevScopeRef.current !== myProductScope) {
      prevScopeRef.current = myProductScope;
      if (myProductScope !== "families") setIsCalendarOpen(false);
      setIsHistoryOpen(false);
      setSearchTerm("");
    }
  }, [myProductScope]);
  useLayoutEffect(() => {
    // Капсулой владеет свайп-пейджер, поэтому стартовую позицию выставляем сами:
    // ProductScopeSwitch в режиме imperativePosition не пишет --scope-position.
    // Позиция нужна при монтировании и при любых сменах scope, дальше её ведёт пейджер.
    handleScopePositionChange(myProductScopeOrder.indexOf(myProductScope), false);
  }, [myProductScope]);
  const visibleFamilies = mode === "actions" ? actionFamilies : families;

  const searchedFamilies = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return visibleFamilies;
    return visibleFamilies.filter((item) => {
      const serviceName = item.family.service_name.toLowerCase();
      const planName = (item.family.plan_name ?? "").toLowerCase();
      const desc = (item.family.description ?? "").toLowerCase();
      return (
        serviceName.includes(term) ||
        planName.includes(term) ||
        desc.includes(term)
      );
    });
  }, [visibleFamilies, searchTerm]);

  const filteredFamilies = searchedFamilies.filter(
    (item) =>
      ((familyRoleFilter === "all" || item.membership.role === familyRoleFilter) &&
       (familyFilter === "all" || item.family.family_type === familyFilter))
  );
  const myAccountListingsQuery = useMyAccountListings(
    mode === "mine"
  );
  const myAccountListings = myAccountListingsQuery.data ?? [];
  const searchedAccountListings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return myAccountListings;
    return myAccountListings.filter((item) => {
      const title = item.title.toLowerCase();
      const serviceName = item.service.name.toLowerCase();
      const desc = (item.description ?? "").toLowerCase();
      return title.includes(term) || serviceName.includes(term) || desc.includes(term);
    });
  }, [myAccountListings, searchTerm]);

  const myGigabytesListingsQuery = useMyMarketplaceListings(
    mode === "mine"
  );
  const myGigabytesListings = myGigabytesListingsQuery.data ?? [];
  const searchedGigabytesListings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return myGigabytesListings;
    return myGigabytesListings.filter((item) => {
      const operatorName = item.operator.name.toLowerCase();
      const desc = (item.description ?? "").toLowerCase();
      return operatorName.includes(term) || desc.includes(term);
    });
  }, [myGigabytesListings, searchTerm]);
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

  const sellerGbRequestsQuery = useMarketplaceRequests("seller", mode === "actions");
  const buyerGbRequestsQuery = useMarketplaceRequests(
    "buyer",
    mode === "actions" || (mode === "mine" && myProductScope === "gigabytes")
  );
  const sellerAccountRequestsQuery = useAccountRequests("seller", mode === "actions");
  const buyerAccountRequestsQuery = useAccountRequests(
    "buyer",
    mode === "actions" || (mode === "mine" && myProductScope === "accounts")
  );

  const sellerGbRequests = sellerGbRequestsQuery.data ?? [];
  const buyerGbRequests = buyerGbRequestsQuery.data ?? [];
  const sellerAccountRequests = sellerAccountRequestsQuery.data ?? [];
  const buyerAccountRequests = buyerAccountRequestsQuery.data ?? [];

  const myAccountPurchaseRequests = buyerAccountRequests;
  const myGigabytesPurchaseRequests = buyerGbRequests;

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
  const paymentActionCount = families.reduce(
    (total, item) =>
      total +
      item.payments.filter((payment) =>
        ["due", "overdue", "payment_reported"].includes(payment.status)
      ).length,
    0
  );
  const accessActionCount = families.filter((item) =>
    ["awaiting_access", "awaiting_confirmation"].includes(item.membership.status)
  ).length;

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

  const sellerGbActiveCount = sellerGbRequests.filter((r) =>
    ["pending", "accepted"].includes(r.status)
  ).length;
  const sellerAccountActiveCount = sellerAccountRequests.filter((r) =>
    ["pending", "accepted"].includes(r.status)
  ).length;
  const buyerGbActiveCount = buyerGbRequests.filter((r) =>
    ["pending", "accepted"].includes(r.status)
  ).length;
  const buyerAccountActiveCount = buyerAccountRequests.filter((r) =>
    ["pending", "accepted"].includes(r.status)
  ).length;

  const familiesInboxCount = ownerRequestCount + ownerReportedPaymentsCount;
  const familiesOutboxCount = pendingRequestCount + memberActionFamilies.length;
  const familiesActionCount = familiesInboxCount + familiesOutboxCount;

  const accountsInboxCount = Math.max(sellerAccountActiveCount, accountSalesActionCount);
  const accountsOutboxCount = Math.max(buyerAccountActiveCount, accountPurchaseActionCount);
  const accountsActionCount = accountsInboxCount + accountsOutboxCount;

  const inboxTotalCount =
    sellerGbRequests.length + sellerAccountRequests.length + ownerActionFamilies.length;
  const outboxTotalCount =
    buyerGbRequests.length +
    buyerAccountRequests.length +
    requests.length +
    memberActionFamilies.length;

  const userSelectedTabRef = useRef<boolean>(false);
  const [actionsTab, setActionsTab] = useState<"inbox" | "outbox">(
    () => initialActionsTab ?? (inboxTotalCount === 0 && outboxTotalCount > 0 ? "outbox" : "inbox")
  );
  const [actionsCategory, setActionsCategory] = useState<ActionsCategoryFilter>("all");
  const [actionsStatus, setActionsStatus] = useState<ActionsStatusFilter>("all");
  const actionsRoleSwitchRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    actionsRoleSwitchRef.current?.style.setProperty(
      "--scope-position",
      actionsTab === "outbox" ? "1" : "0"
    );
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

  const actionsCount = actionsTab === "inbox" ? visibleInboxCount : visibleOutboxCount;
  const actionsFeedSnap = useFeedSnap({
    enabled: mode === "actions",
    itemCount: actionsCount
  });


  const hasMarketplaceSalesActions =

    mode === "actions" &&
    marketplaceSalesActionCount > 0 &&
    Boolean(onOpenMarketplaceSalesActions);
  const hasMarketplacePurchaseActions =
    mode === "actions" &&
    marketplacePurchaseActionCount > 0 &&
    Boolean(onOpenMarketplacePurchaseActions);
  const hasAccountSalesActions =
    mode === "actions" &&
    accountSalesActionCount > 0 &&
    Boolean(onOpenAccountSalesActions);
  const hasAccountPurchaseActions =
    mode === "actions" &&
    accountPurchaseActionCount > 0 &&
    Boolean(onOpenAccountPurchaseActions);
  const hasMarketplaceActions =
    hasMarketplaceSalesActions ||
    hasMarketplacePurchaseActions ||
    hasAccountSalesActions ||
    hasAccountPurchaseActions;
  const hasFamilyActions =
    pendingRequestCount + ownerRequestCount + paymentActionCount + accessActionCount > 0;
  const showFilteredFamiliesEmptyState =
    mode === "mine" &&
    families.length > 0 &&
    (familyRoleFilter !== "all" || familyFilter !== "all" || Boolean(searchTerm.trim())) &&
    filteredFamilies.length === 0;
  const showFamiliesEmptyState =
    filteredFamilies.length === 0 &&
    (mode === "mine" || (!hasFamilyActions && !hasMarketplaceActions));


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

  const renderFamilySection = () => (
    <div className="my-feed-scroll">
      {isLoading && visibleFamilies.length === 0 ? (
        <FamilyListSkeleton count={3} />
      ) : showFamiliesEmptyState ? (
        <EmptyState
          className={mode === "mine" ? "my-family-empty-state" : undefined}
          icon={mode === "mine" ? <SystemSymbol name={searchTerm.trim() ? "magnifyingglass" : "person.2"} size={32} /> : undefined}
          title={
            mode === "actions"
              ? "Сейчас нет действий"
              : searchTerm.trim() && filteredFamilies.length === 0
                ? "Ничего не найдено"
                : showFilteredFamiliesEmptyState
                  ? "По выбранным фильтрам пусто"
                  : "Пока нет семей"
          }
        >
          {mode === "actions" ? (
            "Когда появится заявка, доступ или оплата, она будет здесь."
          ) : searchTerm.trim() && filteredFamilies.length === 0 ? (
            <>
              <span>Попробуйте изменить поисковый запрос или сбросить фильтры.</span>
              <AppButton type="button" variant="secondary" size="sm" onClick={() => setSearchTerm("")}>
                Сбросить поиск
              </AppButton>
            </>
          ) : showFilteredFamiliesEmptyState ? (
            "Измените тип или роль, чтобы увидеть остальные семьи."
          ) : (
            <>
              <span>Найдите подходящую семью или создайте свою.</span>
              {onOpenMarket ? (
                <AppButton type="button" variant="primary" size="sm" onClick={onOpenMarket}>
                  Открыть Маркет
                </AppButton>
              ) : null}
            </>
          )}
        </EmptyState>
      ) : (
        <div className="sm-market-family-list">
          {filteredFamilies.map((item) => {
            const details = ownerDetails[item.family.id];
            return (
              <article
                className={mode === "mine" && expandedFamilyId !== item.family.id ? "my-family-preview" : "family-workspace"}
                data-family-id={item.family.id}
                data-testid="family-workspace"
                key={item.membership.id}
              >
                {mode === "mine" ? (
                  <FamilyListingCard
                    family={item.family}
                    isOwner={item.membership.role === "owner"}
                    status={item.membership.role === "owner" ? null : memberCardStatus(item)}
                    onClick={() => setExpandedFamilyId((current) => current === item.family.id ? null : item.family.id)}
                  />
                ) : null}
                {mode !== "mine" || expandedFamilyId === item.family.id ? (
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
                ) : null}
              </article>
            );
          })}
          {hasMoreFamilies && onLoadMoreFamilies ? (
            <AppButton
              type="button"
              variant="secondary"
              fullWidth
              disabled={isLoadingMoreFamilies}
              onClick={onLoadMoreFamilies}
            >
              {isLoadingMoreFamilies ? "Загружаем семьи..." : "Показать ещё семьи"}
            </AppButton>
          ) : null}
        </div>
      )}
    </div>
  );

  if (loadError) {
    return <Panel title={mode === "actions" ? "Заявки" : "Мои"}>
      <div className="ui-feedback ui-feedback-error" role="alert">
        <strong>Не удалось загрузить данные</strong>
        <p>Проверьте соединение и попробуйте ещё раз.</p>
        <AppButton variant="secondary" onClick={onRetry}>Повторить</AppButton>
      </div>
    </Panel>;
  }

  return (
    <div
      className={mode === "actions" ? "actions-screen" : "my-screen"}
      data-testid={mode === "actions" ? "actions-screen" : "my-screen"}
    >
      <Panel
        title={mode === "actions" ? "Заявки" : "Мои"}
        action={
          mode === "mine" ? (
            <MyScreenContextAction
              scope={myProductScope}
              isCalendarOpen={isCalendarOpen}
              onToggleCalendar={() => setIsCalendarOpen((open) => !open)}
              isHistoryOpen={isHistoryOpen}
              onToggleHistory={() => setIsHistoryOpen((open) => !open)}
            />
          ) : undefined
        }
      >
        {mode === "mine" ? (
          <div className="my-screen-filters">
            <ProductScopeSwitch
              ref={scopeSwitchRef}
              value={myProductScope}
              familiesLabel="Подписки"
              activateOnPointerDown
              imperativePosition
              onChange={onChangeProductScope}
            />
          </div>
        ) : null}
        {mode === "mine" ? (
          <MyProductScopePager
            value={myProductScope}
            onChange={onChangeProductScope}
            onDragPositionChange={handleScopePositionChange}
            renderPane={(scope) => {
              if (scope === "accounts") {
                return (
                  <MyAccountListingsSection
                    listings={searchedAccountListings}
                    rawCount={myAccountListings.length}
                    searchTerm={searchTerm}
                    onResetSearch={() => setSearchTerm("")}
                    query={myAccountListingsQuery}
                    onOpenListing={onOpenAccountListing}
                    onCreateListing={onCreateAccountListing}
                    onOpenMarket={onOpenMarket}
                    isHistoryOpen={isHistoryOpen}
                  />
                );
              }
              if (scope === "gigabytes") {
                return (
                  <MyGigabytesSection
                    listings={searchedGigabytesListings}
                    rawCount={myGigabytesListings.length}
                    searchTerm={searchTerm}
                    onResetSearch={() => setSearchTerm("")}
                    listingsQuery={myGigabytesListingsQuery}
                    onOpenListing={onOpenGigabytesListing}
                    onCreateListing={onCreateGigabytesListing}
                    onOpenMarket={onOpenMarket}
                    isHistoryOpen={isHistoryOpen}
                  />
                );
              }
              return (
                <>
                  <div className="my-family-filter-row">
                    <div className="my-family-section-heading">
                      <h2 className="my-family-section-title">Семьи</h2>
                      <span className="my-family-section-count">{filteredFamilies.length}</span>
                    </div>
                    <FamilyRoleChip
                      value={familyRoleFilter}
                      onChange={setFamilyRoleFilter}
                    />
                    <MyFamilyFilter
                      value={familyFilter}
                      onChange={setFamilyFilter}
                    />
                  </div>
                  <div
                    id="my-family-calendar"
                    className={`my-calendar-disclosure${isCalendarOpen ? " is-open" : ""}`}
                    aria-hidden={!isCalendarOpen}
                    inert={!isCalendarOpen}
                  >
                    <div className="my-calendar-disclosure-content">
                      <PaymentCalendar families={filteredFamilies} />
                    </div>
                  </div>
                  {renderFamilySection()}
                </>
              );
            }}
          />
        ) : (
          <>
            <div className="actions-screen-filters">
              <div
                ref={actionsRoleSwitchRef}
                className="product-scope-switch"
                role="group"
                aria-label="Разделы заявок"
                style={{ "--scope-position": actionsTab === "outbox" ? 1 : 0 } as React.CSSProperties}
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
                    actionsFeedSnap.containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
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
                    actionsFeedSnap.containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
                  }}
                >
                  Исходящие
                </AppButton>
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

            <div
              className="actions-tab-content my-feed-scroll"
              ref={actionsFeedSnap.containerRef}
              {...actionsFeedSnap.scrollHandlers}
              data-testid={actionsTab === "inbox" ? "actions-inbox-pane" : "actions-outbox-pane"}
            >
              {actionsTab === "inbox" ? (
                inboxTotalCount === 0 ? (
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
                )
              ) : (
                outboxTotalCount === 0 ? (
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
                )
              )}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}



function MyScreenContextAction({
  scope,
  isCalendarOpen,
  onToggleCalendar,
  isHistoryOpen,
  onToggleHistory
}: {
  scope: MyProductScope;
  isCalendarOpen: boolean;
  onToggleCalendar: () => void;
  isHistoryOpen: boolean;
  onToggleHistory: () => void;
}) {
  if (scope === "families") {
    return (
      <button
        type="button"
        className={`my-screen-context-action${isCalendarOpen ? " is-active" : ""}`}
        aria-expanded={isCalendarOpen}
        aria-controls="my-family-calendar"
        aria-label="Календарь"
        title="Календарь платежей"
        data-testid="my-family-calendar-trigger"
        onClick={() => {
          triggerTelegramImpact("light");
          onToggleCalendar();
        }}
      >
        <SystemSymbol name="calendar" size={24} />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`my-screen-context-action${isHistoryOpen ? " is-active" : ""}`}
      aria-expanded={isHistoryOpen}
      aria-controls={scope === "accounts" ? "my-account-orders" : "my-gigabytes-orders"}
      aria-label="История"
      title="История заказов"
      data-testid={scope === "accounts" ? "my-accounts-orders-trigger" : "my-gigabytes-orders-trigger"}
      onClick={() => {
        triggerTelegramImpact("light");
        onToggleHistory();
      }}
    >
      <SystemSymbol name="clock" size={24} />
    </button>
  );
}


function ActionsCategoryChip({
  value,
  onChange
}: {
  value: ActionsCategoryFilter;
  onChange: (value: ActionsCategoryFilter) => void;
}) {
  const activeIndex = actionsCategoryFilterOptions.findIndex((option) => option.value === value);
  const activeOption = actionsCategoryFilterOptions[activeIndex >= 0 ? activeIndex : 0];

  return (
    <button
      type="button"
      className={`sm-market-filter-chip${value !== "all" ? " is-active" : ""}`}
      aria-label={`Фильтр раздела: ${activeOption.label}. Нажмите для переключения`}
      data-testid="actions-category-filter-chip"
      onClick={() => {
        triggerTelegramImpact("light");
        onChange(
          actionsCategoryFilterOptions[
            (activeIndex + 1) % actionsCategoryFilterOptions.length
          ].value
        );
      }}
    >
      <SystemSymbol name={activeOption.icon} size={14} />
      <span data-testid="actions-category-filter-label">{activeOption.label}</span>
    </button>
  );
}

function ActionsStatusChip({
  value,
  onChange
}: {
  value: ActionsStatusFilter;
  onChange: (value: ActionsStatusFilter) => void;
}) {
  const activeIndex = actionsStatusFilterOptions.findIndex((option) => option.value === value);
  const activeOption = actionsStatusFilterOptions[activeIndex >= 0 ? activeIndex : 0];

  return (
    <div className="my-family-filter-actions">
      <button
        type="button"
        className={`sm-market-filter-chip${value !== "all" ? " is-active" : ""}`}
        aria-label={`Фильтр статуса: ${activeOption.label}. Нажмите для переключения`}
        data-testid="actions-status-filter-chip"
        onClick={() => {
          triggerTelegramImpact("light");
          onChange(
            actionsStatusFilterOptions[
              (activeIndex + 1) % actionsStatusFilterOptions.length
            ].value
          );
        }}
      >
        <SystemSymbol name={activeOption.icon} size={14} />
        <span data-testid="actions-status-filter-label">{activeOption.label}</span>
      </button>
    </div>
  );
}

function FamilyRoleChip({

  value,
  onChange
}: {
  value: MyFamilyRoleFilter;
  onChange: (value: MyFamilyRoleFilter) => void;
}) {
  const activeIndex = myFamilyRoleFilterOptions.findIndex((option) => option.value === value);
  const activeOption = myFamilyRoleFilterOptions[activeIndex >= 0 ? activeIndex : 0];

  return (
    <button
      type="button"
      className={`sm-market-filter-chip${value !== "all" ? " is-active" : ""}`}
      aria-label={`Фильтр роли: ${activeOption.label}. Нажмите для переключения`}
      data-testid="my-family-role-chip"
      onClick={() =>
        onChange(
          myFamilyRoleFilterOptions[
            (activeIndex + 1) % myFamilyRoleFilterOptions.length
          ].value
        )
      }
    >
      <SystemSymbol name={activeOption.icon} size={14} />
      <span data-testid="my-family-role-label">{activeOption.label}</span>
    </button>
  );
}


function MyFamilyFilter({
  value,
  onChange
}: {
  value: MyFamilyFilter;
  onChange: (value: MyFamilyFilter) => void;
}) {
  const activeOption = myFamilyFilterOptions.find((option) => option.value === value) ?? myFamilyFilterOptions[0];
  const activeIndex = myFamilyFilterOptions.findIndex((option) => option.value === activeOption.value);

  return (
    <div className="my-family-filter-actions">
      <button
        type="button"
        className={`sm-market-filter-chip${value !== "all" ? " is-active" : ""}`}
        aria-label={`Фильтр семей: ${activeOption.label}. Нажмите для следующего фильтра`}
        title="Сменить тип семей"
        data-testid="my-family-filter-button"
        onClick={() => onChange(myFamilyFilterOptions[(activeIndex + 1) % myFamilyFilterOptions.length].value)}
      >
        <SystemSymbol name="sort" size={14} />
        <span data-testid="my-family-filter-label">{activeOption.label}</span>
      </button>
    </div>
  );
}


type PaymentCalendarEvent = {
  dateKey: string;
  family: MyFamily;
};

function parseCalendarDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return { year, month: month - 1, day };
}

function calendarMonthKey(year: number, month: number) {
  return year * 12 + month;
}

function calendarDateKey(year: number, month: number, day: number) {
  return [year, String(month + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function calendarMonthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function calendarDateValue(value: string | null) {
  if (!value) return null;
  const { year, month, day } = parseCalendarDate(value);
  return new CalendarDate(year, month + 1, day);
}

function calendarDateKeyFromValue(value: CalendarDate) {
  return calendarDateKey(value.year, value.month - 1, value.day);
}

function calendarDayLabel(value: string) {
  const { year, month, day } = parseCalendarDate(value);
  return new Intl.DateTimeFormat("ru-KZ", {
    day: "numeric",
    month: "long"
  }).format(new Date(year, month, day));
}

function getCalendarInitialMonth(families: MyFamily[]) {
  const nextPayment = [...families]
    .filter((item) => !["closed"].includes(item.family.status))
    .sort((left, right) => left.family.next_payment_date.localeCompare(right.family.next_payment_date))[0]
    ?.family.next_payment_date;
  if (!nextPayment) return calendarMonthStart(new Date());
  const { year, month } = parseCalendarDate(nextPayment);
  return new Date(year, month, 1);
}

function getPaymentCalendarEvents(families: MyFamily[], visibleMonth: Date): PaymentCalendarEvent[] {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const visibleKey = calendarMonthKey(year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return families.flatMap((item) => {
    const family = item.family;
    if (!["active", "full", "closing"].includes(family.status)) return [];

    const nextPayment = parseCalendarDate(family.next_payment_date);
    const nextPaymentKey = calendarMonthKey(nextPayment.year, nextPayment.month);
    if (visibleKey < nextPaymentKey) return [];
    if (family.period === "yearly" && month !== nextPayment.month) return [];

    const day = Math.min(nextPayment.day, daysInMonth);
    return [{
      dateKey: calendarDateKey(year, month, day),
      family: item
    }];
  });
}

function PaymentCalendar({ families }: { families: MyFamily[] }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<Animation | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; dx: number; dragging: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [visibleMonth, setVisibleMonth] = useState(() => getCalendarInitialMonth(families));
  const previousMonthRef = useRef(visibleMonth.getTime());
  useEffect(() => {
    const previous = previousMonthRef.current;
    previousMonthRef.current = visibleMonth.getTime();
    const grid = gridRef.current;
    if (!grid || previous === visibleMonth.getTime()) return;
    motionRef.current?.cancel();
    grid.style.transform = "";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const direction = visibleMonth.getTime() > previous ? 1 : -1;
    motionRef.current = grid.animate([
      { transform: `translateX(${reduced ? 0 : direction * 48}px)`, opacity: 0 },
      { transform: "translateX(0)", opacity: 1 }
    ], { duration: reduced ? 100 : 300, easing: "cubic-bezier(.22, 1, .36, 1)" });
    return () => motionRef.current?.cancel();
  }, [visibleMonth]);
  const [focusedValue, setFocusedValue] = useState(() => {
    const initialMonth = getCalendarInitialMonth(families);
    return new CalendarDate(initialMonth.getFullYear(), initialMonth.getMonth() + 1, 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);
  const selectionListRef = useRef<HTMLDivElement | null>(null);
  const events = getPaymentCalendarEvents(families, visibleMonth);
  const eventsByDate = new Map<string, PaymentCalendarEvent[]>();

  for (const event of events) {
    const current = eventsByDate.get(event.dateKey) ?? [];
    current.push(event);
    eventsByDate.set(event.dateKey, current);
  }

  useEffect(() => {
    setSelectedDateKey(null);
    setIsSelectionOpen(false);
  }, [visibleMonth]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const selectedEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) ?? [] : [];
  const total = events.reduce((sum, event) => sum + event.family.family.member_share_kzt, 0);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  useEffect(() => {
    if (!selectedEvents.length || !isSelectionOpen) return;
    const el = selectionListRef.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const items = el.querySelectorAll(".my-payment-calendar-selection-item");
    if (items.length) {
      gsap.fromTo(
        items,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.24, stagger: 0.04, ease: "power2.out", overwrite: "auto" }
      );
    }
  }, [selectedDateKey, isSelectionOpen, selectedEvents.length]);

  function handleCalendarFocusChange(value: CalendarDate) {
    setFocusedValue(value);
    const nextMonth = new Date(value.year, value.month - 1, 1);
    if (calendarMonthKey(nextMonth.getFullYear(), nextMonth.getMonth()) !== calendarMonthKey(year, month)) {
      setVisibleMonth(nextMonth);
    }
  }

  function handleCalendarDayClick(value: CalendarDate) {
    const dateKey = calendarDateKeyFromValue(value);
    if (!eventsByDate.has(dateKey)) return;
    if (selectedDateKey === dateKey && isSelectionOpen) {
      setSelectedDateKey(null);
      setIsSelectionOpen(false);
      return;
    }
    setSelectedDateKey(dateKey);
    setIsSelectionOpen(true);
  }

  function handleToday() {
    const current = new Date();
    setFocusedValue(new CalendarDate(current.getFullYear(), current.getMonth() + 1, current.getDate()));
    setVisibleMonth(calendarMonthStart(current));
  }

  return (
    <section className="my-payment-calendar" data-testid="my-payment-calendar" aria-label="Календарь платежей">
      <I18nProvider locale="ru-KZ">
        <Calendar
          className="my-payment-calendar-hero"
          aria-label="Платежи по семьям"
          firstDayOfWeek="mon"
          focusedValue={focusedValue}
          onFocusChange={handleCalendarFocusChange}
          value={calendarDateValue(selectedDateKey)}
          onChange={() => undefined}
        >
          <Calendar.Header className="my-payment-calendar-calendar-header">
            <div className="my-payment-calendar-month-heading">
              <button
                type="button"
                className="my-payment-calendar-month-button"
                aria-label={`${visibleMonth.toLocaleDateString("ru-KZ", { month: "long", year: "numeric" })}. ${isCurrentMonth ? "Текущий месяц" : "Вернуться к текущему месяцу"}`}
                onClick={handleToday}
              >
                <span className="my-payment-calendar-month-name">{visibleMonth.toLocaleDateString("ru-KZ", { month: "long" })}</span>
                <span className="my-payment-calendar-year">
                  {year}
                  <SystemSymbol name="arrow.clockwise" size={12} />
                </span>
              </button>
            </div>
            <div className={`my-payment-calendar-total${events.length ? "" : " is-empty"}`}>
              <span>Итого</span>
              <strong>{events.length ? `${total.toLocaleString("ru-KZ")} ₸` : "Нет платежей"}</strong>
            </div>
            <Calendar.NavButton slot="previous" aria-label="Предыдущий месяц" />
            <Calendar.NavButton slot="next" aria-label="Следующий месяц" />
          </Calendar.Header>
          <div
            className="my-calendar-month-viewport"
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!event.isPrimary || event.button !== 0) return;
              suppressClickRef.current = false;
              dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dragging: false };
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.id !== event.pointerId) return;
              drag.dx = event.clientX - drag.x;
              if (!drag.dragging) {
                if (Math.max(Math.abs(drag.dx), Math.abs(event.clientY - drag.y)) < 8) return;
                if (Math.abs(event.clientY - drag.y) > Math.abs(drag.dx)) {
                  dragRef.current = null;
                  return;
                }
                drag.dragging = true;
                suppressClickRef.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                motionRef.current?.cancel();
              }
              if (gridRef.current) gridRef.current.style.transform = `translateX(${drag.dx}px)`;
            }}
            onPointerUp={(event) => {
              const drag = dragRef.current;
              dragRef.current = null;
              if (!drag?.dragging) return;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              if (Math.abs(drag.dx) >= 48) {
                handleCalendarFocusChange(new CalendarDate(year, month + 1, 1).add({ months: drag.dx < 0 ? 1 : -1 }));
              } else if (gridRef.current) {
                const from = gridRef.current.style.transform;
                gridRef.current.style.transform = "";
                motionRef.current = gridRef.current.animate([{ transform: from }, { transform: "translateX(0)" }], { duration: 200, easing: "ease-out" });
              }
            }}
            onPointerCancel={() => {
              dragRef.current = null;
              if (gridRef.current) gridRef.current.style.transform = "";
            }}
            onClickCapture={(event) => {
              if (!suppressClickRef.current) return;
              event.preventDefault();
              event.stopPropagation();
              suppressClickRef.current = false;
            }}
          >
          <div ref={gridRef}>
          <Calendar.Grid weekdayStyle="short">
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => {
                const dateKey = calendarDateKeyFromValue(date);
                const dayEvents = eventsByDate.get(dateKey) ?? [];
                const previewEvent = dayEvents.find((event) => {
                  const serviceSlug = event.family.family.service_slug?.toLowerCase() ?? "";
                  const serviceName = event.family.family.service_name?.toLowerCase() ?? "";
                  return serviceSlug.includes("youtube") || serviceName.includes("youtube");
                }) ?? dayEvents[0];
                const dayLabel = dayEvents.length
                  ? `${calendarDayLabel(dateKey)}: ${dayEvents.map((event) => familyTitle(event.family.family)).join(", ")}`
                  : calendarDayLabel(dateKey);
                const eventDescriptionId = `my-payment-calendar-date-${dateKey}`;

                return (
                  <Calendar.Cell
                    date={date}
                    className={`my-payment-calendar-hero-cell${dayEvents.length ? " has-event" : ""}`}
                    aria-label={dayLabel}
                    aria-describedby={dayEvents.length ? eventDescriptionId : undefined}
                    onClick={() => handleCalendarDayClick(date)}
                  >
                    {({ formattedDate, isOutsideMonth }) => (
                      <>
                        <span className="my-payment-calendar-event-logos">
                          {previewEvent ? (
                            <ServiceLogo
                              key={previewEvent.family.family.id}
                              serviceSlug={previewEvent.family.family.service_slug}
                              serviceName={previewEvent.family.family.service_name}
                              familyType={previewEvent.family.family.family_type}
                              size={32}
                            />
                          ) : null}
                        </span>
                        {dayEvents.length > 1 ? <small className="my-payment-calendar-extra-count">+{dayEvents.length - 1}</small> : null}
                        <span className="my-payment-calendar-day-number">
                          {isOutsideMonth ? "" : formattedDate}
                        </span>
                        {dayEvents.length ? (
                          <span id={eventDescriptionId} className="sr-only">
                            {dayEvents.map((event) => familyTitle(event.family.family)).join(", ")}
                          </span>
                        ) : null}
                      </>
                    )}
                  </Calendar.Cell>
                );
              }}
            </Calendar.GridBody>
          </Calendar.Grid>
          </div>
          </div>
        </Calendar>
      </I18nProvider>

      <div
        className={`my-payment-calendar-selection-wrap${isSelectionOpen && selectedEvents.length ? " is-open" : ""}`}
        aria-hidden={!isSelectionOpen || selectedEvents.length === 0}
      >
        <div className="my-payment-calendar-selection" aria-live="polite">
          {selectedEvents.length > 0 ? (
            <>
              <div className="my-payment-calendar-selection-heading">
                {selectedDateKey ? calendarDayLabel(selectedDateKey) : ""}
              </div>
              <div className="my-payment-calendar-selection-list" ref={selectionListRef}>
                {selectedEvents.map((event) => (
                  <div className="my-payment-calendar-selection-item" key={event.family.family.id}>
                    <ServiceLogo
                      serviceSlug={event.family.family.service_slug}
                      serviceName={event.family.family.service_name}
                      familyType={event.family.family.family_type}
                      size={24}
                    />
                    <strong>{familyTitle(event.family.family)}</strong>
                    <span>{event.family.family.member_share_kzt.toLocaleString("ru-KZ")} ₸</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

    </section>
  );
}

type MyAccountListingsQuery = ReturnType<typeof useMyAccountListings>;
type MyGigabytesListingsQuery = ReturnType<typeof useMyMarketplaceListings>;
type MyTradeRequestsQuery = {
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
};
type MyTradeRequestPreview = {
  id: string;
  title: string;
  subtitle?: string;
  serviceSlug?: string;
  serviceName: string;
  price: number;
  status: string;
  rawStatus: string;
  counterparty?: string | null;
  date?: string;
  telegramUrl?: string | null;
  telegramDraft?: string | null;
  showMeta?: boolean;
  canRemind?: boolean;
  reminderAvailableAt?: string | null;
  scope?: "accounts" | "gigabytes";
};
type HistoryTab = "purchases" | "sales";

function MyHistorySection({
  isOpen,
  scope
}: {
  isOpen: boolean;
  scope: "accounts" | "gigabytes";
}) {
  const [tab, setTab] = useState<HistoryTab>("purchases");

  useEffect(() => {
    if (isOpen) {
      setTab("purchases");
    }
  }, [isOpen, scope]);

  const accountBuyerQuery = useAccountRequests("buyer", scope === "accounts" && isOpen);
  const accountSellerQuery = useAccountRequests("seller", scope === "accounts" && isOpen);
  const gbBuyerQuery = useMarketplaceRequests("buyer", scope === "gigabytes" && isOpen);
  const gbSellerQuery = useMarketplaceRequests("seller", scope === "gigabytes" && isOpen);

  const isAccounts = scope === "accounts";
  const buyerRequests = isAccounts ? (accountBuyerQuery.data ?? []) : (gbBuyerQuery.data ?? []);
  const sellerRequests = isAccounts ? (accountSellerQuery.data ?? []) : (gbSellerQuery.data ?? []);
  const buyerQuery = isAccounts ? accountBuyerQuery : gbBuyerQuery;
  const sellerQuery = isAccounts ? accountSellerQuery : gbSellerQuery;

  const activeRequests = tab === "purchases" ? buyerRequests : sellerRequests;
  const activeQuery = tab === "purchases" ? buyerQuery : sellerQuery;

  const mappedRequests: MyTradeRequestPreview[] = isAccounts
    ? (activeRequests as AccountRequest[]).map((request) => ({
        id: request.id,
        title: request.title,
        subtitle: request.service_name,
        serviceSlug: request.service_slug,
        serviceName: request.service_name,
        price: request.price_kzt,
        status: myTradeRequestStatus(request.status),
        rawStatus: request.status,
        counterparty: request.counterparty_username,
        date: formatDate(accountOrderDate(request)),
        telegramUrl: request.telegram_url,
        telegramDraft: request.telegram_draft,
        showMeta: true,
        canRemind: Boolean(request.can_remind),
        reminderAvailableAt: request.reminder_available_at,
        scope: "accounts"
      }))
    : (activeRequests as MarketplaceListingRequest[]).map((request) => ({
        id: request.id,
        title: `${request.operator_name} · ${request.amount_gb} ГБ`,
        subtitle: "Пакет ГБ",
        serviceSlug: `${request.operator_slug}-family-tariff`,
        serviceName: request.operator_name,
        price: request.total_price_kzt,
        status: myTradeRequestStatus(request.status),
        rawStatus: request.status,
        counterparty: request.counterparty_username,
        date: formatDate(request.created_at),
        telegramUrl: request.telegram_url,
        telegramDraft: request.telegram_draft,
        canRemind: Boolean(request.can_remind),
        reminderAvailableAt: request.reminder_available_at,
        scope: "gigabytes"
      }));

  const emptyMessage = tab === "purchases"
    ? (isAccounts ? "Здесь появятся купленные вами аккаунты." : "Здесь появятся выбранные вами пакеты.")
    : (isAccounts ? "Здесь появятся заявки на ваши аккаунты." : "Здесь появятся заявки на ваши пакеты.");

  return (
    <section className="my-history-section" data-testid="my-history-section">
      <div className="my-family-filter-row my-generic-section-heading">
        <div className="my-family-section-heading">
          <h2 className="my-family-section-title">История</h2>
          <span className="my-family-section-count">{activeRequests.length}</span>
        </div>
        <div className="my-account-filter-chips">
          <button
            type="button"
            className="sm-history-filter-chip is-active"
            aria-label={`Раздел истории: ${tab === "purchases" ? "Покупки" : "Продажи"}. Нажмите для переключения`}
            data-testid="my-history-filter-chip"
            onClick={() => setTab((current) => (current === "purchases" ? "sales" : "purchases"))}
          >
            <SystemSymbol name="round-sort-vertical" size={14} />
            <span>{tab === "purchases" ? "Покупки" : "Продажи"}</span>
          </button>
        </div>
      </div>
      <div className="my-history-content">
        <MyTradeRequestsSection
          requests={mappedRequests}
          query={activeQuery}
          tab={tab}
          emptyTitle={tab === "purchases" ? "Покупок пока нет" : "Продаж пока нет"}
          emptyMessage={emptyMessage}
          emptyStateClassName="my-account-orders-empty-state"
        />
      </div>
    </section>
  );
}

function tradeRequestSubtitle(request: MyTradeRequestPreview): string {
  const titleLower = request.title.toLowerCase();
  const serviceLower = request.serviceName?.trim().toLowerCase();
  const titleHasService = Boolean(serviceLower && titleLower.includes(serviceLower));

  if (titleHasService || !request.serviceName) {
    return request.date ?? "";
  }
  return request.date ? `${request.serviceName} · ${request.date}` : request.serviceName;
}

function MyTradeRequestsSection({
  requests,
  query,
  emptyMessage,
  emptyTitle,
  tab,
  title,
  emptyStateClassName,
  headerAction
}: {
  requests: MyTradeRequestPreview[];
  query: MyTradeRequestsQuery;
  tab?: HistoryTab;
  emptyTitle?: string;
  emptyMessage: string;
  title?: string;
  emptyStateClassName?: string;
  headerAction?: React.ReactNode;
}) {
  const remindAccount = useRemindAccountRequest();
  const remindGigabytes = useRemindMarketplaceRequest();
  const { toast } = useToast();
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!requests.length) return;
    const el = listRef.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const items = el.querySelectorAll(".my-trade-request");
    if (items.length) {
      gsap.fromTo(
        items,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.28, stagger: 0.04, ease: "power2.out", overwrite: "auto" }
      );
    }
  }, [tab, requests.length]);

  async function handleRemind(request: MyTradeRequestPreview) {
    if (remindingId) return;
    if (!request.canRemind) {
      triggerTelegramNotification("warning");
      toast.warning({ title: "Повторить можно через 1 час" });
      return;
    }
    try {
      setRemindingId(request.id);
      if (request.scope === "gigabytes") {
        await remindGigabytes.mutateAsync(request.id);
      } else {
        await remindAccount.mutateAsync(request.id);
      }
      triggerTelegramNotification("success");
      toast.success({ title: "Уведомление отправлено" });
    } catch {
      triggerTelegramNotification("error");
      toast.error({ title: "Не удалось отправить уведомление" });
    } finally {
      setRemindingId(null);
    }
  }

  return (
    <AsyncContent query={query} label="Загружаем покупки...">
      <section className="my-account-listings my-trade-requests">
        {title ? (
          <div className="my-family-filter-row my-generic-section-heading">
            <div className="my-family-section-heading">
              <h2 className="my-family-section-title">{title}</h2>
              <span className="my-family-section-count">{requests.length}</span>
            </div>
            {headerAction ? (
              <div className="my-account-filter-chips">
                {headerAction}
              </div>
            ) : null}
          </div>
        ) : null}
        {requests.length === 0 ? (
          <EmptyState className={emptyStateClassName} title={emptyTitle ?? "Покупок пока нет"}>{emptyMessage}</EmptyState>
        ) : (
          <div className="my-trade-request-list" ref={listRef}>
            {requests.map((request) => (
              <article className="my-trade-request" key={request.id}>
                <div className="my-trade-request-body">
                  <div className="my-trade-request-top">
                    <strong className="my-trade-request-title">{request.title}</strong>
                    <span className="my-trade-request-price">{formatMyKzt(request.price)}</span>
                  </div>
                  <div className="my-trade-request-sub">
                    <span className="my-trade-request-service">
                      {tradeRequestSubtitle(request)}
                    </span>
                    <span className={`my-trade-request-status is-${request.rawStatus}`}>
                      <span className="my-trade-request-dot" aria-hidden />
                      <span>{request.status}</span>
                    </span>
                  </div>
                </div>
                <div className="my-trade-request-footer">
                  <span
                    className="my-trade-request-seller"
                    aria-label={tab === "sales" ? `Покупатель: ${request.counterparty ?? "не указан"}` : `Продавец: ${request.counterparty ?? "не указан"}`}
                  >
                    <span className="my-trade-request-avatar" aria-hidden>
                      {request.counterparty ? (
                        request.counterparty.replace(/^@/, "").slice(0, 1).toUpperCase()
                      ) : (
                        <SystemSymbol name="person.crop.circle" size={14} />
                      )}
                    </span>
                    <strong className="my-trade-request-username">
                      {request.counterparty ? `@${request.counterparty}` : "Не указан"}
                    </strong>
                  </span>
                  {request.rawStatus === "accepted" && request.counterparty ? (
                    <button
                      type="button"
                      className="my-trade-request-chat-btn"
                      onClick={() => openTelegramUser(request.counterparty!, request.telegramDraft ?? undefined)}
                    >
                      <SystemSymbol name="message" size={13} />
                      <span>Написать</span>
                    </button>
                  ) : null}
                  {tab === "purchases" && request.rawStatus === "pending" ? (
                    <button
                      type="button"
                      className={`my-trade-request-notify-btn${!request.canRemind ? " is-disabled" : ""}`}
                      disabled={remindingId === request.id}
                      onClick={() => void handleRemind(request)}
                      title={
                        request.canRemind
                          ? "Уведомить продавца"
                          : "Уведомление уже отправлено. Повторить можно через 1 час"
                      }
                    >
                      <SystemSymbol name="bell" size={13} />
                      <span>Уведомить</span>
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
        {query.hasNextPage ? (
          <AppButton
            type="button"
            variant="tertiary"
            fullWidth
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? "Загружаем покупки..." : "Показать ещё"}
          </AppButton>
        ) : null}
      </section>
    </AsyncContent>
  );
}

function accountOrderDate(request: AccountRequest) {
  return request.closed_at ?? request.decided_at ?? request.created_at;
}


function myTradeRequestStatus(status: AccountRequest["status"]) {
  return ({
    pending: "Ожидает ответа",
    accepted: "Можно продолжить",
    rejected: "Отклонена",
    cancelled: "Отменена",
    closed: "Закрыта",
    expired: "Истёк срок"
  } as const)[status];
}

function MyAccountListingsSection({
  listings,
  rawCount = 0,
  searchTerm = "",
  onResetSearch,
  query,
  onOpenListing,
  onCreateListing,
  onOpenMarket,
  isHistoryOpen = false
}: {
  listings: AccountListing[];
  rawCount?: number;
  searchTerm?: string;
  onResetSearch?: () => void;
  query: MyAccountListingsQuery;
  onOpenListing: (listingId: string) => void;
  onCreateListing: () => void;
  onOpenMarket?: () => void;
  isHistoryOpen?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<MyAccountStatusFilter>("all");
  const filteredListings = listings.filter((item) => statusFilter === "all" || item.status === statusFilter);
  const activeIndex = myAccountStatusFilterOptions.findIndex((option) => option.value === statusFilter);
  const activeOption = myAccountStatusFilterOptions[activeIndex >= 0 ? activeIndex : 0];
  return (
    <AsyncContent query={query} label="Загружаем объявления...">
      <section className="my-account-listings">
        <div
          id="my-account-orders"
          className={`my-history-disclosure${isHistoryOpen ? " is-open" : ""}`}
          aria-hidden={!isHistoryOpen}
          inert={!isHistoryOpen}
        >
          <div className="my-history-disclosure-content">
            <MyHistorySection
              scope="accounts"
              isOpen={isHistoryOpen}
            />
          </div>
        </div>
        <div data-testid="my-accounts-screen" className="my-accounts-header-scope">
          <div className="my-family-filter-row my-generic-section-heading">
            <div className="my-family-section-heading">
              <h2 className="my-family-section-title">Аккаунты</h2>
              <span className="my-family-section-count">{filteredListings.length}</span>
            </div>
            <div className="my-account-filter-chips">
              <button
                type="button"
                className={`sm-market-filter-chip${statusFilter !== "all" ? " is-active" : ""}`}
                aria-pressed={statusFilter !== "all"}
                aria-label={`Статус: ${activeOption.label}. Нажмите для переключения`}
                onClick={() =>
                  setStatusFilter(
                    myAccountStatusFilterOptions[(activeIndex + 1) % myAccountStatusFilterOptions.length].value
                  )
                }
              >
                <SystemSymbol name={activeOption.icon} size={14} />
                {activeOption.label}
              </button>
            </div>
          </div>
        </div>
        <div className="my-feed-scroll">
          {listings.length === 0 ? (
            <EmptyState
              className="my-family-empty-state"
              icon={<SystemSymbol name={searchTerm.trim() ? "magnifyingglass" : "key"} size={32} />}
              title={searchTerm.trim() ? "Ничего не найдено" : "Объявлений пока нет"}
            >
              {searchTerm.trim() ? (
                <>
                  <span>Попробуйте изменить поисковый запрос.</span>
                  {onResetSearch ? (
                    <AppButton type="button" variant="secondary" size="sm" onClick={onResetSearch}>
                      Сбросить поиск
                    </AppButton>
                  ) : null}
                </>
              ) : (
                <>
                  <span>Опубликуйте первое предложение доступа к сервису.</span>
                  <AppButton
                    type="button"
                    variant="primary"
                    size="sm"
                    data-testid="my-account-create-button"
                    onClick={onCreateListing}
                  >
                    Добавить объявление
                  </AppButton>
                </>
              )}
            </EmptyState>
          ) : filteredListings.length === 0 ? (
            <EmptyState className="my-family-empty-state" title={`Объявлений со статусом «${activeOption.label.toLowerCase()}» пока нет`}>
              Попробуйте переключить статус.
            </EmptyState>
          ) : (
            <div className="sm-market-family-list">
              {filteredListings.map((listing) => (
                <AccountListingCard
                  key={listing.id}
                  listing={listing}
                  showStatus
                  testId="my-account-listing-card"
                  onClick={() => onOpenListing(listing.id)}
                />
              ))}
            </div>
          )}
          {query.hasNextPage ? (
            <AppButton
              type="button"
              variant="tertiary"
              fullWidth
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? "Загружаем объявления..." : "Показать ещё объявления"}
            </AppButton>
          ) : null}
        </div>
      </section>
    </AsyncContent>
  );
}

function MyGigabytesSection({
  listings,
  rawCount = 0,
  searchTerm = "",
  onResetSearch,
  listingsQuery,
  onOpenListing,
  onCreateListing,
  onOpenMarket,
  isHistoryOpen = false
}: {
  listings: MarketplaceListing[];
  rawCount?: number;
  searchTerm?: string;
  onResetSearch?: () => void;
  listingsQuery: MyGigabytesListingsQuery;
  onOpenListing: (listingId: string) => void;
  onCreateListing: () => void;
  onOpenMarket?: () => void;
  isHistoryOpen?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<MyAccountStatusFilter>("all");
  const filteredListings = listings.filter(
    (item) => statusFilter === "all" || item.status === statusFilter
  );
  const activeStatusIndex = myAccountStatusFilterOptions.findIndex(
    (option) => option.value === statusFilter
  );
  const activeStatusOption =
    myAccountStatusFilterOptions[activeStatusIndex >= 0 ? activeStatusIndex : 0];

  return (
    <AsyncContent query={listingsQuery} label="Загружаем объявления...">
      <section className="my-account-listings" data-testid="my-gigabytes-screen">
        <div
          id="my-gigabytes-orders"
          className={`my-history-disclosure${isHistoryOpen ? " is-open" : ""}`}
          aria-hidden={!isHistoryOpen}
          inert={!isHistoryOpen}
        >
          <div className="my-history-disclosure-content">
            <MyHistorySection
              scope="gigabytes"
              isOpen={isHistoryOpen}
            />
          </div>
        </div>
        <div className="my-family-filter-row my-generic-section-heading">
          <div className="my-family-section-heading">
            <h2 className="my-family-section-title">Гигабайты</h2>
            <span className="my-family-section-count">{filteredListings.length}</span>
          </div>
          <div className="my-gigabytes-filter-chips">
            <button
              type="button"
              className={`sm-market-filter-chip${statusFilter !== "all" ? " is-active" : ""}`}
              aria-pressed={statusFilter !== "all"}
              aria-label={`Статус: ${activeStatusOption.label}. Нажмите для переключения`}
              data-testid="my-gigabytes-status-chip"
              onClick={() =>
                setStatusFilter(
                  myAccountStatusFilterOptions[
                    (activeStatusIndex + 1) % myAccountStatusFilterOptions.length
                  ].value
                )
              }
            >
              <SystemSymbol name={activeStatusOption.icon} size={14} />
              <span>{activeStatusOption.label}</span>
            </button>
          </div>
        </div>

        <div className="my-feed-scroll">
          {listings.length === 0 ? (
            <EmptyState
              className="my-family-empty-state"
              icon={<SystemSymbol name={searchTerm.trim() ? "magnifyingglass" : "globe"} size={32} />}
              title={searchTerm.trim() ? "Ничего не найдено" : "Объявлений пока нет"}
            >
              {searchTerm.trim() ? (
                <>
                  <span>Попробуйте изменить поисковый запрос.</span>
                  {onResetSearch ? (
                    <AppButton type="button" variant="secondary" size="sm" onClick={onResetSearch}>
                      Сбросить поиск
                    </AppButton>
                  ) : null}
                </>
              ) : (
                <>
                  <span>Опубликуйте предложение, чтобы продавать интернет-пакеты.</span>
                  <AppButton
                    type="button"
                    variant="primary"
                    size="sm"
                    data-testid="my-gigabytes-create-button"
                    onClick={onCreateListing}
                  >
                    Добавить объявление
                  </AppButton>
                </>
              )}
            </EmptyState>
          ) : filteredListings.length === 0 ? (
            <EmptyState className="my-family-empty-state" title={`Объявлений со статусом «${activeStatusOption.label.toLowerCase()}» пока нет`}>
              Попробуйте переключить статус.
            </EmptyState>
          ) : (
            <div className="sm-market-family-list">
              {filteredListings.map((listing) => (
                <GigabytesListingCard
                  key={listing.id}
                  listing={listing}
                  showStatus
                  testId="my-gigabytes-listing-card"
                  onClick={() => onOpenListing(listing.id)}
                />
              ))}
            </div>
          )}

          {listingsQuery.hasNextPage ? (
            <AppButton
              type="button"
              variant="tertiary"
              fullWidth
              disabled={listingsQuery.isFetchingNextPage}
              onClick={() => void listingsQuery.fetchNextPage()}
            >
              {listingsQuery.isFetchingNextPage ? "Загружаем объявления..." : "Показать ещё объявления"}
            </AppButton>
          ) : null}
        </div>
      </section>
    </AsyncContent>
  );
}

function MyProductScopePager({
  value,
  onChange,
  renderPane,
  onDragPositionChange,
  ariaLabel = "Разделы Моих объявлений"
}: {
  value: MyProductScope;
  onChange: (value: MyProductScope) => void;
  renderPane: (scope: MyProductScope) => ReactNode;
  onDragPositionChange?: (position: number, isDragging: boolean) => void;
  ariaLabel?: string;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const positionRef = useRef(myProductScopeOrder.indexOf(value));
  const pointerRef = useRef<MyProductScopePointerState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationTargetRef = useRef<number | null>(null);
  const wasSwipedRef = useRef(false);
  const activeIndex = myProductScopeOrder.indexOf(value);
  const pagePercent = 100 / myProductScopeOrder.length;
  const SWIPE_GAP = 16;
  function setPosition(position: number) {
    positionRef.current = position;
    if (trackRef.current) {
      const width = viewportRef.current?.clientWidth || 0;
      if (width > 0) {
        trackRef.current.style.transform = `translate3d(${-position * (width + SWIPE_GAP)}px, 0, 0)`;
      } else {
        trackRef.current.style.transform = `translate3d(calc(${-position * pagePercent}% - ${position * ((SWIPE_GAP * (myProductScopeOrder.length - 1)) / myProductScopeOrder.length)}px), 0, 0)`;
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
    const target = Math.min(Math.max(nextPosition, 0), myProductScopeOrder.length - 1);
    stopAnimation();
    animationTargetRef.current = target;
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
    onDragPositionChange?.(position, true);
    let previousTime = performance.now();
    const step = (time: number) => {
      const deltaTime = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;
      const acceleration = (target - position) * stiffness - velocity * damping;
      velocity += acceleration * deltaTime;
      position += velocity * deltaTime;
      setPosition(position);
      onDragPositionChange?.(position, true);

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
    const lastIndex = myProductScopeOrder.length - 1;
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
    target = Math.min(Math.max(target, 0), myProductScopeOrder.length - 1);
    animateTo(target, -pointer.velocityX / stepSize, "gesture");
    if (target !== activeIndex) {
      triggerTelegramImpact("light");
      onChange(myProductScopeOrder[target]);
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
      className="my-product-scope-swipe-viewport"
      ref={viewportRef}
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
        className="my-product-scope-swipe-track"
        ref={trackRef}
        style={{ transform: `translate3d(calc(${-positionRef.current * pagePercent}% - ${positionRef.current * ((SWIPE_GAP * (myProductScopeOrder.length - 1)) / myProductScopeOrder.length)}px), 0, 0)` }}
      >
        {myProductScopeOrder.map((scope) => (
          <div
            key={scope}
            className="my-product-scope-swipe-pane"
            data-product-scope={scope}
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



function MyRequestsSection({
  requests,
  busy,
  isLoading,
  showEmpty = false,
  onCancelRequest
}: {
  requests: FamilyRequest[];
  busy: string | null;
  isLoading?: boolean;
  showEmpty?: boolean;
  onCancelRequest: (requestId: string) => void;
}) {
  if (isLoading && requests.length === 0) {
    return <FamilyListSkeleton count={1} />;
  }

  if (requests.length === 0) {
    if (!showEmpty) return null;
    return (
      <section className="my-requests-section" data-testid="my-requests-section">
        <div className="section-inline-title">
          <span>Мои заявки</span>
          <Badge>0</Badge>
        </div>
        <EmptyState title="Активных заявок нет">
          Когда вы отправите заявку в семью, её статус появится здесь.
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="my-requests-section actions-feed-group" data-testid="my-requests-section">
      {requests.map((request) => (
        <FamilyTradeRequestCard
          key={request.id}
          request={request}
          busy={busy !== null}
          onCancelRequest={onCancelRequest}
        />
      ))}
    </section>
  );
}

function hasPendingPaymentAction(item: MyFamily) {
  return item.payments.some((payment) =>
    ["due", "overdue", "payment_reported"].includes(payment.status)
  );
}

function hasPendingAccessAction(item: MyFamily) {
  if (item.pending_requests_count > 0) return true;
  return ["awaiting_access", "awaiting_confirmation"].includes(item.membership.status);
}

function hasPendingFamilyAction(item: MyFamily) {
  return hasPendingAccessAction(item) || hasPendingPaymentAction(item);
}

function MemberNextStep({
  member,
  payments
}: {
  member: FamilyMember;
  payments: FamilyPayment[];
}) {
  const openPayment = payments.find((payment) =>
    ["due", "overdue", "payment_reported"].includes(payment.status)
  );
  const step = getMemberStep(member, openPayment);

  return (
    <div className={`member-next-step member-next-step-${step.tone}`}>
      <span>Мой следующий шаг</span>
      <strong>{step.title}</strong>
      <p>{step.text}</p>
    </div>
  );
}

function getMemberStep(member: FamilyMember, payment?: FamilyPayment) {
  if (member.status === "awaiting_access") {
    return {
      tone: "info",
      title: "Ждите доступ от владельца",
      text: "Деньги переводить пока не нужно. Сначала владелец добавляет вас в подписку."
    };
  }
  if (member.status === "awaiting_confirmation") {
    return {
      tone: "warning",
      title: "Проверьте доступ",
      text: "Если подписка работает, нажмите «Доступ получен». После этого откроются реквизиты."
    };
  }
  if (payment?.status === "due" || payment?.status === "overdue") {
    return {
      tone: payment.status === "overdue" ? "danger" : "warning",
      title: "Оплатите владельцу",
      text: "Перевод идет напрямую владельцу. После перевода нажмите «Оплатил»."
    };
  }
  if (payment?.status === "payment_reported") {
    return {
      tone: "info",
      title: "Ждите подтверждение владельца",
      text: "Вы отметили оплату. Владелец должен вручную подтвердить получение."
    };
  }
  return {
    tone: "success",
    title: "Все в порядке",
    text: "Активных действий сейчас нет. Следующее напоминание придет перед датой оплаты."
  };
}

function OwnerWorkSummary({
  pendingRequestsCount,
  activeMembersCount,
  maxMembers,
  freeSlots
}: {
  pendingRequestsCount: number;
  activeMembersCount: number;
  maxMembers: number;
  freeSlots: number;
}) {
  return (
    <div className="owner-work-summary">
      <div>
        <span>Новые заявки</span>
        <strong>{pendingRequestsCount}</strong>
      </div>
      <div>
        <span>Участники</span>
        <strong>
          {activeMembersCount}/{maxMembers}
        </strong>
      </div>
      <div>
        <span>Свободно</span>
        <strong>{freeSlots}</strong>
      </div>
    </div>
  );
}

function OwnerSettingsFormAnimated({ children }: { children: ReactNode }) {
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    gsap.fromTo(
      el,
      { opacity: 0, y: -10, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.26, ease: "power2.out", overwrite: "auto" }
    );
  }, []);

  return <div ref={formRef} className="owner-settings-form">{children}</div>;
}

function OwnerActions({
  family,
  busy,
  onLoadOwnerDetails,
  onUpdateDescription,
  onUpdatePrice,
  onUpdatePaymentDay,
  onCloseFamily,
  onConfirmAvailability
}: {
  family: Family;
  busy: string | null;
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
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(family.description ?? "");
  const [priceDraft, setPriceDraft] = useState(String(family.total_price_kzt));
  const [paymentDayDraft, setPaymentDayDraft] = useState(String(family.payment_day));
  const [nextPaymentDateDraft, setNextPaymentDateDraft] = useState(
    family.next_payment_date
  );
  const today = new Date().toISOString().slice(0, 10);
  const defaultCloseDate =
    family.next_payment_date < today ? today : family.next_payment_date;
  const [closeDateDraft, setCloseDateDraft] = useState(defaultCloseDate);

  useEffect(() => {
    setDescriptionDraft(family.description ?? "");
    setPriceDraft(String(family.total_price_kzt));
    setPaymentDayDraft(String(family.payment_day));
    setNextPaymentDateDraft(family.next_payment_date);
    setCloseDateDraft(
      family.next_payment_date < today ? today : family.next_payment_date
    );
  }, [
    family.description,
    family.next_payment_date,
    family.payment_day,
    family.total_price_kzt,
    today
  ]);

  const descriptionValue = descriptionDraft.trim();
  const priceValue = Number(priceDraft);
  const paymentDayValue = Number(paymentDayDraft);
  const canSubmitPrice = Number.isFinite(priceValue) && priceValue > 0;
  const canSubmitPaymentDay =
    Number.isInteger(paymentDayValue) &&
    paymentDayValue >= 1 &&
    paymentDayValue <= 31 &&
    Boolean(nextPaymentDateDraft);

  return (
    <div className="owner-settings-card">
      <div className="row-actions">
        <AppButton
          type="button"
          size="sm"
          data-testid="owner-details-button"
          disabled={busy !== null}
          onClick={() => onLoadOwnerDetails(family.id)}
        >
          Заявки и участники
        </AppButton>
        <AppButton
          type="button"
          variant="secondary"
          size="sm"
          data-testid="confirm-availability-button"
          disabled={busy !== null || !["active", "full"].includes(family.status)}
          onClick={() => onConfirmAvailability(family.id)}
        >
          Семья актуальна
        </AppButton>
      </div>
      <Typography as="small" variant="body" level={4} className="muted">
        Последнее подтверждение:{" "}
        {family.availability_confirmed_at
          ? new Intl.DateTimeFormat("ru-KZ", {
              dateStyle: "short",
              timeStyle: "short"
            }).format(new Date(family.availability_confirmed_at))
          : "нет данных"}
      </Typography>

      <AppButton
        type="button"
        variant="tertiary"
        fullWidth
        data-testid="owner-settings-toggle"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen((current) => !current)}
      >
        {settingsOpen ? "Скрыть настройки" : "Настройки семьи"}
      </AppButton>

      {settingsOpen ? <OwnerSettingsFormAnimated>
        <div className="owner-settings-grid">
        <Input
          label="Доступ работает до"
          data-testid="close-family-date-input"
          min={today}
          type="date"
          value={closeDateDraft}
          onChange={(event) => setCloseDateDraft(event.target.value)}
        />
        <AppButton
          type="button"
          variant="secondary"
          data-testid="close-family-button"
          disabled={
            busy !== null ||
            !closeDateDraft ||
            closeDateDraft < today ||
            ["closing", "closed"].includes(family.status)
          }
          onClick={() => onCloseFamily(family.id, closeDateDraft)}
        >
          Закрыть семью
        </AppButton>
        </div>
        <Typography as="small" variant="body" level={4} className="muted">
          Семья сразу исчезнет из поиска, а участники увидят точную дату окончания
          доступа.
        </Typography>

        <TextArea
          label="Описание семьи"
          data-testid="owner-description-input"
          rows={3}
          value={descriptionDraft}
          onChange={(event) => setDescriptionDraft(event.target.value)}
        />
        <AppButton
          type="button"
          variant="secondary"
          data-testid="owner-save-description-button"
          disabled={busy !== null}
          onClick={() =>
            onUpdateDescription(family.id, descriptionValue ? descriptionValue : null)
          }
        >
          Сохранить описание
        </AppButton>

        <div className="owner-settings-grid">
          <Input
            label="Общая цена"
            data-testid="owner-price-input"
            min={1}
            type="number"
            value={priceDraft}
            onChange={(event) => setPriceDraft(event.target.value)}
          />
          <AppButton
            type="button"
            variant="secondary"
            data-testid="owner-save-price-button"
            disabled={busy !== null || !canSubmitPrice}
            onClick={() => onUpdatePrice(family.id, priceValue)}
          >
            Изменить цену
          </AppButton>
        </div>
        <Typography as="small" variant="body" level={4} className="muted">
          Цену можно менять один раз в месяц. Участники получат уведомление.
        </Typography>

        <div className="owner-settings-grid">
          <Input
            label="День оплаты"
            data-testid="owner-payment-day-input"
            max={31}
            min={1}
            type="number"
            value={paymentDayDraft}
            onChange={(event) => setPaymentDayDraft(event.target.value)}
          />
          <Input
            label="Следующая дата"
            data-testid="owner-next-payment-date-input"
            type="date"
            value={nextPaymentDateDraft}
            onChange={(event) => setNextPaymentDateDraft(event.target.value)}
          />
          <AppButton
            type="button"
            variant="secondary"
            data-testid="owner-save-payment-day-button"
            disabled={busy !== null || !canSubmitPaymentDay}
            onClick={() =>
              onUpdatePaymentDay(family.id, paymentDayValue, nextPaymentDateDraft)
            }
          >
            Изменить дату оплаты
          </AppButton>
        </div>
        <Typography as="small" variant="body" level={4} className="muted">
          Дату оплаты можно менять только пока семья ещё не была полностью собрана.
        </Typography>
      </OwnerSettingsFormAnimated> : null}
    </div>
  );
}

function MemberActions({
  familyId,
  member,
  familyStatus,
  busy,
  onConfirmAccess,
  onGetRequisite,
  onAcknowledgeClosing,
  onLeaveFamily,
  onCreatePrepayment
}: {
  familyId: string;
  member: FamilyMember;
  familyStatus: string;
  busy: string | null;
  onConfirmAccess: (memberId: string) => void;
  onGetRequisite: (memberId: string) => void;
  onAcknowledgeClosing: (familyId: string) => void;
  onLeaveFamily: (memberId: string) => void;
  onCreatePrepayment: (memberId: string) => void;
}) {
  return (
    <>
      {member.status === "awaiting_confirmation" && (
        <AppButton
          type="button"
          data-testid="confirm-access-button"
          disabled={busy !== null}
          onClick={() => onConfirmAccess(member.id)}
        >
          Доступ получен
        </AppButton>
      )}
      {member.access_confirmed_at && (
        <AppButton
          type="button"
          variant="secondary"
          data-testid="show-requisite-button"
          disabled={busy !== null}
          onClick={() => onGetRequisite(member.id)}
        >
          Показать реквизиты
        </AppButton>
      )}
      {member.status === "active" && ["active", "full"].includes(familyStatus) && (
        <AppButton
          type="button"
          variant="secondary"
          data-testid="create-prepayment-button"
          disabled={busy !== null}
          onClick={() => onCreatePrepayment(member.id)}
        >
          Оплатить следующий период заранее
        </AppButton>
      )}
      {familyStatus === "closing" && (
        <AppButton
          type="button"
          data-testid="acknowledge-closing-button"
          disabled={busy !== null}
          onClick={() => onAcknowledgeClosing(familyId)}
        >
          Понятно, семья закрывается
        </AppButton>
      )}
      <AppButton
        type="button"
        variant="secondary"
        data-testid="leave-family-button"
        disabled={busy !== null}
        onClick={() => onLeaveFamily(member.id)}
      >
        Выйти
      </AppButton>
    </>
  );
}
