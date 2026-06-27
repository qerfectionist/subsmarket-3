import { useState } from "react";

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
      <select
        aria-label="Причина удаления"
        data-testid="remove-member-reason"
        value={reason}
        onChange={(event) =>
          setReason(event.target.value as FamilyMemberRemovalReason)
        }
      >
        {Object.entries(memberRemovalReasonLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="danger"
        data-testid="remove-member-button"
        onClick={() => void onRemove(member, reason)}
      >
        Удалить
      </button>
    </div>
  );
}