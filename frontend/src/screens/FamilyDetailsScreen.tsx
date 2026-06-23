import { FamilyCard } from "../components/families";
import { Badge, EmptyState, Panel } from "../components/layout";
import { RequisiteBox } from "../components/RequisiteBox";
import { formatDate, formatDateTime, statusText } from "../format";
import { familyKindLabels, periodLabels } from "../labels";
import type {
  FamilyAuditLog,
  FamilyInvite,
  FamilyMember,
  FamilyPayment,
  FamilyRequest,
  FamilyView,
  PaymentRequisite
} from "../types";
import { openTelegramUser } from "../telegram";

export function FamilyDetailsScreen({
  view,
  requisite,
  busy,
  onBack,
  onRefresh,
  onCreateRequest,
  onConfirmAccess,
  onGetRequisite,
  onReportPayment,
  onCancelPaymentReport,
  auditLogs,
  invite,
  onCreateInvite,
  onRotateInvite,
  onDisableInvite,
  onUpdateVisibility,
  onConfirmAvailability
}: {
  view: FamilyView | null;
  requisite: PaymentRequisite | null;
  auditLogs: FamilyAuditLog[];
  invite: FamilyInvite | null;
  busy: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onCreateRequest: (familyId: string) => void;
  onConfirmAccess: (memberId: string) => void;
  onGetRequisite: (memberId: string) => void;
  onReportPayment: (payment: FamilyPayment) => Promise<unknown>;
  onCancelPaymentReport: (payment: FamilyPayment) => Promise<unknown>;
  onCreateInvite: (familyId: string) => void;
  onRotateInvite: (familyId: string) => void;
  onDisableInvite: (familyId: string) => void;
  onUpdateVisibility: (familyId: string, isSearchVisible: boolean) => void;
  onConfirmAvailability: (familyId: string) => void;
}) {
  if (!view) {
    return (
      <Panel
        title="Семья"
        description="Откройте семью из поиска или из раздела Мои семьи."
        action={<button onClick={onBack}>Назад</button>}
      >
        <EmptyState title="Семья не выбрана">
          Выберите семью, чтобы посмотреть детали.
        </EmptyState>
      </Panel>
    );
  }

  const { family, my_membership: membership, my_request: request } = view;

  return (
    <Panel
      title={family.service_name}
      description={familyKindLabels[family.family_type]}
      action={
        <div className="row-actions">
          <button type="button" className="secondary" onClick={onBack}>
            Назад
          </button>
          <button
            type="button"
            className="secondary"
            data-testid="family-detail-refresh-button"
            onClick={onRefresh}
          >
            Обновить
          </button>
        </div>
      }
    >
      <FamilyCard family={family} />

      {membership?.role === "owner" && (
        <OwnerInvitePanel
          family={family}
          invite={invite}
          busy={busy}
          onCreate={onCreateInvite}
          onRotate={onRotateInvite}
          onDisable={onDisableInvite}
          onUpdateVisibility={onUpdateVisibility}
          onConfirmAvailability={onConfirmAvailability}
        />
      )}

      <section className="detail-grid">
        <DetailItem label="Общая цена" value={`${family.total_price_kzt.toLocaleString("ru-KZ")} ₸`} />
        <DetailItem label="Доля участника" value={`${family.member_share_kzt.toLocaleString("ru-KZ")} ₸`} />
        <DetailItem label="День оплаты" value={`${family.payment_day} число`} />
        <DetailItem label="Следующая оплата" value={formatDate(family.next_payment_date)} />
        <DetailItem label="Свободно мест" value={String(family.free_slots)} />
        <DetailItem label="Создана" value={formatDateTime(family.created_at)} />
      </section>

      <section className="detail-section">
        <h3>Описание</h3>
        <p>{family.description || "Описание пока не добавлено."}</p>
      </section>

      <section className="detail-section">
        <h3>Правила владельца</h3>
        <p>
          {family.owner_rules ||
            "Владелец пока не добавил отдельные правила. Договоритесь в Telegram перед вступлением."}
        </p>
      </section>

      <section className="detail-section">
        <h3>Ваш статус</h3>
        {membership ? (
          <StatusBlock
            title={statusText(membership.status)}
            text={
              membership.role === "owner"
                ? "Вы владелец этой семьи."
                : "Вы участник этой семьи."
            }
          />
        ) : request ? (
          <StatusBlock
            title={statusText(request.status)}
            text={`Заявка создана ${formatDateTime(request.created_at)}.`}
          />
        ) : (
          <StatusBlock
            title="Вы еще не в семье"
            text="Отправьте заявку, владелец напишет вам и примет решение."
          />
        )}
      </section>

      <FamilyFlowSteps
        membership={membership}
        request={request}
        payments={view.my_payments}
        canRequest={view.can_request}
      />

      <section className="detail-section">
        <h3>Действия</h3>
        <div className="workspace-actions">
          {!membership && !request && view.can_request && (
            <button
              type="button"
              data-testid="detail-send-request-button"
              disabled={busy !== null}
              onClick={() => onCreateRequest(family.id)}
            >
              Отправить заявку
            </button>
          )}
          {membership?.status === "awaiting_confirmation" && (
            <button
              type="button"
              data-testid="detail-confirm-access-button"
              disabled={busy !== null}
              onClick={() => onConfirmAccess(membership.id)}
            >
              Доступ получен
            </button>
          )}
          {membership?.access_confirmed_at && (
            <button
              type="button"
              className="secondary"
              data-testid="detail-show-requisite-button"
              disabled={busy !== null}
              onClick={() => onGetRequisite(membership.id)}
            >
              Показать реквизиты
            </button>
          )}
          {view.owner_username && membership?.role !== "owner" && (
            <button
              type="button"
              className="secondary"
              data-testid="owner-chat-button"
              onClick={() =>
                openTelegramUser(
                  view.owner_username!,
                  `Здравствуйте, я оставил заявку в вашу семью ${family.service_name} в SubsMarket.`
                )
              }
            >
              Написать владельцу
            </button>
          )}
          {!view.can_request && !membership && request && (
            <Badge>{statusText(request.status)}</Badge>
          )}
        </div>
      </section>

      {requisite && <RequisiteBox requisite={requisite} />}

      {membership && (
        <FamilyPaymentActions
          payments={view.my_payments}
          onReportPayment={onReportPayment}
          onCancelPaymentReport={onCancelPaymentReport}
        />
      )}

      {membership && <FamilyAuditTimeline logs={auditLogs} />}
    </Panel>
  );
}

function OwnerInvitePanel({
  family,
  invite,
  busy,
  onCreate,
  onRotate,
  onDisable,
  onUpdateVisibility,
  onConfirmAvailability
}: {
  family: FamilyView["family"];
  invite: FamilyInvite | null;
  busy: string | null;
  onCreate: (familyId: string) => void;
  onRotate: (familyId: string) => void;
  onDisable: (familyId: string) => void;
  onUpdateVisibility: (familyId: string, isSearchVisible: boolean) => void;
  onConfirmAvailability: (familyId: string) => void;
}) {
  const editable = ["active", "full"].includes(family.status);
  const formattedCode = invite
    ? `${invite.code.slice(0, 4)} ${invite.code.slice(4)}`
    : null;

  return (
    <section className="invite-owner-card">
      <div>
        <span className="muted">Код приглашения</span>
        <strong data-testid="owner-invite-code">
          {formattedCode ?? "Код ещё не создан"}
        </strong>
        <p className="muted">
          По коду человек увидит карточку и отправит обычную заявку.
        </p>
        <p className="muted">
          Последнее подтверждение:{" "}
          {family.availability_confirmed_at
            ? formatDateTime(family.availability_confirmed_at)
            : "нет данных"}
        </p>
      </div>
      <div className="row-actions">
        {!invite ? (
          <button
            type="button"
            data-testid="create-invite-button"
            disabled={busy !== null || !editable}
            onClick={() => onCreate(family.id)}
          >
            Создать код
          </button>
        ) : (
          <>
            <button
              type="button"
              className="secondary"
              onClick={() => void copyInviteCode(invite.code)}
            >
              Копировать
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy !== null || !editable}
              onClick={() => onRotate(family.id)}
            >
              Заменить код
            </button>
            <button
              type="button"
              className="danger"
              disabled={busy !== null || !editable}
              onClick={() => onDisable(family.id)}
            >
              Отключить код
            </button>
          </>
        )}
        <button
          type="button"
          className="secondary"
          data-testid="toggle-family-visibility-button"
          disabled={busy !== null || !editable}
          onClick={() =>
            onUpdateVisibility(family.id, !family.is_search_visible)
          }
        >
          {family.is_search_visible ? "Скрыть из поиска" : "Показывать в поиске"}
        </button>
        <button
          type="button"
          className="secondary"
          data-testid="detail-confirm-availability-button"
          disabled={busy !== null || !editable}
          onClick={() => onConfirmAvailability(family.id)}
        >
          Семья актуальна
        </button>
      </div>
    </section>
  );
}

async function copyInviteCode(code: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(code);
    return;
  }
  const input = document.createElement("textarea");
  input.value = code;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="status-block">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function FamilyFlowSteps({
  membership,
  request,
  payments,
  canRequest
}: {
  membership: FamilyMember | null;
  request: FamilyRequest | null;
  payments: FamilyPayment[];
  canRequest: boolean;
}) {
  const latestPayment = payments[0];
  const hasRequest = Boolean(request || membership);
  const hasApproval = Boolean(membership);
  const hasAccess = Boolean(membership?.access_provided_at);
  const hasAccessConfirmation = Boolean(membership?.access_confirmed_at);
  const paymentReported = latestPayment?.status === "payment_reported";
  const paymentPaid = latestPayment?.status === "paid";

  const steps = [
    {
      title: "1. Отправить заявку",
      text: canRequest
        ? "Нажмите кнопку заявки, владелец увидит ваш профиль."
        : "Заявка уже не требуется или недоступна.",
      state: hasRequest ? "done" : "active"
    },
    {
      title: "2. Договориться с владельцем",
      text: "После заявки владелец пишет вам в Telegram и принимает решение.",
      state: hasApproval ? "done" : hasRequest ? "active" : "pending"
    },
    {
      title: "3. Получить доступ",
      text: "Деньги переводятся только после фактического доступа к сервису.",
      state: hasAccessConfirmation ? "done" : hasAccess ? "active" : "pending"
    },
    {
      title: "4. Оплатить владельцу",
      text: paymentReported
        ? "Вы отметили оплату. Теперь владелец должен подтвердить получение."
        : "После подтверждения доступа откроются реквизиты владельца.",
      state: paymentPaid
        ? "done"
        : hasAccessConfirmation
          ? "active"
          : "pending"
    }
  ];

  return (
    <section className="detail-section">
      <h3>Порядок сделки</h3>
      <div className="flow-steps">
        {steps.map((step) => (
          <div className={`flow-step flow-step-${step.state}`} key={step.title}>
            <strong>{step.title}</strong>
            <p>{step.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FamilyPaymentActions({
  payments,
  onReportPayment,
  onCancelPaymentReport
}: {
  payments: FamilyPayment[];
  onReportPayment: (payment: FamilyPayment) => Promise<unknown>;
  onCancelPaymentReport: (payment: FamilyPayment) => Promise<unknown>;
}) {
  if (payments.length === 0) {
    return null;
  }
  return (
    <section className="detail-section">
      <h3>Платежи</h3>
      {payments.map((payment) => (
        <div className="list-row" key={payment.id}>
          <div>
            <strong>
              {payment.amount_kzt.toLocaleString("ru-KZ")} ₸ ·{" "}
              {statusText(payment.status)}
            </strong>
            <p>
              {paymentKindText(payment.kind)} · {periodLabels[payment.period]} · до{" "}
              {formatDateTime(payment.due_at)}
            </p>
            <PaymentTimeline payment={payment} />
          </div>
          {(payment.status === "due" || payment.status === "overdue") && (
            <button
              type="button"
              data-testid="detail-report-payment-button"
              onClick={() => void onReportPayment(payment)}
            >
              Оплатил
            </button>
          )}
          {payment.status === "payment_reported" && (
            <button
              type="button"
              className="secondary"
              data-testid="detail-cancel-payment-report-button"
              onClick={() => void onCancelPaymentReport(payment)}
            >
              Отменить отметку
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

function PaymentTimeline({ payment }: { payment: FamilyPayment }) {
  const steps = [
    {
      label: "Реквизиты",
      date: payment.requisites_opened_at,
      done: Boolean(payment.requisites_opened_at)
    },
    {
      label: "Участник отметил оплату",
      date: payment.reported_paid_at,
      done: Boolean(payment.reported_paid_at)
    },
    {
      label: "Владелец подтвердил",
      date: payment.confirmed_paid_at,
      done: Boolean(payment.confirmed_paid_at)
    }
  ];

  return (
    <div className="mini-timeline">
      {steps.map((step) => (
        <span
          className={step.done ? "mini-timeline-step done" : "mini-timeline-step"}
          key={step.label}
        >
          <b />
          {step.label}
          {step.date ? ` · ${formatDateTime(step.date)}` : ""}
        </span>
      ))}
      {payment.overdue_at && (
        <span className="mini-timeline-step overdue">
          <b />
          Просрочено · {formatDateTime(payment.overdue_at)}
        </span>
      )}
    </div>
  );
}

function FamilyAuditTimeline({ logs }: { logs: FamilyAuditLog[] }) {
  if (logs.length === 0) {
    return (
      <section className="detail-section">
        <h3>История семьи</h3>
        <p>История появится после первых действий по семье.</p>
      </section>
    );
  }

  return (
    <section className="detail-section">
      <h3>История семьи</h3>
      <div className="audit-timeline">
        {logs.slice(0, 12).map((log) => (
          <div className="audit-event" key={log.id}>
            <span>{formatDateTime(log.created_at)}</span>
            <strong>{auditActionText(log.action)}</strong>
            {(log.old_status || log.new_status) && (
              <p>
                {log.old_status ? statusText(log.old_status) : "Новое"} →{" "}
                {log.new_status ? statusText(log.new_status) : "без статуса"}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function paymentKindText(kind: string) {
  const labels: Record<string, string> = {
    first: "первый платеж",
    regular: "регулярный платеж",
    prepaid: "предоплата"
  };
  return labels[kind] ?? kind;
}

function auditActionText(action: string) {
  const labels: Record<string, string> = {
    family_created: "Семья создана",
    family_request_created: "Заявка отправлена",
    family_request_cancelled: "Заявка отменена",
    family_request_approved: "Заявка принята",
    family_request_rejected: "Заявка отклонена",
    family_request_expired: "Заявка истекла",
    family_request_cancelled_family_full: "Заявка закрыта: семья заполнена",
    family_became_full: "Семья заполнена",
    family_access_provided: "Владелец выдал доступ",
    family_access_confirmation_reminded: "Владелец напомнил подтвердить доступ",
    family_access_confirmation_overdue_reminded: "Доступ ожидает подтверждения больше суток",
    family_access_confirmed: "Участник подтвердил доступ",
    first_payment_overdue: "Первый платеж просрочен",
    family_payment_reported: "Участник отметил оплату",
    family_payment_report_cancelled: "Участник отменил отметку оплаты",
    family_payment_confirmed: "Владелец подтвердил оплату",
    family_payment_not_received: "Владелец отметил, что оплату не получил",
    family_payment_cancelled: "Будущий платеж отменен",
    family_prepayment_created: "Участник создал предоплату",
    family_prepayment_recorded_by_owner: "Владелец отметил предоплату",
    regular_payment_created: "Создан регулярный платеж",
    regular_payment_due: "Регулярный платеж к оплате",
    regular_payment_overdue: "Регулярный платеж просрочен",
    family_member_removal_scheduled: "Удаление участника запланировано",
    family_member_removal_revoked: "Удаление участника отменено",
    family_member_removal_acknowledged:
      "Участник увидел предупреждение об удалении",
    family_member_removal_cancellation_requested:
      "Участник попросил отменить удаление",
    family_member_removed_by_timeout: "Участник удален после предупреждения",
    family_member_cancelled_before_access: "Вступление отменено до доступа",
    family_member_left: "Участник вышел из семьи",
    family_description_updated: "Описание семьи обновлено",
    family_price_updated: "Стоимость семьи обновлена",
    family_payment_day_updated: "Дата оплаты обновлена",
    family_closing_started: "Семья закрывается",
    family_closing_acknowledged: "Участник подтвердил предупреждение о закрытии",
    family_closed: "Семья закрыта"
  };
  return labels[action] ?? action;
}
