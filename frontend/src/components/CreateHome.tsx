import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { Panel } from "./layout";
import { ServiceLogo } from "./branding";
import { SystemSymbol } from "./SystemSymbol";
import { triggerTelegramSelection } from "../telegram";
import { servicePopularity } from "./families/createFamilyForm";
import { CREATE_TITLES, type CreateCategory } from "./CreateCategoryPicker";
import { useAccountServices, useMarketplaceOperators } from "../hooks/useApi";
import { useFeedSnap } from "../hooks/useFeedSnap";
import { ScrollToTopButton } from "./ScrollToTopButton";
import type { FamilyService } from "../types";

const KIND_ICONS: Record<
  CreateCategory,
  "person.2" | "antenna.radiowaves.left.and.right" | "key" | "globe"
> = {
  subscription: "person.2",
  tariff: "antenna.radiowaves.left.and.right",
  accounts: "key",
  gigabytes: "globe"
};

/** What is created most often, mixed across the four categories. */
const POPULAR_ORDER: [CreateCategory, string][] = [
  ["subscription", "youtube-premium"],
  ["tariff", "tele2-family-tariff"],
  ["accounts", "chatgpt"],
  ["gigabytes", "tele2"],
  ["subscription", "yandex-plus"],
  ["subscription", "spotify-family"],
  ["tariff", "beeline-family-tariff"],
  ["accounts", "telegram-premium"],
  ["gigabytes", "beeline"],
  ["subscription", "netflix-premium"],
  ["accounts", "claude"],
  ["tariff", "activ-family-tariff"],
  ["gigabytes", "activ"],
  ["subscription", "apple-music"],
  ["accounts", "gemini"],
  ["subscription", "icloud-plus-2tb"],
  ["accounts", "youtube-premium"],
  ["subscription", "google-one"],
  ["accounts", "spotify"],
  ["accounts", "canva"]
];

const FILTERS: { id: "all" | CreateCategory; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "subscription", label: "Подписки" },
  { id: "tariff", label: "Тарифы" },
  { id: "accounts", label: "Аккаунты" },
  { id: "gigabytes", label: "Гигабайты" }
];

type PopularItem = {
  key: string;
  kind: CreateCategory;
  title: string;
  subtitle: string;
  logoSlug: string;
  tariffLogo: boolean;
  open: () => void;
};

/** «ChatGPT, Claude и ещё 9»: the names that fit on one line, then how many more. */
function examples(names: string[]) {
  const shown: string[] = [];
  for (const name of names.slice(0, 2)) {
    if (shown.length && [...shown, name].join(", ").length > 24) break;
    shown.push(name);
  }
  const rest = names.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} и ещё ${rest}` : shown.join(", ");
}

/** «до 1 места», «до 6 мест». */
function upToSeats(count: number) {
  return `до ${count} ${count % 10 === 1 && count % 100 !== 11 ? "места" : "мест"}`;
}

/**
 * True once the last row is fully in view, so «Наверх» shows up only at the
 * end of the list and hides again as soon as the list moves back up.
 */
function useReachedEnd(containerRef: RefObject<HTMLElement | null>, rowSelector: string, itemCount: number) {
  const [reached, setReached] = useState(false);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const rows = container.querySelectorAll<HTMLElement>(rowSelector);
      const last = rows[rows.length - 1];
      if (!last || container.scrollTop <= 0) {
        setReached(false);
        return;
      }
      // The list runs on under the bottom menu, so the end counts only above it.
      const dock = document.querySelector(".subs-dock");
      const visibleBottom = Math.min(
        container.getBoundingClientRect().bottom,
        dock ? dock.getBoundingClientRect().top : Infinity
      );
      setReached(last.getBoundingClientRect().bottom <= visibleBottom + 1);
    };
    update();
    container.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      container.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [containerRef, rowSelector, itemCount]);
  return reached;
}

function popularFirst(list: FamilyService[]) {
  return [...list].sort((a, b) => servicePopularity(a.slug) - servicePopularity(b.slug));
}

/**
 * «Создать»: what can be created, each with an example of what is inside,
 * then «Популярное» across all four categories in its own swipeable list,
 * so the screen itself stays put.
 */
export function CreateHome({
  services,
  onOpen,
  onPickService,
  onPickAccount,
  onPickOperator
}: {
  services: FamilyService[];
  onOpen: (kind: CreateCategory) => void;
  onPickService: (service: FamilyService) => void;
  onPickAccount: (serviceSlug: string) => void;
  onPickOperator: (operatorSlug: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | CreateCategory>("all");
  const accountServices = useAccountServices().data ?? [];
  // The operators endpoint lists only operators that take listings now.
  const operators = useMarketplaceOperators().data ?? [];
  const subscriptions = popularFirst(services.filter((item) => item.family_type !== "tariff"));
  const tariffs = popularFirst(services.filter((item) => item.family_type === "tariff"));
  const descriptions: Record<CreateCategory, string> = {
    subscription: examples(subscriptions.map((item) => item.name)),
    tariff: examples(tariffs.map((item) => item.name)),
    accounts: examples(accountServices.map((item) => item.name)),
    gigabytes: examples(operators.map((item) => item.name))
  };
  const kinds: CreateCategory[] = ["subscription", "tariff", "accounts", "gigabytes"];

  const popular: PopularItem[] = [];
  for (const [kind, slug] of POPULAR_ORDER) {
    if (kind === "subscription" || kind === "tariff") {
      const service = services.find((item) => item.slug === slug);
      if (!service) continue;
      popular.push({
        key: `${kind}-${slug}`,
        kind,
        title: service.name,
        subtitle: `${kind === "tariff" ? "Тариф" : "Подписка"} · ${upToSeats(service.max_members)}`,
        logoSlug: service.slug,
        tariffLogo: kind === "tariff",
        open: () => onPickService(service)
      });
    } else if (kind === "accounts") {
      const service = accountServices.find((item) => item.slug === slug);
      if (!service) continue;
      popular.push({
        key: `${kind}-${slug}`,
        kind,
        title: service.name,
        subtitle: (service.plans ?? []).length
          ? `Аккаунт · ${(service.plans ?? []).map((plan) => plan.name).join(", ")}`
          : "Аккаунт",
        logoSlug: service.slug,
        tariffLogo: false,
        open: () => onPickAccount(service.slug)
      });
    } else {
      const operator = operators.find((item) => item.slug === slug);
      if (!operator) continue;
      popular.push({
        key: `${kind}-${slug}`,
        kind,
        title: operator.name,
        subtitle: "Гигабайты",
        logoSlug: `${operator.slug}-family-tariff`,
        tariffLogo: true,
        open: () => onPickOperator(operator.slug)
      });
    }
  }
  const shown = filter === "all" ? popular : popular.filter((item) => item.kind === filter);
  const activeFilter = FILTERS.find((item) => item.id === filter) ?? FILTERS[0];
  // Same feed behaviour as «Заявки» and «Мои»: snap to the nearest row, a fade under the
  // heading once scrolled, and a button back to the top.
  const feedSnap = useFeedSnap({ itemCount: shown.length, cardSelector: ".create-popular-row" });
  const reachedEnd = useReachedEnd(feedSnap.containerRef, ".create-popular-row", shown.length);
  useEffect(() => {
    feedSnap.containerRef.current?.scrollTo({ top: 0 });
  }, [filter, feedSnap.containerRef]);

  return (
    <div className="create-screen create-home" data-testid="create-home">
      <Panel title="Создать">
        <div className="create-kinds">
          {kinds.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`create-kind create-kind-${kind}`}
              data-testid={`create-kind-${kind}`}
              onClick={() => {
                triggerTelegramSelection();
                onOpen(kind);
              }}
            >
              <span className="create-kind-icon" aria-hidden="true">
                <SystemSymbol name={KIND_ICONS[kind]} size={24} />
              </span>
              <span className="create-kind-copy">
                <strong>{CREATE_TITLES[kind]}</strong>
                {descriptions[kind] ? <span>{descriptions[kind]}</span> : null}
              </span>
              <SystemSymbol name="chevron.forward" size={18} />
            </button>
          ))}
        </div>

        {popular.length > 0 ? (
          <section className="create-popular" aria-labelledby="create-popular-title">
            <div className="sm-market-section-heading">
              <div className="sm-market-section-heading-copy">
                <h2 id="create-popular-title">Популярное</h2>
              </div>
              <div className="sm-market-filter-actions">
                <button
                  type="button"
                  data-testid="create-popular-filter"
                  className={`sm-market-filter-chip${filter !== "all" ? " is-active" : ""}`}
                  aria-label={`Показать: ${activeFilter.label}`}
                  onClick={() => {
                    triggerTelegramSelection();
                    const index = FILTERS.findIndex((item) => item.id === filter);
                    setFilter(FILTERS[(index + 1) % FILTERS.length].id);
                  }}
                >
                  <SystemSymbol name="sort" size={14} />
                  <span>{activeFilter.label}</span>
                </button>
              </div>
            </div>
            <div className="my-feed-wrap create-popular-wrap">
              <div
                className="my-feed-scroll create-popular-scroll"
                data-testid="create-popular-list"
                ref={feedSnap.containerRef}
                {...feedSnap.scrollHandlers}
              >
                {shown.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="create-popular-row"
                    data-testid={`create-popular-${item.key}`}
                    onClick={() => {
                      triggerTelegramSelection();
                      item.open();
                    }}
                  >
                    <ServiceLogo
                      serviceSlug={item.logoSlug}
                      serviceName={item.title}
                      familyType={item.tariffLogo ? "tariff" : "subscription"}
                      size={40}
                    />
                    <span className="create-popular-copy">
                      <strong>{item.title}</strong>
                      <span>{item.subtitle}</span>
                    </span>
                    <SystemSymbol name="chevron.forward" size={18} />
                  </button>
                ))}
              </div>
              <ScrollToTopButton
                containerRef={feedSnap.containerRef}
                testId="create-popular-scroll-to-top"
                className="create-popular-to-top"
                hidden={!reachedEnd}
              />
            </div>
          </section>
        ) : null}
      </Panel>
    </div>
  );
}
