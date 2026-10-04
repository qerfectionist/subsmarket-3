import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button as AppButton } from "./components/ui";

import {
  type DevTelegramUser,
  DEV_TELEGRAM_USERS,
  getActiveDevTelegramUser,
  getFamilyByInviteCode,
  isDevUserSwitchVisible,
  setActiveDevTelegramUser
} from "./api";
import type { Tab } from "./appTypes";
import { BottomNav, DevUserSwitch, Shell } from "./components/layout";
import { DevCardsConstructorModal } from "./components/dev/DevCardsConstructorModal";
import { countDevCards, DEV_CARDS_UPDATE_EVENT } from "./utils/devCardsStore";
import { DEV_OPEN_CONSTRUCTOR_EVENT } from "./components/DevControls";
import { AsyncContent } from "./components/AsyncContent";
import { ViewportMetrics } from "./components/ViewportMetrics";
import { formatError, futureDateISO, normalizeText } from "./format";
import { useCreateFamily, useRefreshTelegramProfile } from "./hooks/useApi";
import { useAppQueries } from "./hooks/useAppQueries";
import { useTouchScrollLock } from "./hooks/useTouchScrollLock";
import { useFamilyActionHandlers } from "./hooks/useFamilyActionHandlers";
import { CreateFamilyScreen } from "./screens/CreateFamilyScreen";
import { AccountsScreen } from "./screens/AccountsScreen";
import { ActionsScreen } from "./screens/ActionsScreen";
import { FamilyDetailsScreen } from "./screens/FamilyDetailsScreen";
import { GigabytesScreen } from "./screens/GigabytesScreen";
import { MyFamiliesScreen } from "./screens/MyFamiliesScreen";
import { SearchScreen } from "./screens/SearchScreen";
import type { FamilyCreate, FamilyType } from "./types";
import {
  setTelegramBackButton,
  setTelegramClosingConfirmation,
  showTelegramConfirm,
  getTelegramStartParam,
  openTelegramMiniApp,
  triggerTelegramImpact
} from "./telegram";

const emptyCreateForm: FamilyCreate = {
  service_id: "",
  plan_name: null,
  period: "monthly",
  max_members: 6,
  total_price_kzt: 3800,
  payment_day: 15,
  next_payment_date: futureDateISO(30),
  description: "",
  owner_rules: "",
  payment_bank: "kaspi",
  payment_phone: ""
};

export function App() {
  const queryClient = useQueryClient();
  const [familyType, setFamilyType] = useState<FamilyType>("subscription");
  const [tab, setTab] = useState<Tab>("home");
  const [accountEntryId, setAccountEntryId] = useState<string | null>(null);
  const [gigabytesEntryId, setGigabytesEntryId] = useState<string | null>(null);
  const [accountsBackTab, setAccountsBackTab] = useState<Tab>("home");
  const [gigabytesBackTab, setGigabytesBackTab] = useState<Tab>("home");
  const [createBackTab, setCreateBackTab] = useState<Tab>("home");

  useEffect(() => {
    if (tab !== "accounts") setAccountEntryId(null);
    if (tab !== "gigabytes") setGigabytesEntryId(null);
  }, [tab]);

  const [gigabytesEntryMode, setGigabytesEntryMode] = useState<"catalog" | "create" | "mine">("catalog");
  const [accountsEntryMode, setAccountsEntryMode] = useState<"catalog" | "create" | "mine">("catalog");
  const [actionsTab, setActionsTab] = useState<"inbox" | "outbox" | null>(null);
  const [marketResetToken, setMarketResetToken] = useState(0);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [familyBackTab, setFamilyBackTab] = useState<Tab>("home");
  const [devUser, setDevUser] = useState<DevTelegramUser | null>(getActiveDevTelegramUser());
  const [createForm, setCreateForm] = useState<FamilyCreate>(emptyCreateForm);
  const [myProductScope, setMyProductScope] = useState<"families" | "accounts" | "gigabytes">("families");
  const startParamHandled = useRef(false);

  const [isDevCardsModalOpen, setIsDevCardsModalOpen] = useState(false);
  const [devCardsTotal, setDevCardsTotal] = useState(() => (import.meta.env.DEV ? countDevCards().total : 0));

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handleCardsUpdate = () => {
      setDevCardsTotal(countDevCards().total);
    };
    const handleOpenModal = () => {
      setIsDevCardsModalOpen(true);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === "KeyD" || e.key === "D")) {
        e.preventDefault();
        setIsDevCardsModalOpen((prev) => !prev);
      }
    };
    window.addEventListener(DEV_CARDS_UPDATE_EVENT, handleCardsUpdate);
    window.addEventListener(DEV_OPEN_CONSTRUCTOR_EVENT, handleOpenModal);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener(DEV_CARDS_UPDATE_EVENT, handleCardsUpdate);
      window.removeEventListener(DEV_OPEN_CONSTRUCTOR_EVENT, handleOpenModal);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const {
    meQuery,
    me,
    user,
    loadState,
    servicesQuery,
    services,
    typedServices,
    familiesQuery,
    typedFamilies,
    subscriptionFamiliesQuery,
    subscriptionFamilies,
    tariffFamiliesQuery,
    tariffFamilies,
    marketplaceListingsQuery,
    marketplaceListings,
    accountListingsQuery,
    accountListings,
    myFamiliesQuery,
    myFamilies,
    myRequestsQuery,
    myRequests,
    marketplaceActionSummaryQuery,
    familyViewQuery,
    selectedFamilyView,
    selectedFamilyAudit,
    selectedFamilyInvite,
    counts: {
      familyPendingActionsCount,
      marketplacePendingActionsCount,
      marketplaceSalesActionCount,
      marketplacePurchaseActionCount,
      accountSalesActionCount,
      accountPurchaseActionCount
    }
  } = useAppQueries(tab, familyType, selectedFamilyId);

  const {
    busy,
    setBusy,
    error,
    setError,
    ownerDetails,
    setOwnerDetails,
    requisites,
    setRequisites,
    runMutation,
    familyActionHandlers,
    mutations: {
      createRequestMutation,
      createInviteMutation,
      rotateInviteMutation,
      disableInviteMutation,
      updateVisibilityMutation,
      confirmAvailabilityMutation,
      confirmAccessMutation,
      getRequisiteMutation,
      reportPaymentMutation,
      cancelReportMutation
    }
  } = useFamilyActionHandlers();

  const refreshProfileMutation = useRefreshTelegramProfile();
  const createFamilyMutation = useCreateFamily();

  function openFamily(familyId: string, backTab: Tab = tab) {
    triggerTelegramImpact("light");
    setSelectedFamilyId(familyId);
    setFamilyBackTab(backTab === "family" ? "home" : backTab);
    setTab("family");
  }

  async function openFamilyByInviteCode(code: string) {
    try {
      setBusy("invite-view");
      setError(null);
      const view = await getFamilyByInviteCode(code);
      setSelectedFamilyId(view.family.id);
      setFamilyBackTab("home");
      setTab("family");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(null);
    }
  }

  async function switchDevUser(nextUserId: string) {
    const nextUser = DEV_TELEGRAM_USERS.find((u) => u.id === Number(nextUserId));
    if (!nextUser) return;
    setActiveDevTelegramUser(nextUser);
    setDevUser(nextUser);
    setOwnerDetails({});
    setRequisites({});
    setSelectedFamilyId(null);
    setTab("home");
    queryClient.clear();
  }

  function selectedService() {
    return typedServices.find((service) => service.id === createForm.service_id) ?? null;
  }

  function changeFamilyType(nextType: FamilyType) {
    const nextServices = services.filter((service) => service.family_type === nextType);
    setFamilyType(nextType);
    setCreateForm((current) => ({
      ...current,
      service_id: nextServices[0]?.id || "",
      plan_name: nextType === "tariff" ? current.plan_name : null,
      period: nextServices[0]?.supported_periods[0] ?? "monthly",
      max_members: Math.min(current.max_members, nextServices[0]?.max_members ?? 8)
    }));
  }

  async function handleCreateFamily(event: FormEvent) {
    event.preventDefault();
    await runMutation("create-family", async () => {
      const payload: FamilyCreate = {
        ...createForm,
        plan_name: normalizeText(createForm.plan_name),
        description: normalizeText(createForm.description),
        owner_rules: normalizeText(createForm.owner_rules)
      };
      await createFamilyMutation.mutateAsync(payload);
      setCreateForm({
        ...emptyCreateForm,
        service_id: typedServices[0]?.id || "",
        period: typedServices[0]?.supported_periods[0] ?? "monthly",
        max_members: Math.min(6, typedServices[0]?.max_members ?? 8)
      });
      setTab("mine");
    });
  }

  useTouchScrollLock();

  useEffect(() => {
    if (loadState !== "ready" || startParamHandled.current) return;
    startParamHandled.current = true;
    const match = getTelegramStartParam().match(/^invite_(\d{8})$/);
    if (match) void openFamilyByInviteCode(match[1]);
  }, [loadState]);

  useEffect(() => {
    if (tab === "accounts" || tab === "gigabytes" || tab === "create") return;
    return setTelegramBackButton(tab !== "home", () => {
      if (tab === "family") {
        setTab(familyBackTab);
        return;
      }
      setTab("home");
    });
  }, [familyBackTab, tab]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.querySelector<HTMLElement>(".app-shell, .market-shell")?.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto"
    });
  }, [selectedFamilyId, tab, myProductScope, accountEntryId, gigabytesEntryId]);

  const createFormDirty = Boolean(
    tab === "create" &&
      (createForm.payment_phone.trim().length > 0 ||
        Boolean(createForm.plan_name?.trim()) ||
        Boolean(createForm.description?.trim()) ||
        Boolean(createForm.owner_rules?.trim()) ||
        createForm.total_price_kzt !== emptyCreateForm.total_price_kzt)
  );

  useEffect(() => {
    setTelegramClosingConfirmation(Boolean(busy) || createFormDirty);
  }, [busy, createFormDirty]);

  useEffect(() => {
    if (typedServices.length === 0) return;
    setCreateForm((current) => {
      if (current.service_id && typedServices.some((s) => s.id === current.service_id)) {
        return current;
      }
      const first = typedServices[0];
      return {
        ...current,
        service_id: first.id,
        period: first.supported_periods[0] ?? current.period,
        max_members: Math.min(current.max_members, first.max_members)
      };
    });
  }, [typedServices]);

  if (loadState === "loading") {
    return <Shell title="SubsMarket">Загружаем Mini App...</Shell>;
  }

  if (loadState === "username-required") {
    return (
      <Shell title="Нужен Telegram username">
        <div className="notice">
          <p>{me?.message}</p>
          <ol>
            <li>Откройте настройки Telegram.</li>
            <li>Создайте username.</li>
            <li>Вернитесь в SubsMarket и обновите профиль.</li>
          </ol>
          <AppButton
            type="button"
            fullWidth
            onClick={() => void runMutation("refresh-profile", () => refreshProfileMutation.mutateAsync())}
          >
            Я создал username
          </AppButton>
        </div>
      </Shell>
    );
  }

  if (loadState === "error") {
    const loadErrorMessage = formatError(meQuery.error);
    const requiresTelegram = loadErrorMessage.includes("Telegram Mini App");
    return (
      <Shell title="Backend недоступен">
        <div className="notice notice-error">
          <p>{loadErrorMessage}</p>
          <div className="notice-actions">
            {requiresTelegram && (
              <AppButton type="button" fullWidth onClick={openTelegramMiniApp}>
                Открыть в Telegram
              </AppButton>
            )}
            <AppButton
              type="button"
              fullWidth
              variant={requiresTelegram ? "secondary" : "primary"}
              onClick={() => meQuery.refetch()}
            >
              Повторить
            </AppButton>
          </div>
        </div>
      </Shell>
    );
  }

  const service = selectedService();
  const isMarket = tab === "home" || tab === "search" || tab === "gigabytes" || tab === "accounts";
  const bottomNavTab: Tab =
    tab === "mine" ? "mine" :
    tab === "requests" ? "requests" :
    tab === "create" ? "create" :
    "home";
  const shellTitle =
    tab === "search" ? (familyType === "tariff" ? "Семейные тарифы" : "Семейные подписки") :
    tab === "create" ? "Создать семью" :
    tab === "mine" ? "Мои" :
    tab === "requests" ? "Заявки" :
    tab === "family" ? "Семья" :
    tab === "gigabytes" ? "Гигабайты" :
    tab === "accounts" ? "Аккаунты" :
    "SubsMarket";

  return (
    <Shell title={shellTitle} appearance={isMarket ? "market" : "default"}>
      {import.meta.env.DEV && <ViewportMetrics />}
      {isDevUserSwitchVisible() && devUser && !isMarket && (
        <DevUserSwitch value={devUser} onChange={(id) => void switchDevUser(id)} />
      )}

      {error && (
        <div className="inline-error" role="alert" aria-live="polite">
          {error}
        </div>
      )}

      {(tab === "home" || tab === "search") && (
        <SearchScreen
          view={tab === "search" ? "family-catalog" : "market"}
          userName={user?.username ?? "unknown"}
          firstName={user?.first_name}
          familyType={familyType}
          filteredFamilies={typedFamilies}
          subscriptionFamilies={subscriptionFamilies}
          tariffFamilies={tariffFamilies}
          familyLoading={{
            subscription: subscriptionFamiliesQuery.isLoading,
            tariff: tariffFamiliesQuery.isLoading
          }}
          marketplaceListings={marketplaceListings}
          accountListings={accountListings}
          myFamilies={myFamilies}
          myRequests={myRequests}
          isLoading={
            tab === "home"
              ? [subscriptionFamiliesQuery, tariffFamiliesQuery, marketplaceListingsQuery, accountListingsQuery].some(
                  (query) => query.isLoading
                )
              : familiesQuery.isLoading
          }
          error={
            (tab === "home"
              ? [subscriptionFamiliesQuery, tariffFamiliesQuery, marketplaceListingsQuery, accountListingsQuery].find(
                  (query) => query.isError
                )
              : familiesQuery.isError
                ? familiesQuery
                : undefined
            )?.error
              ? "Проверьте соединение и попробуйте ещё раз."
              : undefined
          }
          hasMoreFamilies={Boolean(familiesQuery.hasNextPage)}
          isLoadingMoreFamilies={familiesQuery.isFetchingNextPage}
          onOpenFamilyCatalog={(nextType) => {
            changeFamilyType(nextType);
            setTab("search");
          }}
          onBack={() => setTab("home")}
          onRefresh={() => {
            if (tab === "home") {
              void subscriptionFamiliesQuery.refetch();
              void tariffFamiliesQuery.refetch();
              void marketplaceListingsQuery.refetch();
              void accountListingsQuery.refetch();
            } else void familiesQuery.refetch();
          }}
          onLoadMoreFamilies={() => void familiesQuery.fetchNextPage()}
          pendingActionsCount={familyPendingActionsCount + marketplacePendingActionsCount}
          marketplaceSalesActionCount={marketplaceSalesActionCount}
          marketplacePurchaseActionCount={marketplacePurchaseActionCount}
          accountSalesActionCount={accountSalesActionCount}
          accountPurchaseActionCount={accountPurchaseActionCount}
          onOpenMine={() => setTab("mine")}
          onOpenActions={(targetTab) => {
            if (targetTab) {
              setActionsTab(targetTab);
            }
            setTab("requests");
          }}
          onOpenGigabytes={(id) => {
            setGigabytesEntryId(id ?? null);
            setGigabytesBackTab("home");
            setGigabytesEntryMode("catalog");
            setTab("gigabytes");
          }}
          onOpenAccounts={(id) => {
            setAccountEntryId(id ?? null);
            setAccountsBackTab("home");
            setAccountsEntryMode("catalog");
            setTab("accounts");
          }}
          onOpenFamily={(familyId) => openFamily(familyId, tab)}
          onOpenInvite={(code) => void openFamilyByInviteCode(code)}
          onCreateFamily={(nextType) => {
            changeFamilyType(nextType);
            setCreateBackTab("home");
            setTab("create");
          }}
          resetToken={marketResetToken}
        />
      )}

      {tab === "create" && (
        <AsyncContent query={servicesQuery}>
          <CreateFamilyScreen
            onBack={() => setTab(createBackTab)}
            onCreateAccounts={() => {
              setAccountsBackTab("create");
              setAccountsEntryMode("create");
              setTab("accounts");
            }}
            onCreateGigabytes={() => {
              setGigabytesBackTab("create");
              setGigabytesEntryMode("create");
              setTab("gigabytes");
            }}
            familyType={familyType}
            typedServices={typedServices}
            service={service}
            createForm={createForm}
            servicesCount={services.length}
            busy={busy}
            onChangeFamilyType={changeFamilyType}
            onChangeForm={setCreateForm}
            onSubmit={(event) => void handleCreateFamily(event)}
          />
        </AsyncContent>
      )}

      {tab === "mine" && (
        <MyFamiliesScreen
          loadError={myFamiliesQuery.isError}
          onRetry={() => {
            void myFamiliesQuery.refetch();
          }}
          myProductScope={myProductScope}
          families={myFamilies}
          ownerDetails={ownerDetails}
          requisites={requisites}
          busy={busy}
          isLoading={myFamiliesQuery.isLoading}
          hasMoreFamilies={myFamiliesQuery.hasNextPage}
          isLoadingMoreFamilies={myFamiliesQuery.isFetchingNextPage}
          onLoadMoreFamilies={() => void myFamiliesQuery.fetchNextPage()}
          onOpenFamily={(familyId) => {
            setSelectedFamilyId(familyId);
            setFamilyBackTab("mine");
            setTab("family");
          }}
          {...familyActionHandlers}
          onChangeProductScope={setMyProductScope}
          onOpenAccountListing={(listingId) => {
            setAccountEntryId(listingId);
            setAccountsBackTab("mine");
            setAccountsEntryMode("mine");
            setTab("accounts");
          }}
          onCreateAccountListing={() => {
            setAccountEntryId(null);
            setAccountsBackTab("mine");
            setAccountsEntryMode("create");
            setTab("accounts");
          }}
          onOpenGigabytesListing={(listingId) => {
            setGigabytesEntryId(listingId);
            setGigabytesBackTab("mine");
            setGigabytesEntryMode("mine");
            setTab("gigabytes");
          }}
          onCreateGigabytesListing={() => {
            setGigabytesEntryId(null);
            setGigabytesBackTab("mine");
            setGigabytesEntryMode("create");
            setTab("gigabytes");
          }}
          onCreateFamily={() => {
            changeFamilyType("subscription");
            setCreateBackTab("mine");
            setTab("create");
          }}
          onOpenMarket={() => setTab("home")}
        />
      )}

      {tab === "requests" && (
        <ActionsScreen
          loadError={myFamiliesQuery.isError || myRequestsQuery.isError || marketplaceActionSummaryQuery.isError}
          onRetry={() => {
            void myFamiliesQuery.refetch();
            void myRequestsQuery.refetch();
            void marketplaceActionSummaryQuery.refetch();
          }}
          initialActionsTab={actionsTab ?? undefined}
          families={myFamilies}
          ownerDetails={ownerDetails}
          requisites={requisites}
          requests={myRequests}
          busy={busy}
          isLoading={myFamiliesQuery.isLoading}
          requestsLoading={myRequestsQuery.isLoading}
          hasMoreRequests={myRequestsQuery.hasNextPage}
          isLoadingMoreRequests={myRequestsQuery.isFetchingNextPage}
          onLoadMoreRequests={() => void myRequestsQuery.fetchNextPage()}
          onOpenFamily={(familyId) => {
            setSelectedFamilyId(familyId);
            setFamilyBackTab("requests");
            setTab("family");
          }}
          {...familyActionHandlers}
          marketplaceSalesActionCount={marketplaceSalesActionCount}
          marketplacePurchaseActionCount={marketplacePurchaseActionCount}
          accountSalesActionCount={accountSalesActionCount}
          accountPurchaseActionCount={accountPurchaseActionCount}
          onOpenMarketplaceSalesActions={() => {
            setActionsTab("inbox");
            setTab("requests");
          }}
          onOpenMarketplacePurchaseActions={() => {
            setActionsTab("outbox");
            setTab("requests");
          }}
          onOpenAccountSalesActions={() => {
            setActionsTab("inbox");
            setTab("requests");
          }}
          onOpenAccountPurchaseActions={() => {
            setActionsTab("outbox");
            setTab("requests");
          }}
        />
      )}

      {tab === "family" && (
        <FamilyDetailsScreen
          loadError={familyViewQuery.isError}
          view={selectedFamilyView}
          requisite={
            selectedFamilyView?.my_membership
              ? requisites[selectedFamilyView.my_membership.id] ?? null
              : null
          }
          auditLogs={selectedFamilyAudit}
          invite={selectedFamilyInvite}
          busy={busy}
          isLoading={familyViewQuery.isLoading}
          onBack={() => {
            setSelectedFamilyId(null);
            setTab(familyBackTab);
          }}
          onRefresh={() => familyViewQuery.refetch()}
          onCreateRequest={(familyId) =>
            void runMutation("create-request", () =>
              createRequestMutation.mutateAsync(familyId)
            ).then((outcome) =>
              outcome === "success" ? familyViewQuery.refetch() : undefined
            )
          }
          onCreateInvite={(familyId) =>
            void runMutation("create-invite", () => createInviteMutation.mutateAsync(familyId))
          }
          onRotateInvite={(familyId) =>
            void runMutation("rotate-invite", () => rotateInviteMutation.mutateAsync(familyId))
          }
          onDisableInvite={(familyId) =>
            void runMutation(
              "disable-invite",
              () => disableInviteMutation.mutateAsync(familyId),
              () => showTelegramConfirm("Отключить приглашение? Новый код не будет работать.")
            )
          }
          onUpdateVisibility={(familyId, isSearchVisible) =>
            void runMutation("update-visibility", () =>
              updateVisibilityMutation.mutateAsync({ familyId, isSearchVisible })
            ).then((outcome) =>
              outcome === "success" ? familyViewQuery.refetch() : undefined
            )
          }
          onConfirmAvailability={(familyId) =>
            void runMutation("confirm-availability", () =>
              confirmAvailabilityMutation.mutateAsync(familyId)
            ).then((outcome) =>
              outcome === "success" ? familyViewQuery.refetch() : undefined
            )
          }
          onConfirmAccess={(memberId) =>
            void runMutation("confirm-access", async () => {
              const result = await confirmAccessMutation.mutateAsync(memberId);
              setRequisites((current) => ({
                ...current,
                [memberId]: result.payment_requisite
              }));
            }).then((outcome) =>
              outcome === "success" ? familyViewQuery.refetch() : undefined
            )
          }
          onGetRequisite={(memberId) =>
            void runMutation("get-requisite", async () => {
              const requisite = await getRequisiteMutation.mutateAsync(memberId);
              setRequisites((current) => ({
                ...current,
                [memberId]: requisite
              }));
            })
          }
          onReportPayment={(payment) =>
            runMutation("report-paid", () => reportPaymentMutation.mutateAsync(payment.id)).then(
              (outcome) => (outcome === "success" ? familyViewQuery.refetch() : undefined)
            )
          }
          onCancelPaymentReport={(payment) =>
            runMutation("cancel-report", () => cancelReportMutation.mutateAsync(payment.id)).then(
              (outcome) => (outcome === "success" ? familyViewQuery.refetch() : undefined)
            )
          }
        />
      )}

      {tab === "gigabytes" && (
        <GigabytesScreen
          initialListingId={gigabytesEntryId}
          initialMode={gigabytesEntryMode}
          onBack={() => setTab(gigabytesBackTab)}
        />
      )}

      {tab === "accounts" && (
        <AccountsScreen
          initialListingId={accountEntryId}
          initialMode={accountsEntryMode}
          onBack={() => setTab(accountsBackTab)}
        />
      )}

      <BottomNav
        active={bottomNavTab}
        onChange={(nextTab) => {
          if (nextTab === "home") {
            try {
              window.sessionStorage.removeItem("subsmarket.marketViewState.v1");
            } catch {}
            setMarketResetToken((current) => current + 1);
          }
          if (nextTab === "requests") {
            setActionsTab(null);
          }
          if (nextTab === "create") {
            setCreateBackTab("home");
          }
          setTab(nextTab);
        }}
        onReselect={(selectedTab) => {
          if (selectedTab === "home") {
            try {
              window.sessionStorage.removeItem("subsmarket.marketViewState.v1");
            } catch {}
            if (tab !== "home") setTab("home");
            setMarketResetToken((current) => current + 1);
          }
        }}
        badges={{
          requests: familyPendingActionsCount + marketplacePendingActionsCount,
          mine: myFamilies.filter(
            (item) =>
              item.pending_requests_count > 0 ||
              item.payments.some((p) => p.status === "payment_reported")
          ).length
        }}
      />

      {import.meta.env.DEV && (
        <>
          <button
            type="button"
            className="dev-floating-fab"
            onClick={() => setIsDevCardsModalOpen(true)}
            data-testid="dev-floating-fab-btn"
            title="Конструктор карточек (Ctrl+Shift+D)"
            aria-label="Конструктор карточек"
          >
            <span>⚡ Карточки</span>
            {devCardsTotal > 0 ? (
              <span className="dev-floating-fab-count">{devCardsTotal}</span>
            ) : null}
          </button>
          <DevCardsConstructorModal
            isOpen={isDevCardsModalOpen}
            onClose={() => setIsDevCardsModalOpen(false)}
          />
        </>
      )}
    </Shell>
  );
}
