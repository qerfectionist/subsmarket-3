import { useState } from "react";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { useToast } from "../ui";
import { triggerTelegramImpact } from "../../telegram";

export function ShowcaseCardAcorns() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyCard = () => {
    triggerTelegramImpact("light");
    navigator.clipboard?.writeText("4400 4301 2290 4421");
    setCopied(true);
    toast.success({ title: "Номер Kaspi Gold скопирован (4400 •••• 4421)" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="sc-card" data-testid="showcase-card-acorns">
      {/* Header */}
      <div className="sc-header">
        <div className="sc-service-info">
          <div className="sc-logo-box">
            <ServiceLogo serviceSlug="youtube" serviceName="YouTube" size={32} />
          </div>
          <div className="sc-meta">
            <span className="sc-title">YouTube Premium Family</span>
            <span className="sc-subtitle">Финансово-метрический биллинг</span>
          </div>
        </div>
      </div>

      {/* Hero Price & Savings */}
      <div className="sc-hero-price-row">
        <div>
          <div className="sc-hero-price">500 ₸ <span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--app-muted)" }}>/ мес</span></div>
          <div style={{ fontSize: "0.8125rem", color: "var(--app-muted)", marginTop: "2px" }}>
            Вместо 2 700 ₸ соло-подписки
          </div>
        </div>
        <div className="sc-savings-tag">
          <SystemSymbol name="checkmark" size="xs" />
          -81% экономия
        </div>
      </div>

      {/* Visual Capacity Bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
          <span style={{ color: "var(--app-text)", fontWeight: 600 }}>Заполнение семьи</span>
          <span style={{ color: "var(--app-info)", fontWeight: 600 }}>4 из 6 мест (67%)</span>
        </div>
        <div className="sc-progress-bar-bg">
          <div className="sc-progress-bar-fill" style={{ width: "67%" }} />
        </div>
      </div>

      {/* Financial Metrics Grid */}
      <div className="sc-metric-cards-grid">
        <div className="sc-metric-cell">
          <span className="sc-metric-label">След. списание</span>
          <span className="sc-metric-value">15 ноября 2026</span>
        </div>
        <div className="sc-metric-cell">
          <span className="sc-metric-label">Экономия в год</span>
          <span className="sc-metric-value" style={{ color: "var(--app-success)" }}>+26 400 ₸</span>
        </div>
      </div>

      {/* Fast Kaspi Requisite Pill */}
      <div className="sc-slot-row" style={{ background: "var(--app-surface-inset)" }}>
        <div className="sc-slot-left">
          <div className="sc-avatar" style={{ background: "rgba(255, 214, 10, 0.15)", color: "var(--app-warning)" }}>
            💳
          </div>
          <div className="sc-slot-names">
            <span className="sc-slot-user">Kaspi Gold</span>
            <span className="sc-slot-subtext">4400 •••• 4421 · Данияр К.</span>
          </div>
        </div>
        <button
          type="button"
          className="sc-slot-action-btn"
          onClick={handleCopyCard}
        >
          {copied ? "Скопировано ✓" : "Скопировать"}
        </button>
      </div>
    </div>
  );
}
