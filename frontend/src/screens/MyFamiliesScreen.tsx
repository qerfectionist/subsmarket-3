import { useEffect, useState } from "react";

import { FamilyCard, OwnerDetails, PaymentList } from "../components/families";
import { Badge, EmptyState, FamilyTypeSwitch, Panel } from "../components/layout";
import { statusText } from "../format";
import { bankLabels } from "../labels";
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
  myFamilyType,
  families,
  ownerDetails,
  requisites,
  busy,
  onChangeFamilyType,
  onOpenFamily,
  onLoadOwnerDetails,
  onUpdateDescription,
  onUpdatePrice,
  onUpdatePaymentDay,
  onCloseFamily,
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
  onRecordPrepayment
}: {
  myFamilyType: FamilyType;
  families: MyFamily[];
  ownerDetails: Record<string, OwnerFamilyDetails>;
  requisites: Record<string, PaymentRequisite>;
  busy: string | null;
  onChangeFamilyType: (familyType: FamilyType) => void;
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
}) {
  return (
    <Panel
      title="Мои семьи"
      description="Здесь видны семьи, где вы владелец или участник."
    >
      <FamilyTypeSwitch value={myFamilyType} onChange={onChangeFamilyType} />
      {families.length === 0 ? (
        <EmptyState title="У вас пока нет семей">
          Создайте семью или отправьте заявку в поиске.
        </EmptyState>
      ) : (
        <div className="stack">
          {families.map((item) => {
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
                  <button
                    type="button"
                    className="secondary"
                    data-testid="workspace-open-family-button"
                    onClick={() => onOpenFamily(item.family.id)}
                  >
                    Подробнее
                  </button>
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
                  <div className="requisite-box">
                    <strong>Реквизиты открыты:</strong>{" "}
                    {bankLabels[requisites[item.membership.id].bank]} ·{" "}
                    {requisites[item.membership.id].phone}
                  </div>
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
        </div>
      )}
    </Panel>
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
  onCloseFamily
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
        <button
          type="button"
          data-testid="owner-details-button"
          disabled={busy !== null}
          onClick={() => onLoadOwnerDetails(family.id)}
        >
          Заявки и участники
        </button>
      </div>

      <div className="owner-settings-grid">
        <label>
          Доступ работает до
          <input
            data-testid="close-family-date-input"
            min={today}
            type="date"
            value={closeDateDraft}
            onChange={(event) => setCloseDateDraft(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="danger"
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
        </button>
      </div>
      <small className="muted">
        Семья сразу исчезнет из поиска, а участники увидят точную дату окончания
        доступа.
      </small>

      <label>
        Описание семьи
        <textarea
          data-testid="owner-description-input"
          rows={3}
          value={descriptionDraft}
          onChange={(event) => setDescriptionDraft(event.target.value)}
          placeholder="Например: как выдаёте доступ и когда отвечаете в Telegram"
        />
      </label>
      <button
        type="button"
        className="secondary"
        data-testid="owner-save-description-button"
        disabled={busy !== null}
        onClick={() =>
          onUpdateDescription(family.id, descriptionValue ? descriptionValue : null)
        }
      >
        Сохранить описание
      </button>

      <div className="owner-settings-grid">
        <label>
          Общая цена
          <input
            data-testid="owner-price-input"
            min={1}
            type="number"
            value={priceDraft}
            onChange={(event) => setPriceDraft(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondary"
          data-testid="owner-save-price-button"
          disabled={busy !== null || !canSubmitPrice}
          onClick={() => onUpdatePrice(family.id, priceValue)}
        >
          Изменить цену
        </button>
      </div>
      <small className="muted">
        Цену можно менять один раз в месяц. Участники получат уведомление.
      </small>

      <div className="owner-settings-grid">
        <label>
          День оплаты
          <input
            data-testid="owner-payment-day-input"
            max={31}
            min={1}
            type="number"
            value={paymentDayDraft}
            onChange={(event) => setPaymentDayDraft(event.target.value)}
          />
        </label>
        <label>
          Следующая дата
          <input
            data-testid="owner-next-payment-date-input"
            type="date"
            value={nextPaymentDateDraft}
            onChange={(event) => setNextPaymentDateDraft(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondary"
          data-testid="owner-save-payment-day-button"
          disabled={busy !== null || !canSubmitPaymentDay}
          onClick={() =>
            onUpdatePaymentDay(family.id, paymentDayValue, nextPaymentDateDraft)
          }
        >
          Изменить дату оплаты
        </button>
      </div>
      <small className="muted">
        Дату оплаты можно менять только пока семья ещё не была полностью собрана.
      </small>
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
        <button
          type="button"
          data-testid="confirm-access-button"
          disabled={busy !== null}
          onClick={() => onConfirmAccess(member.id)}
        >
          Доступ получен
        </button>
      )}
      {member.access_confirmed_at && (
        <button
          type="button"
          className="secondary"
          data-testid="show-requisite-button"
          disabled={busy !== null}
          onClick={() => onGetRequisite(member.id)}
        >
          Показать реквизиты
        </button>
      )}
      {member.status === "active" && ["active", "full"].includes(familyStatus) && (
        <button
          type="button"
          className="secondary"
          data-testid="create-prepayment-button"
          disabled={busy !== null}
          onClick={() => onCreatePrepayment(member.id)}
        >
          Оплатить следующий период заранее
        </button>
      )}
      {familyStatus === "closing" && (
        <button
          type="button"
          data-testid="acknowledge-closing-button"
          disabled={busy !== null}
          onClick={() => onAcknowledgeClosing(familyId)}
        >
          Понятно, семья закрывается
        </button>
      )}
      <button
        type="button"
        className="danger"
        data-testid="leave-family-button"
        disabled={busy !== null}
        onClick={() => onLeaveFamily(member.id)}
      >
        Выйти
      </button>
    </>
  );
}
