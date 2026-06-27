import { useState } from "react";

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
      <label>
        Оплачено будущих периодов
        <select
          data-testid="owner-prepayment-periods"
          value={periods}
          onChange={(event) => setPeriods(Number(event.target.value))}
        >
          {options.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="secondary"
        data-testid="owner-record-prepayment-button"
        onClick={() => void onRecord(member, periods)}
      >
        Отметить
      </button>
      <small>
        Используйте только после договоренности и фактического перевода вне
        SubsMarket.
      </small>
    </div>
  );
}