import { useEffect, useState } from "react";
import {
  Button as WorldButton,
  Input,
  TextArea,
  Typography
} from "@worldcoin/mini-apps-ui-kit-react";

import { FamilyCard, OwnerDetails, PaymentList } from "../components/families";
import {
  Badge,
  EmptyState,
  FamilyTypeSwitch,
  Panel,
  ProductScopeSwitch
} from "../components/layout";
import { RequisiteBox } from "../components/RequisiteBox";
import { FamilyListSkeleton } from "../components/skeleton";
import { familyTitle, formatDateTime, statusText } from "../format";
import {
  familyKindLabels,
  requestCancelReasonLabels
} from "../labels";
import { openTelegramUser } from "../telegram";
import type {
  Family,
  FamilyMember,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyRequest,
  FamilyType,
  MyFamily,
  OwnerFamilyDetails,
  PaymentRequisite
} from "../types";

export function MyFamiliesScreen({
  mode = "mine",
  myFamilyType,
  families,
  ownerDetails,
  requisites,
  requests,
  busy,
  isLoading,
  requestsLoading,
  hasMoreFamilies,
  isLoadingMoreFamilies,
  hasMoreRequests,
  isLoadingMoreRequests,
  onChangeFamilyType,
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
  onCancelRequest
}: {
  mode?: "mine" | "actions";
  myFamilyType: FamilyType;
  families: MyFamily[];
  ownerDetails: Record<string, OwnerFamilyDetails>;
  requisites: Record<string, PaymentRequisite>;
  requests: FamilyRequest[];
  busy: string | null;
  isLoading?: boolean;
  requestsLoading?: boolean;
  hasMoreFamilies?: boolean;
  isLoadingMoreFamilies?: boolean;
  hasMoreRequests?: boolean;
  isLoadingMoreRequests?: boolean;
  onChangeFamilyType: (familyType: FamilyType) => void;
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
}) {
  const actionFamilies = families.filter(hasPendingFamilyAction);
  const visibleFamilies = mode === "actions" ? actionFamilies : families;
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

  return (
    <div data-testid={mode === "actions" ? "actions-screen" : "my-screen"}>
      <Panel
        title={mode === "actions" ? "Действия" : "Мои"}
        description={
          mode === "actions"
            ? "Заявки, доступы и оплаты, где нужен ответ."
            : "Ваши места, семьи и управление подписками."
        }
      >
        {mode === "mine" ? <ProductScopeSwitch /> : null}
        {mode === "actions" ? (
          <ActionSummary
            pendingRequestCount={pendingRequestCount}
            ownerRequestCount={ownerRequestCount}
            paymentActionCount={paymentActionCount}
            accessActionCount={accessActionCount}
          />
        ) : null}
        <MyRequestsSection
          requests={requests}
          busy={busy}
          isLoading={requestsLoading}
          showEmpty={mode === "actions"}
          onCancelRequest={onCancelRequest}
        />
        {hasMoreRequests && onLoadMoreRequests ? (
          <WorldButton
            type="button"
            variant="secondary"
            fullWidth
            disabled={isLoadingMoreRequests}
            onClick={onLoadMoreRequests}
          >
            {isLoadingMoreRequests ? "Загружаем заявки..." : "Показать ещё заявки"}
          </WorldButton>
        ) : null}
        {mode === "mine" ? (
          <FamilyTypeSwitch value={myFamilyType} onChange={onChangeFamilyType} />
        ) : null}
        {mode === "actions" ? (
          <div className="section-inline-title">
            <span>Семьи с действиями</span>
            <Badge>{actionFamilies.length}</Badge>
          </div>
        ) : null}
        {isLoading && visibleFamilies.length === 0 ? (
          <FamilyListSkeleton count={3} />
        ) : visibleFamilies.length === 0 ? (
          <EmptyState
            title={mode === "actions" ? "Сейчас нет действий" : "У вас пока нет семей"}
          >
            {mode === "actions"
              ? "Когда появится заявка, доступ или оплата, она будет здесь."
              : "Создайте семью или отправьте заявку в поиске."}
          </EmptyState>
        ) : (
          <div className="stack">
            {visibleFamilies.map((item) => {
              const details = ownerDetails[item.family.id];
              return (
                <article
                  className="family-workspace"
                  data-family-id={item.family.id}
                  data-testid="family-workspace"
                  key={item.membership.id}
                >
                  <FamilyCard family={item.family}>
                    <Badge>{statusText(item.membership.status)}</Badge>
                    <WorldButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      data-testid="workspace-open-family-button"
                      onClick={() => onOpenFamily(item.family.id)}
                    >
                      Подробнее
                    </WorldButton>
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
            {hasMoreFamilies && onLoadMoreFamilies ? (
              <WorldButton
                type="button"
                variant="secondary"
                fullWidth
                disabled={isLoadingMoreFamilies}
                onClick={onLoadMoreFamilies}
              >
                {isLoadingMoreFamilies ? "Загружаем семьи..." : "Показать ещё семьи"}
              </WorldButton>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ActionSummary({
  pendingRequestCount,
  ownerRequestCount,
  paymentActionCount,
  accessActionCount
}: {
  pendingRequestCount: number;
  ownerRequestCount: number;
  paymentActionCount: number;
  accessActionCount: number;
}) {
  return (
    <div className="action-summary" data-testid="actions-summary">
      <div>
        <span>Мои заявки</span>
        <strong>{pendingRequestCount}</strong>
      </div>
      <div>
        <span>Входящие</span>
        <strong>{ownerRequestCount}</strong>
      </div>
      <div>
        <span>Оплаты</span>
        <strong>{paymentActionCount}</strong>
      </div>
      <div>
        <span>Доступ</span>
        <strong>{accessActionCount}</strong>
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
    <section className="my-requests-section" data-testid="my-requests-section">
      <div className="section-inline-title">
        <span>Активные заявки</span>
        <Badge>{requests.filter((request) => request.status === "pending").length}</Badge>
      </div>
      <div className="stack">
        {requests.map((request) => (
          <article
            className="list-row request-card"
            data-testid="request-card"
            key={request.id}
          >
            <div>
              <div className="request-card-heading">
                <div>
                  <span className={`type-label type-label-${request.family_type}`}>
                    {familyKindLabels[request.family_type]}
                  </span>
                  <Typography as="strong" variant="subtitle" level={3}>
                    {familyTitle(request)}
                  </Typography>
                </div>
                <Badge>{statusText(request.status)}</Badge>
              </div>
              <Typography as="p" variant="body" level={3}>
                Создана {formatDateTime(request.created_at)} · истекает{" "}
                {formatDateTime(request.expires_at)}
              </Typography>
              {request.cancel_reason && (
                <Typography as="small" variant="body" level={4}>
                  {requestCancelReasonLabels[request.cancel_reason] ??
                    request.cancel_reason}
                </Typography>
              )}
            </div>
            {request.status === "pending" && (
              <div className="row-actions">
                {request.owner_username && (
                  <WorldButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="request-owner-chat-button"
                    onClick={() =>
                      openTelegramUser(
                        request.owner_username!,
                        `Здравствуйте, я оставил заявку в вашу семью ${familyTitle(request)} в SubsMarket.`
                      )
                    }
                  >
                    Написать владельцу
                  </WorldButton>
                )}
                <WorldButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => onCancelRequest(request.id)}
                >
                  Отменить
                </WorldButton>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function hasPendingFamilyAction(item: MyFamily) {
  if (item.pending_requests_count > 0) return true;
  if (["awaiting_access", "awaiting_confirmation"].includes(item.membership.status)) {
    return true;
  }
  return item.payments.some((payment) =>
    ["due", "overdue", "payment_reported"].includes(payment.status)
  );
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
  if (member.status === "removal_pending") {
    return {
      tone: "danger",
      title: "Удаление обрабатывается",
      text: "Это старое отложенное удаление. Новых действий от вас не требуется."
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
        <WorldButton
          type="button"
          size="sm"
          data-testid="owner-details-button"
          disabled={busy !== null}
          onClick={() => onLoadOwnerDetails(family.id)}
        >
          Заявки и участники
        </WorldButton>
        <WorldButton
          type="button"
          variant="secondary"
          size="sm"
          data-testid="confirm-availability-button"
          disabled={busy !== null || !["active", "full"].includes(family.status)}
          onClick={() => onConfirmAvailability(family.id)}
        >
          Семья актуальна
        </WorldButton>
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

      <div className="owner-settings-grid">
        <Input
          label="Доступ работает до"
          data-testid="close-family-date-input"
          min={today}
          type="date"
          value={closeDateDraft}
          onChange={(event) => setCloseDateDraft(event.target.value)}
        />
        <WorldButton
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
        </WorldButton>
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
      <WorldButton
        type="button"
        variant="secondary"
        data-testid="owner-save-description-button"
        disabled={busy !== null}
        onClick={() =>
          onUpdateDescription(family.id, descriptionValue ? descriptionValue : null)
        }
      >
        Сохранить описание
      </WorldButton>

      <div className="owner-settings-grid">
        <Input
          label="Общая цена"
          data-testid="owner-price-input"
          min={1}
          type="number"
          value={priceDraft}
          onChange={(event) => setPriceDraft(event.target.value)}
        />
        <WorldButton
          type="button"
          variant="secondary"
          data-testid="owner-save-price-button"
          disabled={busy !== null || !canSubmitPrice}
          onClick={() => onUpdatePrice(family.id, priceValue)}
        >
          Изменить цену
        </WorldButton>
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
        <WorldButton
          type="button"
          variant="secondary"
          data-testid="owner-save-payment-day-button"
          disabled={busy !== null || !canSubmitPaymentDay}
          onClick={() =>
            onUpdatePaymentDay(family.id, paymentDayValue, nextPaymentDateDraft)
          }
        >
          Изменить дату оплаты
        </WorldButton>
      </div>
      <Typography as="small" variant="body" level={4} className="muted">
        Дату оплаты можно менять только пока семья ещё не была полностью собрана.
      </Typography>
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
        <WorldButton
          type="button"
          data-testid="confirm-access-button"
          disabled={busy !== null}
          onClick={() => onConfirmAccess(member.id)}
        >
          Доступ получен
        </WorldButton>
      )}
      {member.access_confirmed_at && (
        <WorldButton
          type="button"
          variant="secondary"
          data-testid="show-requisite-button"
          disabled={busy !== null}
          onClick={() => onGetRequisite(member.id)}
        >
          Показать реквизиты
        </WorldButton>
      )}
      {member.status === "active" && ["active", "full"].includes(familyStatus) && (
        <WorldButton
          type="button"
          variant="secondary"
          data-testid="create-prepayment-button"
          disabled={busy !== null}
          onClick={() => onCreatePrepayment(member.id)}
        >
          Оплатить следующий период заранее
        </WorldButton>
      )}
      {familyStatus === "closing" && (
        <WorldButton
          type="button"
          data-testid="acknowledge-closing-button"
          disabled={busy !== null}
          onClick={() => onAcknowledgeClosing(familyId)}
        >
          Понятно, семья закрывается
        </WorldButton>
      )}
      <WorldButton
        type="button"
        variant="secondary"
        data-testid="leave-family-button"
        disabled={busy !== null}
        onClick={() => onLeaveFamily(member.id)}
      >
        Выйти
      </WorldButton>
    </>
  );
}
