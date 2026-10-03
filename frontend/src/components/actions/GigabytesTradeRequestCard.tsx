import { useState } from "react";
import { SystemSymbol } from "../SystemSymbol";
import { ServiceLogo } from "../branding";
import { openTelegramUser } from "../../telegram";
import type { MarketplaceListingRequest } from "../../types";
import { TradeRequestSellerActions, TradeRequestCancelButton } from "../TradeRequestSellerActions";
import {
  formatTradeGb,
  formatTradeKzt,
  useRequestTimeRemaining,
  useRequestContacted,
  CircularCountdownTimer,
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
  const timeRemaining = useRequestTimeRemaining(request.created_at);
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
          ) : timerPrototype === 4 && isPendingTimer ? (
            <span className="trade-timer-sub-price">
              <span className="trade-timer-sub-dot" aria-hidden />
              <span>{timeRemaining.text}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="sm-listing-footer">
        <span className="sm-market-family-owner">
          <span className="sm-market-family-owner-avatar" aria-hidden>
            {request.counterparty_username
              ? request.counterparty_username.slice(0, 1).toUpperCase()
              : (request.role === "seller" ? "П" : "П")}
          </span>
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
          timerPrototype === 4 ? (
            <span className="my-trade-request-status is-pending">
              <span className="my-trade-request-dot" aria-hidden />
              <span>{request.role === "buyer" ? "Ждём ответа" : "Ждёт ответа"}</span>
            </span>
          ) : timerPrototype === 2 ? (
            <span className="timer-context-badge">
              <span className="timer-context-label">{request.role === "buyer" ? "Ждём ответа" : "Осталось"}</span>
              <CircularCountdownTimer
                text={timeRemaining.text}
                progress={timeRemaining.progress}
                label={gbRequestStatus(request.status)}
              />
            </span>
          ) : (
            <CircularCountdownTimer
              text={timeRemaining.text}
              progress={timeRemaining.progress}
              label={gbRequestStatus(request.status)}
            />
          )
        ) : (
          <span
            className={`my-trade-request-status is-${timeRemaining.isExpired && request.status === "pending" ? "expired" : request.status}`}
          >
            <span className="my-trade-request-dot" aria-hidden />
            <span>
              {timeRemaining.isExpired && request.status === "pending"
                ? "Срок истёк"
                : gbRequestStatus(request.status)}
            </span>
          </span>
        )}
      </div>

      {hasActions ? (
        <div className={`gb-request-actions my-trade-request-actions${request.role === "seller" && request.status === "accepted" ? " is-deal-resolution" : ""}`}>
          {request.role === "seller" && request.status === "pending" ? (
            <TradeRequestSellerActions
              busy={busy || timeRemaining.isExpired}
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
          {request.status === "accepted" && request.counterparty_username ? (
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
          {request.role === "buyer" && request.status === "accepted" ? (
            <TradeRequestCancelButton
              busy={busy}
              onCancel={() => onCancel?.(request.id)}
              label="Отменить"
            />
          ) : null}
          {request.role === "seller" && request.status === "accepted" ? (
            <>
              <button
                disabled={busy || !hasContacted}
                type="button"
                onClick={() => onClose?.(request.id, "sold")}
                className="trade-request-sold-btn"
                data-testid="gb-close-sold-btn"
              >
                <SystemSymbol name="checkmark" size={17} />
                <span>Продано</span>
              </button>
              <button
                disabled={busy || !hasContacted}
                type="button"
                onClick={() => onClose?.(request.id, "not_sold")}
                className="trade-request-not-sold-btn"
                data-testid="gb-close-not-sold-btn"
              >
                <SystemSymbol name="xmark" size={17} />
                <span>Не продано</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
