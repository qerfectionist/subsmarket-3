import { useState } from "react";
import { SystemSymbol } from "./SystemSymbol";
import { TradeRequestStatusIcon } from "./actions/TradeRequestStatusIcon";
import { ServiceLogo } from "./branding";
import { familyTitle, formatDate, statusText } from "../format";
import { familyKindLabels } from "../labels";
import { openTelegramUser } from "../telegram";
import type { Family, FamilyRequest, OwnerFamilyRequest } from "../types";
import { TradeRequestSellerActions, TradeRequestCancelButton } from "./TradeRequestSellerActions";
import { UserAvatar } from "./UserAvatar";

// Re-export extracted helpers and cards for 100% backward compatibility
export * from "./actions/useRequestTimeRemaining";
export { GigabytesTradeRequestCard } from "./actions/GigabytesTradeRequestCard";
export { AccountTradeRequestCard } from "./actions/AccountTradeRequestCard";

import {
  formatTradeKzt,
  useRequestTimeRemaining,
  CircularCountdownTimer,
  PendingRequestTimerBadge
} from "./actions/useRequestTimeRemaining";

export function FamilyTradeRequestCard({
  request,
  busy = false,
  isArchiving = false,
  onCancelRequest
}: {
  request: FamilyRequest;
  busy?: boolean;
  isArchiving?: boolean;
  onCancelRequest?: (id: string) => void;
}) {
  const timeRemaining = useRequestTimeRemaining(request.created_at, request.expires_at);
  const [isCancellingCountdown, setIsCancellingCountdown] = useState(false);
  const hasActions = Boolean(request.owner_username || request.status === "pending");

  return (
    <article
      className={`sm-listing my-trade-request${isArchiving ? " is-archiving-out" : ""}`}
      data-testid="request-card"
    >
      <div className="sm-listing-main">
        <ServiceLogo
          serviceName={request.service_name}
          familyType={request.family_type}
          size={40}
        />
        <div className="sm-listing-copy">
          <strong title={familyTitle(request)}>{familyTitle(request)}</strong>
          <span>{familyKindLabels[request.family_type]}</span>
        </div>
        <div className="sm-listing-price">
          {request.member_share_kzt != null || request.price_kzt != null ? (
            <>
              <strong>{formatTradeKzt((request.member_share_kzt ?? request.price_kzt)!)}</strong>
              <span>в месяц</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "var(--app-muted)", whiteSpace: "nowrap" }}>
              {formatDate(request.created_at)}
            </span>
          )}
        </div>
      </div>

      <div className="sm-listing-footer">
        <span className="sm-market-family-owner">
          <UserAvatar
            name={request.owner_username ? `@${request.owner_username.replace(/^@/, "")}` : "О"}
            size={24}
          />
          <span className="sm-market-family-avatar-name">
            {request.owner_username ? (
              <span className="sm-market-family-avatar-label">
                {`@${request.owner_username.replace(/^@/, "")}`}
              </span>
            ) : (
              <span className="sm-market-family-avatar-label">Владелец</span>
            )}
          </span>
        </span>
        {request.status === "pending" && timeRemaining.text && !timeRemaining.isExpired ? (
          <PendingRequestTimerBadge timeRemaining={timeRemaining} role="buyer" />
        ) : (() => {
          const isExpired = timeRemaining.isExpired && request.status === "pending";
          const effectiveStatus = isExpired ? "expired" : request.status;
          return (
            <span className={`my-trade-request-status is-${effectiveStatus}`}>
              <TradeRequestStatusIcon status={effectiveStatus} />
              <span>
                {isExpired
                  ? "Продавец не ответил"
                  : request.status === "rejected"
                    ? "Продавец отклонил"
                    : statusText(request.status)}
              </span>
            </span>
          );
        })()}
      </div>

      {hasActions ? (
        <div className="gb-request-actions my-trade-request-actions">
          {request.status === "pending" ? (
            <TradeRequestCancelButton
              busy={busy}
              onCancel={() => onCancelRequest?.(request.id)}
              onCountdownChange={setIsCancellingCountdown}
              testId="trade-request-cancel-btn"
            />
          ) : null}
          {request.owner_username ? (
            <button
              type="button"
              disabled={busy || isCancellingCountdown}
              data-testid="request-owner-chat-button"
              onClick={() =>
                openTelegramUser(
                  request.owner_username!,
                  request.status === "accepted"
                    ? `Здравствуйте, моя заявка в вашу семью ${familyTitle(request)} принята в SubsMarket.`
                    : `Здравствуйте, я оставил заявку в вашу семью ${familyTitle(request)} в SubsMarket.`
                )
              }
            >
              <SystemSymbol name="message" size={17} />
              <span>Написать владельцу</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function FamilyCandidateRequestCard({
  family,
  request,
  busy = false,
  isArchiving = false,
  timerPrototype = 1,
  onAccept,
  onReject
}: {
  family: Family;
  request: OwnerFamilyRequest;
  busy?: boolean;
  isArchiving?: boolean;
  timerPrototype?: 1 | 2 | 3 | 4;
  onAccept?: (familyId: string, request: OwnerFamilyRequest) => void;
  onReject?: (familyId: string, request: OwnerFamilyRequest) => void;
}) {
  const timeRemaining = useRequestTimeRemaining(request.created_at, request.expires_at, request.id);
  const candidate = request.candidate;
  const candidateUsername = candidate?.username?.replace(/^@/, "");
  const candidateName = candidate?.first_name || (candidateUsername ? `@${candidateUsername}` : "Кандидат");
  const avatarLetter = (candidateUsername || candidate?.first_name || "К").slice(0, 1).toUpperCase();

  const priceValue = request.member_share_kzt ?? family.member_share_kzt;
  const isPendingTimer = request.status === "pending" && timeRemaining.text && !timeRemaining.isExpired;

  return (
    <article
      className={`sm-listing my-trade-request${isArchiving ? " is-archiving-out" : ""}`}
      data-testid="family-candidate-request-card"
    >
      <div className="sm-listing-main">
        <ServiceLogo
          serviceName={family.service_name}
          serviceSlug={family.service_slug}
          familyType={family.family_type}
          size={40}
        />
        <div className="sm-listing-copy">
          <strong title={familyTitle(family)}>{familyTitle(family)}</strong>
          <span>{familyKindLabels[family.family_type] ?? "Семейная подписка"}</span>
        </div>
        <div className="sm-listing-price">
          {priceValue != null ? (
            <>
              <strong>{formatTradeKzt(priceValue)}</strong>
              <span>в месяц</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "var(--app-muted)", whiteSpace: "nowrap" }}>
              {formatDate(request.created_at)}
            </span>
          )}
        </div>
      </div>

      <div className="sm-listing-footer">
        <span className="sm-market-family-owner">
          <UserAvatar
            name={candidateUsername ? `@${candidateUsername}` : candidateName}
            size={24}
          />
          <span className="sm-market-family-avatar-name">
            {candidateUsername ? (
              <span className="sm-market-family-avatar-label">
                {`@${candidateUsername}`}
              </span>
            ) : (
              <span className="sm-market-family-avatar-label">
                {candidateName}
              </span>
            )}
          </span>
        </span>
        {isPendingTimer ? (
          <PendingRequestTimerBadge timeRemaining={timeRemaining} role="seller" />
        ) : (() => {
          const isExpired = timeRemaining.isExpired && request.status === "pending";
          const effectiveStatus = isExpired ? "expired" : request.status;
          return (
            <span className={`my-trade-request-status is-${effectiveStatus}`}>
              <TradeRequestStatusIcon status={effectiveStatus} />
              <span>
                {isExpired
                  ? "Вы не ответили"
                  : request.status === "rejected"
                    ? "Вы отклонили"
                    : statusText(request.status)}
              </span>
            </span>
          );
        })()}
      </div>

      {request.status === "pending" && !timeRemaining.isExpired ? (
        <div className="gb-request-actions my-trade-request-actions">
          <TradeRequestSellerActions
            busy={busy}
            onAccept={() => onAccept?.(family.id, request)}
            onReject={() => onReject?.(family.id, request)}
          />
        </div>
      ) : null}
    </article>
  );
}
