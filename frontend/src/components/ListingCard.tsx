import type { ReactNode } from "react";

import { ListingAuthor } from "./ListingAuthor";
import { SystemSymbol } from "./SystemSymbol";
import { ServiceLogo } from "./branding";
import { familyTitle } from "../format";
import type { AccountListing, Family, MarketplaceListing, PublicOwner } from "../types";

type Author = Pick<PublicOwner, "avatar_name"> & { photo_url?: string | null };

export function ListingCard({
  title, subtitle, price, unit, serviceSlug, serviceName, owner, detail,
  onClick, testId, familyId, familyType, label
}: {
  title: string;
  subtitle?: string;
  price: number;
  unit?: string;
  serviceSlug?: string;
  serviceName: string;
  owner: Author;
  detail?: ReactNode;
  onClick: () => void;
  testId?: string;
  familyId?: string;
  familyType?: string;
  label?: string;
}) {
  return (
    <button
      className="sm-listing"
      type="button"
      onClick={onClick}
      data-testid={testId}
      data-family-id={familyId}
      data-family-type={familyType}
      aria-label={label}
    >
      <span className="sm-listing-main">
        <ServiceLogo serviceSlug={serviceSlug} serviceName={serviceName} size={40} />
        <span className="sm-listing-copy">
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </span>
        <span className="sm-listing-price">
          <strong>{price.toLocaleString("ru-KZ")} ₸</strong>
          {unit ? <span>{unit}</span> : null}
        </span>
      </span>
      <span className="sm-listing-footer">
        <ListingAuthor owner={owner} />
        {detail ? <span className="sm-listing-detail">{detail}</span> : null}
      </span>
    </button>
  );
}

export function FamilyListingCard({
  family, status, onClick, testId = "family-card"
}: {
  family: Family;
  status?: string | null;
  onClick: () => void;
  testId?: string;
}) {
  const title = family.family_type === "tariff"
    ? family.plan_name || family.service_variant || family.service_name
    : familyTitle(family);
  const capacity = Math.max(0, family.max_members);
  const free = Math.min(capacity, Math.max(0, family.free_slots));
  const capacityLabel = `Свободно ${free} из ${capacity} мест`;
  const kind = family.family_type === "tariff" ? "Семейный тариф" : "Семейная подписка";
  const unit = family.period === "yearly" ? "в год" : "в месяц";
  return (
    <ListingCard
      title={title}
      subtitle={kind}
      price={family.member_share_kzt}
      unit={unit}
      serviceSlug={family.service_slug}
      serviceName={family.service_name}
      owner={family.owner}
      onClick={onClick}
      testId={testId}
      familyId={family.id}
      familyType={family.family_type}
      label={`Открыть ${kind.toLowerCase()} ${title}, ${family.member_share_kzt} ₸ ${unit}, владелец ${family.owner.avatar_name}, ${capacityLabel}${status ? ", " + status : ""}`}
      detail={status === "Вы владелец" ? (
        <span className="sm-owner-status">
          <SystemSymbol name="crown" size="sm" />
          <span>Вы владелец</span>
        </span>
      ) : status || (
        <span className="sm-capacity" role="img" aria-label={capacityLabel} title={capacityLabel}>
          {capacity > 8 ? <small>{free}/{capacity}</small> : Array.from({ length: capacity }, (_, index) => (
            <span key={index} className={index >= capacity - free ? "is-free" : ""} />
          ))}
        </span>
      )}
    />
  );
}

const listingStatus = { active: "Опубликовано", paused: "Скрыто", expired: "Срок истёк", archived: "В архиве" };

export function AccountListingCard({ listing, onClick, showStatus = false, testId = "account-listing-card", formatLabel = "Готовый аккаунт" }: {
  listing: AccountListing;
  onClick: () => void;
  showStatus?: boolean;
  testId?: string;
  formatLabel?: string;
}) {
  const description = listing.description?.trim().toLocaleLowerCase();
  const detectedFormat = description === "на личный аккаунт"
    ? "На личный аккаунт"
    : description === "готовый аккаунт"
      ? "Готовый аккаунт"
      : formatLabel;
  return (
    <ListingCard
      title={listing.title}
      subtitle="Подписка"
      serviceName={listing.service.name}
      serviceSlug={listing.service.slug}
      price={listing.price_kzt}
      owner={listing.owner}
      onClick={onClick}
      testId={testId}
      detail={showStatus ? listingStatus[listing.status] : detectedFormat}
    />
  );
}

export function GigabytesListingCard({ listing, onClick, showStatus = false, testId = "gigabytes-listing-card" }: {
  listing: MarketplaceListing;
  onClick: () => void;
  showStatus?: boolean;
  testId?: string;
}) {
  const validity = listing.operator.validity_days
    ? `${listing.operator.validity_days} ${listing.operator.validity_days === 1 ? "день" : "дней"}`
    : undefined;
  return (
    <ListingCard
      title={listing.operator.name}
      subtitle="Гигабайты"
      serviceSlug={`${listing.operator.slug}-family-tariff`}
      serviceName={listing.operator.name}
      price={listing.price_per_gb_kzt}
      unit="за 1 ГБ"
      owner={listing.owner}
      detail={showStatus ? listingStatus[listing.status] : validity ? `Действует ${validity}` : undefined}
      onClick={onClick}
      testId={testId}
    />
  );
}
