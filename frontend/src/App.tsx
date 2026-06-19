import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  acknowledgeFamilyClosing,
  acknowledgeMemberRemoval,
  approveFamilyRequest,
  cancelFamilyRequest,
  cancelMemberBeforeAccess,
  cancelPaymentReport,
  closeFamily,
  confirmAccessReceived,
  confirmPaymentReceived,
  createFamily,
  createFamilyRequest,
  createMemberPrepayment,
  DEV_TELEGRAM_USERS,
  type DevTelegramUser,
  getActiveDevTelegramUser,
  getFamilies,
  getFamilyAuditLog,
  getFamilyView,
  getFamilyMembers,
  getFamilyServices,
  getMe,
  getMemberPayments,
  getMyFamilies,
  getMyFamilyRequests,
  getOwnerFamilyRequests,
  getPaymentRequisite,
  importFamilyServices,
  initTelegramShell,
  isDevAuthEnabled,
  leaveFamily,
  markAccessProvided,
  markPaymentNotReceived,
  refreshTelegramProfile,
  recordOwnerPrepaidPeriods,
  remindAccessConfirmation,
  rejectFamilyRequest,
  reportPaymentPaid,
  requestMemberRemovalCancellation,
  revokeMemberRemoval,
  scheduleMemberRemoval,
  setActiveDevTelegramUser,
  updateFamilyDescription,
  updateFamilyPaymentDay,
  updateFamilyPrice
} from "./api";
import type { LoadState, Tab } from "./appTypes";
import {
  AppHeader,
  BottomNav,
  DevUserSwitch,
  Shell
} from "./components/layout";
import { formatError, futureDateISO, normalizeText } from "./format";
import { CreateFamilyScreen } from "./screens/CreateFamilyScreen";
import { FamilyDetailsScreen } from "./screens/FamilyDetailsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MyFamiliesScreen } from "./screens/MyFamiliesScreen";
import { RequestsScreen } from "./screens/RequestsScreen";
import { SearchScreen } from "./screens/SearchScreen";
import type {
  Family,
  FamilyAuditLog,
  FamilyCreate,
  FamilyRequest,
  FamilyService,
  FamilyView,
  FamilyType,
  MeResponse,
  MyFamily,
  OwnerFamilyDetails,
  PaymentRequisite
} from "./types";
import {
  setTelegramBackButton,
  triggerTelegramNotification,
  triggerTelegramSelection
} from "./telegram";

const emptyCreateForm: FamilyCreate = {
  service_id: "",
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
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [tab, setTab] = useState<Tab>("home");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [services, setServices] = useState<FamilyService[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [myFamilies, setMyFamilies] = useState<MyFamily[]>([]);
  const [myRequests, setMyRequests] = useState<FamilyRequest[]>([]);
  const [ownerDetails, setOwnerDetails] = useState<
    Record<string, OwnerFamilyDetails>
  >({});
  const [requisites, setRequisites] = useState<Record<string, PaymentRequisite>>({});
  const [selectedFamilyView, setSelectedFamilyView] = useState<FamilyView | null>(
    null
  );
  const [selectedFamilyAudit, setSelectedFamilyAudit] = useState<FamilyAuditLog[]>([]);
  const [familyBackTab, setFamilyBackTab] = useState<Tab>("search");
  const [devUser, setDevUser] = useState<DevTelegramUser | null>(
    getActiveDevTelegramUser()
  );
  const [createForm, setCreateForm] = useState<FamilyCreate>(emptyCreateForm);
  const [familyType, setFamilyType] = useState<FamilyType>("subscription");
  const [myFamilyType, setMyFamilyType] = useState<FamilyType>("subscription");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setLoadState("loading");
      const meResponse = await getMe();
      setMe(meResponse);
      if (!meResponse.ok) {
        setLoadState("username-required");
        return;
      }

      const [serviceResponse, familyResponse, myFamilyResponse, requestResponse] =
        await Promise.all([
          getFamilyServices(),
          getFamilies(),
          getMyFamilies(),
          getMyFamilyRequests()
        ]);
      setServices(serviceResponse);
      setFamilies(familyResponse);
      setMyFamilies(myFamilyResponse);
      setMyRequests(requestResponse);
      setCreateForm((current) => ({
        ...current,
        service_id:
          current.service_id ||
          serviceResponse.find((service) => service.family_type === familyType)?.id ||
          "",
        max_members: Math.min(
          current.max_members,
          serviceResponse.find((service) => service.family_type === familyType)
            ?.max_members ?? 8
        )
      }));
      setLoadState("ready");
    } catch (err) {
      setError(formatError(err));
      setLoadState("error");
    }
  }

  async function runAction(label: string, action: () => Promise<unknown>) {
    try {
      triggerTelegramSelection();
      setBusy(label);
      setError(null);
      setNotice(null);
      await action();
      triggerTelegramNotification("success");
      setNotice("Готово");
      await load();
    } catch (err) {
      triggerTelegramNotification("error");
      setError(formatError(err));
    } finally {
      setBusy(null);
    }
  }

  async function loadOwnerDetails(familyId: string) {
    await runAction("owner-details", async () => {
      const [requests, members] = await Promise.all([
        getOwnerFamilyRequests(familyId),
        getFamilyMembers(familyId)
      ]);
      const paymentPairs = await Promise.all(
        members.map(async (member) => [member.id, await getMemberPayments(member.id)])
      );
      setOwnerDetails((current) => ({
        ...current,
        [familyId]: {
          requests,
          members,
          paymentsByMemberId: Object.fromEntries(paymentPairs)
        }
      }));
    });
  }

  async function openFamily(familyId: string, backTab: Tab = tab) {
    try {
      setBusy("family-view");
      setError(null);
      const view = await getFamilyView(familyId);
      const auditLogs = view.my_membership
        ? await getFamilyAuditLog(familyId)
        : [];
      setSelectedFamilyView(view);
      setSelectedFamilyAudit(auditLogs);
      setFamilyBackTab(backTab === "family" ? "search" : backTab);
      setTab("family");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(null);
    }
  }

  async function switchDevUser(nextUserId: string) {
    const nextUser = DEV_TELEGRAM_USERS.find((user) => user.id === Number(nextUserId));
    if (!nextUser) {
      return;
    }
    setActiveDevTelegramUser(nextUser);
    setDevUser(nextUser);
    setOwnerDetails({});
    setRequisites({});
    setSelectedFamilyView(null);
    setSelectedFamilyAudit([]);
    await load();
  }

  function selectedService() {
    return typedServices.find((service) => service.id === createForm.service_id) ?? null;
  }

  function changeFamilyType(nextType: FamilyType) {
    const nextServices = services.filter((service) => service.family_type === nextType);
    setFamilyType(nextType);
    setFamilyFilter("all");
    setCreateForm((current) => ({
      ...current,
      service_id: nextServices[0]?.id || "",
      period: nextServices[0]?.supported_periods[0] ?? "monthly",
      max_members: Math.min(current.max_members, nextServices[0]?.max_members ?? 8)
    }));
  }

  async function handleCreateFamily(event: FormEvent) {
    event.preventDefault();
    await runAction("create-family", async () => {
      const payload: FamilyCreate = {
        ...createForm,
        description: normalizeText(createForm.description),
        owner_rules: normalizeText(createForm.owner_rules)
      };
      await createFamily(payload);
      setCreateForm({
        ...emptyCreateForm,
        service_id: typedServices[0]?.id || "",
        period: typedServices[0]?.supported_periods[0] ?? "monthly",
        max_members: Math.min(6, typedServices[0]?.max_members ?? 8)
      });
      setMyFamilyType(familyType);
      setTab("mine");
    });
  }

  useEffect(() => {
    const cleanupTelegram = initTelegramShell();
    void load();
    return cleanupTelegram;
  }, []);

  useEffect(() => {
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
  }, [selectedFamilyView?.family.id, tab]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const typedServices = useMemo(
    () => services.filter((service) => service.family_type === familyType),
    [services, familyType]
  );

  const typedFamilies = useMemo(
    () => families.filter((family) => family.family_type === familyType),
    [families, familyType]
  );

  const typedMyFamilies = useMemo(
    () => myFamilies.filter((item) => item.family.family_type === myFamilyType),
    [myFamilies, myFamilyType]
  );

  const filteredFamilies = useMemo(() => {
    if (familyFilter === "all") {
      return typedFamilies;
    }
    return typedFamilies.filter((family) => family.service_id === familyFilter);
  }, [typedFamilies, familyFilter]);

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
          <button
            type="button"
            onClick={() => void runAction("refresh-profile", refreshTelegramProfile)}
          >
            Я создал username
          </button>
        </div>
      </Shell>
    );
  }

  if (loadState === "error") {
    return (
      <Shell title="Backend недоступен">
        <div className="notice notice-error">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>
            Повторить
          </button>
        </div>
      </Shell>
    );
  }

  const user = me?.ok ? me.user : null;
  const service = selectedService();

  return (
    <Shell title="SubsMarket">
      <AppHeader userName={user?.username ?? "unknown"} firstName={user?.first_name} />
      {isDevAuthEnabled() && devUser && (
        <DevUserSwitch value={devUser} onChange={(id) => void switchDevUser(id)} />
      )}

      {error && <div className="inline-error">{error}</div>}
      {notice && <div className="inline-success">{notice}</div>}

      {tab === "home" && (
        <HomeScreen
          families={families}
          myFamilies={myFamilies}
          myRequests={myRequests}
          onSearch={(nextType) => {
            changeFamilyType(nextType);
            setTab("search");
          }}
          onCreate={(nextType) => {
            changeFamilyType(nextType);
            setTab("create");
          }}
          onMine={() => setTab("mine")}
          onRequests={() => setTab("requests")}
        />
      )}

      {tab === "search" && (
        <SearchScreen
          familyType={familyType}
          services={services}
          typedServices={typedServices}
          familyFilter={familyFilter}
          filteredFamilies={filteredFamilies}
          busy={busy}
          onChangeFamilyType={changeFamilyType}
          onChangeFamilyFilter={setFamilyFilter}
          onRefresh={() => void load()}
          onImportCatalog={() =>
            void runAction("import-catalog", importFamilyServices)
          }
          onOpenFamily={(familyId) => void openFamily(familyId, "search")}
          onCreateFamily={(nextType) => {
            changeFamilyType(nextType);
            setTab("create");
          }}
          onCreateRequest={(familyId) =>
            void runAction("create-request", () =>
              createFamilyRequest(familyId)
            ).then(() => openFamily(familyId, "search"))
          }
        />
      )}

      {tab === "create" && (
        <CreateFamilyScreen
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
      )}

      {tab === "mine" && (
        <MyFamiliesScreen
          myFamilyType={myFamilyType}
          families={typedMyFamilies}
          ownerDetails={ownerDetails}
          requisites={requisites}
          busy={busy}
          onChangeFamilyType={setMyFamilyType}
          onOpenFamily={(familyId) => void openFamily(familyId, "mine")}
          onLoadOwnerDetails={(familyId) => void loadOwnerDetails(familyId)}
          onUpdateDescription={(familyId, description) =>
            void runAction("update-description", () =>
              updateFamilyDescription(familyId, description)
            )
          }
          onUpdatePrice={(familyId, totalPriceKzt) =>
            void runAction("update-price", () =>
              updateFamilyPrice(familyId, totalPriceKzt)
            )
          }
          onUpdatePaymentDay={(familyId, paymentDay, nextPaymentDate) =>
            void runAction("update-payment-day", () =>
              updateFamilyPaymentDay(familyId, paymentDay, nextPaymentDate)
            )
          }
          onCloseFamily={(familyId) =>
            void runAction("close-family", () => closeFamily(familyId))
          }
          onConfirmAccess={(memberId) =>
            void runAction("confirm-access", async () => {
              const result = await confirmAccessReceived(memberId);
              setRequisites((current) => ({
                ...current,
                [memberId]: result.payment_requisite
              }));
            })
          }
          onGetRequisite={(memberId) =>
            void runAction("get-requisite", async () => {
              const requisite = await getPaymentRequisite(memberId);
              setRequisites((current) => ({
                ...current,
                [memberId]: requisite
              }));
            })
          }
          onAcknowledgeClosing={(familyId) =>
            void runAction("ack-closing", () => acknowledgeFamilyClosing(familyId))
          }
          onAcknowledgeRemoval={(memberId) =>
            void runAction("ack-removal", () => acknowledgeMemberRemoval(memberId))
          }
          onRequestRemovalCancellation={(memberId) =>
            void runAction("request-removal-cancellation", () =>
              requestMemberRemovalCancellation(memberId)
            )
          }
          onLeaveFamily={(memberId) =>
            void runAction("leave-family", () => leaveFamily(memberId))
          }
          onCreatePrepayment={(memberId) =>
            void runAction("create-prepayment", () =>
              createMemberPrepayment(memberId)
            )
          }
          onReportPayment={(payment) =>
            runAction("report-paid", () => reportPaymentPaid(payment.id))
          }
          onCancelPaymentReport={(payment) =>
            runAction("cancel-report", () => cancelPaymentReport(payment.id))
          }
          onApproveRequest={(familyId, request) =>
            runAction("approve-request", () => approveFamilyRequest(request.id)).then(
              () => loadOwnerDetails(familyId)
            )
          }
          onRejectRequest={(familyId, request) =>
            runAction("reject-request", () => rejectFamilyRequest(request.id)).then(
              () => loadOwnerDetails(familyId)
            )
          }
          onAccessProvided={(familyId, member) =>
            runAction("access-provided", () => markAccessProvided(member.id)).then(
              () => loadOwnerDetails(familyId)
            )
          }
          onRemindAccess={(familyId, member) =>
            runAction("remind-access", () =>
              remindAccessConfirmation(member.id)
            ).then(() => loadOwnerDetails(familyId))
          }
          onCancelBeforeAccess={(familyId, member) =>
            runAction("cancel-before-access", () =>
              cancelMemberBeforeAccess(member.id)
            ).then(() => loadOwnerDetails(familyId))
          }
          onRemoveMember={(familyId, member) =>
            runAction("remove-member", () => scheduleMemberRemoval(member.id)).then(
              () => loadOwnerDetails(familyId)
            )
          }
          onRevokeRemoval={(familyId, member) =>
            runAction("revoke-removal", () => revokeMemberRemoval(member.id)).then(
              () => loadOwnerDetails(familyId)
            )
          }
          onConfirmPayment={(familyId, payment) =>
            runAction("confirm-payment", () =>
              confirmPaymentReceived(payment.id)
            ).then(() => loadOwnerDetails(familyId))
          }
          onNotReceived={(familyId, payment) =>
            runAction("not-received", () => markPaymentNotReceived(payment.id)).then(
              () => loadOwnerDetails(familyId)
            )
          }
          onRecordPrepayment={(familyId, member, periods) =>
            runAction("record-prepayment", () =>
              recordOwnerPrepaidPeriods(member.id, periods)
            ).then(() => loadOwnerDetails(familyId))
          }
        />
      )}

      {tab === "requests" && (
        <RequestsScreen
          requests={myRequests}
          busy={busy}
          onCancelRequest={(requestId) =>
            void runAction("cancel-request", () => cancelFamilyRequest(requestId))
          }
        />
      )}

      {tab === "family" && (
        <FamilyDetailsScreen
          view={selectedFamilyView}
          requisite={
            selectedFamilyView?.my_membership
              ? requisites[selectedFamilyView.my_membership.id] ?? null
              : null
          }
          auditLogs={selectedFamilyAudit}
          busy={busy}
          onBack={() => setTab(familyBackTab)}
          onRefresh={() =>
            selectedFamilyView &&
            void openFamily(selectedFamilyView.family.id, familyBackTab)
          }
          onCreateRequest={(familyId) =>
            void runAction("create-request", () => createFamilyRequest(familyId)).then(
              () => openFamily(familyId, familyBackTab)
            )
          }
          onConfirmAccess={(memberId) =>
            void runAction("confirm-access", async () => {
              const result = await confirmAccessReceived(memberId);
              setRequisites((current) => ({
                ...current,
                [memberId]: result.payment_requisite
              }));
            }).then(
              () =>
                selectedFamilyView &&
                openFamily(selectedFamilyView.family.id, familyBackTab)
            )
          }
          onGetRequisite={(memberId) =>
            void runAction("get-requisite", async () => {
              const requisite = await getPaymentRequisite(memberId);
              setRequisites((current) => ({
                ...current,
                [memberId]: requisite
              }));
            })
          }
          onReportPayment={(payment) =>
            runAction("report-paid", () => reportPaymentPaid(payment.id)).then(
              () =>
                selectedFamilyView &&
                openFamily(selectedFamilyView.family.id, familyBackTab)
            )
          }
          onCancelPaymentReport={(payment) =>
            runAction("cancel-report", () => cancelPaymentReport(payment.id)).then(
              () =>
                selectedFamilyView &&
                openFamily(selectedFamilyView.family.id, familyBackTab)
            )
          }
        />
      )}

      <BottomNav active={tab} onChange={setTab} />
    </Shell>
  );
}
