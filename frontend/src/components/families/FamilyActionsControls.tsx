import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { Button as AppButton, Input, TextArea, Typography } from "../ui";
import type {
  Family,
  FamilyMember,
  FamilyMemberRemovalReason,
  FamilyPayment,
  MyFamily
} from "../../types";

export function hasPendingPaymentAction(item: MyFamily) {
  return item.payments.some((payment) =>
    ["due", "overdue", "payment_reported"].includes(payment.status)
  );
}

export function hasPendingAccessAction(item: MyFamily) {
  if (item.pending_requests_count > 0) return true;
  return ["awaiting_access", "awaiting_confirmation"].includes(item.membership.status);
}

export function hasPendingFamilyAction(item: MyFamily) {
  return hasPendingAccessAction(item) || hasPendingPaymentAction(item);
}

export function getMemberStep(member: FamilyMember, payment?: FamilyPayment) {
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

export function MemberNextStep({
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

export function OwnerWorkSummary({
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

export function OwnerSettingsFormAnimated({ children }: { children: ReactNode }) {
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    gsap.fromTo(
      el,
      { opacity: 0, y: -10, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.26, ease: "power2.out", overwrite: "auto" }
    );
  }, []);

  return <div ref={formRef} className="owner-settings-form">{children}</div>;
}

export function OwnerActions({
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
  const [settingsOpen, setSettingsOpen] = useState(false);
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
        <AppButton
          type="button"
          size="sm"
          data-testid="owner-details-button"
          disabled={busy !== null}
          onClick={() => onLoadOwnerDetails(family.id)}
        >
          Заявки и участники
        </AppButton>
        <AppButton
          type="button"
          variant="secondary"
          size="sm"
          data-testid="confirm-availability-button"
          disabled={busy !== null || !["active", "full"].includes(family.status)}
          onClick={() => onConfirmAvailability(family.id)}
        >
          Семья актуальна
        </AppButton>
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

      <AppButton
        type="button"
        variant="tertiary"
        fullWidth
        data-testid="owner-settings-toggle"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen((current) => !current)}
      >
        {settingsOpen ? "Скрыть настройки" : "Настройки семьи"}
      </AppButton>

      {settingsOpen ? (
        <OwnerSettingsFormAnimated>
          <div className="owner-settings-grid">
            <Input
              label="Доступ работает до"
              data-testid="close-family-date-input"
              min={today}
              type="date"
              value={closeDateDraft}
              onChange={(event) => setCloseDateDraft(event.target.value)}
            />
            <AppButton
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
            </AppButton>
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
          <AppButton
            type="button"
            variant="secondary"
            data-testid="owner-save-description-button"
            disabled={busy !== null}
            onClick={() =>
              onUpdateDescription(family.id, descriptionValue ? descriptionValue : null)
            }
          >
            Сохранить описание
          </AppButton>

          <div className="owner-settings-grid">
            <Input
              label="Общая цена"
              data-testid="owner-price-input"
              min={1}
              type="number"
              value={priceDraft}
              onChange={(event) => setPriceDraft(event.target.value)}
            />
            <AppButton
              type="button"
              variant="secondary"
              data-testid="owner-save-price-button"
              disabled={busy !== null || !canSubmitPrice}
              onClick={() => onUpdatePrice(family.id, priceValue)}
            >
              Изменить цену
            </AppButton>
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
            <AppButton
              type="button"
              variant="secondary"
              data-testid="owner-save-payment-day-button"
              disabled={busy !== null || !canSubmitPaymentDay}
              onClick={() =>
                onUpdatePaymentDay(family.id, paymentDayValue, nextPaymentDateDraft)
              }
            >
              Изменить дату оплаты
            </AppButton>
          </div>
          <Typography as="small" variant="body" level={4} className="muted">
            Дату оплаты можно менять только пока семья ещё не была полностью собрана.
          </Typography>
        </OwnerSettingsFormAnimated>
      ) : null}
    </div>
  );
}

export function MemberActions({
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
        <AppButton
          type="button"
          data-testid="confirm-access-button"
          disabled={busy !== null}
          onClick={() => onConfirmAccess(member.id)}
        >
          Доступ получен
        </AppButton>
      )}
      {member.access_confirmed_at && (
        <AppButton
          type="button"
          variant="secondary"
          data-testid="show-requisite-button"
          disabled={busy !== null}
          onClick={() => onGetRequisite(member.id)}
        >
          Показать реквизиты
        </AppButton>
      )}
      {member.status === "active" && ["active", "full"].includes(familyStatus) && (
        <AppButton
          type="button"
          variant="secondary"
          data-testid="create-prepayment-button"
          disabled={busy !== null}
          onClick={() => onCreatePrepayment(member.id)}
        >
          Оплатить следующий период заранее
        </AppButton>
      )}
      {familyStatus === "closing" && (
        <AppButton
          type="button"
          data-testid="acknowledge-closing-button"
          disabled={busy !== null}
          onClick={() => onAcknowledgeClosing(familyId)}
        >
          Понятно, семья закрывается
        </AppButton>
      )}
      <AppButton
        type="button"
        variant="secondary"
        data-testid="leave-family-button"
        disabled={busy !== null}
        onClick={() => onLeaveFamily(member.id)}
      >
        Выйти
      </AppButton>
    </>
  );
}
