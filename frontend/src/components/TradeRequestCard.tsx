import { SystemSymbol } from "./SystemSymbol";
import { ServiceLogo } from "./branding";
import { familyTitle, formatDate, statusText } from "../format";
import { familyKindLabels } from "../labels";
import { openTelegramUser } from "../telegram";
import type { AccountRequest, FamilyRequest, MarketplaceListingRequest } from "../types";

export function formatTradeKzt(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
}

export function formatTradeGb(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("ru-KZ", { maximumFractionDigits: 0 });
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
      pending: "Ожидает",
      accepted: "Принята",
      rejected: "Отклонена",
      cancelled: "Отменена",
      closed: "Закрыта",
      expired: "Истекла"
    } as const
  )[status];
}

export function GigabytesTradeRequestCard({
  request,
  busy = false,
  onAccept,
  onReject,
  onCancel,
  onClose,
  onRemind
}: {
  request: MarketplaceListingRequest;
  busy?: boolean;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  onClose?: (id: string, outcome: "sold" | "not_sold") => void;
  onRemind?: (id: string) => void;
}) {
  const hasActions =
    (request.role === "seller" && (request.status === "pending" || request.status === "accepted")) ||
    (request.role === "buyer" && (request.status === "pending" || request.status === "accepted")) ||
    (request.status === "accepted" && Boolean(request.counterparty_username));

  const counterpartyLabel = request.role === "seller" ? "Покупатель:" : "Продавец:";

  return (
    <article className="sm-listing my-trade-request" data-testid="gigabytes-request-card">
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
          <span>Гигабайты · {request.operator_name}</span>
        </div>
        <div className="sm-listing-price">
          <strong>{formatTradeKzt(request.total_price_kzt)}</strong>
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
            <span className="trade-counterparty-role">{counterpartyLabel}</span>
            <span className="sm-market-family-avatar-label">
              {request.counterparty_username
                ? `@${request.counterparty_username}`
                : (request.role === "seller" ? "покупатель" : "продавец")}
            </span>
          </span>
        </span>
        <em className={`my-trade-request-status is-${request.status}`}>
          <span className="my-trade-request-dot" aria-hidden />
          <span>{gbRequestStatus(request.status)}</span>
        </em>
      </div>

      {hasActions ? (
        <div className="gb-request-actions my-trade-request-actions">
          {request.role === "seller" && request.status === "pending" ? (
            <>
              <button disabled={busy} onClick={() => onAccept?.(request.id)} type="button">
                <SystemSymbol name="checkmark" size={17} />
                Принять
              </button>
              <button disabled={busy} onClick={() => onReject?.(request.id)} type="button">
                <SystemSymbol name="xmark" size={17} />
                Отклонить
              </button>
            </>
          ) : null}
          {request.role === "buyer" && request.status === "pending" ? (
            <>
              <button disabled={busy} onClick={() => onCancel?.(request.id)} type="button">
                Отменить
              </button>
              <button
                disabled={busy || !request.can_remind}
                onClick={() => onRemind?.(request.id)}
                type="button"
              >
                <SystemSymbol name="arrow.clockwise" size={17} />
                Напомнить
              </button>
            </>
          ) : null}
          {request.role === "buyer" && request.status === "accepted" ? (
            <button disabled={busy} onClick={() => onCancel?.(request.id)} type="button">
              Отменить заявку
            </button>
          ) : null}
          {request.status === "accepted" && request.counterparty_username ? (
            <button
              type="button"
              className="gb-chat-button"
              onClick={() =>
                openTelegramUser(request.counterparty_username!, request.telegram_draft ?? undefined)
              }
            >
              <SystemSymbol name="message" size={17} />
              Открыть Telegram
            </button>
          ) : null}
          {request.role === "seller" && request.status === "accepted" ? (
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
  onAccept,
  onReject,
  onCancel,
  onClose,
  onRemind
}: {
  request: AccountRequest;
  busy?: boolean;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  onClose?: (id: string, outcome: "sold" | "not_sold") => void;
  onRemind?: (id: string) => void;
}) {
  const hasActions =
    (request.role === "seller" && (request.status === "pending" || request.status === "accepted")) ||
    (request.role === "buyer" && (request.status === "pending" || request.status === "accepted")) ||
    (request.status === "accepted" && Boolean(request.counterparty_username));

  const counterpartyLabel = request.role === "seller" ? "Покупатель:" : "Продавец:";

  return (
    <article className="sm-listing my-trade-request" data-testid="account-request-card">
      <div className="sm-listing-main">
        <ServiceLogo
          serviceSlug={request.service_slug ?? request.service_name?.toLowerCase()}
          serviceName={request.service_name}
          size={40}
        />
        <div className="sm-listing-copy">
          <strong title={request.title}>{request.title}</strong>
          <span>Аккаунт · {request.service_name}</span>
        </div>
        <div className="sm-listing-price">
          <strong>{formatTradeKzt(request.price_kzt)}</strong>
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
            <span className="trade-counterparty-role">{counterpartyLabel}</span>
            <span className="sm-market-family-avatar-label">
              {request.counterparty_username
                ? `@${request.counterparty_username}`
                : (request.role === "seller" ? "покупатель" : "продавец")}
            </span>
          </span>
        </span>
        <em className={`my-trade-request-status is-${request.status}`}>
          <span className="my-trade-request-dot" aria-hidden />
          <span>{accountRequestStatus(request.status)}</span>
        </em>
      </div>

      {hasActions ? (
        <div className="gb-request-actions my-trade-request-actions">
          {request.role === "seller" && request.status === "pending" ? (
            <>
              <button disabled={busy} onClick={() => onAccept?.(request.id)} type="button">
                <SystemSymbol name="checkmark" size={17} />
                Принять
              </button>
              <button disabled={busy} onClick={() => onReject?.(request.id)} type="button">
                <SystemSymbol name="xmark" size={17} />
                Отклонить
              </button>
            </>
          ) : null}
          {request.role === "buyer" && request.status === "pending" ? (
            <>
              <button disabled={busy} onClick={() => onCancel?.(request.id)} type="button">
                Отменить
              </button>
              <button
                disabled={busy || !request.can_remind}
                onClick={() => onRemind?.(request.id)}
                type="button"
              >
                <SystemSymbol name="arrow.clockwise" size={17} />
                Напомнить
              </button>
            </>
          ) : null}
          {request.status === "accepted" && request.counterparty_username ? (
            <button
              type="button"
              className="gb-chat-button"
              onClick={() =>
                openTelegramUser(request.counterparty_username!, request.telegram_draft ?? undefined)
              }
            >
              <SystemSymbol name="message" size={17} />
              Написать
            </button>
          ) : null}
          {request.role === "buyer" && request.status === "accepted" ? (
            <button disabled={busy} onClick={() => onCancel?.(request.id)} type="button">
              Отменить
            </button>
          ) : null}
          {request.role === "seller" && request.status === "accepted" ? (
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
  onCancelRequest
}: {
  request: FamilyRequest;
  busy?: boolean;
  onCancelRequest?: (id: string) => void;
}) {
  const hasActions = Boolean(
    (request.status === "pending" || request.status === "accepted") &&
      (request.owner_username || request.status === "pending")
  );

  return (
    <article className="sm-listing my-trade-request" data-testid="request-card">
      <div className="sm-listing-main">
        <ServiceLogo
          serviceName={request.service_name}
          familyType={request.family_type}
          size={40}
        />
        <div className="sm-listing-copy">
          <strong title={familyTitle(request)}>{familyTitle(request)}</strong>
          <span>
            {request.service_variant
              ? `${familyKindLabels[request.family_type]} · ${request.service_variant}`
              : familyKindLabels[request.family_type]}
          </span>
        </div>
        <div className="sm-listing-price">
          <span style={{ fontSize: 12, color: "var(--app-muted)", whiteSpace: "nowrap" }}>
            {formatDate(request.created_at)}
          </span>
        </div>
      </div>

      <div className="sm-listing-footer">
        <span className="sm-market-family-owner">
          <span className="sm-market-family-owner-avatar" aria-hidden>
            {request.owner_username ? request.owner_username.slice(0, 1).toUpperCase() : "О"}
          </span>
          <span className="sm-market-family-avatar-name">
            <span className="trade-counterparty-role">Организатор:</span>
            <span className="sm-market-family-avatar-label">
              {request.owner_username ? `@${request.owner_username}` : "Организатор"}
            </span>
          </span>
        </span>
        <em className={`my-trade-request-status is-${request.status}`}>
          <span className="my-trade-request-dot" aria-hidden />
          <span>{statusText(request.status)}</span>
        </em>
      </div>

      {hasActions ? (
        <div className="gb-request-actions my-trade-request-actions">
          {request.owner_username ? (
            <button
              type="button"
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
              Написать владельцу
            </button>
          ) : null}
          {request.status === "pending" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onCancelRequest?.(request.id)}
            >
              Отменить
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
