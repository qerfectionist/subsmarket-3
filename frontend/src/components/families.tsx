import { useState, type ReactNode } from "react";

import { formatDate, formatDateTime, statusText } from "../format";
import {
  familyKindLabels,
  paymentCancelReasonLabels,
  periodLabels
} from "../labels";
import type {
  Family,
  FamilyMember,
  FamilyPayment,
  FamilyRequest,
  OwnerFamilyDetails
} from "../types";
import { Badge } from "./layout";

export function OwnerDetails({
  family,
  details,
  onApprove,
  onReject,
  onAccessProvided,
  onRemindAccess,
  onCancelBeforeAccess,
  onRemove,
  onRevokeRemoval,
  onConfirmPayment,
  onNotReceived,
  onRecordPrepayment
}: {
  family: Family;
  details: OwnerFamilyDetails;
  onApprove: (request: FamilyRequest) => Promise<unknown>;
  onReject: (request: FamilyRequest) => Promise<unknown>;
  onAccessProvided: (member: FamilyMember) => Promise<unknown>;
  onRemindAccess: (member: FamilyMember) => Promise<unknown>;
  onCancelBeforeAccess: (member: FamilyMember) => Promise<unknown>;
  onRemove: (member: FamilyMember) => Promise<unknown>;
  onRevokeRemoval: (member: FamilyMember) => Promise<unknown>;
  onConfirmPayment: (payment: FamilyPayment) => Promise<unknown>;
  onNotReceived: (payment: FamilyPayment) => Promise<unknown>;
  onRecordPrepayment: (
    member: FamilyMember,
    periods: number
  ) => Promise<unknown>;
}) {
  const pendingPayments = details.members.flatMap((member) =>
    (details.paymentsByMemberId[member.id] ?? [])
      .filter((payment) => payment.status === "payment_reported")
      .map((payment) => ({ member, payment }))
  );
  const nonOwnerMembers = details.members.filter((member) => member.role !== "owner");

  return (
    <div className="owner-details">
      <div className="owner-task-grid">
        <TaskCounter
          label="Заявки"
          testId="owner-requests-count"
          value={details.requests.length}
        />
        <TaskCounter
          label="Участники"
          testId="owner-members-count"
          value={nonOwnerMembers.length}
        />
        <TaskCounter
          label="Оплаты"
          testId="owner-pending-payments-count"
          value={pendingPayments.length}
        />
      </div>

      <OwnerSection title="Заявки" count={details.requests.length}>
        {details.requests.length === 0 ? (
          <p className="muted">Новых заявок нет.</p>
        ) : (
          details.requests.map((request) => (
            <div className="list-row task-row" key={request.id}>
              <div>
                <strong>@{request.candidate.username}</strong>
                <p>{request.candidate.first_name}</p>
                <small>Кандидат ждет решения владельца.</small>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  data-testid="approve-request-button"
                  onClick={() => void onApprove(request)}
                >
                  Принять
                </button>
                <button
                  type="button"
                  className="secondary"
                  data-testid="reject-request-button"
                  onClick={() => void onReject(request)}
                >
                  Отклонить
                </button>
              </div>
            </div>
          ))
        )}
      </OwnerSection>

      <OwnerSection title="Участники" count={details.members.length}>
        {details.members.map((member) => (
          <div className="member-block" key={member.id}>
            <div className="list-row task-row">
              <div>
                <strong>
                  @{member.user.username} ·{" "}
                  {member.role === "owner" ? "владелец" : "участник"}
                </strong>
                <p>{statusText(member.status)}</p>
                {member.role !== "owner" && (
                  <small>{ownerMemberHint(member.status)}</small>
                )}
              </div>
              {member.role !== "owner" && (
                <div className="row-actions">
                  {member.status === "awaiting_access" && (
                    <>
                      <button
                        type="button"
                        data-testid="access-provided-button"
                        onClick={() => void onAccessProvided(member)}
                      >
                        Доступ выдан
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        data-testid="cancel-before-access-button"
                        onClick={() => void onCancelBeforeAccess(member)}
                      >
                        Отменить до доступа
                      </button>
                    </>
                  )}
                  {member.status === "awaiting_confirmation" && (
                    <button
                      type="button"
                      className="secondary"
                      data-testid="remind-access-button"
                      onClick={() => void onRemindAccess(member)}
                    >
                      Напомнить подтвердить
                    </button>
                  )}
                  {member.status === "removal_pending" ? (
                    <button
                      type="button"
                      className="secondary"
                      data-testid="revoke-removal-button"
                      onClick={() => void onRevokeRemoval(member)}
                    >
                      Отменить удаление
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="danger"
                      data-testid="remove-member-button"
                      onClick={() => void onRemove(member)}
                    >
                      Удалить через 12 часов
                    </button>
                  )}
                </div>
              )}
            </div>
            {member.role !== "owner" && member.status === "active" && (
              <OwnerPrepaymentControl
                family={family}
                member={member}
                onRecord={onRecordPrepayment}
              />
            )}
            <PaymentList
              payments={details.paymentsByMemberId[member.id] ?? []}
              ownerMode
              onConfirm={(payment) => onConfirmPayment(payment)}
              onNotReceived={(payment) => onNotReceived(payment)}
            />
          </div>
        ))}
      </OwnerSection>

      <OwnerSection title="Оплаты на подтверждение" count={pendingPayments.length}>
        {pendingPayments.length === 0 ? (
          <p className="muted">Нет оплат, которые ждут подтверждения.</p>
        ) : (
          pendingPayments.map(({ member, payment }) => (
            <div className="list-row task-row" key={payment.id}>
              <div>
                <strong>
                  @{member.user.username} · {payment.amount_kzt.toLocaleString("ru-KZ")} ₸
                </strong>
                <p>{paymentKindText(payment.kind)} · {statusText(payment.status)}</p>
                <small>Проверьте перевод вне SubsMarket и подтвердите вручную.</small>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  data-testid="confirm-payment-button"
                  onClick={() => void onConfirmPayment(payment)}
                >
                  Подтвердить
                </button>
                <button
                  type="button"
                  className="secondary"
                  data-testid="payment-not-received-button"
                  onClick={() => void onNotReceived(payment)}
                >
                  Не получил
                </button>
              </div>
            </div>
          ))
        )}
      </OwnerSection>
    </div>
  );
}

function OwnerPrepaymentControl({
  family,
  member,
  onRecord
}: {
  family: Family;
  member: FamilyMember;
  onRecord: (member: FamilyMember, periods: number) => Promise<unknown>;
}) {
  const [periods, setPeriods] = useState(1);
  const options = family.period === "yearly" ? [1, 2, 3] : [1, 2, 3, 6, 12];

  return (
    <div className="owner-prepayment-control">
      <label>
        Оплачено будущих периодов
        <select
          data-testid="owner-prepayment-periods"
          value={periods}
          onChange={(event) => setPeriods(Number(event.target.value))}
        >
          {options.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="secondary"
        data-testid="owner-record-prepayment-button"
        onClick={() => void onRecord(member, periods)}
      >
        Отметить предоплату
      </button>
      <small>
        Используйте только после договоренности и фактического перевода вне
        SubsMarket.
      </small>
    </div>
  );
}

function OwnerSection({
  title,
  count,
  children
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="owner-task-section">
      <div className="owner-section-header">
        <h4>{title}</h4>
        <span>{count}</span>
      </div>
      <div className="owner-task-list">{children}</div>
    </section>
  );
}

function TaskCounter({
  label,
  value,
  testId
}: {
  label: string;
  value: number;
  testId: string;
}) {
  return (
    <div data-testid={testId}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ownerMemberHint(status: string) {
  const hints: Record<string, string> = {
    awaiting_access: "Следующий шаг: добавьте человека в подписку и нажмите Доступ выдан.",
    awaiting_confirmation: "Участник должен подтвердить, что доступ получен.",
    payment_due: "Участник получил доступ. Теперь он должен оплатить.",
    payment_reported: "Проверьте перевод и подтвердите оплату.",
    active: "Участник активен, первый платеж подтвержден.",
    removal_pending: "Удаление запланировано, можно отменить до истечения срока."
  };
  return hints[status] ?? "Проверьте статус участника.";
}

function paymentKindText(kind: string) {
  const labels: Record<string, string> = {
    first: "первый платеж",
    prepaid: "предоплата",
    regular: "регулярный платеж"
  };
  return labels[kind] ?? kind;
}

export function PaymentList({
  payments,
  ownerMode,
  onReport,
  onCancel,
  onConfirm,
  onNotReceived
}: {
  payments: FamilyPayment[];
  ownerMode?: boolean;
  onReport?: (payment: FamilyPayment) => Promise<unknown>;
  onCancel?: (payment: FamilyPayment) => Promise<unknown>;
  onConfirm?: (payment: FamilyPayment) => Promise<unknown>;
  onNotReceived?: (payment: FamilyPayment) => Promise<unknown>;
}) {
  if (payments.length === 0) {
    return (
      <div className="payment-list">
        <div className="list-row compact">
          <div>
            <strong>Платежей пока нет</strong>
            <p>
              Они появятся после подтверждения доступа или перед следующей датой
              оплаты.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="payment-list">
      {payments.map((payment) => (
        <div className="list-row compact" key={payment.id}>
          <div>
            <strong>
              {payment.amount_kzt.toLocaleString("ru-KZ")} ₸ ·{" "}
              {statusText(payment.status)}
            </strong>
            <p>
              {paymentKindText(payment.kind)} · {periodLabels[payment.period]} · до{" "}
              {formatDateTime(payment.due_at)}
            </p>
            {payment.cancel_reason && (
              <small>
                {paymentCancelReasonLabels[payment.cancel_reason] ??
                  payment.cancel_reason}
              </small>
            )}
          </div>
          {!ownerMode && (
            <div className="row-actions">
              {(payment.status === "due" || payment.status === "overdue") && onReport && (
                <button
                  type="button"
                  data-testid="report-payment-button"
                  onClick={() => void onReport(payment)}
                >
                  Оплатил
                </button>
              )}
              {payment.status === "payment_reported" && onCancel && (
                <button
                  type="button"
                  className="secondary"
                  data-testid="cancel-payment-report-button"
                  onClick={() => void onCancel(payment)}
                >
                  Отменить отметку
                </button>
              )}
            </div>
          )}
          {ownerMode && payment.status === "payment_reported" && (
            <div className="row-actions">
              {onConfirm && (
                <button
                  type="button"
                  data-testid="confirm-payment-button"
                  onClick={() => void onConfirm(payment)}
                >
                  Подтвердить
                </button>
              )}
              {onNotReceived && (
                <button
                  type="button"
                  className="secondary"
                  data-testid="payment-not-received-button"
                  onClick={() => void onNotReceived(payment)}
                >
                  Не получил
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function FamilyCard({ family, children }: { family: Family; children?: ReactNode }) {
  return (
    <article
      className="family-card"
      data-family-id={family.id}
      data-family-type={family.family_type}
      data-testid="family-card"
    >
      <div className="card-topline">
        <span className="card-topline-left">
          <Badge>{statusText(family.status)}</Badge>
          <span className={`type-label type-label-${family.family_type}`}>
            {familyKindLabels[family.family_type]}
          </span>
        </span>
        <span>{periodLabels[family.period]}</span>
      </div>
      <h3>
        {family.service_name}
        {family.service_variant ? ` ${family.service_variant}` : ""}
      </h3>
      <p>{family.description || "Описание пока не добавлено."}</p>
      {family.owner_rules && (
        <div className="owner-rules-preview">
          <span>Правила владельца</span>
          <p>{family.owner_rules}</p>
        </div>
      )}
      <div className="metrics">
        <Metric
          label="Доля"
          value={`${family.member_share_kzt.toLocaleString("ru-KZ")} ₸`}
        />
        <Metric
          label="Места"
          value={`${family.active_members_count}/${family.max_members}`}
        />
        <Metric label="Свободно" value={String(family.free_slots)} />
      </div>
      <div className="card-footer">
        <span>Оплата: {formatDate(family.next_payment_date)}</span>
        <span>Владелец: {family.owner.first_name}</span>
      </div>
      {family.rounding_delta_kzt > 0 && (
        <small>Округление: +{family.rounding_delta_kzt} ₸ на всю семью</small>
      )}
      {family.status === "closing" && family.closes_at && (
        <div className="warning">Закрывается {formatDateTime(family.closes_at)}</div>
      )}
      {children && <div className="card-actions">{children}</div>}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
