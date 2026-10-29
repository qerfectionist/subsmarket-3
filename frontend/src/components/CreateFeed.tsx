import { useEffect } from "react";
import { ServiceLogo } from "./branding";
import { SystemSymbol } from "./SystemSymbol";
import { ScrollToTopButton } from "./ScrollToTopButton";
import { triggerTelegramSelection } from "../telegram";
import { useFeedSnap } from "../hooks/useFeedSnap";
import { useListEnd } from "../hooks/useListEnd";
import type { CreateHomeItem } from "./createHomeItems";

function CreateRow({ item }: { item: CreateHomeItem }) {
  return (
    <button
      type="button"
      className="create-row"
      data-testid={`create-row-${item.key}`}
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
      <span className="create-row-copy">
        <strong>{item.title}</strong>
        <span>{item.subtitle}</span>
      </span>
      <SystemSymbol name="chevron.forward" size={18} />
    </button>
  );
}

/**
 * A list of rows on «Создать» that scrolls inside itself with the «Заявки» feed
 * behaviour: rows snap to the top, a fade while it moves, and «Наверх» once only
 * the last two rows are left. A new `resetKey` starts it from the top.
 */
export function CreateFeed({
  items,
  testId,
  resetKey
}: {
  items: CreateHomeItem[];
  testId: string;
  resetKey?: string;
}) {
  const feedSnap = useFeedSnap({ itemCount: items.length, cardSelector: ".create-row" });
  const end = useListEnd(feedSnap.containerRef, ".create-row", items.length);
  useEffect(() => {
    feedSnap.containerRef.current?.scrollTo({ top: 0 });
  }, [resetKey, feedSnap.containerRef]);

  return (
    <div className="my-feed-wrap create-feed-wrap">
      <div
        className="my-feed-scroll create-feed"
        data-testid={testId}
        ref={feedSnap.containerRef}
        {...feedSnap.scrollHandlers}
        onScroll={() => {
          feedSnap.scrollHandlers.onScroll?.();
          end.check();
        }}
      >
        {items.map((item) => (
          <CreateRow key={item.key} item={item} />
        ))}
      </div>
      <ScrollToTopButton
        containerRef={feedSnap.containerRef}
        testId={`${testId}-to-top`}
        className="create-feed-to-top"
        hidden={!end.reached}
        style={end.offset === null ? undefined : { bottom: `${end.offset}px` }}
      />
    </div>
  );
}
