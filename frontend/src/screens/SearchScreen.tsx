import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import AntennaIcon from "@hugeicons/core-free-icons/AntennaIcon";
import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import Key01Icon from "@hugeicons/core-free-icons/Key01Icon";
import Notification02Icon from "@hugeicons/core-free-icons/Notification02Icon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import UserMultipleIcon from "@hugeicons/core-free-icons/UserMultipleIcon";
import Wifi01Icon from "@hugeicons/core-free-icons/Wifi01Icon";
import { HugeiconsIcon } from "@hugeicons/react";

import { resolveServiceBrand, serviceIconUrl } from "../components/branding/serviceBranding";
import { familyTitle } from "../format";
import { triggerTelegramImpact, triggerTelegramSelection } from "../telegram";
import type { Family, FamilyRequest, FamilyType, MyFamily } from "../types";

const FIRST_RUN_BANNER_KEY = "subsmarket.firstRunBannerSeen.v1";
const FAMILY_LIMIT = 5;

const MARKET_BADGE_PREVIEWS = [
  { kind: "reliable", label: "Надёжный владелец" },
  { kind: "responsive", label: "Быстро отвечает" },
  { kind: "value", label: "Ниже рынка" }
] as const;

function familyBadge(index: number) {
  if (index === 0) {
    return null;
  }
  // Reputation and price badges remain preview-only until backend metrics exist.
  return import.meta.env.DEV ? MARKET_BADGE_PREVIEWS[index % MARKET_BADGE_PREVIEWS.length] : null;
}

function pluralRu(value: number, one: string, few: string, many: string) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function familyPaymentSchedule(family: Family) {
  if (family.period === "monthly") {
    return {
      label: "Оплата",
      date: `${family.payment_day}-го`
    };
  }

  const nextPaymentDate = new Date(`${family.next_payment_date}T00:00:00`);
  if (Number.isNaN(nextPaymentDate.getTime())) {
    return {
      label: "Оплата",
      date: "не указана"
    };
  }

  return {
    label: "Оплата",
    date: new Intl.DateTimeFormat("ru-KZ", {
      day: "numeric",
      month: "long"
    }).format(nextPaymentDate)
  };
}

function ServiceLogo({ family }: { family: Family }) {
  const brand = resolveServiceBrand({
    serviceSlug: family.service_slug,
    serviceName: family.service_name,
    familyType: family.family_type
  });
  const iconColor = ["#000000", "#111111"].includes(brand.color.toUpperCase())
    ? "#FFFFFF"
    : brand.color;

  return (
    <span
      className="sm-market-service-logo"
      style={{ "--sm-service-color": brand.color } as CSSProperties}
      aria-hidden
    >
      {brand.iconSlug ? (
        <img
          alt=""
          loading="lazy"
          src={serviceIconUrl(brand.iconSlug, iconColor)}
        />
      ) : (
        brand.monogram || family.service_name.slice(0, 1)
      )}
    </span>
  );
}

export function SearchScreen({
  view = "market",
  userName,
  firstName,
  familyType,
  filteredFamilies,
  myFamilies,
  myRequests,
  isLoading,
  hasMoreFamilies,
  isLoadingMoreFamilies,
  onOpenFamilyCatalog,
  onBack,
  onRefresh,
  onLoadMoreFamilies,
  onOpenFamily,
  onOpenInvite,
  onCreateFamily,
  resetToken,
  pendingActionsCount = 0,
  onOpenMine,
  onOpenActions,
  onOpenGigabytes,
  onOpenAccounts
}: {
  view?: "market" | "family-catalog";
  userName: string;
  firstName?: string;
  familyType: FamilyType;
  filteredFamilies: Family[];
  myFamilies: MyFamily[];
  myRequests: FamilyRequest[];
  isLoading?: boolean;
  hasMoreFamilies?: boolean;
  isLoadingMoreFamilies?: boolean;
  onOpenFamilyCatalog: (familyType: FamilyType) => void;
  onBack?: () => void;
  onRefresh?: () => void;
  onLoadMoreFamilies?: () => void;
  onOpenFamily: (familyId: string) => void;
  onOpenInvite: (code: string) => void;
  onCreateFamily: (familyType: FamilyType) => void;
  resetToken?: number;
  pendingActionsCount?: number;
  onOpenMine?: () => void;
  onOpenActions?: () => void;
  onOpenGigabytes: () => void;
  onOpenAccounts: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFirstRunBanner, setShowFirstRunBanner] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(FIRST_RUN_BANNER_KEY) !== "true";
  });

  useEffect(() => {
    setSearchTerm("");
  }, [familyType, resetToken]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const inviteCode = searchTerm.replace(/\D/g, "").slice(0, 8);
  const isInviteCode = /^\d{8}$/.test(searchTerm.trim());
  const isMarketSearchActive =
    view === "market" && Boolean(normalizedSearchTerm) && !isInviteCode;
  const joinedFamilyIds = useMemo(
    () => new Set(myFamilies.map((item) => item.family.id)),
    [myFamilies]
  );
  const pendingRequestFamilyIds = useMemo(
    () =>
      new Set(
        myRequests
          .filter((request) => request.status === "pending")
          .map((request) => request.family_id)
      ),
    [myRequests]
  );
  const displayFamilies = useMemo(() => {
    if (!normalizedSearchTerm || (view === "market" && isInviteCode)) {
      return filteredFamilies;
    }
    return filteredFamilies.filter((family) =>
      [
        family.service_name,
        family.service_variant ?? "",
        family.plan_name ?? "",
        family.owner.first_name
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchTerm)
    );
  }, [filteredFamilies, isInviteCode, normalizedSearchTerm, view]);
  const visibleFamilies = displayFamilies.slice(0, FAMILY_LIMIT);
  const hasHiddenFamilies =
    displayFamilies.length > visibleFamilies.length || Boolean(hasMoreFamilies);

  function openInvite() {
    if (!isInviteCode) return;
    triggerTelegramImpact("light");
    onOpenInvite(inviteCode);
  }

  const userAcronym = (firstName || userName || "SM").slice(0, 2).toUpperCase();

  if (view === "family-catalog") {
    const catalogTitle =
      familyType === "tariff" ? "Семейные тарифы" : "Семейные подписки";
    const catalogDescription =
      familyType === "tariff"
        ? "Места в семейных тарифах операторов связи"
        : "Места в подписках на сервисы и приложения";

    return (
      <div className="subs-screen-scroll sm-market-screen" data-testid="family-catalog-screen">
        <header className="sm-market-catalog-header">
          <IconButton
            label="Назад в Маркет"
            onClick={() => {
              triggerTelegramSelection();
              onBack?.();
            }}
          >
            <HugeiconsIcon aria-hidden icon={ArrowLeft01Icon} size={21} strokeWidth={2} />
          </IconButton>
          <div className="sm-market-heading-copy">
            <h1>{catalogTitle}</h1>
            <p>{catalogDescription}</p>
          </div>
        </header>

        <MarketSearch
          ariaLabel={`Поиск: ${catalogTitle.toLowerCase()}`}
          testId="family-catalog-search-input"
          value={searchTerm}
          placeholder={
            familyType === "tariff"
              ? "Найти Beeline, activ, Tele2"
              : "Найти YouTube, Spotify, Apple One"
          }
          onChange={setSearchTerm}
        />

        <div className="sm-market-section-heading sm-market-section-heading-with-action">
          <div>
            <h2>Свободные семьи</h2>
            <p>Выберите объявление и отправьте заявку</p>
          </div>
          <button
            className="sm-market-button sm-market-button-primary"
            type="button"
            onClick={() => onCreateFamily(familyType)}
          >
            Создать
          </button>
        </div>

        <FamilyCards
          families={visibleFamilies}
          familyType={familyType}
          hasHiddenFamilies={hasHiddenFamilies}
          isLoading={Boolean(isLoading)}
          isLoadingMore={Boolean(isLoadingMoreFamilies)}
          joinedFamilyIds={joinedFamilyIds}
          pendingRequestFamilyIds={pendingRequestFamilyIds}
          onCreateFamily={onCreateFamily}
          onLoadMoreFamilies={onLoadMoreFamilies}
          onOpenFamily={onOpenFamily}
          onRefresh={onRefresh}
        />
      </div>
    );
  }

  return (
    <div className="subs-screen-scroll sm-market-screen" data-testid="market-screen">
      <header className="sm-market-header">
        <button
          aria-label="Мой профиль"
          className="sm-market-avatar-button"
          type="button"
          onClick={() => {
            triggerTelegramSelection();
            onOpenMine?.();
          }}
        >
          {userAcronym}
        </button>
        <strong className="sm-market-brand">SubsMarket</strong>
        <IconButton
          className="sm-market-notifications"
          label="Действия"
          testId="market-notifications"
          onClick={() => {
            triggerTelegramSelection();
            onOpenActions?.();
          }}
        >
          <HugeiconsIcon aria-hidden icon={Notification02Icon} size={20} strokeWidth={1.8} />
          {pendingActionsCount > 0 ? (
            <span className="sm-market-notification-badge">
              {pendingActionsCount > 9 ? "9+" : pendingActionsCount}
            </span>
          ) : null}
        </IconButton>
      </header>

      <MarketSearch
        ariaLabel="Поиск сервиса или семьи"
        testId="market-search-input"
        value={searchTerm}
        placeholder="Найти YouTube, Beeline, GPT"
        onChange={setSearchTerm}
        onEnter={openInvite}
      />

      {isInviteCode ? (
        <button
          className="sm-market-button sm-market-button-secondary sm-market-button-full"
          type="button"
          onClick={openInvite}
        >
          Открыть семью по коду {inviteCode}
        </button>
      ) : null}

      {showFirstRunBanner ? (
        <section className="sm-market-alert" data-testid="market-first-run-banner">
          <div>
            <span className="sm-market-alert-eyebrow">Как это работает</span>
            <strong>Сначала доступ, потом оплата</strong>
            <p>Проверьте доступ и только затем оплачивайте долю владельцу.</p>
          </div>
          <button
            className="sm-market-button sm-market-button-primary sm-market-alert-action"
            type="button"
            onClick={() => {
              triggerTelegramSelection();
              window.localStorage.setItem(FIRST_RUN_BANNER_KEY, "true");
              setShowFirstRunBanner(false);
            }}
          >
            Понятно
          </button>
        </section>
      ) : pendingActionsCount > 0 ? (
        <section className="sm-market-alert sm-market-alert-attention" role="status">
          <div>
            <strong>
              {pendingActionsCount} {pluralRu(pendingActionsCount, "действие ждёт", "действия ждут", "действий ждут")} вас
            </strong>
            <p>Проверьте заявки, доступы и оплаты.</p>
          </div>
          <button
            className="sm-market-button sm-market-button-primary sm-market-alert-action"
            type="button"
            onClick={() => {
              triggerTelegramSelection();
              onOpenActions?.();
            }}
          >
            Открыть
          </button>
        </section>
      ) : null}

      <div className="sm-market-service-grid">
        <MarketTile
          data-testid="family-type-tariff"
          icon={<HugeiconsIcon aria-hidden icon={AntennaIcon} size={24} strokeWidth={1.8} />}
          title="Семейные тарифы"
          onClick={() => onOpenFamilyCatalog("tariff")}
        />
        <MarketTile
          data-testid="family-type-subscription"
          icon={<HugeiconsIcon aria-hidden icon={UserMultipleIcon} size={24} strokeWidth={1.8} />}
          title="Семейные подписки"
          onClick={() => onOpenFamilyCatalog("subscription")}
        />
        <MarketTile
          data-testid="market-buy-gigabytes"
          icon={<HugeiconsIcon aria-hidden icon={Wifi01Icon} size={24} strokeWidth={1.8} />}
          title="Гигабайты"
          onClick={onOpenGigabytes}
        />
        <MarketTile
          data-testid="market-buy-accounts"
          icon={<HugeiconsIcon aria-hidden icon={Key01Icon} size={24} strokeWidth={1.8} />}
          title="Аккаунты"
          onClick={onOpenAccounts}
        />
      </div>

      <section
        className="sm-market-family-section"
        aria-label={isMarketSearchActive ? "Результаты поиска" : "Предложения семей"}
      >
        <div className="sm-market-section-heading">
          <h2>{isMarketSearchActive ? "Результаты поиска" : "Свободные семьи"}</h2>
          {!isMarketSearchActive && hasHiddenFamilies ? (
            <button
              className="sm-market-section-link"
              type="button"
              onClick={() => {
                triggerTelegramSelection();
                onOpenFamilyCatalog(familyType);
              }}
            >
              Смотреть все
              <HugeiconsIcon aria-hidden icon={ArrowRight01Icon} size={16} strokeWidth={2} />
            </button>
          ) : null}
        </div>
        <FamilyCards
          families={visibleFamilies}
          familyType={familyType}
          hasHiddenFamilies={hasHiddenFamilies}
          isSearchActive={isMarketSearchActive}
          isLoading={Boolean(isLoading)}
          isLoadingMore={Boolean(isLoadingMoreFamilies)}
          joinedFamilyIds={joinedFamilyIds}
          pendingRequestFamilyIds={pendingRequestFamilyIds}
          onCreateFamily={onCreateFamily}
          onClearSearch={() => setSearchTerm("")}
          onOpenFamily={onOpenFamily}
          onRefresh={onRefresh}
        />
      </section>
    </div>
  );
}

function IconButton({
  children,
  className = "",
  label,
  testId,
  onClick
}: {
  children: ReactNode;
  className?: string;
  label: string;
  testId?: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={`sm-market-icon-button ${className}`.trim()}
      data-testid={testId}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MarketSearch({
  ariaLabel,
  placeholder,
  testId,
  value,
  onChange,
  onEnter
}: {
  ariaLabel: string;
  placeholder: string;
  testId: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
}) {
  return (
    <label className="sm-market-search">
      <HugeiconsIcon aria-hidden icon={Search01Icon} size={20} strokeWidth={1.8} />
      <input
        aria-label={ariaLabel}
        data-testid={testId}
        placeholder={placeholder}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onEnter?.();
        }}
      />
      {value ? (
        <button
          aria-label="Очистить поиск"
          className="sm-market-search-clear"
          type="button"
          onClick={() => onChange("")}
        >
          <HugeiconsIcon aria-hidden icon={Cancel01Icon} size={17} strokeWidth={2} />
        </button>
      ) : null}
    </label>
  );
}

function MarketTile({
  title,
  icon,
  onClick,
  ...buttonProps
}: {
  title: string;
  icon: ReactNode;
  onClick: () => void;
  "data-testid"?: string;
}) {
  return (
    <button
      {...buttonProps}
      className="sm-market-service-tile"
      type="button"
      onClick={() => {
        triggerTelegramSelection();
        onClick();
      }}
    >
      <span className="sm-market-service-icon" aria-hidden>{icon}</span>
      <span className="sm-market-service-copy">
        <strong>{title}</strong>
      </span>
      <HugeiconsIcon aria-hidden icon={ArrowRight01Icon} size={18} strokeWidth={2} />
    </button>
  );
}

function FamilyCards({
  familyType,
  families,
  joinedFamilyIds,
  pendingRequestFamilyIds,
  isLoading,
  isLoadingMore,
  hasHiddenFamilies,
  isSearchActive = false,
  onCreateFamily,
  onClearSearch,
  onLoadMoreFamilies,
  onOpenFamily,
  onRefresh
}: {
  familyType: FamilyType;
  families: Family[];
  joinedFamilyIds: Set<string>;
  pendingRequestFamilyIds: Set<string>;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasHiddenFamilies: boolean;
  isSearchActive?: boolean;
  onCreateFamily: (familyType: FamilyType) => void;
  onClearSearch?: () => void;
  onLoadMoreFamilies?: () => void;
  onOpenFamily: (familyId: string) => void;
  onRefresh?: () => void;
}) {
  if (isLoading && families.length === 0) {
    return (
      <div aria-label="Загружаем семьи" className="sm-market-family-list">
        {[0, 1, 2].map((item) => (
          <div className="sm-market-family-card sm-market-family-skeleton" key={item}>
            <span className="sm-market-skeleton sm-market-skeleton-logo" />
            <span className="sm-market-skeleton-copy">
              <span className="sm-market-skeleton sm-market-skeleton-title" />
              <span className="sm-market-skeleton sm-market-skeleton-line" />
            </span>
            <span className="sm-market-skeleton sm-market-skeleton-price" />
          </div>
        ))}
      </div>
    );
  }

  if (families.length === 0) {
    if (isSearchActive) {
      return (
        <section className="sm-market-empty" data-testid="market-empty-state">
          <div>
            <h3>Ничего не найдено</h3>
            <p>Попробуйте изменить запрос.</p>
          </div>
          <div className="sm-market-empty-actions">
            <button
              className="sm-market-button sm-market-button-secondary"
              type="button"
              onClick={onClearSearch}
            >
              Сбросить поиск
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="sm-market-empty" data-testid="market-empty-state">
        <div>
          <h3>Свободных семей пока нет</h3>
          <p>Создайте семью и пригласите участников.</p>
        </div>
        <div className="sm-market-empty-actions">
          <button
            className="sm-market-button sm-market-button-secondary"
            type="button"
            onClick={() => onRefresh?.()}
          >
            Обновить
          </button>
          <button
            className="sm-market-button sm-market-button-primary"
            data-testid="empty-create-family-button"
            type="button"
            onClick={() => onCreateFamily(familyType)}
          >
            Создать семью
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="sm-market-family-list">
      {families.map((family, index) => {
        const isMine = joinedFamilyIds.has(family.id);
        const isPending = pendingRequestFamilyIds.has(family.id);
        const isFull = family.status === "full" || family.free_slots <= 0;
        const statusLabel = isPending
          ? "Ожидает"
          : isMine
            ? "В семье"
            : isFull
              ? "Полная"
              : null;
        const badge = statusLabel ? null : familyBadge(index);
        const paymentSchedule = familyPaymentSchedule(family);

        return (
          <button
            className="sm-market-family-card"
            data-family-id={family.id}
            data-family-type={family.family_type}
            data-testid="family-card"
            key={family.id}
            type="button"
            onClick={() => onOpenFamily(family.id)}
          >
            <span
              className={`sm-market-family-main${
                family.family_type === "tariff" ? " sm-market-family-main-tariff" : ""
              }`}
            >
              <span className="sm-market-family-topline">
                <ServiceLogo family={family} />
                {family.family_type === "tariff" ? (
                  <strong className="sm-market-family-operator-name">{family.service_name}</strong>
                ) : (
                  <span aria-hidden />
                )}
                <span className="sm-market-family-schedule sm-market-family-schedule-inline">
                  {paymentSchedule.label} {paymentSchedule.date}
                </span>
              </span>
              <strong className="sm-market-family-plan-name">
                {family.family_type === "tariff"
                  ? family.plan_name || family.service_variant || "Семейный тариф"
                  : familyTitle(family)}
              </strong>
            </span>
            <span className="sm-market-family-bottomline">
              <span className="sm-market-family-price">
                <span className="sm-market-family-price-line">
                  <strong>{family.member_share_kzt.toLocaleString("ru-KZ")} ₸</strong>
                  <small>в месяц</small>
                </span>
              </span>
              <span className="sm-market-family-badge-slot">
                {badge ? (
                  <span className={`sm-market-proof sm-market-proof-${badge.kind}`}>
                    {badge.label}
                  </span>
                ) : null}
                {statusLabel ? (
                  <span className={`sm-market-status${isPending ? " sm-market-status-warning" : ""}`}>
                    {statusLabel}
                  </span>
                ) : null}
                {!badge && !statusLabel ? (
                  <HugeiconsIcon
                    aria-hidden
                    className="sm-market-family-chevron"
                    icon={ArrowRight01Icon}
                    size={18}
                    strokeWidth={2}
                  />
                ) : null}
              </span>
            </span>
          </button>
        );
      })}

      {hasHiddenFamilies && onLoadMoreFamilies ? (
        <button
          className="sm-market-button sm-market-button-secondary sm-market-button-full"
          disabled={isLoadingMore}
          type="button"
          onClick={() => {
            triggerTelegramSelection();
            onLoadMoreFamilies();
          }}
        >
          {isLoadingMore ? "Загружаем" : "Показать ещё"}
        </button>
      ) : null}
    </div>
  );
}
