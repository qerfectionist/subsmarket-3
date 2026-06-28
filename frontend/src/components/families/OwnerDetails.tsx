import { useEffect, useState, type ReactNode } from "react";
import {
  Button as WorldButton,
  Typography
} from "@worldcoin/mini-apps-ui-kit-react";

import { statusText } from "../../format";
import type {
  Family,
  FamilyMember,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyRequest,
  OwnerFamilyDetails
} from "../../types";
import { ownerMemberHint, paymentKindText } from "../../labels";
import { OwnerMemberRemovalControl } from "./OwnerMemberRemovalControl";
import { OwnerPrepaymentControl } from "./OwnerPrepaymentControl";
import { PaymentList } from "./PaymentList";

function OwnerPanel({
  title,
  empty,
  children
}: {
  title: string;
  empty?: string;
  children?: ReactNode;
}) {
  return (
    <section className="owner-panel">
      <Typography as="h4" variant="subtitle" level={2}>
        {title}
      </Typography>
      {empty ? (
        <Typography as="p" variant="body" level={3} className="muted">
          {empty}
        </Typography>
      ) : children}
    </section>
  );
}

function OwnerListRow({
  title,
  subtitle,
  description,
  children
}: {
  title: string;
  subtitle?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <article className="owner-list-row">
      <div>
        <Typography as="strong" variant="subtitle" level={3}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography as="p" variant="body" level={3}>
            {subtitle}
          </Typography>
        ) : null}
        {description ? (
          <Typography as="small" variant="body" level={4}>
            {description}
          </Typography>
        ) : null}
      </div>
      {children ? <div className="row-actions">{children}</div> : null}
    </article>
  );
}

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
      <div
        className="owner-tabs segmented-control segmented-control-3"
        role="tablist"
        aria-label="Управление семьёй"
      >
        <WorldButton
          type="button"
          role="tab"
          aria-selected={ownerTab === "requests"}
          variant={ownerTab === "requests" ? "primary" : "tertiary"}
          size="sm"
          className={
            ownerTab === "requests"
              ? "segmented-option segmented-option-active"
              : "segmented-option"
          }
          onClick={() => setOwnerTab("requests")}
        >
          Заявки{details.requests.length > 0 ? ` · ${details.requests.length}` : ""}
        </WorldButton>
        <WorldButton
          type="button"
          role="tab"
          aria-selected={ownerTab === "members"}
          variant={ownerTab === "members" ? "primary" : "tertiary"}
          size="sm"
          className={
            ownerTab === "members"
              ? "segmented-option segmented-option-active"
              : "segmented-option"
          }
          onClick={() => setOwnerTab("members")}
        >
          Участники · {details.members.length}
        </WorldButton>
        <WorldButton
          type="button"
          role="tab"
          aria-selected={ownerTab === "payments"}
          variant={ownerTab === "payments" ? "primary" : "tertiary"}
          size="sm"
          className={
            ownerTab === "payments"
              ? "segmented-option segmented-option-active"
              : "segmented-option"
          }
          onClick={() => setOwnerTab("payments")}
        >
          Оплаты{pendingPayments.length > 0 ? ` · ${pendingPayments.length}` : ""}
        </WorldButton>
      </div>

      {ownerTab === "requests" && (
        <OwnerPanel
          title={`Заявки · ${details.requests.length}`}
          empty={
            details.requests.length === 0
              ? "Новых заявок нет."
              : undefined
          }
        >
          {details.requests.map((request) => (
            <OwnerListRow
              key={request.id}
              title={`@${request.candidate.username}`}
              subtitle={request.candidate.first_name}
              description="Кандидат ждет решения владельца."
            >
              <WorldButton
                type="button"
                size="sm"
                data-testid="approve-request-button"
                onClick={() => void onApprove(request)}
              >
                Принять
              </WorldButton>
              <WorldButton
                type="button"
                variant="secondary"
                size="sm"
                data-testid="reject-request-button"
                onClick={() => void onReject(request)}
              >
                Отклонить
              </WorldButton>
            </OwnerListRow>
          ))}
        </OwnerPanel>
      )}

      {ownerTab === "members" && (
        <OwnerPanel
          title={`Участники · ${nonOwnerMembers.length}`}
          empty={
            nonOwnerMembers.length === 0
              ? "У вас пока нет участников. Создайте приглашение или ожидайте заявки."
              : undefined
          }
        >
          {nonOwnerMembers.map((member) => (
            <div className="member-block" key={member.id}>
              <OwnerListRow
                title={`@${member.user.username} · участник`}
                subtitle={statusText(member.status)}
                description={ownerMemberHint(member.status)}
              >
                {member.status === "awaiting_access" && (
                  <>
                    <WorldButton
                      type="button"
                      size="sm"
                      data-testid="access-provided-button"
                      onClick={() => void onAccessProvided(member)}
                    >
                      Доступ выдан
                    </WorldButton>
                    <WorldButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      data-testid="cancel-before-access-button"
                      onClick={() => void onCancelBeforeAccess(member)}
                    >
                      Отменить до доступа
                    </WorldButton>
                  </>
                )}
                {member.status === "awaiting_confirmation" && (
                  <WorldButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="remind-access-button"
                    onClick={() => void onRemindAccess(member)}
                  >
                    Напомнить
                  </WorldButton>
                )}
              </OwnerListRow>
              {["awaiting_confirmation", "payment_due", "active"].includes(
                member.status
              ) && <OwnerMemberRemovalControl member={member} onRemove={onRemove} />}
              {member.status === "active" && (
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
        </OwnerPanel>
      )}

      {ownerTab === "payments" && (
        <OwnerPanel
          title={`Оплаты на подтверждение · ${pendingPayments.length}`}
          empty={
            pendingPayments.length === 0
              ? "Нет оплат, которые ждут подтверждения."
              : undefined
          }
        >
          {pendingPayments.map(({ member, payment }) => (
            <OwnerListRow
              key={payment.id}
              title={`@${member.user.username} · ${payment.amount_kzt.toLocaleString("ru-KZ")} ₸`}
              subtitle={`${paymentKindText(payment.kind)} · ${statusText(payment.status)}`}
              description="Проверьте перевод вне SubsMarket и подтвердите вручную."
            >
              <WorldButton
                type="button"
                size="sm"
                data-testid="confirm-payment-button"
                onClick={() => void onConfirmPayment(payment)}
              >
                Подтвердить
              </WorldButton>
              <WorldButton
                type="button"
                variant="secondary"
                size="sm"
                data-testid="payment-not-received-button"
                onClick={() => void onNotReceived(payment)}
              >
                Не получил
              </WorldButton>
            </OwnerListRow>
          ))}
        </OwnerPanel>
      )}
    </div>
  );
}
