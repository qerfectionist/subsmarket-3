import { Chip, CircularIcon, ListItem, Typography } from "@worldcoin/mini-apps-ui-kit-react";
import type { LucideIcon } from "lucide-react";
import { BadgePlus, KeyRound, Search, UsersRound, Wifi } from "lucide-react";

import type { Family, FamilyRequest, FamilyType, MyFamily } from "../types";

type Direction = {
  id: "family" | "accounts" | "gigabytes";
  title: string;
  subtitle: string;
  status: string;
  tone: "blue" | "neutral";
  enabled: boolean;
  Icon: LucideIcon;
  onClick?: () => void;
};

type PrimaryAction = {
  id: "find" | "create";
  title: string;
  subtitle: string;
  badge: string;
  tone: "blue" | "neutral";
  Icon: LucideIcon;
  onClick: () => void;
};

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
          ? `${openFamilies.length} семья открыта для заявок`
          : "Посмотреть доступные подписки",
      badge: "Поиск",
      tone: "blue",
      Icon: Search,
      onClick: () => onSearch("subscription")
    },
    {
      id: "create",
      title: "Создать семью",
      subtitle: "Открыть места для участников",
      badge: activeFamilies.length >= 2 ? "Лимит" : "Старт",
      tone: "neutral",
      Icon: BadgePlus,
      onClick: () => onCreate("subscription")
    }
  ];

  const directions: Direction[] = [
    {
      id: "family",
      title: "Подписки и тарифы",
      subtitle: "YouTube, Spotify, операторы",
      status: "Доступно",
      tone: "blue",
      enabled: true,
      Icon: UsersRound,
      onClick: () => onSearch("subscription")
    },
    {
      id: "accounts",
      title: "Аккаунты и доступы",
      subtitle: "AI-сервисы, обучение",
      status: "Скоро",
      tone: "neutral",
      enabled: false,
      Icon: KeyRound
    },
    {
      id: "gigabytes",
      title: "Гигабайты",
      subtitle: "Мобильный интернет",
      status: "Позже",
      tone: "neutral",
      enabled: false,
      Icon: Wifi
    }
  ];

  return (
    <div className="home-app" data-testid="home-screen">
      <section className="home-section home-intro">
        <Typography as="span" variant="label" level={2} className="home-kicker">
          SubsMarket
        </Typography>
        <Typography as="h1" variant="heading" level={4} className="home-heading">
          Что делаем?
        </Typography>
        <Typography as="p" variant="body" level={3} className="home-lead">
          Найдите место в семейной подписке или создайте свою семью.
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
            quietCount
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
            <action.Icon size={24} strokeWidth={2.2} />
          </CircularIcon>
        }
        endAdornment={
          <Chip
            label={action.badge}
            variant="default"
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
      <direction.Icon size={23} strokeWidth={2.1} />
    </CircularIcon>
  );
  const endAdornment = (
    <Chip
      label={direction.status}
      variant="default"
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
  quietCount = false,
  onClick
}: {
  title: string;
  subtitle: string;
  count: number;
  quietCount?: boolean;
  onClick: () => void;
}) {
  return (
    <ListItem
      type="button"
      label={title}
      description={subtitle}
      endAdornment={
        count > 0 ? (
          <Chip label={String(count)} variant={quietCount ? "default" : "error"} />
        ) : undefined
      }
      data-testid="home-quick-action"
      onClick={onClick}
    />
  );
}
