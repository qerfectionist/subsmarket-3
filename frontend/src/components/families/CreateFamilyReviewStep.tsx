import type { ReactNode } from "react";
import { bankLabels } from "../../labels";
import type { FamilyCreate, FamilyService } from "../../types";
import { CreateFamilyPreview, type PreviewOwner } from "./CreateFamilyPreview";
import {
  calculatePreviewShare,
  formatKzt,
  periodPhrase,
  pluralRu,
  type CreateStep
} from "./createFamilyForm";

const CHAT_NAMES = { telegram: "Telegram", whatsapp: "WhatsApp" } as const;

function ReviewRow({
  title,
  testId,
  onEdit,
  children
}: {
  title: string;
  testId: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="create-terms-row create-review-row" data-testid={testId}>
      <div className="create-review-copy">
        <span>{title}</span>
        <strong>{children}</strong>
      </div>
      <button type="button" className="create-payout-edit" data-testid={`${testId}-edit`} onClick={onEdit}>
        Изменить
      </button>
    </div>
  );
}

/**
 * Step 4: the last look before creating. The family as the Market will show
 * it, then what was entered on each step with a way back to change it.
 */
export function CreateFamilyReviewStep({
  form,
  service,
  owner,
  onEdit
}: {
  form: FamilyCreate;
  service: FamilyService;
  owner: PreviewOwner;
  onEdit: (step: CreateStep) => void;
}) {
  const share = calculatePreviewShare(form.total_price_kzt, form.max_members);
  const name = form.payment_recipient_name?.trim();
  return (
    <div className="create-step-body create-payout create-review" data-create-step="review">
      <section className="create-payout-block" aria-label="Так увидят в Маркете" data-testid="create-terms-summary">
        <span className="create-terms-caption">Так увидят в Маркете</span>
        <CreateFamilyPreview form={form} service={service} owner={owner} />
        <small className="create-payout-note">После создания сервис и места не поменять.</small>
      </section>

      <section className="create-payout-block" aria-label="Что вы указали">
        <span className="create-terms-caption">Что вы указали</span>
        <div className="create-terms-group">
          <ReviewRow title="Цена и места" testId="create-review-terms" onEdit={() => onEdit("terms")}>
            {formatKzt(form.total_price_kzt)} {periodPhrase(form.period)} · {form.max_members}{" "}
            {pluralRu(form.max_members, "место", "места", "мест")} · оплата {form.payment_day}-го
            <small>С человека {formatKzt(share)}</small>
          </ReviewRow>
          <ReviewRow title="Куда переводить" testId="create-review-payout" onEdit={() => onEdit("payout")}>
            {bankLabels[form.payment_bank]} · {form.payment_phone}
            <small>{name ? name : "Без имени получателя"}</small>
          </ReviewRow>
          <ReviewRow title="Чат семьи" testId="create-review-chat" onEdit={() => onEdit("payout")}>
            {CHAT_NAMES[form.chat_kind ?? "telegram"]}
          </ReviewRow>
        </div>
        <small className="create-payout-note">
          Номер и имя увидят только участники, которым вы подтвердили доступ.
        </small>
      </section>
    </div>
  );
}
