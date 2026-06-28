import { Button as WorldButton, Chip, ListItem } from "@worldcoin/mini-apps-ui-kit-react";

import { ServiceLogo } from "../branding";
import { formatDate } from "../../format";
import { familyKindLabels, periodLabels } from "../../labels";
import type { Family } from "../../types";
import { StatusBadge } from "../StatusBadge";

export function FamilyListItem({
  family,
  busy,
  onOpen,
  onRequest
}: {
  family: Family;
  busy: string | null;
  onOpen: () => void;
  onRequest: () => void;
}) {
  return (
    <article
      className="family-list-item"
      data-family-id={family.id}
      data-family-type={family.family_type}
      data-testid="family-card"
    >
      <ListItem
        label={`${family.service_name}${family.service_variant ? ` ${family.service_variant}` : ""}`}
        description={`${family.member_share_kzt.toLocaleString("ru-KZ")} ₸ · ${family.free_slots} ${slotLabel(family.free_slots)} · ${periodLabels[family.period]} · ${formatDate(family.next_payment_date)}`}
        startAdornment={
          <ServiceLogo
            serviceSlug={family.service_slug}
            serviceName={family.service_name}
            familyType={family.family_type}
            size={40}
          />
        }
        endAdornment={<Chip label={familyKindLabels[family.family_type]} variant="default" />}
        data-testid="open-family-button"
        onClick={onOpen}
      />
      <div className="family-list-item-action-row">
        <StatusBadge status={family.status} />
        <WorldButton
          type="button"
          size="sm"
          data-testid="send-request-button"
          disabled={busy !== null}
          onClick={onRequest}
        >
          Заявка
        </WorldButton>
      </div>
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
