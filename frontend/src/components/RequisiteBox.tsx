import { useState } from "react";
import { Button as WorldButton, Typography } from "@worldcoin/mini-apps-ui-kit-react";

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
      <Typography as="p" variant="body" level={3}>
        <Typography as="strong" variant="subtitle" level={3}>
          {bankLabel}
        </Typography>
        <br />
        {phoneDisplay}
      </Typography>
      <div className="row-actions">
        <WorldButton
          type="button"
          size="sm"
          variant="secondary"
          fullWidth
          data-testid="requisite-toggle-button"
          onClick={handleReveal}
        >
          {revealed ? "Скрыть" : "Показать"}
        </WorldButton>
        {revealed ? (
          <WorldButton
            type="button"
            size="sm"
            variant="tertiary"
            fullWidth
            data-testid="requisite-copy-button"
            onClick={handleCopy}
          >
            {copied ? "Скопировано" : "Копировать"}
          </WorldButton>
        ) : null}
      </div>
    </div>
  );
}
