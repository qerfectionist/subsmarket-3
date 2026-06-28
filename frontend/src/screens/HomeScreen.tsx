import {
  Button as WorldButton,
  Chip,
  CircularIcon,
  ListItem,
  Typography
} from "@worldcoin/mini-apps-ui-kit-react";

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

type PrimaryAction = {
  id: "find" | "create";
  title: string;
  subtitle: string;
  badge: string;
  tone: "blue" | "dark";
  onClick: () => void;
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
  const ownerPendingRequests = myFamilies.reduce(
    (total, item) => total + item.pending_requests_count,
    0
  );
  const paymentsNeedingAttention = myFamilies.reduce(
    (total, item) =>
      total +
      item.payments.filter((payment) =>
        ["due", "overdue", "payment_reported"].includes(payment.status)
      ).length,
    0
  );
  const attentionCount =
    activeRequests.length + ownerPendingRequests + paymentsNeedingAttention;

  const primaryActions: PrimaryAction[] = [
    {
      id: "find",
      title: "Найти семью",
      subtitle:
        openFamilies.length > 0
          ? `${openFamilies.length} свободных семей в поиске`
          : "Посмотреть доступные подписки",
      badge: "Поиск",
      tone: "blue",
      onClick: () => onSearch("subscription")
    },
    {
      id: "create",
      title: "Создать семью",
      subtitle: "Открыть места и принимать заявки",
      badge: activeFamilies.length >= 2 ? "Лимит" : "Владелец",
      tone: "dark",
      onClick: () => onCreate("subscription")
    }
  ];

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
      <section className="home-section home-intro">
        <Typography as="span" variant="label" level={2} className="home-kicker">
          SubsMarket
        </Typography>
        <Typography as="h1" variant="heading" level={4} className="home-heading">
          Что хотите сделать?
        </Typography>
        <Typography as="p" variant="body" level={3} className="home-lead">
          Найдите место в семье или откройте свою. Остальное приложение ведёт по
          заявкам, доступу и оплатам.
        </Typography>
      </section>

      <section className="home-primary-actions" aria-label="Главные действия">
        {primaryActions.map((action) => (
          <PrimaryActionCard key={action.id} action={action} />
        ))}
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <Typography as="h2" variant="subtitle" level={2} className="home-title">
            Нужно внимание
          </Typography>
          <Chip
            label={attentionCount > 0 ? String(attentionCount) : "спокойно"}
            variant={attentionCount > 0 ? "warning" : "default"}
          />
        </div>
        <div className="home-quick-actions" data-testid="home-quick-actions">
          <QuickAction
            title="Мои семьи"
            subtitle={
              activeFamilies.length > 0
                ? `${activeFamilies.length} активных`
                : "Пока пусто"
            }
            count={activeFamilies.length}
            onClick={onMine}
          />
          <QuickAction
            title="Заявки"
            subtitle={
              activeRequests.length > 0
                ? "Ждут ответа владельца"
                : ownerPendingRequests > 0
                  ? "Есть заявки к вам"
                  : "Нет активных"
            }
            count={activeRequests.length + ownerPendingRequests}
            onClick={onRequests}
          />
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <Typography as="h2" variant="subtitle" level={2} className="home-title">
            Разделы
          </Typography>
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

      <section className="home-section">
        <div className="home-section-heading">
          <Typography as="h2" variant="subtitle" level={2} className="home-title">
            Популярное
          </Typography>
          <WorldButton
            type="button"
            variant="tertiary"
            size="sm"
            className="text-button"
            onClick={() => onSearch("subscription")}
          >
            Все семьи
          </WorldButton>
        </div>
        <div className="popular-service-list" data-testid="home-popular-services">
          {popularServices.map((service) => (
            <ListItem
              key={service.slug}
              type="button"
              label={service.name}
              description={`${service.price} за место`}
              startAdornment={
                <ServiceLogo
                  serviceSlug={service.slug}
                  serviceName={service.name}
                  familyType="subscription"
                  size={42}
                />
              }
              endAdornment={<Chip label={service.slots} variant="success" />}
              onClick={() => onSearch("subscription")}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function PrimaryActionCard({ action }: { action: PrimaryAction }) {
  const testId =
    action.id === "create" ? "home-create-family-button" : "home-search-family-button";

  return (
    <div className={`home-primary-action home-primary-action-${action.tone}`}>
      <ListItem
        type="button"
        label={action.title}
        description={action.subtitle}
        startAdornment={
          <CircularIcon className={`home-action-icon home-action-icon-${action.tone}`} size="md">
            <ActionGlyph id={action.id} />
          </CircularIcon>
        }
        endAdornment={
          <Chip
            label={action.badge}
            variant={action.tone === "blue" ? "success" : "default"}
          />
        }
        data-testid={testId}
        onClick={action.onClick}
      />
    </div>
  );
}

function DirectionCard({ direction }: { direction: Direction }) {
  const startAdornment = (
    <CircularIcon className={`direction-icon direction-icon-${direction.tone}`} size="md">
      <DirectionGlyph id={direction.id} />
    </CircularIcon>
  );
  const endAdornment = (
    <Chip
      label={direction.status}
      variant={direction.enabled ? "success" : "default"}
    />
  );

  if (!direction.enabled) {
    return (
      <ListItem
        label={direction.title}
        description={direction.subtitle}
        startAdornment={startAdornment}
        endAdornment={endAdornment}
        disabled
        data-testid="home-direction-row"
      />
    );
  }

  return (
    <ListItem
      type="button"
      label={direction.title}
      description={direction.subtitle}
      startAdornment={startAdornment}
      endAdornment={endAdornment}
      data-testid="home-direction-row"
      onClick={direction.onClick}
    />
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
    <ListItem
      type="button"
      label={title}
      description={subtitle}
      endAdornment={count > 0 ? <Chip label={String(count)} variant="error" /> : undefined}
      data-testid="home-quick-action"
      onClick={onClick}
    />
  );
}

function ActionGlyph({ id }: { id: PrimaryAction["id"] }) {
  if (id === "find") {
    return (
      <svg viewBox="0 0 24 24" className="home-glyph">
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="m15.2 15.2 4.3 4.3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="home-glyph">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
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
