import { useState } from "react";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { useToast } from "../ui";
import { triggerTelegramImpact } from "../../telegram";

export function ShowcaseCardTolan() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = () => {
    triggerTelegramImpact("light");
    navigator.clipboard?.writeText("https://t.me/subsmarket_bot?start=invite_spotify123");
    setCopied(true);
    toast.success({ title: "Ссылка-инвайт скопирована в буфер" });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleManage = (user: string) => {
    triggerTelegramImpact("light");
    toast.info({ title: `Управление слотом @${user}` });
  };

  return (
    <div className="sc-card" data-testid="showcase-card-tolan">
      {/* Header */}
      <div className="sc-header">
        <div className="sc-service-info">
          <div className="sc-logo-box">
            <ServiceLogo serviceSlug="spotify" serviceName="Spotify" size={32} />
          </div>
          <div className="sc-meta">
            <span className="sc-title">Spotify Family</span>
            <span className="sc-subtitle">Слоты участников и биллинг</span>
          </div>
        </div>
        <div className="sc-price-box">
          <span className="sc-price-val">500 ₸</span>
          <span className="sc-price-unit">в месяц / место</span>
        </div>
      </div>

      {/* Capacity Overview Bar */}
      <div className="sc-capacity-overview">
        <span className="sc-capacity-text">
          <SystemSymbol name="person.2" size="xs" />
          4 из 6 мест занято
        </span>
        <span className="sc-capacity-badge">2 слота доступно</span>
      </div>

      {/* Member Slots List */}
      <div className="sc-slots-list">
        {/* Slot 1: Owner */}
        <div className="sc-slot-row">
          <div className="sc-slot-left">
            <div className="sc-avatar">
              А
              <span className="sc-avatar-badge" title="Организатор">👑</span>
            </div>
            <div className="sc-slot-names">
              <span className="sc-slot-user">
                @aleksandr_kz
                <span className="sc-organizer-pill">Организатор</span>
              </span>
              <span className="sc-slot-subtext">Kaspi: +7 707 ••• 89</span>
            </div>
          </div>
          <button
            type="button"
            className="sc-slot-action-btn"
            onClick={() => handleManage("aleksandr_kz")}
          >
            Реквизиты
          </button>
        </div>

        {/* Slot 2: Active Member */}
        <div className="sc-slot-row">
          <div className="sc-slot-left">
            <div className="sc-avatar">Д</div>
            <div className="sc-slot-names">
              <span className="sc-slot-user">@daniya_music</span>
              <span className="sc-slot-subtext">
                <span className="sc-dot is-green" />
                Оплачено (до 15.11)
              </span>
            </div>
          </div>
          <button
            type="button"
            className="sc-slot-action-btn"
            onClick={() => handleManage("daniya_music")}
          >
            Управление
          </button>
        </div>

        {/* Slot 3: Active Member */}
        <div className="sc-slot-row">
          <div className="sc-slot-left">
            <div className="sc-avatar">Т</div>
            <div className="sc-slot-names">
              <span className="sc-slot-user">@timur_rock</span>
              <span className="sc-slot-subtext">
                <span className="sc-dot is-green" />
                Оплачено (до 22.11)
              </span>
            </div>
          </div>
          <button
            type="button"
            className="sc-slot-action-btn"
            onClick={() => handleManage("timur_rock")}
          >
            Управление
          </button>
        </div>

        {/* Slot 4: Awaiting Access */}
        <div className="sc-slot-row">
          <div className="sc-slot-left">
            <div className="sc-avatar">Е</div>
            <div className="sc-slot-names">
              <span className="sc-slot-user">@eldar_jazz</span>
              <span className="sc-slot-subtext">
                <span className="sc-dot is-yellow" />
                Ожидает доступ
              </span>
            </div>
          </div>
          <button
            type="button"
            className="sc-slot-action-btn is-primary"
            onClick={() => {
              triggerTelegramImpact("medium");
              toast.success({ title: "Инвайт выдан @eldar_jazz!" });
            }}
          >
            Выдать доступ
          </button>
        </div>

        {/* Slot 5: Empty Slot (Dashed) */}
        <div
          className="sc-slot-row is-empty"
          onClick={handleCopyInvite}
          role="button"
          tabIndex={0}
          aria-label="Свободное место. Нажмите для копирования инвайта"
        >
          <div className="sc-slot-left">
            <div className="sc-empty-icon">
              <SystemSymbol name="plus" size="sm" />
            </div>
            <div className="sc-slot-names">
              <span className="sc-empty-title">Свободный слот №5</span>
              <span className="sc-empty-hint">Нажмите, чтобы скопировать ссылку</span>
            </div>
          </div>
          <button type="button" className="sc-slot-action-btn">
            {copied ? "Скопировано ✓" : "Инвайт"}
          </button>
        </div>
      </div>

      {/* Security Invariant Note */}
      <div className="sc-security-note">
        <SystemSymbol name="checkmark.shield" size="xs" />
        <span>Реквизиты Kaspi раскрываются только после подтверждения доступа</span>
      </div>
    </div>
  );
}
