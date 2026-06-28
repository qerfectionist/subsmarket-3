import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button as WorldButton, useToast } from "@worldcoin/mini-apps-ui-kit-react";

import {
  type DevTelegramUser,
  DEV_TELEGRAM_USERS,
  getActiveDevTelegramUser,
  getFamilyByInviteCode,
  getFamilyMemberPayments,
  getFamilyMembers,
  getOwnerFamilyRequests,
  initTelegramShell,
  isDevAuthEnabled,
  isDevUserSwitchVisible,
  setActiveDevTelegramUser
} from "./api";
import type { LoadState, Tab } from "./appTypes";
import { AppHeader, BottomNav, DevUserSwitch, Shell } from "./components/layout";
import { formatError, futureDateISO, normalizeText } from "./format";
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
  useCreateFamily,
  useCreateFamilyInvite,
  useCreateFamilyRequest,
  useCreateMemberPrepayment,
  useDisableFamilyInvite,
  useFamilyAuditLog,
  useFamilyInvite,
  useFamilyMemberPayments,
  useFamilyMembers,
  useFamilyServices,
  useFamilyView,
  useFamilies,
  useGetPaymentRequisite,
  useImportFamilyServices,
  useLeaveFamily,
  useMarkAccessProvided,
  useMarkPaymentNotReceived,
  useMe,
  useMyFamilies,
  useMyFamilyRequests,
  useOwnerFamilyRequests,
  useRecordOwnerPrepaidPeriods,
  useRefreshTelegramProfile,
  useRemindAccessConfirmation,
  useRejectFamilyRequest,
  useReportPaymentPaid,
  useResolveInviteCode,
  useRotateFamilyInvite,
  useRemoveMember,
  useUpdateFamilyDescription,
  useUpdateFamilyPaymentDay,
  useUpdateFamilyPrice,
  useUpdateFamilyVisibility
} from "./hooks/useApi";
import { CreateFamilyScreen } from "./screens/CreateFamilyScreen";
import { FamilyDetailsScreen } from "./screens/FamilyDetailsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MyFamiliesScreen } from "./screens/MyFamiliesScreen";
import { RequestsScreen } from "./screens/RequestsScreen";
import { SearchScreen } from "./screens/SearchScreen";
import type {
  Family,
  FamilyCreate,
  FamilyMemberRemovalReason,
  FamilyType,
  OwnerFamilyDetails,
  PaymentRequisite
} from "./types";
import {
  setTelegramBackButton,
  setTelegramClosingConfirmation,
  showTelegramConfirm,
  getTelegramStartParam,
  triggerTelegramImpact,
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const meQuery = useMe();
  const servicesQuery = useFamilyServices();
  const familiesQuery = useFamilies();
  const myFamiliesQuery = useMyFamilies();
  const myRequestsQuery = useMyFamilyRequests();

  const [tab, setTab] = useState<Tab>("home");
  const [ownerDetails, setOwnerDetails] = useState<
    Record<string, OwnerFamilyDetails>
  >({});
  const [requisites, setRequisites] = useState<Record<string, PaymentRequisite>>({});
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
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
  const startParamHandled = useRef(false);

  const familyViewQuery = useFamilyView(selectedFamilyId);
  const familyAuditQuery = useFamilyAuditLog(
    selectedFamilyId && familyViewQuery.data?.my_membership ? selectedFamilyId : null
  );
  const familyInviteQuery = useFamilyInvite(
    selectedFamilyId && familyViewQuery.data?.my_membership?.role === "owner"
      ? selectedFamilyId
      : null
  );

  const me = meQuery.data;
  const services = servicesQuery.data ?? [];
  const families = familiesQuery.data ?? [];
  const myFamilies = myFamiliesQuery.data ?? [];
  const myRequests = myRequestsQuery.data ?? [];
  const selectedFamilyView = familyViewQuery.data ?? null;
  const selectedFamilyAudit = familyAuditQuery.data ?? [];
  const selectedFamilyInvite = familyInviteQuery.data ?? null;

  const loadState: LoadState = meQuery.isPending
    ? "loading"
    : meQuery.isError
      ? "error"
      : me && !me.ok
        ? "username-required"
        : "ready";

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

  async function runMutation(label: string, mutation: () => Promise<unknown>) {
    try {
      triggerTelegramSelection();
      setBusy(label);
      setError(null);
      await mutation();
      triggerTelegramNotification("success");
      toast.success({ title: toastMessage(label) });
    } catch (err) {
      triggerTelegramNotification("error");
      setError(formatError(err));
    } finally {
      setBusy(null);
    }
  }

  async function loadOwnerDetails(familyId: string) {
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
  }

  function openFamily(familyId: string, backTab: Tab = tab) {
    triggerTelegramImpact("light");
    setSelectedFamilyId(familyId);
    setFamilyBackTab(backTab === "family" ? "search" : backTab);
    setTab("family");
  }

  async function openFamilyByInviteCode(code: string) {
    try {
      setBusy("invite-view");
      setError(null);
      const view = await getFamilyByInviteCode(code);
      setSelectedFamilyId(view.family.id);
      setFamilyBackTab("search");
      setTab("family");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(null);
    }
  }

  async function switchDevUser(nextUserId: string) {
    const nextUser = DEV_TELEGRAM_USERS.find((user) => user.id === Number(nextUserId));
    if (!nextUser) return;
    setActiveDevTelegramUser(nextUser);
    setDevUser(nextUser);
    setOwnerDetails({});
    setRequisites({});
    setSelectedFamilyId(null);
    setTab("home");
    queryClient.clear();
  }

  const refreshProfileMutation = useRefreshTelegramProfile();
  const importCatalogMutation = useImportFamilyServices();
  const createFamilyMutation = useCreateFamily();
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
  const resolveInviteMutation = useResolveInviteCode();
  const actualLeaveMutation = useLeaveFamily();

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
    await runMutation("create-family", async () => {
      const payload: FamilyCreate = {
        ...createForm,
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
      setMyFamilyType(familyType);
      setTab("mine");
    });
  }

  useEffect(() => {
    const cleanupTelegram = initTelegramShell();
    return cleanupTelegram;
  }, []);

  useEffect(() => {
    if (loadState !== "ready" || startParamHandled.current) return;
    startParamHandled.current = true;
    const match = getTelegramStartParam().match(/^invite_(\d{8})$/);
    if (match) void openFamilyByInviteCode(match[1]);
  }, [loadState]);

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
  }, [selectedFamilyId, tab]);

  const createFormDirty = Boolean(
    tab === "create" &&
      (createForm.payment_phone.trim().length > 0 ||
        Boolean(createForm.description?.trim()) ||
        Boolean(createForm.owner_rules?.trim()) ||
        createForm.total_price_kzt !== emptyCreateForm.total_price_kzt)
  );
  useEffect(() => {
    setTelegramClosingConfirmation(Boolean(busy) || createFormDirty);
  }, [busy, createFormDirty]);

  const typedServices = useMemo(
    () => services.filter((service) => service.family_type === familyType),
    [services, familyType]
  );

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

  const typedFamilies = useMemo(
    () => families.filter((family) => family.family_type === familyType),
    [families, familyType]
  );

  const typedMyFamilies = useMemo(
    () => myFamilies.filter((item) => item.family.family_type === myFamilyType),
    [myFamilies, myFamilyType]
  );

  const filteredFamilies = useMemo(() => {
    if (familyFilter === "all") return typedFamilies;
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
          <WorldButton
            type="button"
            fullWidth
            onClick={() => void runMutation("refresh-profile", () => refreshProfileMutation.mutateAsync())}
          >
            Я создал username
          </WorldButton>
        </div>
      </Shell>
    );
  }

  if (loadState === "error") {
    return (
      <Shell title="Backend недоступен">
        <div className="notice notice-error">
          <p>{formatError(meQuery.error)}</p>
          <WorldButton type="button" fullWidth onClick={() => meQuery.refetch()}>
            Повторить
          </WorldButton>
        </div>
      </Shell>
    );
  }

  const user = me?.ok ? me.user : null;
  const service = selectedService();

  return (
    <Shell title="SubsMarket">
      <AppHeader userName={user?.username ?? "unknown"} firstName={user?.first_name} />
      {isDevUserSwitchVisible() && devUser && (
        <DevUserSwitch value={devUser} onChange={(id) => void switchDevUser(id)} />
      )}

      {error && (
        <div className="inline-error" role="alert" aria-live="polite">
          {error}
        </div>
      )}

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
          isLoading={familiesQuery.isLoading}
          onChangeFamilyType={changeFamilyType}
          onChangeFamilyFilter={setFamilyFilter}
          onRefresh={() => familiesQuery.refetch()}
          onImportCatalog={() =>
            void runMutation("import-catalog", () => importCatalogMutation.mutateAsync())
          }
          onOpenFamily={(familyId) => openFamily(familyId, "search")}
          onOpenInvite={(code) => void openFamilyByInviteCode(code)}
          onCreateFamily={(nextType) => {
            changeFamilyType(nextType);
            setTab("create");
          }}
          onCreateRequest={(familyId) =>
            void runMutation("create-request", () =>
              createRequestMutation.mutateAsync(familyId)
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
          isLoading={myFamiliesQuery.isLoading}
          onChangeFamilyType={setMyFamilyType}
          onOpenFamily={(familyId) => openFamily(familyId, "mine")}
          onLoadOwnerDetails={(familyId) => void loadOwnerDetails(familyId)}
          onUpdateDescription={(familyId, description) =>
            void runMutation("update-description", () =>
              updateDescriptionMutation.mutateAsync({ familyId, description })
            )
          }
          onUpdatePrice={(familyId, totalPriceKzt) =>
            void runMutation("update-price", () =>
              updatePriceMutation.mutateAsync({ familyId, totalPriceKzt })
            )
          }
          onUpdatePaymentDay={(familyId, paymentDay, nextPaymentDate) =>
            void runMutation("update-payment-day", () =>
              updatePaymentDayMutation.mutateAsync({ familyId, paymentDay, nextPaymentDate })
            )
          }
          onCloseFamily={(familyId, closesOn) =>
            void runMutation("close-family", async () => {
              const ok = await showTelegramConfirm(
                `Закрыть семью с ${closesOn}? Участники получат уведомление, новые заявки будут отменены.`
              );
              if (!ok) return;
              await closeFamilyMutation.mutateAsync({ familyId, closesOn });
            })
          }
          onConfirmAvailability={(familyId) =>
            void runMutation("confirm-availability", () =>
              confirmAvailabilityMutation.mutateAsync(familyId)
            )
          }
          onConfirmAccess={(memberId) =>
            void runMutation("confirm-access", async () => {
              const result = await confirmAccessMutation.mutateAsync(memberId);
              setRequisites((current) => ({
                ...current,
                [memberId]: result.payment_requisite
              }));
            })
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
          onAcknowledgeClosing={(familyId) =>
            void runMutation("ack-closing", () => ackClosingMutation.mutateAsync(familyId))
          }
          onLeaveFamily={(memberId) =>
            void runMutation("leave-family", async () => {
              const ok = await showTelegramConfirm(
                "Покинуть семью? Будущие платежи отменятся, место освободится."
              );
              if (!ok) return;
              await actualLeaveMutation.mutateAsync(memberId);
            })
          }
          onCreatePrepayment={(memberId) =>
            void runMutation("create-prepayment", () =>
              createPrepaymentMutation.mutateAsync(memberId)
            )
          }
          onReportPayment={(payment) =>
            runMutation("report-paid", () => reportPaymentMutation.mutateAsync(payment.id))
          }
          onCancelPaymentReport={(payment) =>
            runMutation("cancel-report", () => cancelReportMutation.mutateAsync(payment.id))
          }
          onApproveRequest={(familyId, request) =>
            runMutation("approve-request", () =>
              approveRequestMutation.mutateAsync({ familyId, requestId: request.id })
            ).then(() => loadOwnerDetails(familyId))
          }
          onRejectRequest={(familyId, request) =>
            runMutation("reject-request", () =>
              rejectRequestMutation.mutateAsync({ familyId, requestId: request.id })
            ).then(() => loadOwnerDetails(familyId))
          }
          onAccessProvided={(familyId, member) =>
            runMutation("access-provided", () =>
              markAccessMutation.mutateAsync({ familyId, memberId: member.id })
            ).then(() => loadOwnerDetails(familyId))
          }
          onRemindAccess={(familyId, member) =>
            runMutation("remind-access", () =>
              remindAccessMutation.mutateAsync({ familyId, memberId: member.id })
            ).then(() => loadOwnerDetails(familyId))
          }
          onCancelBeforeAccess={(familyId, member) =>
            runMutation("cancel-before-access", () =>
              cancelBeforeAccessMutation.mutateAsync({ familyId, memberId: member.id })
            ).then(() => loadOwnerDetails(familyId))
          }
          onRemoveMember={(familyId, member, reason: FamilyMemberRemovalReason) =>
            runMutation("remove-member", async () => {
              const ok = await showTelegramConfirm(
                `Удалить @${member.user.username} из семьи? Причина: ${reason}.`
              );
              if (!ok) return;
                await removeMemberMutation.mutateAsync({
                  familyId,
                  memberId: member.id,
                  reason
                });
            }).then(() => loadOwnerDetails(familyId))
          }
          onConfirmPayment={(familyId, payment) =>
            runMutation("confirm-payment", () =>
              confirmPaymentMutation.mutateAsync({ familyId, paymentId: payment.id })
            ).then(() => loadOwnerDetails(familyId))
          }
          onNotReceived={(familyId, payment) =>
            runMutation("not-received", () =>
              notReceivedMutation.mutateAsync({ familyId, paymentId: payment.id })
            ).then(() => loadOwnerDetails(familyId))
          }
          onRecordPrepayment={(familyId, member, periods) =>
            runMutation("record-prepayment", () =>
              recordPrepaymentMutation.mutateAsync({ familyId, memberId: member.id, periods })
            ).then(() => loadOwnerDetails(familyId))
          }
        />
      )}

      {tab === "requests" && (
        <RequestsScreen
          requests={myRequests}
          busy={busy}
          isLoading={myRequestsQuery.isLoading}
          onCancelRequest={(requestId) =>
            void runMutation("cancel-request", () => cancelRequestMutation.mutateAsync(requestId))
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
            ).then(() => familyViewQuery.refetch())
          }
          onCreateInvite={(familyId) =>
            void runMutation("create-invite", () => createInviteMutation.mutateAsync(familyId))
          }
          onRotateInvite={(familyId) =>
            void runMutation("rotate-invite", () => rotateInviteMutation.mutateAsync(familyId))
          }
          onDisableInvite={(familyId) =>
            void runMutation("disable-invite", async () => {
              const ok = await showTelegramConfirm(
                "Отключить приглашение? Новый код не будет работать."
              );
              if (!ok) return;
              await disableInviteMutation.mutateAsync(familyId);
            })
          }
          onUpdateVisibility={(familyId, isSearchVisible) =>
            void runMutation("update-visibility", () =>
              updateVisibilityMutation.mutateAsync({ familyId, isSearchVisible })
            ).then(() => familyViewQuery.refetch())
          }
          onConfirmAvailability={(familyId) =>
            void runMutation("confirm-availability", () =>
              confirmAvailabilityMutation.mutateAsync(familyId)
            ).then(() => familyViewQuery.refetch())
          }
          onConfirmAccess={(memberId) =>
            void runMutation("confirm-access", async () => {
              const result = await confirmAccessMutation.mutateAsync(memberId);
              setRequisites((current) => ({
                ...current,
                [memberId]: result.payment_requisite
              }));
            }).then(() => familyViewQuery.refetch())
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
              () => familyViewQuery.refetch()
            )
          }
          onCancelPaymentReport={(payment) =>
            runMutation("cancel-report", () => cancelReportMutation.mutateAsync(payment.id)).then(
              () => familyViewQuery.refetch()
            )
          }
        />
      )}

      <BottomNav
        active={tab}
        onChange={setTab}
        badges={{
          requests: myRequests.filter((r) => r.status === "pending").length,
          mine: myFamilies.filter((item) =>
            item.pending_requests_count > 0 ||
            item.payments.some((p) => p.status === "payment_reported")
          ).length
        }}
      />

    </Shell>
  );
}
