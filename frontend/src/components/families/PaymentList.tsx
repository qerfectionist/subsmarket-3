import { formatDateTime, statusText } from "../../format";
import { paymentCancelReasonLabels, paymentKindText, periodLabels } from "../../labels";
import type { FamilyPayment } from "../../types";

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
      <div className="payment-list payment-list-empty">
        <p className="muted">Платежей пока нет</p>
        <small>
          Они появятся после подтверждения доступа или перед следующей датой оплаты.
        </small>
      </div>
    );
  }

  return (
    <div className="payment-list">
      {payments.map((payment) => (
        <article className="payment-row" key={payment.id}>
          <div>
            <strong>
              {payment.amount_kzt.toLocaleString("ru-KZ")} ₸ · {statusText(payment.status)}
            </strong>
            <p>
              {paymentKindText(payment.kind)} · {periodLabels[payment.period]} · до{" "}
              {formatDateTime(payment.due_at)}
            </p>
            {payment.cancel_reason ? (
              <small>
                {paymentCancelReasonLabels[payment.cancel_reason] ?? payment.cancel_reason}
              </small>
            ) : null}
          </div>
          {!ownerMode ? (
            <div className="row-actions">
              {(payment.status === "due" || payment.status === "overdue") && onReport ? (
                <button
                  type="button"
                  data-payment-id={payment.id}
                  data-testid="report-payment-button"
                  disabled={false}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void onReport(payment);
                  }}
                >
                  Оплатил
                </button>
              ) : null}
              {payment.status === "payment_reported" && onCancel ? (
                <button
                  type="button"
                  className="secondary"
                  data-testid="cancel-payment-report-button"
                  onClick={() => void onCancel(payment)}
                >
                  Отменить
                </button>
              ) : null}
            </div>
          ) : payment.status === "payment_reported" ? (
            <div className="row-actions">
              {onConfirm ? (
                <button
                  type="button"
                  data-testid="confirm-payment-button"
                  onClick={() => void onConfirm(payment)}
                >
                  Подтвердить
                </button>
              ) : null}
              {onNotReceived ? (
                <button
                  type="button"
                  className="secondary"
                  data-testid="payment-not-received-button"
                  onClick={() => void onNotReceived(payment)}
                >
                  Не получил
                </button>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}