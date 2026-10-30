import { bankLabels } from "../../labels";
import type { FamilyCreate } from "../../types";
import { RequisiteBox } from "../RequisiteBox";
import { calculatePreviewShare } from "./createFamilyForm";

/**
 * «Так увидят участники при оплате»: the real requisites box a member gets,
 * filled from this form, only to look at. Like the Market card on top, it is
 * the actual component, so it cannot drift from what members see.
 */
export function CreateFamilyRequisitePreview({ form, locked }: { form: FamilyCreate; locked: boolean }) {
  const name = form.payment_recipient_name?.trim();
  return (
    <section
      className="create-payout-block"
      aria-label="Так увидят участники при оплате"
      data-testid="create-requisite-preview"
    >
      <span className="create-terms-caption" data-locked={locked || undefined}>
        Так увидят участники при оплате
      </span>
      <div className="create-requisite-preview" data-locked={locked || undefined} aria-hidden="true" inert>
        <RequisiteBox
          requisite={{
            bank: form.payment_bank,
            phone: form.payment_phone || "+7 700 123 45 67",
            recipient_name: name || null
          }}
        />
      </div>
    </section>
  );
}

/**
 * What the family brings in once every place is taken: the share times the
 * other members, on the day and to the bank set here. A number, not a lesson,
 * so it stays worth reading every time.
 */
export function CreateFamilyIncome({ form, bankChosen }: { form: FamilyCreate; bankChosen: boolean }) {
  const share = calculatePreviewShare(form.total_price_kzt, form.max_members);
  const members = Math.max(0, form.max_members - 1);
  const yearly = form.period === "yearly";
  const total = (share * members).toLocaleString("ru-RU");
  const when = yearly ? "раз в год" : `${form.payment_day}-го`;
  const where = bankChosen ? ` на ${bankLabels[form.payment_bank]}` : "";
  return (
    <section className="create-payout-block" aria-label="Сколько вы будете получать" data-testid="create-income">
      <div className="create-income">
        <span className="create-income-label">Когда все места заняты, вам придёт</span>
        <strong className="create-income-value">
          {total} ₸ <span>{yearly ? "в год" : "в месяц"}</span>
        </strong>
        <small className="create-income-math">
          {members} × {share.toLocaleString("ru-RU")} ₸, {when}
          {where}
        </small>
      </div>
    </section>
  );
}
