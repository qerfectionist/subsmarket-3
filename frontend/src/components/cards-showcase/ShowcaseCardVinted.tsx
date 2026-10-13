import { useState } from "react";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { useToast } from "../ui";
import { triggerTelegramImpact } from "../../telegram";

export function ShowcaseCardVinted() {
  const { toast } = useToast();
  const [isJoined, setIsJoined] = useState(false);

  const handleJoin = () => {
    triggerTelegramImpact("medium");
    setIsJoined(true);
    toast.success({ title: "Заявка отправлена владельцу семьи" });
  };

  return (
    <div className="sc-card" data-testid="showcase-card-vinted">
      {/* Header */}
      <div className="sc-header">
        <div className="sc-service-info">
          <div className="sc-logo-box">
            <ServiceLogo serviceSlug="apple" serviceName="Apple" size={32} />
          </div>
          <div className="sc-meta">
            <span className="sc-title">Apple One Premier</span>
            <span className="sc-subtitle">Apple Music, TV+, Arcade, iCloud</span>
          </div>
        </div>
        <div className="sc-price-box">
          <span className="sc-price-val">900 ₸</span>
          <span className="sc-price-unit">в месяц</span>
        </div>
      </div>

      {/* Seller / Organizer Trust Snippet */}
      <div className="sc-slot-row" style={{ background: "transparent", padding: "4px 0", borderBottom: "1px solid var(--app-border)" }}>
        <div className="sc-slot-left">
          <div className="sc-avatar" style={{ width: "30px", height: "30px", fontSize: "0.8125rem" }}>
            Е
          </div>
          <div className="sc-slot-names">
            <span className="sc-slot-user">
              @yerassyl_owner
              <span style={{ color: "var(--app-warning)", fontSize: "0.8125rem", fontWeight: 700 }}>★ 4.9</span>
            </span>
          </div>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--app-muted)", whiteSpace: "nowrap" }}>
          48 отзывов
        </span>
      </div>

      {/* Social Trust & Guarantee Tags */}
      <div className="sc-tags-row">
        <span className="sc-trust-tag is-verified">
          <SystemSymbol name="checkmark.shield" size="xs" />
          Проверен SubsMarket
        </span>
        <span className="sc-trust-tag">
          ⚡ Мгновенный инвайт
        </span>
        <span className="sc-trust-tag">
          🇰🇿 Регион KZ
        </span>
        <span className="sc-trust-tag">
          🔒 Без риска
        </span>
      </div>

      {/* Primary Conversion CTA */}
      <button
        type="button"
        className="sc-cta-btn"
        onClick={handleJoin}
        style={{
          background: isJoined ? "var(--app-secondary-bg)" : "var(--app-accent)",
          color: isJoined ? "var(--app-success)" : "var(--app-accent-text)"
        }}
      >
        {isJoined ? (
          <>
            <SystemSymbol name="checkmark" size="sm" />
            Заявка отправлена
          </>
        ) : (
          <>
            <span>Вступить в семью · 900 ₸</span>
            <SystemSymbol name="arrow.clockwise" size="xs" />
          </>
        )}
      </button>
    </div>
  );
}
