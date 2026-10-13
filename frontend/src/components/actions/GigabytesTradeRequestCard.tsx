import { useState } from "react";
import { SystemSymbol } from "../SystemSymbol";
import { TradeRequestStatusIcon } from "./TradeRequestStatusIcon";
import { ServiceLogo } from "../branding";
import { openTelegramUser } from "../../telegram";
import type { MarketplaceListingRequest } from "../../types";
import { TradeRequestSellerActions, TradeRequestCancelButton } from "../TradeRequestSellerActions";
import { UserAvatar } from "../UserAvatar";
import {
  formatTradeGb,
  formatTradeKzt,
  useRequestTimeRemaining,
  useRequestContacted,
  CircularCountdownTimer,
  PendingRequestTimerBadge,
  gbRequestStatus
} from "./useRequestTimeRemaining";

export function GigabytesTradeRequestCard({
  request,
  busy = false,
  isArchiving = false,
  timerPrototype = 1,
  onAccept,
  onReject,
  onCancel,
  onClose,
  onRemind
}: {
  request: MarketplaceListingRequest;
  busy?: boolean;
  isArchiving?: boolean;
  timerPrototype?: 1 | 2 | 3 | 4;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  onClose?: (id: string, outcome: "sold" | "not_sold") => void;
  onRemind?: (id: string) => void;
}) {
  const timeRemaining = useRequestTimeRemaining(request.created_at, null, request.id);
  const { hasContacted, markContacted } = useRequestContacted(request.id);
  const [isCancellingCountdown, setIsCancellingCountdown] = useState(false);
  const hasActions =
    (request.role === "seller" && (request.status === "pending" || request.status === "accepted")) ||
    (request.role === "buyer" && (request.status === "pending" || request.status === "accepted")) ||
    (request.status === "accepted" && Boolean(request.counterparty_username));

  const isPendingTimer = request.status === "pending" && timeRemaining.text && !timeRemaining.isExpired;

  return (
    <article
      className={`sm-listing my-trade-request${isArchiving ? " is-archiving-out" : ""}`}
      data-testid="gigabytes-request-card"
    >
      <div className="sm-listing-main">
        <ServiceLogo
          serviceSlug={`${request.operator_slug}-family-tariff`}
          serviceName={request.operator_name}
          size={40}
        />
        <div className="sm-listing-copy">
          <strong title={`${formatTradeGb(request.amount_gb)} ГБ`}>
            {formatTradeGb(request.amount_gb)} ГБ
          </strong>
          <span>{request.role === "seller" ? "Продажа гигабайта" : "Покупка гигабайта"}</span>
        </div>
        <div className="sm-listing-price">
          <strong>{formatTradeKzt(request.total_price_kzt)}</strong>
          {timerPrototype === 3 ? (
            <span>разово</span>
          ) : null}
        </div>
      </div>

      <div className="sm-listing-footer">
        <span className="sm-market-family-owner">
          <UserAvatar
            name={
              request.counterparty_username
                ? `@${request.counterparty_username.replace(/^@/, "")}`
                : (request.role === "seller" ? "Покупатель" : "Продавец")
            }
            size={24}
          />
          <span className="sm-market-family-avatar-name">
            {request.counterparty_username ? (
              <span className="sm-market-family-avatar-label">
                {`@${request.counterparty_username.replace(/^@/, "")}`}
              </span>
            ) : (
              <span className="sm-market-family-avatar-label">
                {request.role === "seller" ? "Покупатель" : "Продавец"}
              </span>
            )}
          </span>
        </span>
        {isPendingTimer ? (
          timerPrototype === 2 ? (
            <span className="timer-context-badge">
              <span className="timer-context-label">{request.role === "buyer" ? "Ждём ответа" : "Осталось"}</span>
              <CircularCountdownTimer
                text={timeRemaining.text}
                progress={timeRemaining.progress}
                label={gbRequestStatus(request.status, request.role)}
              />
            </span>
          ) : (
            <PendingRequestTimerBadge timeRemaining={timeRemaining} role={request.role} />
          )
        ) : (() => {
          const isExpired = (timeRemaining.isExpired && request.status === "pending") || request.status === "expired";
          const effectiveStatus = isExpired ? "expired" : request.status;
          return (
            <span className={`my-trade-request-status is-${effectiveStatus}`}>
              <TradeRequestStatusIcon status={effectiveStatus} />
              <span>
                {isExpired
                  ? request.role === "buyer"
                    ? "Продавец не ответил"
                    : "Вы не ответили"
                  : gbRequestStatus(request.status, request.role)}
              </span>
            </span>
          );
        })()}
      </div>

      {hasActions && !timeRemaining.isExpired ? (
        <div className={`gb-request-actions my-trade-request-actions${request.role === "seller" && request.status === "accepted" ? " is-deal-resolution" : ""}`}>
          {request.role === "seller" && request.status === "pending" ? (
            <TradeRequestSellerActions
              busy={busy}
              onAccept={() => onAccept?.(request.id)}
              onReject={() => onReject?.(request.id)}
            />
          ) : null}
          {request.role === "buyer" && request.status === "pending" ? (
            <>
              <TradeRequestCancelButton
                busy={busy}
                onCancel={() => onCancel?.(request.id)}
                onCountdownChange={setIsCancellingCountdown}
                testId="trade-request-cancel-btn"
              />
              <button
                disabled={busy || !request.can_remind || isCancellingCountdown}
                onClick={() => onRemind?.(request.id)}
                type="button"
                data-testid="trade-request-remind-btn"
              >
                <SystemSymbol name="bell" size={17} />
                <span>Напомнить</span>
              </button>
            </>
          ) : null}
          {request.role === "buyer" && request.status === "accepted" ? (
            <>
              {request.counterparty_username ? (
                <button
                  type="button"
                  className="gb-chat-button"
                  onClick={() => {
                    markContacted();
                    openTelegramUser(request.counterparty_username!, request.telegram_draft ?? undefined);
                  }}
                >
                  <SystemSymbol name="message" size={17} />
                  <span>Написать</span>
                </button>
              ) : null}
              <TradeRequestCancelButton
                busy={busy}
                onCancel={() => onCancel?.(request.id)}
                label="Отменить"
              />
            </>
          ) : null}
          {request.role === "seller" && request.status === "accepted" ? (
            !hasContacted ? (
              <button
                type="button"
                className="gb-chat-button is-stepwise-write"
                data-testid="trade-request-write-btn"
                onClick={() => {
                  markContacted();
                  openTelegramUser(request.counterparty_username!, request.telegram_draft ?? undefined);
                }}
              >
                <SystemSymbol name="message" size={17} />
                <span>Написать покупателю</span>
              </button>
            ) : (
              <>
                <button
                  disabled={busy}
                  type="button"
                  onClick={() => onClose?.(request.id, "sold")}
                  className="trade-request-sold-btn"
                  data-testid="gb-close-sold-btn"
                >
                  <SystemSymbol name="checkmark" size={17} />
                  <span>Продано</span>
                </button>
                <button
                  disabled={busy}
                  type="button"
                  onClick={() => onClose?.(request.id, "not_sold")}
                  className="trade-request-not-sold-btn"
                  data-testid="gb-close-not-sold-btn"
                >
                  <SystemSymbol name="xmark" size={17} />
                  <span>Не продано</span>
                </button>
              </>
            )
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
