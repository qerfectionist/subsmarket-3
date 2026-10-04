import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import type { ActionsArchiveItem } from "../families";
import type { ActionsTab } from "./ActionsScopePager";

export interface ActionsArchiveCardProps {
  item: ActionsArchiveItem;
  scope: ActionsTab;
  reapplyingId?: string | null;
  onReapply?: (item: ActionsArchiveItem) => void;
  formatArchiveCardDate: (rawDate?: string, fallback?: string) => string;
}

export function ActionsArchiveCard({
  item,
  scope,
  reapplyingId,
  onReapply,
  formatArchiveCardDate
}: ActionsArchiveCardProps) {
  return (
    <article
      className="sm-listing my-trade-request actions-archive-card"
      data-testid="actions-archive-item"
    >
      <div className="sm-listing-main">
        <ServiceLogo
          serviceSlug={item.serviceSlug}
          serviceName={item.serviceName || item.title}
          familyType={item.category === "gigabytes" ? "tariff" : "subscription"}
          size={40}
        />
        <div className="sm-listing-copy">
          <strong title={item.title}>{item.title}</strong>
          <div className="actions-archive-card-sub">
            <span>{item.categoryLabel}</span>
            <span className={`my-trade-request-status is-${item.status}`}>
              <span className="my-trade-request-dot" aria-hidden />
              <span>{item.statusLabel || (item.status === "successful" ? "Завершена" : "Отклонена")}</span>
            </span>
          </div>
          {item.rejectionReason && (
            <span className="actions-archive-rejection-text">
              Причина: {item.rejectionReason}
            </span>
          )}
        </div>
        <div className="sm-listing-price">
          {item.amountKzt != null ? (
            <strong
              className={`actions-archive-price${
                item.status === "successful"
                  ? (scope === "inbox" ? " is-positive" : "")
                  : " is-cancelled"
              }`}
            >
              {item.status === "successful" && scope === "inbox"
                ? `+${item.amountKzt.toLocaleString("ru-RU")} ₸`
                : `${item.amountKzt.toLocaleString("ru-RU")} ₸`}
            </strong>
          ) : null}
        </div>
      </div>

      <div className="sm-listing-footer">
        <span
          className="sm-market-family-owner"
          aria-label={scope === "inbox" ? "Покупатель" : "Продавец"}
        >
          <span className="sm-market-family-owner-avatar" aria-hidden>
            {scope === "inbox" ? "П" : "П"}
          </span>
          <span className="sm-market-family-avatar-name">
            <span className="trade-counterparty-role">
              {scope === "inbox" ? "Покупатель" : "Продавец"}
            </span>
          </span>
        </span>

        <span className="actions-archive-date">
          {formatArchiveCardDate(item.rawDate, item.date)}
        </span>
      </div>

      {scope === "outbox" && item.status === "cancelled" ? (
        <div className="actions-archive-actions">
          <button
            type="button"
            disabled={reapplyingId === item.id}
            className="actions-archive-reapply-btn"
            onClick={() => onReapply?.(item)}
            data-testid="actions-archive-reapply-btn"
          >
            <SystemSymbol name="arrow.clockwise" size={15} />
            <span>{reapplyingId === item.id ? "Отправка..." : "Подать повторно"}</span>
          </button>
        </div>
      ) : null}
    </article>
  );
}
