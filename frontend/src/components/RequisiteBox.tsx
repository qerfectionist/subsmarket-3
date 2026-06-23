import { useState } from "react";

import { Button } from "@telegram-apps/telegram-ui";

import { bankLabels } from "../labels";
import type { PaymentRequisite } from "../types";

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  const lastTwo = digits.slice(-2);
  return `+7 *** *** ** ${lastTwo}`;
}

export function RequisiteBox({ requisite }: { requisite: PaymentRequisite }) {
  const [revealed, setRevealed] = useState(false);
  const bankLabel = bankLabels[requisite.bank] ?? requisite.bank;
  const phoneDisplay = revealed ? requisite.phone : maskPhone(requisite.phone);

  return (
    <div className="requisite-box">
      <strong>Реквизиты:</strong> {bankLabel} · {phoneDisplay}
      <Button
        type="button"
        size="s"
        mode="plain"
        onClick={() => setRevealed(!revealed)}
      >
        {revealed ? "Скрыть" : "Показать"}
      </Button>
    </div>
  );
}
