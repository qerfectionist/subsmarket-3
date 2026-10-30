import { bankLabels } from "../../labels";
import type { FamilyCreate } from "../../types";
import { SystemSymbol } from "../SystemSymbol";
import { calculatePreviewShare } from "./createFamilyForm";

/**
 * What happens after creation, as a short timeline: when, then what, with
 * this family's own share, day and bank. The first point is lit, the line
 * fades towards the later ones, like the «how your trial works» timelines.
 */
export function CreateFamilyNextSteps({ form, bankChosen }: { form: FamilyCreate; bankChosen: boolean }) {
  const share = calculatePreviewShare(form.total_price_kzt, form.max_members).toLocaleString("ru-RU");
  const bank = bankChosen ? bankLabels[form.payment_bank] : "ваш банк";
  const steps = [
    {
      icon: "square.grid.2x2",
      when: "Сразу",
      title: "Семья появится в Маркете",
      text: "Её увидят такой, как карточка выше."
    },
    {
      icon: "person.2.badge.plus",
      when: "Когда придут заявки",
      title: "Вы подтверждаете участников",
      text: "Сами решаете, кого принять."
    },
    {
      icon: "calendar",
      when: form.period === "yearly" ? "Раз в год" : `Каждый месяц, ${form.payment_day}-го`,
      title: "Участники платят вам",
      text: `По ${share} ₸ на ${bank}.`
    }
  ] as const;
  return (
    <section
      className="create-payout-block create-payout-snap-end"
      aria-label="Что будет после создания"
      data-testid="create-next-steps"
    >
      <ol className="create-timeline">
        {steps.map((step) => (
          <li key={step.title}>
            <span className="create-timeline-icon" aria-hidden="true">
              <SystemSymbol name={step.icon} size={16} />
            </span>
            <span className="create-timeline-body">
              <span className="create-timeline-when">{step.when}</span>
              <strong>{step.title}</strong>
              <small>{step.text}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
