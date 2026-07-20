import { useEffect, useMemo, useRef, useState } from "react";
import {
  CardSim,
  KeyRound,
  RadioTower,
  Search as SearchIcon,
  UsersRound
} from "lucide-react";

import { FamilyListItem } from "../components/families";
import { Panel } from "../components/layout";
import { FamilyListSkeleton } from "../components/skeleton";
import type { Family, FamilyService, FamilyType } from "../types";

const FIRST_RUN_BANNER_KEY = "subsmarket.firstRunBannerSeen.v1";
const MARKET_HOME_FAMILY_LIMIT = 5;

type MarketBannerTone = "blue" | "dark" | "green" | "amber" | "violet";

type MarketHeroBanner = {
  key: string;
  tone: MarketBannerTone;
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

type MarketSection = "tariff" | "subscription" | "gigabytes" | "accounts";

export type MarketBannerMetrics = {
  pendingJoinRequests: number;
  paymentConfirmations: number;
  memberDuePayments: number;
  accessConfirmations: number;
  activeFamilies: number;
  ownedFamilies: number;
  joinedFamilies: number;
  freeFamilies: number;
  freeSlots: number;
};

function pluralRu(value: number, one: string, few: string, many: string) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function SearchScreen({
  familyType,
  services,
  typedServices,
  filteredFamilies,
  bannerMetrics,
  busy,
  isLoading,
  hasMoreFamilies,
  isLoadingMoreFamilies,
  onChangeFamilyType,
  onChangeFamilyFilter,
  onRefresh,
  onLoadMoreFamilies,
  onOpenFamily,
  onOpenInvite,
  onCreateFamily,
  onCreateRequest,
  resetToken,
  pendingActionsCount,
  onOpenMine,
  onOpenActions,
  onOpenGigabytes
}: {
  familyType: FamilyType;
  services: FamilyService[];
  typedServices: FamilyService[];
  filteredFamilies: Family[];
  bannerMetrics: MarketBannerMetrics;
  busy: string | null;
  isLoading?: boolean;
  hasMoreFamilies?: boolean;
  isLoadingMoreFamilies?: boolean;
  onChangeFamilyType: (familyType: FamilyType) => void;
  onChangeFamilyFilter: (value: string) => void;
  onRefresh: () => void;
  onLoadMoreFamilies?: () => void;
  onOpenFamily: (familyId: string) => void;
  onOpenInvite: (code: string) => void;
  onCreateFamily: (familyType: FamilyType) => void;
  onCreateRequest: (familyId: string) => void;
  resetToken?: number;
  pendingActionsCount?: number;
  onOpenMine?: () => void;
  onOpenActions?: () => void;
  onOpenGigabytes: () => void;
}) {
  const [inviteCode, setInviteCode] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [heroIndex, setHeroIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<MarketSection | null>(null);
  const [showFirstRunBanner, setShowFirstRunBanner] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(FIRST_RUN_BANNER_KEY) !== "true";
  });
  const heroCarouselRef = useRef<HTMLElement | null>(null);
  const normalizedInviteCode = inviteCode.replace(/\D/g, "").slice(0, 8);
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  useEffect(() => {
    setSearchTerm("");
    setActiveSection(null);
  }, [resetToken]);

  const displayFamilies = normalizedSearchTerm
    ? filteredFamilies.filter((family) =>
        [
          family.service_name,
          family.service_variant ?? "",
          family.plan_name ?? "",
          family.owner.first_name
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearchTerm)
      )
    : filteredFamilies;
  const marketHomeFamilies = displayFamilies.slice(0, MARKET_HOME_FAMILY_LIMIT);
  const hasHiddenMarketHomeFamilies =
    displayFamilies.length > marketHomeFamilies.length || Boolean(hasMoreFamilies);
  const hasPendingActions =
    pendingActionsCount !== undefined && pendingActionsCount > 0 && Boolean(onOpenActions);

  useEffect(() => {
    if (!hasPendingActions) return;
    setHeroIndex(0);
    heroCarouselRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [hasPendingActions, pendingActionsCount]);

  const heroBanners = useMemo<MarketHeroBanner[]>(() => {
    const banners: MarketHeroBanner[] = [];
    const openMine = onOpenMine;
    const openActions = onOpenActions;
    const hideFirstRunBanner = () => {
      window.localStorage.setItem(FIRST_RUN_BANNER_KEY, "true");
      setShowFirstRunBanner(false);
      setHeroIndex(0);
      heroCarouselRef.current?.scrollTo({ left: 0, behavior: "smooth" });
    };

    if (hasPendingActions && pendingActionsCount !== undefined && openActions) {
      banners.push({
        key: "pending-actions",
        tone: "blue",
        eyebrow: "требует внимания",
        title: `${pendingActionsCount} ${pluralRu(
          pendingActionsCount,
          "действие ждёт",
          "действия ждут",
          "действий ждут"
        )} ответа`,
        description: "Проверьте заявки, оплаты и подтверждения.",
        actionLabel: "Открыть действия",
        onAction: openActions
      });
    }

    if (showFirstRunBanner) {
      banners.push({
        key: "first-run",
        tone: "blue",
        eyebrow: "первый вход",
        title: "С чего начать?",
        description: "Найдите место в семье или создайте свою. Оплата только после доступа.",
        actionLabel: "Понятно",
        onAction: hideFirstRunBanner
      });
    }

    if (bannerMetrics.accessConfirmations > 0) {
      banners.push({
        key: "access-confirmations",
        tone: "amber",
        eyebrow: "доступ",
        title: "Подтвердите доступ",
        description: `${bannerMetrics.accessConfirmations} ${pluralRu(
          bannerMetrics.accessConfirmations,
          "семья ждёт",
          "семьи ждут",
          "семей ждут"
        )} проверки доступа.`,
        actionLabel: "Открыть",
        onAction: openActions
      });
    }

    if (bannerMetrics.paymentConfirmations > 0) {
      banners.push({
        key: "payment-confirmations",
        tone: "dark",
        eyebrow: "оплаты",
        title: "Проверьте переводы",
        description: `${bannerMetrics.paymentConfirmations} ${pluralRu(
          bannerMetrics.paymentConfirmations,
          "оплата ждёт",
          "оплаты ждут",
          "оплат ждут"
        )} подтверждения владельцем.`,
        actionLabel: "К оплатам",
        onAction: openActions
      });
    }

    if (bannerMetrics.pendingJoinRequests > 0) {
      banners.push({
        key: "join-requests",
        tone: "green",
        eyebrow: "заявки",
        title: "Кандидаты ждут",
        description: `${bannerMetrics.pendingJoinRequests} ${pluralRu(
          bannerMetrics.pendingJoinRequests,
          "заявка",
          "заявки",
          "заявок"
        )} на вступление в ваши семьи.`,
        actionLabel: "Посмотреть",
        onAction: openActions
      });
    }

    if (bannerMetrics.memberDuePayments > 0) {
      banners.push({
        key: "member-payments",
        tone: "amber",
        eyebrow: "к оплате",
        title: "Есть платежи",
        description: "Отметьте оплату, чтобы владелец подтвердил получение.",
        actionLabel: "Мои места",
        onAction: openActions
      });
    }

    if (bannerMetrics.activeFamilies > 0) {
      banners.push({
        key: "active-families",
        tone: "violet",
        eyebrow: "ваши места",
        title: "Семьи активны",
        description: `${bannerMetrics.joinedFamilies} ${pluralRu(
          bannerMetrics.joinedFamilies,
          "место",
          "места",
          "мест"
        )} у вас · ${bannerMetrics.ownedFamilies} ${pluralRu(
          bannerMetrics.ownedFamilies,
          "семья",
          "семьи",
          "семей"
        )} под управлением.`,
        actionLabel: "Открыть",
        onAction: openMine
      });
    }

    banners.push({
      key: "free-families",
      tone: "blue",
      eyebrow: "свободно сейчас",
      title:
        bannerMetrics.freeFamilies > 0
          ? `${bannerMetrics.freeSlots} ${pluralRu(bannerMetrics.freeSlots, "место", "места", "мест")}`
          : "Новых мест пока нет",
      description:
        bannerMetrics.freeFamilies > 0
          ? `${bannerMetrics.freeFamilies} ${pluralRu(
              bannerMetrics.freeFamilies,
              "семья",
              "семьи",
              "семей"
            )} в поиске по подпискам и тарифам.`
          : "Можно создать свою семью и собрать участников.",
      actionLabel: bannerMetrics.freeFamilies > 0 ? "Смотреть" : "Создать",
      onAction: bannerMetrics.freeFamilies > 0 ? onRefresh : () => onCreateFamily(familyType)
    });

    return banners.slice(0, 6);
  }, [
    bannerMetrics,
    familyType,
    hasPendingActions,
    onCreateFamily,
    onOpenMine,
    onOpenActions,
    onRefresh,
    pendingActionsCount,
    showFirstRunBanner
  ]);
  const currentHeroIndex = Math.min(heroIndex, Math.max(0, heroBanners.length - 1));
  const activeSectionCopy = activeSection ? MARKET_SECTION_COPY[activeSection] : null;
  const activeFamilyType: FamilyType | null =
    activeSection === "subscription" || activeSection === "tariff" ? activeSection : null;
  const isFamilyWindow = activeFamilyType !== null;
  const activeSectionFamilies =
    activeFamilyType !== null && activeFamilyType === familyType ? displayFamilies : [];

  if (activeSectionCopy) {
    return (
      <div className="market-home market-section-page" data-testid={`market-section-${activeSection}`}>
        <Panel>
          <section className="market-section-screen">
            <header className="market-section-top">
              <button
                type="button"
                className="market-section-back"
                onClick={() => {
                  setSearchTerm("");
                  setActiveSection(null);
                }}
              >
                Назад
              </button>
              <span className={`market-fast-icon ${activeSectionCopy.iconClass}`}>
                {activeSection === "tariff" ? <RadioTower size={24} /> : null}
                {activeSection === "subscription" ? <UsersRound size={24} /> : null}
                {activeSection === "gigabytes" ? <CardSim size={23} /> : null}
                {activeSection === "accounts" ? <KeyRound size={23} /> : null}
              </span>
              <div>
                <p>{activeSectionCopy.eyebrow}</p>
                <h1>{activeSectionCopy.title}</h1>
                <span>{activeSectionCopy.description}</span>
              </div>
            </header>

            {activeFamilyType ? (
              <>
                <div className="market-section-actions" aria-label="Функции раздела">
                  <button type="button" className="market-section-action-active">
                    <strong>Свободные места</strong>
                    <span>{activeSectionFamilies.length} семей</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreateFamily(activeFamilyType)}
                  >
                    <strong>Создать семью</strong>
                    <span>собрать участников</span>
                  </button>
                </div>

                <label className="market-search-box" aria-label="Поиск внутри раздела">
                  <SearchIcon size={19} aria-hidden />
                  <input
                    type="search"
                    value={searchTerm}
                    placeholder={
                      activeFamilyType === "tariff"
                        ? "Найти Beeline, Kcell, activ..."
                        : "Найти YouTube, Spotify, Netflix..."
                    }
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </label>

                {isLoading && activeSectionFamilies.length === 0 ? (
                  <FamilyListSkeleton count={4} />
                ) : activeSectionFamilies.length === 0 ? (
                  <button
                    type="button"
                    className="market-empty-row"
                    onClick={() => onCreateFamily(activeFamilyType)}
                  >
                    <span>Свободных семей пока нет</span>
                    <strong>Создать</strong>
                  </button>
                ) : (
                  <div className="wallet-list-group">
                    {activeSectionFamilies.map((family) => (
                      <FamilyListItem
                        key={family.id}
                        family={family}
                        busy={busy}
                        onOpen={() => onOpenFamily(family.id)}
                        onRequest={() => onCreateRequest(family.id)}
                      />
                    ))}
                    {hasMoreFamilies && onLoadMoreFamilies ? (
                      <button
                        type="button"
                        className="market-more-row"
                        disabled={isLoadingMoreFamilies}
                        onClick={() => onLoadMoreFamilies()}
                      >
                        <span>
                          {isLoadingMoreFamilies
                            ? "Загружаем места..."
                            : "Ещё свободные места"}
                        </span>
                        <strong>{isLoadingMoreFamilies ? "..." : "Смотреть"}</strong>
                      </button>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="market-section-actions" aria-label="Функции раздела">
                  {activeSectionCopy.actions.map((action, index) => (
                    <button
                      key={action.title}
                      type="button"
                      data-testid={`market-section-action-${activeSection}-${index}`}
                      className={action.primary ? "market-section-action-active" : ""}
                      disabled
                    >
                      <strong>{action.title}</strong>
                      <span>{action.description}</span>
                    </button>
                  ))}
                </div>
                <div className="market-section-soon" data-testid={`market-section-soon-${activeSection}`}>
                  <strong>{activeSectionCopy.soonTitle}</strong>
                  <p>{activeSectionCopy.soonText}</p>
                </div>
              </>
            )}
          </section>
        </Panel>
      </div>
    );
  }

  return (
    <div className="market-home" data-testid="market-screen">
      <Panel>
      <div className="sr-only" aria-hidden>
        <input
          data-testid="invite-code-input"
          inputMode="numeric"
          maxLength={8}
          tabIndex={-1}
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value)}
        />
        <button
          type="button"
          data-testid="open-invite-button"
          disabled={busy !== null || normalizedInviteCode.length !== 8}
          onClick={() => onOpenInvite(normalizedInviteCode)}
        >
          Открыть код
        </button>
        <button
          type="button"
          data-testid="family-type-subscription"
          onClick={() => onChangeFamilyType("subscription")}
        >
          Подписки
        </button>
        <button
          type="button"
          data-testid="family-type-tariff"
          onClick={() => onChangeFamilyType("tariff")}
        >
          Тарифы
        </button>
      </div>

      <div className="market-hero-wrap">
        <section
          ref={heroCarouselRef}
          className="market-hero-carousel"
          aria-label="Подсказки SubsMarket"
          onScroll={(event) => {
            const target = event.currentTarget;
            const card = target.querySelector<HTMLElement>(".market-hero-card");
            const cardWidth = (card?.offsetWidth ?? target.clientWidth) + 10;
            const nextIndex = Math.round(target.scrollLeft / Math.max(1, cardWidth));
            setHeroIndex(Math.max(0, Math.min(heroBanners.length - 1, nextIndex)));
          }}
        >
          {heroBanners.map((banner) => (
            <article
              key={banner.key}
              className={`market-hero-card market-hero-card-${banner.tone}`}
              data-testid={`market-hero-${banner.key}`}
            >
              <span>{banner.eyebrow}</span>
              <strong>{banner.title}</strong>
              <p>{banner.description}</p>
              {banner.actionLabel && banner.onAction ? (
                <button
                  type="button"
                  className="market-hero-action"
                  onClick={banner.onAction}
                >
                  {banner.actionLabel}
                </button>
              ) : null}
            </article>
          ))}
        </section>
        <div className="market-hero-dots" aria-label="Слайды баннера">
          {heroBanners.map((banner, index) => (
            <button
              key={banner.key}
              type="button"
              className={index === currentHeroIndex ? "market-hero-dot-active" : ""}
              aria-label={`Показать баннер ${index + 1}`}
              onClick={() => {
                const target = heroCarouselRef.current;
                if (!target) return;
                const card = target.querySelector<HTMLElement>(".market-hero-card");
                const cardWidth = (card?.offsetWidth ?? target.clientWidth) + 10;
                target.scrollTo({
                  left: index * cardWidth,
                  behavior: "smooth"
                });
                setHeroIndex(index);
              }}
            />
          ))}
        </div>
      </div>

      <div className="market-fast-grid" aria-label="Разделы SubsMarket">
        <button
          type="button"
          className="market-fast-card"
          data-testid="market-find-tariff"
          onClick={() => {
            onChangeFamilyType("tariff");
            onChangeFamilyFilter("all");
            setSearchTerm("");
            setActiveSection("tariff");
          }}
        >
          <span className="market-fast-icon market-fast-icon-green">
            <RadioTower size={24} />
          </span>
          <span className="market-fast-copy">
            <strong>Найти семейный тариф</strong>
            <small>операторы связи</small>
          </span>
        </button>
        <button
          type="button"
          className="market-fast-card"
          data-testid="market-find-subscription"
          onClick={() => {
            onChangeFamilyType("subscription");
            onChangeFamilyFilter("all");
            setSearchTerm("");
            setActiveSection("subscription");
          }}
        >
          <span className="market-fast-icon market-fast-icon-blue">
            <UsersRound size={24} />
          </span>
          <span className="market-fast-copy">
            <strong>Найти семейную подписку</strong>
            <small>YouTube, Spotify, AI</small>
          </span>
        </button>
        <button
          type="button"
          className="market-fast-card"
          data-testid="market-buy-gigabytes"
          onClick={onOpenGigabytes}
        >
          <span className="market-fast-icon market-fast-icon-orange">
            <CardSim size={23} />
          </span>
          <span className="market-fast-copy">
            <strong>Купить гигабайты</strong>
            <small>объявления продавцов</small>
          </span>
        </button>
        <button
          type="button"
          className="market-fast-card"
          data-testid="market-buy-accounts"
          onClick={() => {
            setSearchTerm("");
            setActiveSection("accounts");
          }}
        >
          <span className="market-fast-icon market-fast-icon-violet">
            <KeyRound size={23} />
          </span>
          <span className="market-fast-copy">
            <strong>Купить аккаунты</strong>
            <small>GPT, Canva, Grok</small>
          </span>
        </button>
      </div>

      <section className="market-recommendations" aria-label="Рекомендации">
        {isLoading && marketHomeFamilies.length === 0 ? (
          <FamilyListSkeleton count={4} />
        ) : marketHomeFamilies.length === 0 ? (
          <button
            type="button"
            className="market-empty-row"
            data-testid="empty-create-family-button"
            onClick={() => onCreateFamily(familyType)}
          >
            <span>Свободных семей пока нет</span>
            <strong>Создать</strong>
          </button>
        ) : (
          <div className="wallet-list-group">
            {marketHomeFamilies.map((family) => (
              <FamilyListItem
                key={family.id}
                family={family}
                busy={busy}
                compact
                onOpen={() => onOpenFamily(family.id)}
                onRequest={() => onCreateRequest(family.id)}
              />
            ))}
            {hasHiddenMarketHomeFamilies && onLoadMoreFamilies ? (
              <button
                type="button"
                className="market-more-row"
                disabled={isLoadingMoreFamilies}
                onClick={() => {
                  onChangeFamilyFilter("all");
                  setSearchTerm("");
                  onLoadMoreFamilies();
                }}
              >
                <span>
                  {isLoadingMoreFamilies
                    ? "Загружаем места..."
                    : "Ещё свободные места"}
                </span>
                <strong>{isLoadingMoreFamilies ? "..." : "Смотреть"}</strong>
              </button>
            ) : null}
          </div>
        )}
      </section>
      </Panel>
    </div>
  );
}

const MARKET_SECTION_COPY: Record<
  MarketSection,
  {
    eyebrow: string;
    title: string;
    description: string;
    iconClass: string;
    soonTitle: string;
    soonText: string;
    actions: Array<{ title: string; description: string; primary?: boolean }>;
  }
> = {
  tariff: {
    eyebrow: "семейные тарифы",
    title: "Найти семейный тариф",
    description: "Места у владельцев тарифов операторов связи.",
    iconClass: "market-fast-icon-green",
    soonTitle: "",
    soonText: "",
    actions: []
  },
  subscription: {
    eyebrow: "семейные подписки",
    title: "Найти семейную подписку",
    description: "YouTube, Spotify, Netflix, Duolingo и другие сервисы.",
    iconClass: "market-fast-icon-blue",
    soonTitle: "",
    soonText: "",
    actions: []
  },
  gigabytes: {
    eyebrow: "объявления",
    title: "Купить гигабайты",
    description: "Покупка мобильного интернета у продавцов.",
    iconClass: "market-fast-icon-orange",
    soonTitle: "Раздел объявлений готовим следующим этапом",
    soonText:
      "Здесь будут карточки продавцов, заявка на покупку и переход в личный Telegram-чат.",
    actions: [
      { title: "Купить ГБ", description: "найти продавца", primary: true },
      { title: "Продать ГБ", description: "создать объявление" },
      { title: "Мои заявки", description: "покупки и продажи" }
    ]
  },
  accounts: {
    eyebrow: "объявления",
    title: "Купить аккаунты",
    description: "AI-сервисы, обучение, цифровые продукты.",
    iconClass: "market-fast-icon-violet",
    soonTitle: "Раздел аккаунтов будет отдельной витриной",
    soonText:
      "Покупатель оставит заявку, продавец примет её и откроется личный чат с готовым текстом.",
    actions: [
      { title: "Купить аккаунт", description: "AI, обучение, сервисы", primary: true },
      { title: "Продать доступ", description: "создать объявление" },
      { title: "Мои заявки", description: "статусы и чат" }
    ]
  }
};
