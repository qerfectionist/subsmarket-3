import { ListingAuthor } from "../ListingAuthor";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { Button as AppButton } from "../ui";
import { formatDate } from "../../format";
import { showTelegramConfirm } from "../../telegram";
import type { AccountListing } from "../../types";

const formatKzt = (value: number) => `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;

export function AccountsListingDetails({
  listing,
  loading,
  busy,
  onRequest,
  onEdit,
  onPause,
  onResume,
  onRenew,
  onArchive
}: {
  listing: AccountListing | null;
  loading: boolean;
  busy: string | null;
  onRequest: (id: string) => void;
  onEdit: (listing: AccountListing) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRenew: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  if (loading || !listing) {
    return (
      <div className="gb-empty sm-market-empty">
        <SystemSymbol name="clock" size={28} />
        <h3>Открываем объявление...</h3>
      </div>
    );
  }

  return (
    <section className="gb-stack">
      <article className="gb-detail-card family-overview-card" data-testid="account-detail-card">
        <div className="gb-detail-head family-overview-head">
          <ServiceLogo
            serviceSlug={listing.service.slug}
            serviceName={listing.service.name}
            size={48}
          />
          <div className="gb-detail-title-block">
            <h2>{listing.title}</h2>
            <strong className="gb-detail-price">{formatKzt(listing.price_kzt)}</strong>
          </div>
        </div>

        {listing.description ? (
          <div className="gb-detail-description">
            <p>{listing.description}</p>
          </div>
        ) : null}

        <div className="gb-detail-meta-row">
          <div className="gb-detail-meta-item">
            <SystemSymbol name="calendar" size={17} />
            <span>Объявление до {formatDate(listing.expires_at)}</span>
          </div>
        </div>

        <ListingAuthor className="gb-detail-author" owner={listing.owner} />
      </article>

      {!listing.is_owner ? (
        <div className="gb-buy-box">
          <button
            className="gb-primary-button"
            data-testid="account-submit-request"
            disabled={busy !== null || listing.status !== "active"}
            onClick={() => onRequest(listing.id)}
            type="button"
          >
            Связаться с продавцом
          </button>
          <p className="gb-safety-note">
            После принятия запроса продавец и покупатель связываются в Telegram. Условия, оплату и передачу доступа они согласуют самостоятельно.
          </p>
        </div>
      ) : (
        <div className="gb-owner-actions">
          <AppButton
            variant="tertiary"
            disabled={busy !== null}
            onClick={() => onEdit(listing)}
          >
            <SystemSymbol name="pencil" size={18} />
            Изменить
          </AppButton>
          {listing.status === "active" ? (
            <AppButton
              variant="tertiary"
              disabled={busy !== null}
              onClick={() => onPause(listing.id)}
            >
              <SystemSymbol name="pause.circle" size={18} />
              Скрыть
            </AppButton>
          ) : listing.status === "paused" ? (
            <AppButton
              variant="tertiary"
              disabled={busy !== null}
              onClick={() => onResume(listing.id)}
            >
              <SystemSymbol name="checkmark" size={18} />
              Показать
            </AppButton>
          ) : null}
          {listing.can_renew ? (
            <AppButton
              variant="tertiary"
              disabled={busy !== null}
              onClick={() => onRenew(listing.id)}
            >
              <SystemSymbol name="arrow.clockwise" size={18} />
              Продлить
            </AppButton>
          ) : null}
          <AppButton
            variant="tertiary"
            disabled={busy !== null}
            onClick={async () => {
              if (
                await showTelegramConfirm(
                  "Убрать объявление? Неотвеченные запросы закроются."
                )
              ) {
                onArchive(listing.id);
              }
            }}
          >
            <SystemSymbol name="xmark" size={18} />
            Убрать
          </AppButton>
        </div>
      )}
    </section>
  );
}
