import type { Family, FamilyRequest, FamilyType, MyFamily } from "../types";

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
  const subscriptionFamilies = families.filter(
    (family) => family.family_type === "subscription"
  );
  const tariffFamilies = families.filter((family) => family.family_type === "tariff");
  return (
    <div className="screen-stack">
      <section className="home-hero">
        <span className="eyebrow">Семейные подписки</span>
        <div>
          <h2>Найдите семью для подписки</h2>
          <p>
            SubsMarket помогает незнакомым людям объединяться в семьи подписок:
            сначала заявка и доступ, потом оплата напрямую владельцу.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={() => onSearch("subscription")}>
            Найти подписку
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => onCreate("subscription")}
          >
            Создать семью
          </button>
        </div>
      </section>

      <section className="trust-strip">
        <TrustStep title="1. Заявка" text="Владелец видит запрос и пишет вам в Telegram." />
        <TrustStep title="2. Доступ" text="Деньги переводятся только после выдачи доступа." />
        <TrustStep title="3. Контроль" text="Бот напоминает оплатить, владелец подтверждает." />
      </section>

      <section className="quick-grid">
        <HomeStat label="Семьи подписок" value={String(subscriptionFamilies.length)} />
        <HomeStat label="Мои семьи" value={String(myFamilies.length)} />
        <HomeStat label="Активные заявки" value={String(activeRequests.length)} />
        <HomeStat label="Семьи тарифов" value={String(tariffFamilies.length)} />
      </section>

      <section className="action-list">
        <HomeAction
          title="Найти семью подписки"
          text="YouTube, Spotify, Duolingo, Apple One и другие сервисы."
          onClick={() => onSearch("subscription")}
        />
        <HomeAction
          title="Создать свою семью"
          text="Цена делится поровну, владелец тоже занимает место."
          onClick={() => onCreate("subscription")}
        />
        <HomeAction
          title="Проверить мои семьи"
          text="Доступы, платежи, участники и действия владельца."
          onClick={onMine}
        />
        <HomeAction
          title="Семейные тарифы"
          text="Отдельный раздел для мобильных операторов, без сложных слотов."
          onClick={() => onSearch("tariff")}
        />
        <HomeAction
          title="Создать семью тарифа"
          text="Один участник тарифа равен одному месту, без сложных слотов."
          onClick={() => onCreate("tariff")}
        />
        <HomeAction
          title="Мои заявки"
          text="Ожидание, отмена, отклонение или истечение заявки."
          onClick={onRequests}
        />
      </section>
    </div>
  );
}

function TrustStep({ title, text }: { title: string; text: string }) {
  return (
    <div className="trust-step">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function HomeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="home-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function HomeAction({
  title,
  text,
  onClick
}: {
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="home-action" onClick={onClick}>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <b>›</b>
    </button>
  );
}
