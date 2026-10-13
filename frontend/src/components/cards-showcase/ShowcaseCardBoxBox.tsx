import { useState } from "react";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { useToast } from "../ui";
import { triggerTelegramImpact } from "../../telegram";

export function ShowcaseCardBoxBox() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);

  const handleCopyKaspi = () => {
    triggerTelegramImpact("light");
    navigator.clipboard?.writeText("+7 777 888 99 00");
    toast.success({ title: "Номер Kaspi скопирован: +7 777 888 99 00" });
  };

  const handleChat = () => {
    triggerTelegramImpact("light");
    toast.info({ title: "Открытие диалога в Telegram: @yerassyl_owner" });
  };

  const handleRemind = () => {
    triggerTelegramImpact("medium");
    toast.success({ title: "3 участника уведомлены ботом в Telegram" });
  };

  return (
    <div className="sc-card" data-testid="showcase-card-boxbox">
      {/* Header with expand/collapse toggle */}
      <div
        className="sc-header"
        onClick={() => {
          triggerTelegramImpact("light");
          setIsOpen((prev) => !prev);
        }}
        style={{ cursor: "pointer" }}
        role="button"
        tabIndex={0}
      >
        <div className="sc-service-info">
          <div className="sc-logo-box">
            <ServiceLogo serviceSlug="netflix" serviceName="Netflix" size={32} />
          </div>
          <div className="sc-meta">
            <span className="sc-title">Netflix Premium 4K</span>
            <span className="sc-subtitle">Быстрые микро-действия в 1 клик</span>
          </div>
        </div>
        <div className="sc-price-box">
          <span className="sc-price-val">1 200 ₸</span>
          <span className="sc-price-unit" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {isOpen ? "свернуть" : "раскрыть"}
            <span style={{ fontSize: "10px" }}>{isOpen ? "▲" : "▼"}</span>
          </span>
        </div>
      </div>

      {isOpen && (
        <>
          {/* Quick Stats Pill */}
          <div className="sc-capacity-overview">
            <span className="sc-capacity-text">
              <SystemSymbol name="clock" size="xs" />
              Оплата через 5 дней (20 ноября)
            </span>
            <span className="sc-capacity-badge is-urgent">Требует внимания</span>
          </div>

          {/* Micro-actions Row */}
          <div className="sc-quick-actions-bar">
            <button
              type="button"
              className="sc-quick-action-btn"
              onClick={handleCopyKaspi}
              title="Скопировать номер Kaspi"
            >
              <span style={{ fontSize: "1.125rem" }}>📋</span>
              <span className="sc-quick-action-label">Копия Kaspi</span>
            </button>

            <button
              type="button"
              className="sc-quick-action-btn"
              onClick={handleChat}
              title="Написать организатору в Telegram"
            >
              <span style={{ fontSize: "1.125rem" }}>💬</span>
              <span className="sc-quick-action-label">Telegram</span>
            </button>

            <button
              type="button"
              className="sc-quick-action-btn"
              onClick={handleRemind}
              title="Отправить напоминание об оплате"
            >
              <span style={{ fontSize: "1.125rem" }}>🔔</span>
              <span className="sc-quick-action-label">Напомнить</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
