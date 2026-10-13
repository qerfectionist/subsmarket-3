import { useEffect, useState } from "react";
import { Select, Typography } from "./ui";
import { SystemSymbol } from "./SystemSymbol";
import { DEV_TELEGRAM_USERS, type DevTelegramUser } from "../api";
import { getTelegramPlatform, setDevPlatform, triggerTelegramImpact } from "../telegram";
import { countDevCards, DEV_CARDS_UPDATE_EVENT, populateAllStatusesShowcase } from "../utils/devCardsStore";
import { setNavStylePreference, type NavStyle } from "./BottomNav";
import "../styles/dev-controls.css";

export const DEV_OPEN_CONSTRUCTOR_EVENT = "subsmarket:open-dev-cards-modal";

export function DevUserSwitch({
  value,
  onChange
}: {
  value: DevTelegramUser;
  onChange: (userId: string) => void;
}) {
  const isWebDriver = typeof window !== "undefined" && Boolean(window.navigator?.webdriver);
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("sm_dev_panel_open");
      if (stored !== null) return stored === "true";
    } catch {
      // ignore
    }
    return false;
  });

  const [platform, setPlatformState] = useState<string>(() => getTelegramPlatform());
  const [cardCounts, setCardCounts] = useState(() => countDevCards());

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sm_dev_panel_open", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleUserChange = (id: string) => {
    onChange(id);
    setIsOpen(false);
    try {
      localStorage.setItem("sm_dev_panel_open", "false");
    } catch {
      // ignore
    }
  };

  const handlePlatformChange = (p: string) => {
    setPlatformState(p);
    setDevPlatform(p as "ios" | "android" | "tdesktop" | "default");
  };

  const [navStyle, setNavStyle] = useState<NavStyle>(() => {
    try {
      return (localStorage.getItem("subsmarket.navStyle") as NavStyle) || "spotify";
    } catch {
      return "spotify";
    }
  });

  const handleNavStyleChange = (s: string) => {
    const val = s as NavStyle;
    setNavStyle(val);
    setNavStylePreference(val);
  };

  useEffect(() => {
    const handleUpdate = () => {
      setCardCounts(countDevCards());
    };
    window.addEventListener(DEV_CARDS_UPDATE_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(DEV_CARDS_UPDATE_EVENT, handleUpdate);
    };
  }, []);

  if (!isOpen) {
    return (
      <div className="dev-controls-fixed" data-testid="dev-user-switch-collapsed">
        <button
          type="button"
          className="dev-top-plus-btn"
          onClick={toggleOpen}
          title={`Панель разработчика (@${value.username})`}
          data-testid="dev-controls-toggle"
          aria-label={`Панель разработчика (@${value.username})`}
          aria-expanded={false}
        >
          <SystemSymbol name="plus" size={16} />
        </button>
      </div>
    );
  }

  return (
    <>
      {!isWebDriver && (
        <div
          className="dev-controls-backdrop"
          onClick={toggleOpen}
          aria-hidden="true"
          data-testid="dev-controls-backdrop"
        />
      )}
      <div
        className="dev-controls-panel is-expanded"
        aria-label="Dev user switch"
        data-testid="dev-user-switch"
      >
        <div className="dev-panel-header">
          <div className="dev-panel-title-group">
            <span className="dev-panel-title">Панель разработчика</span>
            <span className="dev-user-badge">@{value.username}</span>
          </div>
          <button
            type="button"
            className="dev-top-close-btn"
            onClick={toggleOpen}
            title="Закрыть панель разработчика"
            data-testid="dev-controls-collapse"
            aria-label="Закрыть панель"
          >
            <SystemSymbol name="xmark" size={14} />
          </button>
        </div>
        <div className="dev-panel-grid">
          <div className="dev-panel-field">
            <Typography as="span" variant="label" level={2}>
              Пользователь
            </Typography>
            <div data-testid="dev-user-select" data-value={String(value.id)}>
              <Select
                value={String(value.id)}
                onChange={handleUserChange}
                options={DEV_TELEGRAM_USERS.map((user) => ({
                  value: String(user.id),
                  label: `${user.label} · @${user.username}`
                }))}
              />
            </div>
          </div>
          <div className="dev-panel-field">
            <Typography as="span" variant="label" level={2}>
              Платформа
            </Typography>
            <Select
              value={platform}
              onChange={handlePlatformChange}
              options={[
                { value: "unknown", label: "Auto" },
                { value: "ios", label: "iOS (Mock)" },
                { value: "android", label: "Android" },
                { value: "tdesktop", label: "Desktop" }
              ]}
            />
          </div>
          <div className="dev-panel-field">
            <Typography as="span" variant="label" level={2}>
              Навигация
            </Typography>
            <Select
              value={navStyle}
              onChange={handleNavStyleChange}
              options={[
                { value: "classic", label: "Classic (3+1 Dock)" },
                { value: "spotify", label: "Spotify (Градиент 4 таба)" }
              ]}
            />
          </div>
        </div>
        <div className="dev-panel-footer" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            className="dev-constructor-trigger-btn"
            style={{
              background: "linear-gradient(135deg, rgba(52, 199, 89, 0.2), rgba(0, 122, 255, 0.2))",
              borderColor: "rgba(52, 199, 89, 0.45)"
            }}
            onClick={() => {
              populateAllStatusesShowcase();
              triggerTelegramImpact("medium");
              setIsOpen(false);
            }}
            title="Заполнить карточками со всеми статусами"
            data-testid="dev-populate-showcase-btn"
          >
            🌈 Показать все статусы
          </button>
          <button
            type="button"
            className="dev-constructor-trigger-btn"
            onClick={() => window.dispatchEvent(new CustomEvent(DEV_OPEN_CONSTRUCTOR_EVENT))}
            title="Открыть конструктор карточек (Ctrl+Shift+D)"
            data-testid="dev-constructor-open-btn"
          >
            ⚡ Конструктор карточек {cardCounts.total > 0 ? `(${cardCounts.total})` : ""}
          </button>
        </div>
      </div>
    </>
  );
}
