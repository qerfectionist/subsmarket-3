import { useEffect, useMemo, useRef, useState } from "react";
import type { CreateCategory } from "./components/CreateCategoryPicker";
import { servicePopularity } from "./components/families/createFamilyForm";
import { CreateHome } from "./components/CreateHome";

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
import { AppLoadNotice } from "./components/AppLoadNotice";
import { AsyncContent } from "./components/AsyncContent";
import { ViewportMetrics } from "./components/ViewportMetrics";
import { formatError, normalizeText } from "./format";
import { nextPaymentDateFor } from "./components/families/createFamilyForm";
import { useCreateFamily, useRefreshTelegramProfile } from "./hooks/useApi";
import { useAppQueries } from "./hooks/useAppQueries";
import { useAppScrollCapture } from "./hooks/useAppScrollCapture";
import { useDevCardsModal } from "./hooks/useDevCardsModal";
import {
  newDraftId,
  useCreateFamilyDrafts,
  WIZARD_START,
  type CreateFamilyDraft,
  type CreateWizardState
} from "./hooks/useCreateFamilyDraft";
import type { CreateStep } from "./components/families/createFamilyForm";
import type { PayoutProgress } from "./components/families/createPayoutParts";
import { useTouchScrollLock } from "./hooks/useTouchScrollLock";
import { useFamilyActionHandlers } from "./hooks/useFamilyActionHandlers";
import { CreateFamilyScreen } from "./screens/CreateFamilyScreen";
import { FamilyCreatedScreen } from "./screens/FamilyCreatedScreen";
import { AccountsScreen } from "./screens/AccountsScreen";
import { ActionsScreen } from "./screens/ActionsScreen";
import { FamilyDetailsScreen } from "./screens/FamilyDetailsScreen";
import { GigabytesScreen } from "./screens/GigabytesScreen";
import { MyFamiliesScreen } from "./screens/MyFamiliesScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { MasterFamilyCard } from "./components/cards-showcase/MasterFamilyCard";
import type { AccountListing, Family, FamilyCreate, FamilyService, FamilyType } from "./types";
import type { MarketplaceListing } from "./types";
import {
  setTelegramBackButton,
  setTelegramClosingConfirmation,
  showTelegramConfirm,
  getTelegramStartParam,
  openTelegramMiniApp,
  triggerTelegramImpact
} from "./telegram";

function popularFirst<T extends { slug: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => servicePopularity(a.slug) - servicePopularity(b.slug));
}

const emptyCreateForm: FamilyCreate = {
  service_id: "",
  plan_name: null,
  full_speed_gb: null,
  period: "monthly",
  max_members: 6,
  total_price_kzt: 3800,
  payment_day: 15,
  next_payment_date: nextPaymentDateFor(15),
  description: "",
  owner_rules: "",
  payment_bank: "kaspi",
  payment_phone: "",
  payment_recipient_name: "",
  chat_kind: "telegram",
  is_search_visible: true
};

export function App() {
  const queryClient = useQueryClient();
  const [familyType, setFamilyType] = useState<FamilyType>("subscription");
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const showcaseParam = searchParams.get("showcase");
      if (showcaseParam === "1" || showcaseParam === "true") return "cards-showcase";

      const targetParam = searchParams.get("tab") || searchParams.get("screen");
      if (targetParam === "cards" || targetParam === "showcase") return "cards-showcase";
      if (targetParam === "actions" || targetParam === "requests") return "requests";
      if (targetParam === "my" || targetParam === "mine") return "mine";
      if (targetParam === "market" || targetParam === "home") return "home";
      if (targetParam === "create") return "create";

      if (searchParams.has("actions_tab")) return "requests";
    } catch {}
    return "home";
  });
  const [accountEntryId, setAccountEntryId] = useState<string | null>(null);
  const [gigabytesEntryId, setGigabytesEntryId] = useState<string | null>(null);
  const [accountsBackTab, setAccountsBackTab] = useState<Tab>("home");
  const [gigabytesBackTab, setGigabytesBackTab] = useState<Tab>("home");
  const [createBackTab, setCreateBackTab] = useState<Tab>("home");
  const [createdFamilyId, setCreatedFamilyId] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "accounts") setAccountEntryId(null);
    if (tab !== "gigabytes") setGigabytesEntryId(null);
  }, [tab]);

  const [gigabytesEntryMode, setGigabytesEntryMode] = useState<"catalog" | "create" | "mine">("catalog");
  const [accountsEntryMode, setAccountsEntryMode] = useState<"catalog" | "create" | "mine">("catalog");
  const [actionsTab, setActionsTab] = useState<"inbox" | "outbox" | null>(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const act = searchParams.get("actions_tab");
      if (act === "inbox" || act === "outbox") return act;
    } catch {}
    return null;
  });
  const [marketResetToken, setMarketResetToken] = useState(0);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [familyBackTab, setFamilyBackTab] = useState<Tab>("home");
  const [devUser, setDevUser] = useState<DevTelegramUser | null>(getActiveDevTelegramUser());
  const [createForm, setCreateForm] = useState<FamilyCreate>(emptyCreateForm);
  const [myProductScope, setMyProductScope] = useState<"families" | "accounts" | "gigabytes">("families");
  // «Создать» opens on its menu; a form opened from elsewhere sets its own scope.
  const [createScope, setCreateScope] = useState<"home" | "families" | "accounts" | "gigabytes">("home");
  const [createFamilyStep, setCreateFamilyStep] = useState<CreateStep>("service");
  // Where the family wizard is, for the saved draft; and the «Выплата» progress to resume with.
  const [createWizard, setCreateWizard] = useState<CreateWizardState>(WIZARD_START);
  const [resumeProgress, setResumeProgress] = useState<PayoutProgress | undefined>(undefined);
  const [createEntry, setCreateEntry] = useState(0);
  const [createFromMenu, setCreateFromMenu] = useState(false);
  const [createPreset, setCreatePreset] = useState<string | null>(null);
  // A listing from «Недавние»: its form opens filled with the same terms.
  const [createRepeat, setCreateRepeat] = useState<AccountListing | MarketplaceListing | null>(null);
  const startParamHandled = useRef(false);

  const { isDevCardsModalOpen, setIsDevCardsModalOpen } = useDevCardsModal();
  useAppScrollCapture();

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
  // The draft the open family form writes to: a new one per fresh start, the old one on «Продолжить».
  const [activeDraftId, setActiveDraftId] = useState(newDraftId);
  const {
    drafts: familyDrafts,
    remove: removeFamilyDraft,
    restore: restoreFamilyDraft
  } = useCreateFamilyDrafts({
    userId: user?.id ?? null,
    active: tab === "create" && createScope === "families",
    draftId: activeDraftId,
    form: createForm,
    familyType,
    wizard: createWizard
  });

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
      reportAccessIssueMutation,
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
    return services.find((service) => service.id === createForm.service_id) ?? null;
  }

  function changeFamilyType(nextType: FamilyType) {
    // Nothing is preselected: the person picks the service themselves.
    const nextServices = popularFirst(services.filter((service) => service.family_type === nextType));
    setFamilyType(nextType);
    setCreateForm((current) => ({
      ...current,
      service_id: "",
      plan_name: nextType === "tariff" ? current.plan_name : null,
      full_speed_gb: nextType === "tariff" ? current.full_speed_gb : null,
      period: "monthly",
      max_members: Math.min(current.max_members, nextServices[0]?.max_members ?? 8)
    }));
  }

  /** The family type follows the picked service: an operator means a tariff family. */
  function pickCreateService(next: FamilyService) {
    const nextType: FamilyType = next.family_type === "tariff" ? "tariff" : "subscription";
    setFamilyType(nextType);
    setCreateForm((current) => ({
      ...current,
      service_id: next.id,
      plan_name: nextType === "tariff" ? current.plan_name : null,
      full_speed_gb: nextType === "tariff" ? current.full_speed_gb : null,
      // «Раз в год» needs a payment screenshot checked by a moderator; until that
      // exists new families are monthly only.
      period: "monthly",
      max_members: Math.min(Math.max(current.max_members, 2), next.max_members)
    }));
  }

  async function handleCreateFamily(event: FormEvent) {
    event.preventDefault();
    await runMutation("create-family", async () => {
      const payload: FamilyCreate = {
        ...createForm,
        plan_name: normalizeText(createForm.plan_name),
        full_speed_gb:
          selectedService()?.family_type === "tariff" ? createForm.full_speed_gb : null,
        period: "monthly",
        description: normalizeText(createForm.description),
        owner_rules: normalizeText(createForm.owner_rules),
        payment_recipient_name: normalizeText(createForm.payment_recipient_name)
      };
      const created = await createFamilyMutation.mutateAsync(payload);
      removeFamilyDraft(activeDraftId);
      setActiveDraftId(newDraftId());
      setCreateForm({ ...emptyCreateForm, max_members: 6 });
      setCreatedFamilyId(created.family.id);
      setTab("created");
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
    if (tab === "accounts" || tab === "gigabytes" || tab === "create" || tab === "created") return;
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
        Boolean(createForm.payment_recipient_name?.trim()) ||
        createForm.total_price_kzt !== emptyCreateForm.total_price_kzt)
  );

  useEffect(() => {
    setTelegramClosingConfirmation(Boolean(busy) || createFormDirty);
  }, [busy, createFormDirty]);

  useEffect(() => {
    if (typedServices.length === 0) return;
    // A picked service that left the catalog is cleared; nothing is picked for the person.
    setCreateForm((current) =>
      current.service_id && !typedServices.some((s) => s.id === current.service_id)
        ? { ...current, service_id: "" }
        : current
    );
  }, [typedServices]);

  if (loadState !== "ready") {
    return (
      <AppLoadNotice
        loadState={loadState}
        me={me}
        meError={meQuery.error}
        onRefreshProfile={() => void runMutation("refresh-profile", () => refreshProfileMutation.mutateAsync())}
        onRetry={() => void meQuery.refetch()}
      />
    );
  }

  /** A row on the «Создать» menu: the form opens on the same tab, with a back arrow to the menu. */
  function switchCreateCategory(category: CreateCategory) {
    setCreatePreset(null);
    setCreateRepeat(null);
    if (category === "accounts" || category === "gigabytes") {
      setCreateScope(category);
    } else {
      setCreateScope("families");
      setCreateFamilyStep("service");
      startFreshFamily();
      changeFamilyType(category);
    }
    setCreateEntry((current) => current + 1);
    setCreateFromMenu(true);
    setTab("create");
  }

  /** A service found on the menu opens its family on «Условия». */
  function createFromPopular(next: FamilyService) {
    startFreshFamily();
    pickCreateService(next);
    setCreateScope("families");
    setCreateFamilyStep("terms");
    setCreateEntry((current) => current + 1);
    setCreateFromMenu(true);
  }

  /**
   * A new family from scratch: a new draft, an empty form (a draft left before
   * keeps its own copy), nothing walked on «Выплата».
   */
  function startFreshFamily() {
    setActiveDraftId(newDraftId());
    setResumeProgress(undefined);
    setCreateForm({ ...emptyCreateForm, next_payment_date: nextPaymentDateFor(emptyCreateForm.payment_day) });
  }

  /** A draft picked from the «Создать» menu: its form, on the step it was left at. */
  function resumeFamilyDraft(draft: CreateFamilyDraft) {
    setActiveDraftId(draft.id);
    setFamilyType(draft.familyType);
    setCreateForm({
      ...emptyCreateForm,
      ...draft.form,
      // The day stays; the date is worked out again, so an old draft is not in the past.
      next_payment_date: nextPaymentDateFor(draft.form.payment_day)
    });
    setCreateFamilyStep(draft.step);
    setResumeProgress(draft.progress);
    setCreateScope("families");
    setCreateEntry((current) => current + 1);
    setCreateFromMenu(true);
    setTab("create");
  }

  /** An account or operator found on the menu opens its form with it picked. */
  function createListingFromPopular(
    scope: "accounts" | "gigabytes",
    slug: string,
    repeat: AccountListing | MarketplaceListing | null = null
  ) {
    setCreatePreset(slug);
    setCreateRepeat(repeat);
    setCreateScope(scope);
    setCreateEntry((current) => current + 1);
    setCreateFromMenu(true);
  }

  /** A family from «Недавние» opens on «Условия» with the same seats, price and texts. */
  function repeatFamily(family: Family) {
    const next = services.find((item) => item.id === family.service_id);
    if (!next) return;
    createFromPopular(next);
    setCreateForm((current) => ({
      ...current,
      max_members: Math.min(family.max_members, next.max_members),
      total_price_kzt: family.total_price_kzt,
      plan_name: family.plan_name,
      full_speed_gb: family.full_speed_gb ?? null,
      description: family.description,
      owner_rules: family.owner_rules
    }));
  }

  /** Back from a form: to the menu when it was opened there, else where the person came from. */
  function leaveCreateForm() {
    if (createFromMenu) {
      setCreateScope("home");
      return;
    }
    setTab(createBackTab);
  }

  /** After an account or GB listing is published from «Создать»: show it in «Мои». */
  function openPublishedListing(scope: "accounts" | "gigabytes") {
    setMyProductScope(scope);
    setTab("mine");
  }

  const service = selectedService();
  const isMarket = tab === "home" || tab === "search" || tab === "gigabytes" || tab === "accounts";
  const bottomNavTab: Tab =
    tab === "mine" ? "mine" :
    tab === "requests" ? "requests" :
    tab === "create" || tab === "created" ? "create" :
    "home";
  const shellTitle =
    tab === "cards-showcase" ? "Варианты карточек" :
    tab === "search" ? (familyType === "tariff" ? "Семейные тарифы" : "Семейные подписки") :
    tab === "create" ? "Создать семью" :
    tab === "created" ? "Семья создана" :
    tab === "mine" ? "Мои" :
    tab === "requests" ? "Заявки" :
    tab === "family" ? "Семья" :
    tab === "gigabytes" ? "Гигабайты" :
    tab === "accounts" ? "Аккаунты" :
    "SubsMarket";

  return (
    <Shell title={shellTitle} appearance={isMarket ? "market" : "default"}>
      {import.meta.env.DEV && <ViewportMetrics />}
      {/* Not on the create flow either: there it sat over the back arrow. */}
      {isDevUserSwitchVisible() && devUser && !isMarket && tab !== "create" && tab !== "created" && (
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
            setCreateScope("families");
            setCreateFamilyStep("service");
            startFreshFamily();
            setCreateFromMenu(false);
            changeFamilyType(nextType);
            setCreateBackTab("home");
            setTab("create");
          }}
          resetToken={marketResetToken}
        />
      )}

      {tab === "create" && createScope === "home" && (
        <AsyncContent query={servicesQuery}>
          <CreateHome
            services={services}
            myFamilies={myFamilies}
            drafts={familyDrafts}
            onResumeDraft={resumeFamilyDraft}
            onDiscardDraft={removeFamilyDraft}
            onRestoreDraft={restoreFamilyDraft}
            onOpen={switchCreateCategory}
            onPickService={createFromPopular}
            onPickAccount={(slug) => createListingFromPopular("accounts", slug)}
            onPickOperator={(slug) => createListingFromPopular("gigabytes", slug)}
            onRepeatFamily={repeatFamily}
            onRepeatAccount={(listing) => createListingFromPopular("accounts", listing.service.slug, listing)}
            onRepeatGigabytes={(listing) => createListingFromPopular("gigabytes", listing.operator.slug, listing)}
          />
        </AsyncContent>
      )}

      {tab === "create" && createScope === "families" && (
        <AsyncContent query={servicesQuery}>
          <CreateFamilyScreen
            key={`create-family-${createEntry}`}
            initialStep={createFamilyStep}
            initialPayoutProgress={resumeProgress}
            onWizardChange={setCreateWizard}
            onBack={leaveCreateForm}
            services={services}
            service={service}
            familyType={familyType}
            createForm={createForm}
            busy={busy}
            onPickService={pickCreateService}
            owner={{ avatar_name: user?.first_name || "Вы", photo_url: user?.photo_url ?? null }}
            onChangeForm={setCreateForm}
            onSubmit={(event) => void handleCreateFamily(event)}
          />
        </AsyncContent>
      )}

      {tab === "create" && createScope === "accounts" && (
        <AccountsScreen
          key={`create-accounts-${createEntry}`}
          initialMode="create"
          onBack={leaveCreateForm}
          embedded={{
            onPublished: () => openPublishedListing("accounts"),
            serviceSlug: createPreset,
            repeat: createRepeat && "service" in createRepeat ? createRepeat : null
          }}
        />
      )}

      {tab === "create" && createScope === "gigabytes" && (
        <GigabytesScreen
          key={`create-gigabytes-${createEntry}`}
          initialMode="create"
          onBack={leaveCreateForm}
          embedded={{
            onPublished: () => openPublishedListing("gigabytes"),
            operatorSlug: createPreset,
            repeat: createRepeat && "operator" in createRepeat ? createRepeat : null
          }}
        />
      )}

      {tab === "created" && (
        <FamilyCreatedScreen
          item={myFamilies.find((entry) => entry.family.id === createdFamilyId) ?? null}
          onDone={() => setTab("mine")}
        />
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
            setCreateScope("families");
            setCreateFamilyStep("service");
            startFreshFamily();
            setCreateFromMenu(false);
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
          onCreateRequest={(familyId, body) =>
            void runMutation("create-request", () =>
              createRequestMutation.mutateAsync({ familyId, body })
            ).then((outcome) =>
              outcome === "success" ? familyViewQuery.refetch() : undefined
            )
          }
          onReportAccessIssue={(memberId) =>
            void runMutation("report-access-issue", () =>
              reportAccessIssueMutation.mutateAsync(memberId)
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

      {tab === "cards-showcase" && (
        <MasterFamilyCard onBack={() => setTab("home")} />
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
            setCreateScope("home");
          }
          setTab(nextTab);
        }}
        onReselect={(selectedTab) => {
          if (selectedTab === "create") setCreateScope("home");
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

      {import.meta.env.DEV && tab !== "cards-showcase" && (
        <DevCardsConstructorModal
          isOpen={isDevCardsModalOpen}
          onClose={() => setIsDevCardsModalOpen(false)}
          onOpenShowcase={() => setTab("cards-showcase")}
        />
      )}
    </Shell>
  );
}
