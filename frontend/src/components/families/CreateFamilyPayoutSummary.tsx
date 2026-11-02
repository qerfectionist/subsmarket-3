import { triggerTelegramSelection } from "../../telegram";
import { SystemSymbol } from "../SystemSymbol";

/**
 * «Показывать в Маркете» as a settings row: an icon tile, the title with one
 * short line under it, the switch on the right. Off, the family is found only
 * by the owner's invite link (the backend's is_search_visible).
 */
export function CreateFamilyVisibility({
  visible,
  locked,
  onChange
}: {
  visible: boolean;
  locked: boolean;
  onChange: (visible: boolean) => void;
}) {
  return (
    <section className="create-payout-block" aria-label="Показывать в Маркете" data-testid="create-visibility">
      <div className="create-switch-row" data-locked={locked || undefined}>
        <span className="create-switch-icon" aria-hidden="true">
          <SystemSymbol name="square.grid.2x2" size={18} />
        </span>
        <span className="create-switch-text">
          <span id="create-visibility-label">Показывать в Маркете</span>
          <small>{visible ? "Семью увидят все" : "Только по ссылке-приглашению"}</small>
        </span>
        <button
          type="button"
          role="switch"
          className="create-switch"
          data-testid="create-visibility-switch"
          aria-checked={visible}
          aria-labelledby="create-visibility-label"
          disabled={locked}
          onClick={() => {
            triggerTelegramSelection();
            onChange(!visible);
          }}
        >
          <span aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
