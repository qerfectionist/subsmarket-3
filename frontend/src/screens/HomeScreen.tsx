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
        <div>
          <h2>Экономьте вместе</h2>
          <p>
            Семьи подписок и тарифов: заявка сначала, доступ потом, оплата
            напрямую владельцу после проверки.
          </p>
        </div>
        <button type="button" onClick={() => onSearch("subscription")}>
          Найти семью
        </button>
      </section>

      <section className="quick-grid">
        <HomeStat label="Семьи подписок" value={String(subscriptionFamilies.length)} />
        <HomeStat label="Семьи тарифов" value={String(tariffFamilies.length)} />
        <HomeStat label="Мои семьи" value={String(myFamilies.length)} />
        <HomeStat label="Активные заявки" value={String(activeRequests.length)} />
      </section>

      <section className="action-list">
        <HomeAction
          title="Найти семью подписки"
          text="YouTube, Spotify, Duolingo, Apple One и другие сервисы."
          onClick={() => onSearch("subscription")}
        />
        <HomeAction
          title="Найти семью тарифа"
          text="Мобильные операторы отдельно от цифровых подписок."
          onClick={() => onSearch("tariff")}
        />
        <HomeAction
          title="Создать свою семью"
          text="Цена делится поровну, владелец тоже занимает место."
          onClick={() => onCreate("subscription")}
        />
        <HomeAction
          title="Создать семью тарифа"
          text="Один участник тарифа равен одному месту, без сложных слотов."
          onClick={() => onCreate("tariff")}
        />
        <HomeAction
          title="Проверить мои семьи"
          text="Доступы, платежи, участники и действия владельца."
          onClick={onMine}
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

