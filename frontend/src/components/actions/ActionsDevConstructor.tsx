import { SystemSymbol } from "../SystemSymbol";
import type {
  Family,
  OwnerFamilyRequest,
  AccountRequest,
  MarketplaceListingRequest,
  FamilyRequest
} from "../../types";

export const DEV_TEST_CARDS_STORAGE_KEY = "sm_dev_test_cards_v1";

export interface DevTestCardsState {
  candidates: Array<{ family: Family; request: OwnerFamilyRequest }>;
  sellerAccounts: AccountRequest[];
  buyerAccounts: AccountRequest[];
  sellerGb: MarketplaceListingRequest[];
  buyerGb: MarketplaceListingRequest[];
  buyerFamilies: FamilyRequest[];
}

export interface ActionsDevConstructorProps {
  isOpen: boolean;
  totalCount: number;
  timerPrototype: 1 | 2 | 3 | 4;
  onSelectTimerPrototype: (proto: 1 | 2 | 3 | 4) => void;
  onAddDevFamily: () => void;
  onAddDevAccount: () => void;
  onAddDevGb: () => void;
  onAddAllCategories: () => void;
  onClearAll: () => void;
}

export function ActionsDevConstructor({
  isOpen,
  totalCount,
  timerPrototype,
  onSelectTimerPrototype,
  onAddDevFamily,
  onAddDevAccount,
  onAddDevGb,
  onAddAllCategories,
  onClearAll
}: ActionsDevConstructorProps) {
  if (!isOpen) return null;

  return (
    <div className="actions-dev-constructor" data-testid="actions-dev-constructor">
      <div className="actions-dev-constructor-header">
        <span className="actions-dev-constructor-title">
          <SystemSymbol name="tuning" size={14} />
          Конструктор карточек
        </span>
        <span className="actions-dev-constructor-badge">
          {totalCount > 0 ? `${totalCount} шт` : "0 шт"}
        </span>
      </div>
      <div className="actions-dev-constructor-grid">
        <button
          type="button"
          className="actions-dev-chip"
          data-testid="dev-add-family"
          onClick={onAddDevFamily}
        >
          <span className="actions-dev-chip-icon">👨‍👩‍👧</span>
          <span>+ Подписка</span>
        </button>
        <button
          type="button"
          className="actions-dev-chip"
          data-testid="dev-add-account"
          onClick={onAddDevAccount}
        >
          <span className="actions-dev-chip-icon">👤</span>
          <span>+ Аккаунт</span>
        </button>
        <button
          type="button"
          className="actions-dev-chip"
          data-testid="dev-add-gb"
          onClick={onAddDevGb}
        >
          <span className="actions-dev-chip-icon">📶</span>
          <span>+ Гигабайты</span>
        </button>
      </div>
      <div className="actions-dev-prototype-bar">
        <span className="actions-dev-prototype-title">
          <SystemSymbol name="clock" size={13} />
          Режим таймера карточек:
        </span>
        <div className="actions-dev-prototype-options">
          <button
            type="button"
            className={`actions-dev-proto-btn${timerPrototype === 1 ? " is-active" : ""}`}
            data-testid="dev-proto-btn-1"
            onClick={() => onSelectTimerPrototype(1)}
          >
            1. Каноничный
          </button>
          <button
            type="button"
            className={`actions-dev-proto-btn${timerPrototype === 2 ? " is-active" : ""}`}
            data-testid="dev-proto-btn-2"
            onClick={() => onSelectTimerPrototype(2)}
          >
            2. Контекст
          </button>
          <button
            type="button"
            className={`actions-dev-proto-btn${timerPrototype === 3 ? " is-active" : ""}`}
            data-testid="dev-proto-btn-3"
            onClick={() => onSelectTimerPrototype(3)}
          >
            3. «Разово»
          </button>
          <button
            type="button"
            className={`actions-dev-proto-btn${timerPrototype === 4 ? " is-active" : ""}`}
            data-testid="dev-proto-btn-4"
            onClick={() => onSelectTimerPrototype(4)}
          >
            4. Под ценой
          </button>
        </div>
      </div>
      <div className="actions-dev-constructor-footer">
        <button
          type="button"
          className="actions-dev-btn-all"
          data-testid="dev-add-all-categories"
          onClick={onAddAllCategories}
        >
          <span>⚡ Все 3 категории</span>
        </button>
        {totalCount > 0 && (
          <button
            type="button"
            className="actions-dev-btn-clear"
            data-testid="dev-clear-all"
            onClick={onClearAll}
          >
            <span>🗑 Очистить</span>
          </button>
        )}
      </div>
    </div>
  );
}
