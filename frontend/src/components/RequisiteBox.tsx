import { useState } from "react";

import { Button } from "@telegram-apps/telegram-ui";

import { bankLabels } from "../labels";
import { triggerTelegramImpact, triggerTelegramNotification } from "../telegram";
import type { PaymentRequisite } from "../types";

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  const lastTwo = digits.slice(-2);
  return `+7 *** *** ** ${lastTwo}`;
}

export function RequisiteBox({ requisite }: { requisite: PaymentRequisite }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const bankLabel = bankLabels[requisite.bank] ?? requisite.bank;
  const phoneDisplay = revealed ? requisite.phone : maskPhone(requisite.phone);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(requisite.phone);
      setCopied(true);
      triggerTelegramNotification("success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      triggerTelegramNotification("error");
    }
  };

  const handleReveal = () => {
    setRevealed(!revealed);
    triggerTelegramImpact("light");
  };

  return (
    <div className="requisite-box">
      <strong>Реквизиты:</strong> {bankLabel} · {phoneDisplay}
      <Button
        type="button"
        size="s"
        mode="plain"
        data-testid="requisite-toggle-button"
        onClick={handleReveal}
      >
        {revealed ? "Скрыть" : "Показать"}
      </Button>
      {revealed && (
        <Button
          type="button"
          size="s"
          mode="plain"
          data-testid="requisite-copy-button"
          onClick={handleCopy}
        >
          {copied ? "Скопировано" : "Копировать"}
        </Button>
      )}
    </div>
  );
}
