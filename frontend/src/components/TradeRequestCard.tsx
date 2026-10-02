import { useState, useEffect } from "react";
import { SystemSymbol } from "./SystemSymbol";
import { ServiceLogo } from "./branding";
import { familyTitle, formatDate, formatAccountTitle, statusText } from "../format";
import { familyKindLabels } from "../labels";
import { openTelegramUser } from "../telegram";
import type { AccountRequest, Family, FamilyRequest, MarketplaceListingRequest, OwnerFamilyRequest } from "../types";
import { TradeRequestSellerActions, TradeRequestCancelButton } from "./TradeRequestSellerActions";

export function formatTradeKzt(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
}

export function formatTradeGb(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("ru-KZ", { maximumFractionDigits: 0 });
}

function parseTimestamp(val: string) {
  if (!val) return 0;
  const normalized = /Z|[+-]\d{2}:?\d{2}$/i.test(val)
    ? val
    : val.includes("T")
      ? `${val}Z`
      : `${val.replace(" ", "T")}Z`;
  const ms = new Date(normalized).getTime();
  return Number.isNaN(ms) ? new Date(val).getTime() : ms;
}

function useRequestTimeRemaining(createdAt?: string | null, expiresAt?: string | null) {
  const calculate = () => {
    if (!createdAt && !expiresAt) return { text: "", progress: 1, isExpired: false };
    const now = Date.now();
    const start = parseTimestamp(createdAt!);
    const totalDuration = 5 * 60 * 60 * 1000;
    const maxDeadline = start ? start + totalDuration : (expiresAt ? parseTimestamp(expiresAt) : now + totalDuration);
    const deadline = expiresAt
      ? Math.min(parseTimestamp(expiresAt), maxDeadline)
      : maxDeadline;
    const diffMs = deadline - now;

    if (diffMs <= 0) {
      return { text: "Срок истёк", progress: 0, isExpired: true };
    }

    const progress = Math.max(0, Math.min(1, diffMs / totalDuration));
    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");
    const text = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;

    return { text, progress, isExpired: false };
  };

  const [data, setData] = useState(calculate);

  useEffect(() => {
    if (!createdAt && !expiresAt) return;

    setData(calculate());
    const interval = setInterval(() => {
      setData(calculate());
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt, expiresAt]);

  return data;
}

export function CircularCountdownTimer({
  text,
  progress,
  label = "Ждёт ответа"
}: {
  text: string;
  progress: number;
  label?: string;
}) {
  const circumference = 44;
  const offset = circumference * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <span
      className="timer-circular-wrap"
      title={`${label} · осталось ${text}`}
      aria-label={`${label}, осталось ${text}`}
      data-testid="circular-countdown-timer"
    >
      <svg className="timer-ring-svg" viewBox="0 0 18 18" aria-hidden="true">
        <circle
          className="timer-ring-bg"
          cx="9"
          cy="9"
          r="7"
          fill="none"
          strokeWidth="2.2"
        />
        <circle
          className="timer-ring-val"
          cx="9"
          cy="9"
          r="7"
          fill="none"
          strokeWidth="2.2"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span>{text}</span>
    </span>
  );
}

function gbRequestStatus(status: MarketplaceListingRequest["status"]) {
  return (
    {
      pending: "Ждёт ответа",
      accepted: "Можно написать",
      rejected: "Отклонена",
      cancelled: "Отменена",
      closed: "Закрыта",
      expired: "Срок истёк"
    } as const
  )[status];
}

function accountRequestStatus(status: AccountRequest["status"]) {
  return (
    {
      pending: "Ждёт ответа",
      accepted: "Принята",
      rejected: "Отклонена",
      cancelled: "Отменена",
      closed: "Закрыта",
      expired: "Истекла"
    } as const
  )[status];
}

function useRequestContacted(requestId: string) {
  const key = `sm_contacted_${requestId}`;
  const [hasContacted, setHasContacted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  });

  const markContacted = () => {
    setHasContacted(true);
    try {
      localStorage.setItem(key, "true");
    } catch {
      // ignore
    }
  };

  return { hasContacted, markContacted };
}

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
        <div className="gb-request-actions my-trade-request-actions">
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
            <TradeRequestCancelButton
              busy={busy}
              onCancel={() => onCancel?.(request.id)}
              label="Отменить заявку"
            />
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
              Открыть Telegram
            </button>
          ) : null}
          {request.role === "seller" && request.status === "accepted" && hasContacted ? (
            <>
              <button disabled={busy} type="button" onClick={() => onClose?.(request.id, "sold")}>
                <SystemSymbol name="checkmark" size={17} />
                Продано
              </button>
              <button disabled={busy} type="button" onClick={() => onClose?.(request.id, "not_sold")}>
                <SystemSymbol name="xmark" size={17} />
                Не состоялось
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function AccountTradeRequestCard({
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
  request: AccountRequest;
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
      data-testid="account-request-card"
    >
      <div className="sm-listing-main">
        <ServiceLogo
          serviceSlug={request.service_slug ?? request.service_name?.toLowerCase()}
          serviceName={request.service_name}
          size={40}
        />
        <div className="sm-listing-copy">
          <strong title={request.title}>{formatAccountTitle(request.service_name, request.title)}</strong>
          <span>{request.role === "seller" ? "Продажа аккаунта" : "Покупка аккаунта"}</span>
        </div>
        <div className="sm-listing-price">
          <strong>{formatTradeKzt(request.price_kzt)}</strong>
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
                label={accountRequestStatus(request.status)}
              />
            </span>
          ) : (
            <CircularCountdownTimer
              text={timeRemaining.text}
              progress={timeRemaining.progress}
              label={accountRequestStatus(request.status)}
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
                : accountRequestStatus(request.status)}
            </span>
          </span>
        )}
      </div>

      {hasActions ? (
        <div className="gb-request-actions my-trade-request-actions">
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
              Написать
            </button>
          ) : null}
          {request.role === "buyer" && request.status === "accepted" ? (
            <TradeRequestCancelButton
              busy={busy}
              onCancel={() => onCancel?.(request.id)}
              label="Отменить"
            />
          ) : null}
          {request.role === "seller" && request.status === "accepted" && hasContacted ? (
            <>
              <button disabled={busy} onClick={() => onClose?.(request.id, "sold")} type="button">
                <SystemSymbol name="checkmark" size={17} />
                Продано
              </button>
              <button disabled={busy} onClick={() => onClose?.(request.id, "not_sold")} type="button">
                <SystemSymbol name="xmark" size={17} />
                Не продано
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

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
          <span className="sm-market-family-owner-avatar" aria-hidden>
            {request.owner_username ? request.owner_username.slice(0, 1).toUpperCase() : "О"}
          </span>
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
          <CircularCountdownTimer
            text={timeRemaining.text}
            progress={timeRemaining.progress}
            label={statusText(request.status)}
          />
        ) : (
          <span
            className={`my-trade-request-status is-${timeRemaining.isExpired && request.status === "pending" ? "expired" : request.status}`}
          >
            <span className="my-trade-request-dot" aria-hidden />
            <span>
              {timeRemaining.isExpired && request.status === "pending"
                ? "Срок истёк"
                : statusText(request.status)}
            </span>
          </span>
        )}
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
  const timeRemaining = useRequestTimeRemaining(request.created_at, request.expires_at);
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
              {timerPrototype === 4 && isPendingTimer ? (
                <span className="trade-timer-sub-price">
                  <span className="trade-timer-sub-dot" aria-hidden />
                  <span>{timeRemaining.text}</span>
                </span>
              ) : (
                <span>в месяц</span>
              )}
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
          <span className="sm-market-family-owner-avatar" aria-hidden>
            {avatarLetter}
          </span>
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
          timerPrototype === 4 ? (
            <span className="my-trade-request-status is-pending">
              <span className="my-trade-request-dot" aria-hidden />
              <span>Ждёт ответа</span>
            </span>
          ) : timerPrototype === 2 ? (
            <span className="timer-context-badge">
              <span className="timer-context-label">Осталось</span>
              <CircularCountdownTimer
                text={timeRemaining.text}
                progress={timeRemaining.progress}
                label={statusText(request.status)}
              />
            </span>
          ) : (
            <CircularCountdownTimer
              text={timeRemaining.text}
              progress={timeRemaining.progress}
              label={statusText(request.status)}
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
                : statusText(request.status)}
            </span>
          </span>
        )}
      </div>

      {request.status === "pending" ? (
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
