import { bankLabels } from "../../labels";
import type { FamilyCreate } from "../../types";
import { calculatePreviewShare } from "./createFamilyForm";

/**
 * What happens after creation: the three things that follow once the family
 * exists (no caption, the numbered rows speak for themselves), with this family's own share, day and bank, so the button below is
 * not a leap into the unknown.
 */
export function CreateFamilyNextSteps({ form, bankChosen }: { form: FamilyCreate; bankChosen: boolean }) {
  const share = calculatePreviewShare(form.total_price_kzt, form.max_members).toLocaleString("ru-RU");
  const bank = bankChosen ? bankLabels[form.payment_bank] : "ваш банк";
  const when = form.period === "yearly" ? "Раз в год" : `Каждый месяц ${form.payment_day}-го`;
  const steps = [
    { title: "Семья появится в Маркете", text: "Её увидят такой, как карточка выше." },
    { title: "Вы подтверждаете участников", text: "Придут заявки, и вы сами решаете, кого принять." },
    { title: "Участники платят вам", text: `${when} по ${share} ₸ на ${bank}.` }
  ];
  return (
    <section
      className="create-payout-block create-payout-snap-end"
      aria-label="Что будет после создания"
      data-testid="create-next-steps">
      <ol className="create-next-steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="create-next-steps-num" aria-hidden="true">
              {index + 1}
            </span>
            <span className="create-next-steps-body">
              <strong>{step.title}</strong>
              <small>{step.text}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
