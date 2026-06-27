import { Cell, Navigation } from "@telegram-apps/telegram-ui";

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
      <Cell
        before={
          <ServiceLogo
            serviceSlug={family.service_slug}
            serviceName={family.service_name}
            familyType={family.family_type}
            size={40}
          />
        }
        subtitle={`${family.member_share_kzt.toLocaleString("ru-KZ")} ₸ · ${family.free_slots} ${slotLabel(family.free_slots)} · ${periodLabels[family.period]}`}
        description={`Оплата ${formatDate(family.next_payment_date)} · ${family.owner.first_name}`}
        after={<Navigation />}
        multiline
        data-testid="open-family-button"
        onClick={onOpen}
      >
        {family.service_name}
        {family.service_variant ? ` ${family.service_variant}` : ""}
        <span className={`type-label type-label-${family.family_type}`}>
          {familyKindLabels[family.family_type]}
        </span>
      </Cell>
      <div className="family-list-item-action-row">
        <StatusBadge status={family.status} />
        <button
          type="button"
          data-testid="send-request-button"
          disabled={busy !== null}
          onClick={onRequest}
        >
          Заявка
        </button>
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