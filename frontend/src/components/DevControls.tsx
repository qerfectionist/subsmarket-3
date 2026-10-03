import { useEffect, useState } from "react";
import { Select, Typography } from "./ui";
import { SystemSymbol } from "./SystemSymbol";
import { DEV_TELEGRAM_USERS, type DevTelegramUser } from "../api";
import { getTelegramPlatform, setDevPlatform } from "../telegram";
import { countDevCards, DEV_CARDS_UPDATE_EVENT } from "../utils/devCardsStore";
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
        </div>
        <div className="dev-panel-footer">
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
