import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  loadDevCards,
  countDevCards,
  addDevCandidateCard,
  addDevBuyerFamilyCard,
  addDevAccountCard,
  addDevGbCard,
  addAllDevCategoriesSet,
  clearLocalDevCards,
  resetAndSeedServerCards,
  cleanAllServerCards,
  clearServerArchive,
  DEV_CARDS_UPDATE_EVENT,
  type DevTestCardsState
} from "../../utils/devCardsStore";
import {
  RANDOM_FAMILIES,
  RANDOM_ACCOUNTS,
  RANDOM_GB
} from "../../utils/devTestCards";
import { triggerTelegramImpact, triggerTelegramSelection } from "../../telegram";
import { useToast } from "../ui";
import "../../styles/dev-constructor-modal.css";

export interface DevCardsConstructorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIMER_OPTIONS = [
  { label: "По умолч.", seconds: undefined },
  { label: "30 сек", seconds: 30 },
  { label: "60 сек", seconds: 60 },
  { label: "2 мин", seconds: 120 },
  { label: "5 мин", seconds: 300 }
];

export function DevCardsConstructorModal({
  isOpen,
  onClose
}: DevCardsConstructorModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [cards, setCards] = useState<DevTestCardsState>(() => loadDevCards());
  const [scope, setScope] = useState<"inbox" | "outbox">("inbox");
  const [selectedTimerSec, setSelectedTimerSec] = useState<number | undefined>(undefined);
  const [customCategory, setCustomCategory] = useState<"family" | "account" | "gb">("family");
  const [customSlug, setCustomSlug] = useState<string>("spotify");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setCards(loadDevCards());
    };
    window.addEventListener(DEV_CARDS_UPDATE_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(DEV_CARDS_UPDATE_EVENT, handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const counts = countDevCards(cards);

  const handleAddFamily = () => {
    triggerTelegramImpact("light");
    if (scope === "inbox") {
      addDevCandidateCard({ expiresInSeconds: selectedTimerSec });
      toast.success({ title: "Входящий кандидат в семью добавлен" });
    } else {
      addDevBuyerFamilyCard({ expiresInSeconds: selectedTimerSec });
      toast.success({ title: "Исходящая заявка в семью добавлена" });
    }
  };

  const handleAddAccount = () => {
    triggerTelegramImpact("light");
    const role = scope === "inbox" ? "seller" : "buyer";
    addDevAccountCard(role);
    toast.success({ title: `Аккаунт (${scope === "inbox" ? "продажа" : "покупка"}) добавлен` });
  };

  const handleAddGb = () => {
    triggerTelegramImpact("light");
    const role = scope === "inbox" ? "seller" : "buyer";
    addDevGbCard(role);
    toast.success({ title: `Трафик ГБ (${scope === "inbox" ? "продажа" : "покупка"}) добавлен` });
  };

  const handleAddAll = () => {
    triggerTelegramImpact("medium");
    addAllDevCategoriesSet(scope, selectedTimerSec);
    toast.success({ title: `Все 3 категории (${scope === "inbox" ? "Входящие" : "Исходящие"}) добавлены` });
  };

  const handleCreateCustom = () => {
    triggerTelegramImpact("light");
    if (customCategory === "family") {
      if (scope === "inbox") {
        addDevCandidateCard({ serviceSlug: customSlug, expiresInSeconds: selectedTimerSec });
      } else {
        addDevBuyerFamilyCard({ serviceSlug: customSlug, expiresInSeconds: selectedTimerSec });
      }
      toast.success({ title: `Создана семья: ${customSlug}` });
    } else if (customCategory === "account") {
      addDevAccountCard(scope === "inbox" ? "seller" : "buyer", { serviceSlug: customSlug });
      toast.success({ title: `Создан аккаунт: ${customSlug}` });
    } else {
      addDevGbCard(scope === "inbox" ? "seller" : "buyer", { operatorSlug: customSlug });
      toast.success({ title: `Создан трафик ГБ: ${customSlug}` });
    }
  };

  const handleClearLocal = () => {
    triggerTelegramImpact("medium");
    clearLocalDevCards();
    toast.info({ title: "Локальные тестовые карточки очищены" });
  };

  const handleServerReseed = async () => {
    triggerTelegramImpact("medium");
    setIsSubmitting(true);
    try {
      await resetAndSeedServerCards();
      await queryClient.invalidateQueries();
      toast.success({ title: "БД перезасеяна тестовыми заявками!" });
    } catch {
      toast.error({ title: "Ошибка при вызове dev reset-and-seed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleServerCleanAll = async () => {
    triggerTelegramImpact("heavy");
    setIsSubmitting(true);
    try {
      await cleanAllServerCards();
      await queryClient.invalidateQueries();
      toast.info({ title: "Вся база заявок и архив очищены!" });
    } catch {
      toast.error({ title: "Ошибка при очистке БД" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearArchive = async () => {
    triggerTelegramImpact("light");
    try {
      await clearServerArchive();
      await queryClient.invalidateQueries();
      toast.success({ title: "Архив очищен" });
    } catch {
      toast.error({ title: "Ошибка при очистке архива" });
    }
  };

  return (
    <div
      className="dev-constructor-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Конструктор карточек"
    >
      <div className="dev-constructor-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="dev-constructor-head">
          <div className="dev-constructor-title-wrap">
            <span className="dev-constructor-title">⚡ Конструктор карточек</span>
            <span className="dev-constructor-badge">
              Активно: {counts.total} ({counts.inbox} вх / {counts.outbox} исх)
            </span>
          </div>
          <button
            type="button"
            className="dev-constructor-close-btn"
            onClick={onClose}
            aria-label="Закрыть"
            title="Закрыть (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="dev-constructor-body">
          {/* Scope Selector */}
          <div className="dev-constructor-scope-tabs">
            <button
              type="button"
              className={`dev-constructor-scope-tab${scope === "inbox" ? " is-active" : ""}`}
              onClick={() => {
                triggerTelegramSelection();
                setScope("inbox");
              }}
            >
              📥 Входящие (Продажи)
            </button>
            <button
              type="button"
              className={`dev-constructor-scope-tab${scope === "outbox" ? " is-active" : ""}`}
              onClick={() => {
                triggerTelegramSelection();
                setScope("outbox");
              }}
            >
              📤 Исходящие (Покупки)
            </button>
          </div>

          {/* Quick Add Section */}
          <div className="dev-constructor-section">
            <span className="dev-constructor-section-label">Быстрое создание карточек</span>
            <div className="dev-constructor-grid">
              <button type="button" className="dev-action-card-btn" onClick={handleAddFamily}>
                <span className="dev-card-btn-icon">👨‍👩‍👧</span>
                <span>+ В семью</span>
              </button>
              <button type="button" className="dev-action-card-btn" onClick={handleAddAccount}>
                <span className="dev-card-btn-icon">👤</span>
                <span>+ Аккаунт</span>
              </button>
              <button type="button" className="dev-action-card-btn" onClick={handleAddGb}>
                <span className="dev-card-btn-icon">📶</span>
                <span>+ Трафик ГБ</span>
              </button>
              <button type="button" className="dev-action-card-btn" onClick={handleAddAll}>
                <span className="dev-card-btn-icon">⚡</span>
                <span>+ Все 3 категории</span>
              </button>
            </div>
          </div>

          {/* Timer preset section */}
          <div className="dev-constructor-section">
            <span className="dev-constructor-section-label">Таймер для новых карточек</span>
            <div className="dev-timer-chips-row">
              {TIMER_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={`dev-timer-chip${selectedTimerSec === opt.seconds ? " is-active" : ""}`}
                  onClick={() => {
                    triggerTelegramSelection();
                    setSelectedTimerSec(opt.seconds);
                  }}
                >
                  ⏱ {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom creator section */}
          <div className="dev-constructor-section">
            <span className="dev-constructor-section-label">Выбор конкретного сервиса</span>
            <div className="dev-custom-card-row">
              <select
                className="dev-custom-select"
                value={customCategory}
                onChange={(e) => {
                  const val = e.target.value as "family" | "account" | "gb";
                  setCustomCategory(val);
                  if (val === "family") setCustomSlug(RANDOM_FAMILIES[0].service_slug);
                  else if (val === "account") setCustomSlug(RANDOM_ACCOUNTS[0].service_slug);
                  else setCustomSlug(RANDOM_GB[0].operator_slug);
                }}
              >
                <option value="family">Семья</option>
                <option value="account">Аккаунт</option>
                <option value="gb">Трафик ГБ</option>
              </select>

              <select
                className="dev-custom-select"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
              >
                {customCategory === "family" &&
                  RANDOM_FAMILIES.map((f) => (
                    <option key={f.service_slug} value={f.service_slug}>
                      {f.service_name}
                    </option>
                  ))}
                {customCategory === "account" &&
                  RANDOM_ACCOUNTS.map((a) => (
                    <option key={a.service_slug} value={a.service_slug}>
                      {a.service_name}
                    </option>
                  ))}
                {customCategory === "gb" &&
                  RANDOM_GB.map((g) => (
                    <option key={g.operator_slug} value={g.operator_slug}>
                      {g.operator_name} ({g.amount_gb} ГБ)
                    </option>
                  ))}
              </select>

              <button
                type="button"
                className="dev-custom-submit-btn"
                onClick={handleCreateCustom}
              >
                Создать
              </button>
            </div>
          </div>

          {/* Database & Management */}
          <div className="dev-constructor-section">
            <span className="dev-constructor-section-label">Синхронизация и очистка</span>
            <div className="dev-mgmt-grid">
              <button
                type="button"
                className="dev-mgmt-btn"
                onClick={handleServerReseed}
                disabled={isSubmitting}
                title="Сгенерировать стандартный набор карточек в БД"
              >
                🔄 Reseed БД
              </button>
              <button
                type="button"
                className="dev-mgmt-btn"
                onClick={handleClearLocal}
                title="Очистить только локальные карточки"
              >
                🧹 Очистить локал
              </button>
              <button
                type="button"
                className="dev-mgmt-btn is-danger"
                onClick={handleServerCleanAll}
                disabled={isSubmitting}
                title="Очистить все заявки в БД и локально"
              >
                🗑 Очистить БД
              </button>
            </div>
            <div style={{ marginTop: "4px" }}>
              <button
                type="button"
                className="dev-mgmt-btn"
                style={{ width: "100%" }}
                onClick={handleClearArchive}
                disabled={isSubmitting}
              >
                📦 Очистить архив
              </button>
            </div>
          </div>
        </div>

        <div className="dev-constructor-foot">
          <span>Подсказка: горячая клавиша Ctrl+Shift+D</span>
          <span>SubsMarket DevTools</span>
        </div>
      </div>
    </div>
  );
}
