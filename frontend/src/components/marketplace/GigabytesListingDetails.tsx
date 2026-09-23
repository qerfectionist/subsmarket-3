import { useEffect, useState } from "react";
import { ListingAuthor } from "../ListingAuthor";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { Button as AppButton } from "../ui";
import { formatDate } from "../../format";
import type { MarketplaceListing } from "../../types";

const MINIMUM_GB_ORDER = 1;

function formatKzt(value: number) {
  return `${value.toLocaleString("ru-KZ")} ₸`;
}

export function GigabytesListingDetails({
  listing,
  loading,
  busy,
  onBuy,
  onEdit,
  onPause,
  onResume,
  onRenew,
  onArchive
}: {
  listing: MarketplaceListing | null;
  loading: boolean;
  busy: string | null;
  onBuy: (id: string, amountGb: string) => Promise<void>;
  onEdit: (listing: MarketplaceListing) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRenew: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const [amountGb, setAmountGb] = useState("5");
  useEffect(() => setAmountGb("5"), [listing?.id]);
  if (loading || !listing) {
    return (
      <div className="gb-empty sm-market-empty">
        <SystemSymbol name="clock" size={28} />
        <h3>Открываем объявление...</h3>
      </div>
    );
  }

  const minimumAmount = Math.max(
    MINIMUM_GB_ORDER,
    Number(listing.operator.min_lot_gb ?? 0)
  );
  const selectedAmount = amountGb;
  const totalPrice = Math.round(
    Number(selectedAmount) * listing.price_per_gb_kzt
  );

  return (
    <section className="gb-stack">
      <article className="gb-detail-card family-overview-card" data-testid="gigabytes-detail-card">
        <div className="gb-detail-head family-overview-head">
          <ServiceLogo
            serviceSlug={listing.operator.slug + "-family-tariff"}
            serviceName={listing.operator.name}
            size={48}
          />
          <div className="gb-detail-title-block">
            <span className="gb-detail-service-name">{listing.operator.name}</span>
            <h2 className="gb-detail-price">{formatKzt(listing.price_per_gb_kzt)} за 1 ГБ</h2>
          </div>
        </div>

        {listing.description ? (
          <div className="gb-detail-description">
            <p>{listing.description}</p>
          </div>
        ) : null}

        <ListingAuthor className="gb-detail-author" owner={listing.owner} />
      </article>

      <article className="gb-info-card">
        <div className="gb-info-row">
          <SystemSymbol name="calendar" size={17} />
          <span>Объявление до {formatDate(listing.expires_at)}</span>
        </div>
        {listing.operator.validity_days ? (
          <div className="gb-info-row">
            <SystemSymbol name="info.circle" size={17} />
            <span>Переданные ГБ действуют {listing.operator.validity_days} дней</span>
          </div>
        ) : null}
        {listing.operator.conditions ? (
          <div className="gb-info-note">
            <p>{listing.operator.conditions}</p>
          </div>
        ) : null}
        {listing.operator.fee_note ? (
          <div className="gb-info-note">
            <p>{listing.operator.fee_note}</p>
          </div>
        ) : null}
      </article>

      {!listing.is_owner ? (
        <div className="gb-buy-box">
          <label className="ui-field">
            <span>Сколько ГБ</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={selectedAmount}
              onKeyDown={(event) => {
                if (event.key.length === 1 && !/\d/.test(event.key)) {
                  event.preventDefault();
                }
              }}
              onChange={(event) => {
                const integerValue = event.target.value.match(/^\d*/)?.[0] ?? "";
                setAmountGb(integerValue);
              }}
            />
          </label>

          <div className="gb-amount-presets" aria-label="Быстрый выбор количества">
            {[3, 5, 10].map((amount) => (
              <button
                key={amount}
                type="button"
                className={selectedAmount === String(amount) ? "active" : ""}
                onClick={() => setAmountGb(String(amount))}
              >
                {amount} ГБ
              </button>
            ))}
          </div>

          <div className="gb-total-price">
            <strong>Итого: {formatKzt(totalPrice)}</strong>
          </div>

          <button
            className="gb-primary-button"
            data-testid="marketplace-submit-request"
            type="button"
            disabled={
              busy !== null ||
              listing.status !== "active" ||
              !Number.isInteger(Number(selectedAmount)) ||
              Number(selectedAmount) < minimumAmount ||
              (listing.operator.max_lot_gb !== null &&
                Number(selectedAmount) > Number(listing.operator.max_lot_gb))
            }
            onClick={() => {
              void onBuy(listing.id, selectedAmount);
            }}
          >
            Отправить заявку
          </button>
        </div>
      ) : (
        <div className="gb-owner-actions">
          <AppButton variant="tertiary" disabled={busy !== null} onClick={() => onEdit(listing)}>
            <SystemSymbol name="pencil" size={18} />
            Изменить
          </AppButton>
          {listing.status === "active" ? (
            <AppButton variant="tertiary" disabled={busy !== null} onClick={() => onPause(listing.id)}>
              <SystemSymbol name="pause.circle" size={18} />
              Скрыть
            </AppButton>
          ) : listing.status === "paused" ? (
            <AppButton variant="tertiary" disabled={busy !== null} onClick={() => onResume(listing.id)}>
              <SystemSymbol name="checkmark" size={18} />
              Показать
            </AppButton>
          ) : null}
          {listing.can_renew ? (
            <AppButton variant="tertiary" disabled={busy !== null} onClick={() => onRenew(listing.id)}>
              <SystemSymbol name="arrow.clockwise" size={18} />
              Продлить
            </AppButton>
          ) : null}
          <AppButton variant="tertiary" disabled={busy !== null} onClick={() => onArchive(listing.id)}>
            <SystemSymbol name="xmark" size={18} />
            Убрать
          </AppButton>
        </div>
      )}
      <p className="gb-safety-note">
        SubsMarket не принимает оплату и не подтверждает перевод ГБ. После принятия заявки продавец пишет покупателю в Telegram.
      </p>
    </section>
  );
}
