import { useState } from "react";
import {
  Button as WorldButton,
  Select
} from "@worldcoin/mini-apps-ui-kit-react";

import type { FamilyMember, FamilyMemberRemovalReason } from "../../types";
import { memberRemovalReasonLabels } from "../../labels";

export function OwnerMemberRemovalControl({
  member,
  onRemove
}: {
  member: FamilyMember;
  onRemove: (
    member: FamilyMember,
    reason: FamilyMemberRemovalReason
  ) => Promise<unknown>;
}) {
  const [reason, setReason] = useState<FamilyMemberRemovalReason>("other");

  return (
    <div className="owner-removal-control">
      <div data-testid="remove-member-reason" data-value={reason}>
        <Select
          aria-label="Причина удаления"
          value={reason}
          onChange={(value) => setReason(value as FamilyMemberRemovalReason)}
          options={Object.entries(memberRemovalReasonLabels).map(([value, label]) => ({
            value,
            label
          }))}
        />
      </div>
      <WorldButton
        type="button"
        variant="secondary"
        data-testid="remove-member-button"
        onClick={() => void onRemove(member, reason)}
      >
        Удалить
      </WorldButton>
    </div>
  );
}
