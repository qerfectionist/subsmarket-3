import { useEffect, useState, type ReactNode } from "react";

import {
  Button,
  Card,
  Cell,
  Section
} from "@telegram-apps/telegram-ui";

import { formatDate, formatDateTime, statusText } from "../format";
import {
  familyKindLabels,
  paymentCancelReasonLabels,
  periodLabels
} from "../labels";
import type {
  Family,
  FamilyMember,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyRequest,
  OwnerFamilyDetails
} from "../types";
import { Badge } from "./layout";

const memberRemovalReasonLabels: Record<FamilyMemberRemovalReason, string> = {
  no_payment: "Не оплатил",
  no_response: "Нет связи",
  access_issue: "Проблема с доступом",
  mutual_agreement: "По договоренности",
  other: "Другое"
};

export function OwnerDetails({
  family,
  details,
  onApprove,
  onReject,
  onAccessProvided,
  onRemindAccess,
  onCancelBeforeAccess,
  onRemove,
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
  onRemove: (
    member: FamilyMember,
    reason: FamilyMemberRemovalReason
  ) => Promise<unknown>;
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
  const [ownerTab, setOwnerTab] = useState<"requests" | "members" | "payments">(
    details.requests.length > 0 ? "requests" : "members"
  );
  useEffect(() => {
    if (details.requests.length === 0 && ownerTab === "requests") {
      setOwnerTab("members");
    }
  }, [details.requests.length, ownerTab]);

  return (
    <div className="owner-details">
      <div className="owner-tabs">
        <Button
          type="button"
          size="s"
          mode={ownerTab === "requests" ? "filled" : "plain"}
          onClick={() => setOwnerTab("requests")}
        >
          Заявки{details.requests.length > 0 ? ` · ${details.requests.length}` : ""}
        </Button>
        <Button
          type="button"
          size="s"
          mode={ownerTab === "members" ? "filled" : "plain"}
          onClick={() => setOwnerTab("members")}
        >
          Участники · {details.members.length}
        </Button>
        <Button
          type="button"
          size="s"
          mode={ownerTab === "payments" ? "filled" : "plain"}
          onClick={() => setOwnerTab("payments")}
        >
          Оплаты{pendingPayments.length > 0 ? ` · ${pendingPayments.length}` : ""}
        </Button>
      </div>

      {ownerTab === "requests" && (
        <Section header={`Заявки · ${details.requests.length}`}>
          {details.requests.length === 0 ? (
            <Cell subtitle="Новых заявок нет." />
          ) : (
          details.requests.map((request) => (
            <Cell
              key={request.id}
              before={<span className="cell-avatar-acronym">{"@"}</span>}
              title={`@${request.candidate.username}`}
              subtitle={request.candidate.first_name}
              description="Кандидат ждет решения владельца."
              after={
                <div className="row-actions">
                  <Button
                    type="button"
                    size="s"
                    mode="filled"
                    data-testid="approve-request-button"
                    onClick={() => void onApprove(request)}
                  >
                    Принять
                  </Button>
                  <Button
                    type="button"
                    size="s"
                    mode="plain"
                    data-testid="reject-request-button"
                    onClick={() => void onReject(request)}
                  >
                    Отклонить
                  </Button>
                </div>
              }
            />
          ))
        )}
      </Section>
      )}

      {ownerTab === "members" && (
        <Section header={`Участники · ${nonOwnerMembers.length}`}>
        {nonOwnerMembers.length === 0 ? (
          <Cell subtitle="У вас пока нет участников. Создайте приглашение или ожидайте заявки." />
        ) : (
        nonOwnerMembers.map((member) => (
          <div className="member-block" key={member.id}>
            <Cell
              title={`@${member.user.username} · ${member.role === "owner" ? "владелец" : "участник"}`}
              subtitle={statusText(member.status)}
              description={member.role !== "owner" ? ownerMemberHint(member.status) : undefined}
              after={
                member.role !== "owner" ? (
                  <div className="row-actions">
                    {member.status === "awaiting_access" && (
                      <>
                        <Button
                          type="button"
                          size="s"
                          mode="filled"
                          data-testid="access-provided-button"
                          onClick={() => void onAccessProvided(member)}
                        >
                          Доступ выдан
                        </Button>
                        <Button
                          type="button"
                          size="s"
                          mode="plain"
                          data-testid="cancel-before-access-button"
                          onClick={() => void onCancelBeforeAccess(member)}
                        >
                          Отменить до доступа
                        </Button>
                      </>
                    )}
                    {member.status === "awaiting_confirmation" && (
                      <Button
                        type="button"
                        size="s"
                        mode="plain"
                        data-testid="remind-access-button"
                        onClick={() => void onRemindAccess(member)}
                      >
                        Напомнить
                      </Button>
                    )}
                    {["awaiting_confirmation", "payment_due", "active"].includes(
                      member.status
                    ) && (
                      <OwnerMemberRemovalControl
                        member={member}
                        onRemove={onRemove}
                      />
                    )}
                  </div>
                ) : undefined
              }
            />
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
        ))
        )}
        </Section>
      )}

      {ownerTab === "payments" && (
        <Section header={`Оплаты на подтверждение · ${pendingPayments.length}`}>
        {pendingPayments.length === 0 ? (
          <Cell subtitle="Нет оплат, которые ждут подтверждения." />
        ) : (
          pendingPayments.map(({ member, payment }) => (
            <Cell
              key={payment.id}
              title={`@${member.user.username} · ${payment.amount_kzt.toLocaleString("ru-KZ")} ₸`}
              subtitle={`${paymentKindText(payment.kind)} · ${statusText(payment.status)}`}
              description="Проверьте перевод вне SubsMarket и подтвердите вручную."
              after={
                <div className="row-actions">
                  <Button
                    type="button"
                    size="s"
                    mode="filled"
                    data-testid="confirm-payment-button"
                    onClick={() => void onConfirmPayment(payment)}
                  >
                    Подтвердить
                  </Button>
                  <Button
                    type="button"
                    size="s"
                    mode="plain"
                    data-testid="payment-not-received-button"
                    onClick={() => void onNotReceived(payment)}
                  >
                    Не получил
                  </Button>
                </div>
              }
            />
          ))
        )}
      </Section>
      )}
    </div>
  );
}

function OwnerMemberRemovalControl({
  member,
  onRemove
}: {
  member: FamilyMember;
  onRemove: (
    member: FamilyMember,
    reason: FamilyMemberRemovalReason
  ) => Promise<unknown>;
}) {
  const [reason, setReason] = useState<FamilyMemberRemovalReason>("other");

  return (
    <div className="owner-removal-control">
      <select
        aria-label="Причина удаления"
        data-testid="remove-member-reason"
        value={reason}
        onChange={(event) =>
          setReason(event.target.value as FamilyMemberRemovalReason)
        }
      >
        {Object.entries(memberRemovalReasonLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="s"
        mode="plain"
        data-testid="remove-member-button"
        onClick={() => void onRemove(member, reason)}
      >
        Удалить
      </Button>
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
      <Button
        type="button"
        size="s"
        mode="plain"
        data-testid="owner-record-prepayment-button"
        onClick={() => void onRecord(member, periods)}
      >
        Отметить
      </Button>
      <small>
        Используйте только после договоренности и фактического перевода вне
        SubsMarket.
      </small>
    </div>
  );
}

function TaskCounter({ value }: { value: number }) {
  return (
    <span
      style={{
        alignItems: "center",
        background: "var(--app-secondary-bg, #f7f9fd)",
        borderRadius: 12,
        display: "inline-flex",
        fontSize: 18,
        fontWeight: 800,
        height: 40,
        justifyContent: "center",
        minWidth: 40,
        padding: "0 10px"
      }}
    >
      {value}
    </span>
  );
}

function ownerMemberHint(status: string) {
  const hints: Record<string, string> = {
    awaiting_access: "Следующий шаг: добавьте человека в подписку и нажмите Доступ выдан.",
    awaiting_confirmation: "Участник должен подтвердить, что доступ получен.",
    payment_due: "Участник получил доступ. Теперь он должен оплатить.",
    payment_reported: "Проверьте перевод и подтвердите оплату.",
    active: "Участник активен, первый платеж подтвержден.",
    removal_pending:
      "Старое отложенное удаление ожидает фоновой обработки."
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
      <Section>
        <Cell subtitle="Платежей пока нет" description="Они появятся после подтверждения доступа или перед следующей датой оплаты." />
      </Section>
    );
  }
  return (
    <Section className="payment-list">
      {payments.map((payment) => (
        <Cell
          key={payment.id}
          title={`${payment.amount_kzt.toLocaleString("ru-KZ")} ₸ · ${statusText(payment.status)}`}
          subtitle={`${paymentKindText(payment.kind)} · ${periodLabels[payment.period]} · до ${formatDateTime(payment.due_at)}`}
          description={
            payment.cancel_reason
              ? paymentCancelReasonLabels[payment.cancel_reason] ?? payment.cancel_reason
              : undefined
          }
          after={
            !ownerMode ? (
              <div className="row-actions">
                {(payment.status === "due" || payment.status === "overdue") && onReport && (
                  <Button
                    type="button"
                    size="s"
                    mode="filled"
                    data-testid="report-payment-button"
                    onClick={() => void onReport(payment)}
                  >
                    Оплатил
                  </Button>
                )}
                {payment.status === "payment_reported" && onCancel && (
                  <Button
                    type="button"
                    size="s"
                    mode="plain"
                    data-testid="cancel-payment-report-button"
                    onClick={() => void onCancel(payment)}
                  >
                    Отменить
                  </Button>
                )}
              </div>
            ) : ownerMode && payment.status === "payment_reported" ? (
              <div className="row-actions">
                {onConfirm && (
                  <Button
                    type="button"
                    size="s"
                    mode="filled"
                    data-testid="confirm-payment-button"
                    onClick={() => void onConfirm(payment)}
                  >
                    Подтвердить
                  </Button>
                )}
                {onNotReceived && (
                  <Button
                    type="button"
                    size="s"
                    mode="plain"
                    data-testid="payment-not-received-button"
                    onClick={() => void onNotReceived(payment)}
                  >
                    Не получил
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />
      ))}
    </Section>
  );
}

export function FamilyCard({ family, children }: { family: Family; children?: ReactNode }) {
  return (
    <div
      data-family-id={family.id}
      data-family-type={family.family_type}
      data-testid="family-card"
    >
      <Card>
      <Cell
        before={
          <span className="card-topline-left">
            <Badge>{statusText(family.status)}</Badge>
            <span className={`type-label type-label-${family.family_type}`}>
              {familyKindLabels[family.family_type]}
            </span>
          </span>
        }
        after={<span>{periodLabels[family.period]}</span>}
        title={family.service_name + (family.service_variant ? ` ${family.service_variant}` : "")}
        subtitle={family.description || "Описание пока не добавлено."}
        description={family.owner_rules}
        multiline
      />
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
      </Card>
    </div>
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
