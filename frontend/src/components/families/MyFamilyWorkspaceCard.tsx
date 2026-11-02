import { FamilyListingCard } from "../ListingCard";
import { memberCardStatus } from "../../format";
import { triggerTelegramImpact } from "../../telegram";
import type { MyFamily } from "../../types";

export function MyFamilyWorkspaceCard({
  item,
  onOpenFamily
}: {
  item: MyFamily;
  onOpenFamily: (familyId: string) => void;
  [key: string]: unknown;
}) {
  return (
    <div
      className="my-family-preview"
      data-family-id={item.family.id}
      data-testid="family-workspace"
      key={item.membership.id}
    >
      <FamilyListingCard
        family={item.family}
        isOwner={item.membership.role === "owner"}
        status={item.membership.role === "owner" ? null : memberCardStatus(item)}
        onClick={() => {
          triggerTelegramImpact("light");
          onOpenFamily(item.family.id);
        }}
      />
    </div>
  );
}
