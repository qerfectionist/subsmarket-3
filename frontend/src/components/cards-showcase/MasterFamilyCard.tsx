import { useState } from "react";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { useToast } from "../ui";
import { triggerTelegramImpact, triggerTelegramSelection } from "../../telegram";
import "../../styles/master-family-card.css";

interface MasterFamilyCardProps {
  onBack?: () => void;
}

export function MasterFamilyCard({ onBack }: MasterFamilyCardProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"owner" | "member">("owner");
  const [accessGiven, setAccessGiven] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const handleCopyInvite = (slotNum: number) => {
    triggerTelegramImpact("light");
    navigator.clipboard?.writeText("https://t.me/subsmarket_bot?start=invite_spotify123");
    setCopiedInvite(true);
    toast.success({ title: `Инвайт на слот №${slotNum} скопирован в буфер!` });
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleGiveAccess = () => {
    triggerTelegramImpact("medium");
    setAccessGiven(true);
    toast.success({ title: "Доступ выдан @eldar_99! Слот активирован." });
  };

  const handleRequisites = () => {
    triggerTelegramImpact("light");
    toast.info({ title: "Kaspi Gold: +7 707 ••• 89 (Данияр К.)" });
  };

  return (
    <div className="mfc-page-container" data-testid="master-family-card-screen">
      {/* Page Header */}
      <div className="mfc-page-head">
        <div className="mfc-page-title-group">
          {onBack && (
            <button
              type="button"
              className="mfc-back-btn"
              onClick={() => {
                triggerTelegramImpact("light");
                onBack();
              }}
              aria-label="Назад"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <h1 className="mfc-page-title">Семья подписки</h1>
        </div>
        <span className="mfc-benchmark-badge">Tolan & BoxBox</span>
      </div>

      {/* Perspective Toggle: Owner vs Member */}
      <div className="mfc-mode-switcher" role="tablist">
        <button
          type="button"
          className={`mfc-mode-tab${viewMode === "owner" ? " is-active" : ""}`}
          onClick={() => {
            triggerTelegramSelection();
            setViewMode("owner");
          }}
        >
          👑 Вид организатора
        </button>
        <button
          type="button"
          className={`mfc-mode-tab${viewMode === "member" ? " is-active" : ""}`}
          onClick={() => {
            triggerTelegramSelection();
            setViewMode("member");
          }}
        >
          👤 Вид участника
        </button>
      </div>

      {/* THE MASTER CARD */}
      <div className="mfc-card" data-testid="master-family-card">
        {/* Header: Service Logo, Title, Price */}
        <div className="mfc-header">
          <div className="mfc-service-block">
            <div className="mfc-service-icon-box">
              <ServiceLogo serviceSlug="spotify" serviceName="Spotify" size={32} />
            </div>
            <div className="mfc-service-texts">
              <span className="mfc-service-name">Spotify Family</span>
              <span className="mfc-service-type">Семейная подписка (Казахстан)</span>
            </div>
          </div>
          <div className="mfc-price-block">
            <span className="mfc-price-val">500 ₸</span>
            <span className="mfc-price-period">в месяц / слот</span>
          </div>
        </div>

        {/* Capacity Strip (Tolan Dots Benchmark) */}
        <div className="mfc-capacity-strip">
          <div className="mfc-capacity-dots-group">
            <div className="mfc-dots-row">
              <span className="mfc-dot-seat is-filled" />
              <span className="mfc-dot-seat is-filled" />
              <span className="mfc-dot-seat is-filled" />
              <span className={`mfc-dot-seat ${accessGiven ? "is-filled" : "is-filled"}`} />
              <span className="mfc-dot-seat is-empty" />
              <span className="mfc-dot-seat is-empty" />
            </div>
            <span className="mfc-capacity-label">4 из 6 мест занято</span>
          </div>
          <span className="mfc-free-badge">2 места свободно</span>
        </div>

        {/* Section Title */}
        <div className="mfc-section-title">Состав семьи · 6 мест</div>

        {/* Slots Container */}
        <div className="mfc-slots-container">
          {/* Slot 1: Organizer (Owner) */}
          <div className="mfc-slot-item">
            <div className="mfc-slot-profile">
              <div className="mfc-avatar-frame is-owner">
                Д
                <span className="mfc-owner-crown">👑</span>
              </div>
              <div className="mfc-slot-meta">
                <span className="mfc-slot-username">@dustyotter</span>
                <span className="mfc-slot-subtext">
                  <span className="mfc-owner-chip">Владелец</span>
                  <span>Kaspi Gold</span>
                </span>
              </div>
            </div>
            <button
              type="button"
              className="mfc-pill-btn"
              onClick={handleRequisites}
            >
              Kaspi
            </button>
          </div>

          {/* Slot 2: Member 1 */}
          <div className="mfc-slot-item">
            <div className="mfc-slot-profile">
              <div className="mfc-avatar-frame">А</div>
              <div className="mfc-slot-meta">
                <span className="mfc-slot-username">@arman_kz</span>
                <span className="mfc-slot-subtext">
                  <span className="mfc-status-dot is-paid" />
                  Оплачен до 15.11
                </span>
              </div>
            </div>
            <button
              type="button"
              className="mfc-pill-btn"
              onClick={() => {
                triggerTelegramImpact("light");
                toast.info({ title: "Слот @arman_kz активен до 15.11" });
              }}
            >
              Инфо
            </button>
          </div>

          {/* Slot 3: Member 2 */}
          <div className="mfc-slot-item">
            <div className="mfc-slot-profile">
              <div className="mfc-avatar-frame">Д</div>
              <div className="mfc-slot-meta">
                <span className="mfc-slot-username">@dariya_s</span>
                <span className="mfc-slot-subtext">
                  <span className="mfc-status-dot is-paid" />
                  Оплачен до 22.11
                </span>
              </div>
            </div>
            <button
              type="button"
              className="mfc-pill-btn"
              onClick={() => {
                triggerTelegramImpact("light");
                toast.info({ title: "Слот @dariya_s активен до 22.11" });
              }}
            >
              Инфо
            </button>
          </div>

          {/* Slot 4: Member 3 (Pending Access) */}
          <div className="mfc-slot-item">
            <div className="mfc-slot-profile">
              <div className="mfc-avatar-frame">Е</div>
              <div className="mfc-slot-meta">
                <span className="mfc-slot-username">@eldar_99</span>
                <span className="mfc-slot-subtext">
                  {accessGiven ? (
                    <>
                      <span className="mfc-status-dot is-paid" />
                      Доступ активен
                    </>
                  ) : (
                    <>
                      <span className="mfc-status-dot is-pending" />
                      Ожидает доступ
                    </>
                  )}
                </span>
              </div>
            </div>
            {viewMode === "owner" && !accessGiven ? (
              <button
                type="button"
                className="mfc-pill-btn is-cta"
                onClick={handleGiveAccess}
              >
                Одобрить
              </button>
            ) : (
              <button
                type="button"
                className="mfc-pill-btn"
                onClick={() => {
                  triggerTelegramImpact("light");
                  toast.info({ title: "Слот @eldar_99" });
                }}
              >
                Инфо
              </button>
            )}
          </div>

          {/* Slot 5: Empty Slot (Tolan Dashed "Add Member" Pattern) */}
          <div
            className="mfc-slot-item is-empty"
            onClick={() => handleCopyInvite(5)}
            role="button"
            tabIndex={0}
          >
            <div className="mfc-slot-profile">
              <div className="mfc-empty-icon-frame">
                <SystemSymbol name="plus" size="sm" />
              </div>
              <div className="mfc-slot-meta">
                <span className="mfc-empty-title">Свободный слот №5</span>
                <span className="mfc-empty-subtext">Пригласить по ссылке</span>
              </div>
            </div>
            <button type="button" className="mfc-pill-btn is-invite">
              {copiedInvite ? "Скопировано ✓" : "+ Инвайт"}
            </button>
          </div>

          {/* Slot 6: Empty Slot */}
          <div
            className="mfc-slot-item is-empty"
            onClick={() => handleCopyInvite(6)}
            role="button"
            tabIndex={0}
          >
            <div className="mfc-slot-profile">
              <div className="mfc-empty-icon-frame">
                <SystemSymbol name="plus" size="sm" />
              </div>
              <div className="mfc-slot-meta">
                <span className="mfc-empty-title">Свободный слот №6</span>
                <span className="mfc-empty-subtext">Пригласить по ссылке</span>
              </div>
            </div>
            <button type="button" className="mfc-pill-btn is-invite">
              + Инвайт
            </button>
          </div>
        </div>

        {/* Security & Invariant Trust Footer (Tolan Style) */}
        <div className="mfc-trust-footer">
          <span className="mfc-trust-icon">🛡️</span>
          <p className="mfc-trust-text">
            SubsMarket защищает семью: реквизиты Kaspi раскрываются только после подтверждения доступа организатором.
          </p>
        </div>
      </div>
    </div>
  );
}
