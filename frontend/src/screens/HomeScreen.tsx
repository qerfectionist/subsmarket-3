import { ServiceLogo } from "../components/branding";
import type { Family, FamilyRequest, FamilyType, MyFamily } from "../types";

type Direction = {
  id: "family" | "accounts" | "gigabytes";
  title: string;
  subtitle: string;
  status: string;
  tone: "blue" | "violet" | "amber";
  enabled: boolean;
  onClick?: () => void;
};

const popularServices = [
  {
    name: "YouTube Premium",
    slug: "youtube-premium",
    price: "от 650 ₸",
    slots: "1-6 мест"
  },
  {
    name: "Spotify Premium",
    slug: "spotify-family",
    price: "от 590 ₸",
    slots: "1-6 мест"
  },
  {
    name: "Apple One",
    slug: "apple-one",
    price: "от 1 290 ₸",
    slots: "1-6 мест"
  }
];

export function HomeScreen({
  families,
  myFamilies,
  myRequests,
  onSearch,
  onCreate,
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
    ["active", "full", "closing", "awaiting_access", "awaiting_confirmation"].includes(
      item.membership.status
    )
  );
  const openFamilies = families.filter((family) => family.free_slots > 0);

  const directions: Direction[] = [
    {
      id: "family",
      title: "Подписки и тарифы",
      subtitle: "YouTube, Spotify, операторы",
      status: "Работает",
      tone: "blue",
      enabled: true,
      onClick: () => onSearch("subscription")
    },
    {
      id: "accounts",
      title: "Аккаунты и доступы",
      subtitle: "AI-сервисы, обучение, цифровые продукты",
      status: "Скоро",
      tone: "violet",
      enabled: false
    },
    {
      id: "gigabytes",
      title: "Гигабайты / интернет",
      subtitle: "Витрина мобильного интернета",
      status: "Позже",
      tone: "amber",
      enabled: false
    }
  ];

  return (
    <div className="home-app" data-testid="home-screen">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">SubsMarket</span>
          <h1>Семьи для подписок и тарифов</h1>
          <p>
            Создавайте семью, принимайте заявки и контролируйте оплаты в одном
            Mini App.
          </p>
        </div>
        <div className="hero-stats" aria-label="Сводка">
          <div>
            <strong>{openFamilies.length}</strong>
            <span>семей в поиске</span>
          </div>
          <div>
            <strong>{activeFamilies.length}</strong>
            <span>моих семей</span>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <h2 className="home-title">Что нужно?</h2>
        </div>
        <div
          className="home-directions"
          aria-label="Разделы SubsMarket"
          data-testid="home-directions"
        >
          {directions.map((direction) => (
            <DirectionCard key={direction.id} direction={direction} />
          ))}
        </div>
      </section>

      <section className="home-actions-strip" aria-label="Быстрые действия">
        <button
          type="button"
          className="primary-action-card"
          data-testid="home-create-family-button"
          onClick={() => onCreate("subscription")}
        >
          <span>Создать семью</span>
          <strong>Открыть места и собрать участников</strong>
        </button>
        <div className="home-quick-actions" data-testid="home-quick-actions">
          <QuickAction
            title="Мои семьи"
            subtitle={activeFamilies.length > 0 ? "Активные" : "Пока пусто"}
            count={activeFamilies.length}
            onClick={onMine}
          />
          <QuickAction
            title="Заявки"
            subtitle={activeRequests.length > 0 ? "Ждут ответа" : "Нет активных"}
            count={activeRequests.length}
            onClick={onRequests}
          />
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <h2 className="home-title">Популярное</h2>
          <button
            type="button"
            className="text-button"
            onClick={() => onSearch("subscription")}
          >
            Все семьи
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
                <small>{service.price} за место</small>
              </span>
              <span className="popular-service-slots">{service.slots}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function DirectionCard({ direction }: { direction: Direction }) {
  const content = (
    <>
      <span className={`direction-icon direction-icon-${direction.tone}`} aria-hidden>
        <DirectionGlyph id={direction.id} />
      </span>
      <span className="direction-copy">
        <strong>{direction.title}</strong>
        <small>{direction.subtitle}</small>
      </span>
      <span className={direction.enabled ? "direction-status" : "direction-status muted-pill"}>
        {direction.status}
      </span>
    </>
  );

  if (!direction.enabled) {
    return (
      <div
        className="direction-card direction-card-disabled"
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
      className="direction-card"
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
  onClick
}: {
  title: string;
  subtitle: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="quick-action-card"
      data-testid="home-quick-action"
      onClick={onClick}
    >
      <span className="quick-action-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      {count > 0 ? <span className="quick-action-count">{count}</span> : null}
    </button>
  );
}

function DirectionGlyph({ id }: { id: Direction["id"] }) {
  if (id === "family") {
    return (
      <svg viewBox="0 0 24 24" className="home-glyph">
        <circle cx="9" cy="9" r="3" />
        <circle cx="16.4" cy="9.8" r="2.5" />
        <path d="M4 19c.7-3.2 2.4-5 5-5s4.3 1.8 5 5" />
        <path d="M13.6 15c2.4.1 3.9 1.5 4.5 4" />
      </svg>
    );
  }
  if (id === "accounts") {
    return (
      <svg viewBox="0 0 24 24" className="home-glyph">
        <circle cx="8" cy="16" r="3" />
        <path d="M10.4 13.6 18 6" />
        <path d="m15.8 8.2 2 2" />
        <path d="m17.6 6.4 1.8 1.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="home-glyph">
      <circle cx="12" cy="12" r="8" />
      <path d="M4.5 12h15" />
      <path d="M12 4.3c2 2.2 3 4.8 3 7.7s-1 5.5-3 7.7" />
      <path d="M12 4.3c-2 2.2-3 4.8-3 7.7s1 5.5 3 7.7" />
    </svg>
  );
}
