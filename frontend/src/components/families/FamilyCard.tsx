import type { ReactNode } from "react";

import { ServiceLogo } from "../branding";
import { formatDate, formatDateTime } from "../../format";
import { familyKindLabels, periodLabels } from "../../labels";
import type { Family } from "../../types";
import { StatusBadge } from "../StatusBadge";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-cell">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function FamilyCard({
  family,
  children,
  embedded
}: {
  family: Family;
  children?: ReactNode;
  embedded?: boolean;
}) {
  return (
    <article
      className={embedded ? "family-card family-card-embedded" : "family-card"}
      data-family-id={family.id}
      data-family-type={family.family_type}
      data-testid="family-card"
    >
      <div className="family-card-head">
        <ServiceLogo
          serviceSlug={family.service_slug}
          serviceName={family.service_name}
          familyType={family.family_type}
          size={48}
        />
        <div className="family-card-head-copy">
          <div className="card-topline">
            <div className="card-topline-left">
              <StatusBadge status={family.status} />
              <span className={`type-label type-label-${family.family_type}`}>
                {familyKindLabels[family.family_type]}
              </span>
            </div>
            <span className="card-period">{periodLabels[family.period]}</span>
          </div>
          <h3 className="family-card-title">
            {family.service_name}
            {family.service_variant ? ` ${family.service_variant}` : ""}
          </h3>
        </div>
      </div>
      <p className="family-card-subtitle">
        {family.description || "Описание пока не добавлено."}
      </p>
      {family.owner_rules ? (
        <p className="family-card-rules">{family.owner_rules}</p>
      ) : null}

      <div className="metrics">
        <Metric
          label="Доля"
          value={`${family.member_share_kzt.toLocaleString("ru-KZ")} ₸`}
        />
        <Metric
          label="Места"
          value={`${family.active_members_count}/${family.max_members}`}
        />
        <Metric label="Свободно" value={String(family.free_slots)} />
      </div>

      <div className="card-footer">
        <span>Оплата: {formatDate(family.next_payment_date)}</span>
        <span>Владелец: {family.owner.first_name}</span>
      </div>

      {family.rounding_delta_kzt > 0 ? (
        <small className="family-card-note">
          Округление: +{family.rounding_delta_kzt} ₸ на всю семью
        </small>
      ) : null}
      {family.status === "closing" && family.closes_at ? (
        <div className="warning">Закрывается {formatDateTime(family.closes_at)}</div>
      ) : null}
      {children ? <div className="card-actions">{children}</div> : null}
    </article>
  );
}