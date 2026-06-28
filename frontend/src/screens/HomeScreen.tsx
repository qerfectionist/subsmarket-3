import { Chip, CircularIcon, ListItem, Typography } from "@worldcoin/mini-apps-ui-kit-react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CheckCircle2,
  Clock3,
  Grid2X2,
  KeyRound,
  Plus,
  Radio,
  ShieldCheck,
} from "lucide-react";

import { ServiceLogo } from "../components/branding";
import type { Family, FamilyRequest, FamilyType, MyFamily } from "../types";

type TodayTask = {
  id: "places" | "requests" | "payments";
  title: string;
  subtitle: string;
  badge: string;
  tone: "neutral" | "attention";
  Icon: LucideIcon;
  onClick: () => void;
};

type QuickAction = {
  id: "find" | "create" | "gigabytes" | "accounts";
  title: string;
  subtitle: string;
  tone: "blue" | "orange" | "green" | "violet";
  Icon: LucideIcon;
  enabled: boolean;
  onClick?: () => void;
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
  const requestCount = activeRequests.length + ownerPendingRequests;
  const recommendations = openFamilies.slice(0, 3);

  const todayTasks: TodayTask[] = [
    {
      id: "places",
      title: "Мои места",
      subtitle:
        activeFamilies.length > 0
          ? `${activeFamilies.length} активных`
          : "Пока нет активных мест",
      badge: String(activeFamilies.length),
      tone: "neutral",
      Icon: ShieldCheck,
      onClick: onMine
    },
    {
      id: "requests",
      title: "Заявки",
      subtitle:
        requestCount > 0
          ? "Есть новые действия"
          : "Новых заявок нет",
      badge: String(requestCount),
      tone: requestCount > 0 ? "attention" : "neutral",
      Icon: Bell,
      onClick: onRequests
    },
    {
      id: "payments",
      title: "Оплаты",
      subtitle:
        paymentsNeedingAttention > 0
          ? "Нужно проверить оплату"
          : "Таймеров на оплату нет",
      badge: paymentsNeedingAttention > 0 ? String(paymentsNeedingAttention) : "нет",
      tone: paymentsNeedingAttention > 0 ? "attention" : "neutral",
      Icon: Clock3,
      onClick: onMine
    }
  ];

  const quickActions: QuickAction[] = [
    {
      id: "find",
      title: "Найти место",
      subtitle: "подписка или тариф",
      tone: "blue",
      Icon: Grid2X2,
      enabled: true,
      onClick: () => onSearch("subscription")
    },
    {
      id: "create",
      title: "Создать семью",
      subtitle: activeFamilies.length >= 2 ? "лимит владельца" : "семейная подписка",
      tone: "orange",
      Icon: Plus,
      enabled: activeFamilies.length < 2,
      onClick: () => onCreate("subscription")
    },
    {
      id: "gigabytes",
      title: "Продать ГБ",
      subtitle: "лишний трафик",
      tone: "green",
      Icon: Radio,
      enabled: false,
    },
    {
      id: "accounts",
      title: "Аккаунт",
      subtitle: "GPT, Canva, Grok",
      tone: "violet",
      Icon: KeyRound,
      enabled: false,
    }
  ];

  return (
    <div className="home-app" data-testid="home-screen">
      <section className="home-section">
        <div className="home-section-heading">
          <Typography as="h2" variant="subtitle" level={2} className="home-title">
            Сегодня
          </Typography>
          {attentionCount > 0 ? <Chip label={String(attentionCount)} variant="warning" /> : null}
        </div>
        <div className="home-today-list" data-testid="home-today-list">
          {todayTasks.map((task) => (
            <TodayTaskRow key={task.id} task={task} />
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <Typography as="h2" variant="subtitle" level={2} className="home-title">
            Быстро
          </Typography>
        </div>
        <div className="home-fast-grid" aria-label="Быстрые действия">
          {quickActions.map((action) => (
            <QuickActionCard key={action.id} action={action} />
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-heading">
          <Typography as="h2" variant="subtitle" level={2} className="home-title">
            Для вас
          </Typography>
          <button
            type="button"
            className="home-link-button"
            onClick={() => onSearch("subscription")}
          >
            Все
          </button>
        </div>
        <div className="home-recommendations" data-testid="home-recommendations">
          {recommendations.length > 0 ? (
            recommendations.map((family) => (
              <RecommendationRow
                key={family.id}
                family={family}
                onClick={() => onSearch(family.family_type)}
              />
            ))
          ) : (
            <div className="home-empty-recommendation">
              <CheckCircle2 size={21} strokeWidth={2} />
              <span>Свободных семей пока нет</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TodayTaskRow({ task }: { task: TodayTask }) {
  return (
    <ListItem
      type="button"
      label={task.title}
      description={task.subtitle}
      startAdornment={
        <CircularIcon className="home-today-icon" size="md">
          <task.Icon size={23} strokeWidth={2.1} />
        </CircularIcon>
      }
      endAdornment={
        <span className={`home-task-badge home-task-badge-${task.tone}`}>{task.badge}</span>
      }
      data-testid="home-today-task"
      onClick={task.onClick}
    />
  );
}

function QuickActionCard({ action }: { action: QuickAction }) {
  const testId =
    action.id === "create" ? "home-create-family-button" : "home-search-family-button";
  const content = (
    <>
      <span className={`home-fast-icon home-fast-icon-${action.tone}`}>
        <action.Icon size={24} strokeWidth={2.2} />
      </span>
      <span className="home-fast-copy">
        <strong>{action.title}</strong>
        <small>{action.subtitle}</small>
      </span>
    </>
  );

  if (!action.enabled) {
    return (
      <div className="home-fast-card home-fast-card-disabled" data-testid="home-fast-action">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="home-fast-card"
      data-testid={testId}
      onClick={action.onClick}
    >
      {content}
    </button>
  );
}

function RecommendationRow({
  family,
  onClick
}: {
  family: Family;
  onClick: () => void;
}) {
  return (
    <ListItem
      type="button"
      label={`${family.service_name}${family.service_variant ? ` ${family.service_variant}` : ""}`}
      description={`${family.free_slots} ${slotLabel(family.free_slots)} свободно`}
      startAdornment={
        <ServiceLogo
          serviceSlug={family.service_slug}
          serviceName={family.service_name}
          familyType={family.family_type}
          size={46}
        />
      }
      endAdornment={
        <span className="home-recommendation-price">
          <strong>{family.member_share_kzt.toLocaleString("ru-KZ")}₸</strong>
          <small>/мес</small>
        </span>
      }
      data-testid="home-recommendation-row"
      onClick={onClick}
    />
  );
}

function slotLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "место";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "места";
  return "мест";
}
