import { ServiceLogo } from "../components/branding";
import type { Family, FamilyRequest, FamilyType, MyFamily } from "../types";

type ServiceDirection = {
  id: "subscriptions" | "accounts" | "gigabytes";
  title: string;
  subtitle: string;
  tone: "blue" | "mint" | "violet";
  onClick?: () => void;
};

const popularServices = [
  {
    name: "YouTube Premium",
    slug: "youtube-premium",
    price: "Доля от 650 ₸",
    slots: "1–6 мест"
  },
  {
    name: "Spotify Premium",
    slug: "spotify-family",
    price: "Доля от 590 ₸",
    slots: "1–6 мест"
  },
  {
    name: "Apple One",
    slug: "apple-one",
    price: "Доля от 1 290 ₸",
    slots: "1–6 мест"
  },
  {
    name: "Duolingo Super",
    slug: "duolingo-super",
    price: "Доля от 490 ₸",
    slots: "1–3 места"
  }
];

export function HomeScreen({
  myFamilies,
  myRequests,
  onSearch,
  onMine,
  onRequests
}: {
  families: Family[];
  myFamilies: MyFamily[];
  myRequests: FamilyRequest[];
  onSearch: (familyType: FamilyType) => void;
  onCreate: (familyType: FamilyType) => void;
  onMine: () => void;
  onRequests: () => void;
}) {
  const activeRequests = myRequests.filter((request) => request.status === "pending");
  const activeFamilies = myFamilies.filter((item) =>
    ["active", "full", "closing"].includes(item.membership.status)
  );

  const directions: ServiceDirection[] = [
    {
      id: "subscriptions",
      title: "Семейные подписки",
      subtitle: "YouTube, Spotify, Duolingo",
      tone: "blue",
      onClick: () => onSearch("subscription")
    },
    {
      id: "accounts",
      title: "Аккаунты и доступы",
      subtitle: "AI, обучение, сервисы",
      tone: "mint"
    },
    {
      id: "gigabytes",
      title: "Гигабайты / интернет",
      subtitle: "мобильный интернет",
      tone: "violet"
    }
  ];

  return (
    <div className="home-app" data-testid="home-screen">
      <section className="home-section">
        <h2 className="home-title">Что ищете?</h2>
        <div
          className="home-directions"
          aria-label="Разделы SubsMarket"
          data-testid="home-directions"
        >
          {directions.map((direction) => (
            <DirectionRow key={direction.id} direction={direction} />
          ))}
        </div>
      </section>

      <section className="home-section">
        <h3 className="home-section-title">Быстрые действия</h3>
        <div className="home-quick-actions" data-testid="home-quick-actions">
          <QuickAction
            title="Мои семьи"
            subtitle={activeFamilies.length > 0 ? "Активные" : "Пока пусто"}
            count={activeFamilies.length}
            icon="families"
            onClick={onMine}
          />
          <QuickAction
            title="Мои заявки"
            subtitle={activeRequests.length > 0 ? "Ожидают ответа" : "Нет активных"}
            count={activeRequests.length}
            icon="requests"
            onClick={onRequests}
          />
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <h3 className="home-section-title">Популярные сервисы</h3>
          <button
            type="button"
            className="home-link-button"
            onClick={() => onSearch("subscription")}
          >
            Смотреть все
          </button>
        </div>
        <div className="popular-service-list" data-testid="home-popular-services">
          {popularServices.map((service) => (
            <button
              key={service.slug}
              type="button"
              className="popular-service-row"
              onClick={() => onSearch("subscription")}
            >
              <ServiceLogo
                serviceSlug={service.slug}
                serviceName={service.name}
                familyType="subscription"
                size={42}
              />
              <span className="popular-service-copy">
                <strong>{service.name}</strong>
                <small>{service.price}</small>
              </span>
              <span className="popular-service-slots">{service.slots}</span>
              <span className="home-row-arrow" aria-hidden>
                ›
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function DirectionRow({ direction }: { direction: ServiceDirection }) {
  const content = (
    <>
      <span className={`direction-icon direction-icon-${direction.tone}`} aria-hidden>
        <DirectionGlyph id={direction.id} />
      </span>
      <span className="direction-copy">
        <strong>{direction.title}</strong>
        <small>{direction.subtitle}</small>
      </span>
      <span className="home-row-arrow" aria-hidden>
        ›
      </span>
    </>
  );

  if (!direction.onClick) {
    return (
      <div
        className="direction-row"
        role="button"
        tabIndex={0}
        aria-disabled="true"
        data-testid="home-direction-row"
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="direction-row"
      data-testid="home-direction-row"
      onClick={direction.onClick}
    >
      {content}
    </button>
  );
}

function QuickAction({
  title,
  subtitle,
  count,
  icon,
  onClick
}: {
  title: string;
  subtitle: string;
  count: number;
  icon: "families" | "requests";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="quick-action-card"
      data-testid="home-quick-action"
      onClick={onClick}
    >
      <span className={`quick-action-icon quick-action-icon-${icon}`} aria-hidden>
        <QuickActionGlyph icon={icon} />
      </span>
      <span className="quick-action-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      {count > 0 ? <span className="quick-action-count">{count}</span> : null}
    </button>
  );
}

function DirectionGlyph({ id }: { id: ServiceDirection["id"] }) {
  if (id === "subscriptions") {
    return (
      <svg viewBox="0 0 24 24" className="home-glyph">
        <circle cx="9" cy="9" r="3.1" />
        <circle cx="16.5" cy="9.8" r="2.5" />
        <path d="M3.9 18.7c.7-3.2 2.4-5 5.1-5s4.5 1.8 5.2 5" />
        <path d="M13.8 15c2.3.1 3.8 1.4 4.4 3.7" />
      </svg>
    );
  }

  if (id === "accounts") {
    return (
      <svg viewBox="0 0 24 24" className="home-glyph">
        <circle cx="8.2" cy="15.8" r="3.2" />
        <path d="M10.6 13.4 18 6" />
        <path d="m15.6 8.4 2 2" />
        <path d="m17.5 6.5 1.7 1.7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="home-glyph">
      <circle cx="12" cy="12" r="8" />
      <path d="M4.5 12h15" />
      <path d="M12 4.2c2 2.2 3 4.8 3 7.8s-1 5.6-3 7.8" />
      <path d="M12 4.2c-2 2.2-3 4.8-3 7.8s1 5.6 3 7.8" />
    </svg>
  );
}

function QuickActionGlyph({ icon }: { icon: "families" | "requests" }) {
  if (icon === "families") {
    return (
      <svg viewBox="0 0 24 24" className="home-glyph">
        <circle cx="8.5" cy="8.8" r="2.7" />
        <circle cx="16.2" cy="9.5" r="2.2" />
        <path d="M3.9 18.8c.7-3.1 2.3-4.8 4.7-4.8s4 1.7 4.7 4.8" />
        <path d="M13.6 15.1c2.1.2 3.5 1.5 4.1 3.7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="home-glyph">
      <path d="M7 4.7h8.1l2.9 2.9v11.7H7z" />
      <path d="M15 5v3h3" />
      <path d="M9.7 12h5.4" />
      <path d="M9.7 15.2h3.8" />
    </svg>
  );
}
