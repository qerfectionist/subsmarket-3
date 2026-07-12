import {
  Button as WorldButton,
  Typography
} from "@worldcoin/mini-apps-ui-kit-react";

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
        <Typography as="p" variant="body" level={3} className="muted">
          Платежей пока нет
        </Typography>
        <Typography as="small" variant="body" level={4}>
          Они появятся после подтверждения доступа или перед следующей датой оплаты.
        </Typography>
      </div>
    );
  }

  return (
    <div className="payment-list">
      {payments.map((payment) => (
        <article className="payment-row" key={payment.id}>
          <div>
            <Typography as="strong" variant="subtitle" level={3}>
              {payment.amount_kzt.toLocaleString("ru-KZ")} ₸ · {statusText(payment.status)}
            </Typography>
            <Typography as="p" variant="body" level={3}>
              {paymentKindText(payment.kind)} · {periodLabels[payment.period]} · до{" "}
              {formatDateTime(payment.due_at)}
            </Typography>
            {payment.cancel_reason ? (
              <Typography as="small" variant="body" level={4}>
                {paymentCancelReasonLabels[payment.cancel_reason] ?? payment.cancel_reason}
              </Typography>
            ) : null}
          </div>
          {!ownerMode ? (
            <div className="row-actions">
              {(payment.status === "due" || payment.status === "overdue") && onReport ? (
                <WorldButton
                  type="button"
                  size="sm"
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
                </WorldButton>
              ) : null}
              {payment.status === "payment_reported" && onCancel ? (
                <WorldButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  data-testid="cancel-payment-report-button"
                  onClick={() => void onCancel(payment)}
                >
                  Отменить
                </WorldButton>
              ) : null}
            </div>
          ) : payment.status === "payment_reported" ? (
            <div className="row-actions">
              {onConfirm ? (
                <WorldButton
                  type="button"
                  size="sm"
                  data-testid="confirm-payment-button"
                  onClick={() => void onConfirm(payment)}
                >
                  Подтвердить
                </WorldButton>
              ) : null}
              {onNotReceived ? (
                <WorldButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  data-testid="payment-not-received-button"
                  onClick={() => void onNotReceived(payment)}
                >
                  Не получил
                </WorldButton>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
