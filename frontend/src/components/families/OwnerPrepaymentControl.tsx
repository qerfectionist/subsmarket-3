import { useState } from "react";
import {
  Button as AppButton,
  Select,
  Typography
} from "../ui";

import type { Family, FamilyMember } from "../../types";

export function OwnerPrepaymentControl({
  family,
  member,
  onRecord
}: {
  family: Family;
  member: FamilyMember;
  onRecord: (member: FamilyMember, periods: number) => Promise<unknown>;
}) {
  const [periods, setPeriods] = useState(1);
  const options = family.period === "yearly" ? [1, 2, 3] : [1, 2, 3, 6, 12];

  return (
    <div className="owner-prepayment-control">
      <div data-testid="owner-prepayment-periods" data-value={String(periods)}>
        <Select
          value={String(periods)}
          placeholder="Оплачено будущих периодов"
          onChange={(value) => setPeriods(Number(value))}
          options={options.map((value) => ({
            value: String(value),
            label: String(value)
          }))}
        />
      </div>
      <AppButton
        type="button"
        variant="secondary"
        data-testid="owner-record-prepayment-button"
        onClick={() => void onRecord(member, periods)}
      >
        Отметить
      </AppButton>
      <Typography as="small" variant="body" level={4}>
        Используйте только после договоренности и фактического перевода вне
        SubsMarket.
      </Typography>
    </div>
  );
}
