import { useState } from "react";
import { ShowcaseCardTolan } from "./ShowcaseCardTolan";
import { ShowcaseCardAcorns } from "./ShowcaseCardAcorns";
import { ShowcaseCardVinted } from "./ShowcaseCardVinted";
import { ShowcaseCardBoxBox } from "./ShowcaseCardBoxBox";
import { SystemSymbol } from "../SystemSymbol";
import { triggerTelegramImpact, triggerTelegramSelection } from "../../telegram";
import "../../styles/cards-showcase.css";

interface CardsShowcaseViewProps {
  onBack?: () => void;
}

type ShowcaseFilter = "all" | "tolan" | "acorns" | "vinted" | "boxbox";

export function CardsShowcaseView({ onBack }: CardsShowcaseViewProps) {
  const [filter, setFilter] = useState<ShowcaseFilter>("all");

  const handleFilterChange = (nextFilter: ShowcaseFilter) => {
    triggerTelegramSelection();
    setFilter(nextFilter);
  };

  return (
    <div className="showcase-container" data-testid="cards-showcase-view">
      {/* Top Header */}
      <div className="showcase-header">
        <div className="showcase-title-row">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {onBack && (
              <button
                type="button"
                onClick={() => {
                  triggerTelegramImpact("light");
                  onBack();
                }}
                className="sc-back-btn"
                aria-label="Назад"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <h1 className="showcase-title">Варианты карточек</h1>
          </div>
          <span className="showcase-badge">4 концепта</span>
        </div>
        <p className="showcase-subtitle">
          Интерактивная витрина карточек SubsMarket на базе референсов Tolan, Acorns, Vinted и Box Box Club.
        </p>
      </div>

      {/* Filter Chips */}
      <div className="showcase-chips" role="tablist" aria-label="Фильтр концептов">
        <button
          type="button"
          className={`showcase-chip${filter === "all" ? " is-active" : ""}`}
          onClick={() => handleFilterChange("all")}
        >
          Все концепты
        </button>
        <button
          type="button"
          className={`showcase-chip${filter === "tolan" ? " is-active" : ""}`}
          onClick={() => handleFilterChange("tolan")}
        >
          1. Слоты семьи (Tolan)
        </button>
        <button
          type="button"
          className={`showcase-chip${filter === "acorns" ? " is-active" : ""}`}
          onClick={() => handleFilterChange("acorns")}
        >
          2. Финансы (Acorns)
        </button>
        <button
          type="button"
          className={`showcase-chip${filter === "vinted" ? " is-active" : ""}`}
          onClick={() => handleFilterChange("vinted")}
        >
          3. Траст (Vinted)
        </button>
        <button
          type="button"
          className={`showcase-chip${filter === "boxbox" ? " is-active" : ""}`}
          onClick={() => handleFilterChange("boxbox")}
        >
          4. Действия (BoxBox)
        </button>
      </div>

      {/* Concept 1: Tolan / Greenlight */}
      {(filter === "all" || filter === "tolan") && (
        <div>
          <div className="showcase-section-head">
            <span className="showcase-section-title">01 • Слоты участников и доступ</span>
            <span className="showcase-section-ref">Паттерн Tolan / Greenlight</span>
          </div>
          <ShowcaseCardTolan />
        </div>
      )}

      {/* Concept 2: Acorns / NordVPN */}
      {(filter === "all" || filter === "acorns") && (
        <div>
          <div className="showcase-section-head">
            <span className="showcase-section-title">02 • Финансовая выгода и биллинг</span>
            <span className="showcase-section-ref">Паттерн Acorns / NordVPN</span>
          </div>
          <ShowcaseCardAcorns />
        </div>
      )}

      {/* Concept 3: Vinted / Depop */}
      {(filter === "all" || filter === "vinted") && (
        <div>
          <div className="showcase-section-head">
            <span className="showcase-section-title">03 • Социальный траст и теги</span>
            <span className="showcase-section-ref">Паттерн Vinted / Depop</span>
          </div>
          <ShowcaseCardVinted />
        </div>
      )}

      {/* Concept 4: Box Box Club / Cash App */}
      {(filter === "all" || filter === "boxbox") && (
        <div>
          <div className="showcase-section-head">
            <span className="showcase-section-title">04 • Микро-действия в 1 клик</span>
            <span className="showcase-section-ref">Паттерн Box Box Club</span>
          </div>
          <ShowcaseCardBoxBox />
        </div>
      )}
    </div>
  );
}
