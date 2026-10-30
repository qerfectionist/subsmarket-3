import { FamilyListingCard } from "../ListingCard";
import type { Family, FamilyCreate, FamilyService } from "../../types";
import { calculatePreviewShare } from "./createFamilyForm";

/** Who the preview card shows as the organiser. */
export type PreviewOwner = { avatar_name: string; photo_url?: string | null };

/**
 * The family as the Market will show it: the real listing card, only to look
 * at. Only the fields the card reads are filled; the rest of a family does not
 * exist yet.
 */
export function CreateFamilyPreview({
  form,
  service,
  owner
}: {
  form: FamilyCreate;
  service: FamilyService;
  owner: PreviewOwner;
}) {
  const isTariff = service.family_type === "tariff";
  const preview = {
    id: "preview",
    family_type: isTariff ? "tariff" : "subscription",
    service_slug: service.slug,
    service_name: service.name,
    service_variant: service.variant ?? null,
    plan_name: isTariff ? form.plan_name?.trim() || "Название тарифа" : null,
    max_members: form.max_members,
    free_slots: Math.max(0, form.max_members - 1),
    period: form.period,
    member_share_kzt: calculatePreviewShare(form.total_price_kzt, form.max_members),
    owner
  } as unknown as Family;
  return (
    <div className="create-terms-preview-card" aria-hidden="true">
      <FamilyListingCard family={preview} isOwner onClick={() => undefined} testId="create-preview-card" />
    </div>
  );
}
