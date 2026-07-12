import { ListItem } from "@worldcoin/mini-apps-ui-kit-react";

import { periodLabels } from "../../labels";
import type { Family } from "../../types";
import { ServiceLogo } from "../branding";

export function FamilyListItem({
  family,
  onOpen,
  onRequest: _onRequest,
  compact = false
}: {
  family: Family;
  busy: string | null;
  onOpen: () => void;
  onRequest: () => void;
  compact?: boolean;
}) {
  const title = `${family.service_name}${family.service_variant ? ` ${family.service_variant}` : ""}`;
  const description = `${family.free_slots} ${slotLabel(family.free_slots)} свободно`;
  const period = family.period === "monthly" ? "/мес" : `/${periodLabels[family.period]}`;
  const price = `${family.member_share_kzt.toLocaleString("ru-KZ")}₸`;

  if (compact) {
    return (
      <article
        className="family-list-item family-list-item-compact"
        data-family-id={family.id}
        data-family-type={family.family_type}
        data-testid="family-card"
      >
        <button type="button" data-testid="open-family-button" onClick={onOpen}>
          <ServiceLogo
            serviceSlug={family.service_slug}
            serviceName={family.service_name}
            familyType={family.family_type}
            size={36}
          />
          <span className="family-compact-copy">
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
          <span className="family-row-price">
            <strong>{price}</strong>
            <small>{period}</small>
          </span>
        </button>
      </article>
    );
  }

  return (
    <article
      className="family-list-item"
      data-family-id={family.id}
      data-family-type={family.family_type}
      data-testid="family-card"
    >
      <ListItem
        label={title}
        description={description}
        startAdornment={
          <ServiceLogo
            serviceSlug={family.service_slug}
            serviceName={family.service_name}
            familyType={family.family_type}
            size={44}
          />
        }
        endAdornment={
          <span className="family-row-price">
            <strong>{price}</strong>
            <small>{period}</small>
          </span>
        }
        data-testid="open-family-button"
        onClick={onOpen}
      />
    </article>
  );
}

function slotLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "место";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "места";
  return "мест";
}
