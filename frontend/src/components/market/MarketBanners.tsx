import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { BannerIcon } from "./MarketTiles";
import type { BannerPointerState, MarketBanner } from "./types";

export const DEV_BANNER_ITEMS: MarketBanner[] = [
  {
    id: "test-raspberry-banner",
    priority: 3,
    title: "Тест: действие требуется",
    detail: "Проверьте заявку",
    detailNote: "Без этого продолжить нельзя",
    meta: "Важно",
    icon: "alert",
    tone: "raspberry"
  },
  {
    id: "test-status-banner",
    priority: 3,
    title: "Тест: короткий статус",
    detail: "Состояние уведомления",
    detailNote: "Ожидает обновления",
    meta: "Ожидает",
    icon: "clock",
    tone: "warning",
    pulse: "notification"
  },
  {
    id: "test-long-banner",
    priority: 3,
    title: "Тест: длинный текст",
    detail: "Адаптивная типографика",
    detailNote: "Для разных экранов",
    meta: "Тест",
    icon: "message",
    tone: "success"
  }
];

export function MarketBannerCarousel({
  bannerItems,
  onOpenActions,
  resetToken
}: {
  bannerItems: MarketBanner[];
  onOpenActions?: (targetTab?: "inbox" | "outbox") => void;
  resetToken?: number;
}) {
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const bannerPositionRef = useRef(0);
  const bannerTrackRef = useRef<HTMLDivElement | null>(null);
  const bannerViewportRef = useRef<HTMLDivElement | null>(null);
  const bannerDotsRef = useRef<HTMLDivElement | null>(null);
  const bannerPointerRef = useRef<BannerPointerState | null>(null);
  const bannerAnimationFrame = useRef<number | null>(null);
  const bannerWasSwiped = useRef(false);
  const previousBannerItemsRef = useRef<MarketBanner[] | null>(null);

  const stopBannerAnimation = useCallback(() => {
    if (bannerAnimationFrame.current !== null) {
      cancelAnimationFrame(bannerAnimationFrame.current);
      bannerAnimationFrame.current = null;
    }
  }, []);

  const setBannerPosition = useCallback(
    (position: number) => {
      bannerPositionRef.current = position;
      const track = bannerTrackRef.current;
      if (track) track.style.transform = `translate3d(${-position * 100}%, 0, 0)`;

      const dots = bannerDotsRef.current;
      if (dots && bannerItems.length > 1) {
        const boundedPosition = Math.min(Math.max(position, 0), bannerItems.length - 1);
        const dotSpacing = document.documentElement.dataset.higReview === "on" ? 44 : 28;
        const centerOffset = (boundedPosition - (bannerItems.length - 1) / 2) * dotSpacing;
        dots.style.setProperty("--sm-banner-dot-offset", `${centerOffset}px`);
      }
    },
    [bannerItems.length]
  );

  const animateBannerTo = useCallback(
    (
      nextIndex: number,
      initialVelocity = 0,
      interaction: "gesture" | "auto" = "gesture"
    ) => {
      if (bannerItems.length < 1) return;
      stopBannerAnimation();
      const target = Math.min(Math.max(nextIndex, 0), bannerItems.length - 1);
      const start = bannerPositionRef.current;
      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        Math.abs(target - start) < 0.001
      ) {
        setBannerPosition(target);
        setActiveBannerIndex(target);
        return;
      }

      let position = start;
      let velocity = Math.max(-4, Math.min(4, initialVelocity));
      const stiffness = interaction === "auto" ? 320 : 260;
      const damping = interaction === "auto" ? 36 : 32;
      let previousTime = performance.now();
      const step = (time: number) => {
        const deltaTime = Math.min((time - previousTime) / 1000, 0.032);
        previousTime = time;
        const acceleration = (target - position) * stiffness - velocity * damping;
        velocity += acceleration * deltaTime;
        position += velocity * deltaTime;
        setBannerPosition(position);

        if (Math.abs(target - position) < 0.001 && Math.abs(velocity) < 0.01) {
          setBannerPosition(target);
          bannerAnimationFrame.current = null;
          setActiveBannerIndex(target);
          return;
        }
        bannerAnimationFrame.current = requestAnimationFrame(step);
      };
      bannerAnimationFrame.current = requestAnimationFrame(step);
    },
    [bannerItems.length, setBannerPosition, stopBannerAnimation]
  );

  useEffect(() => {
    const previousBannerItems = previousBannerItemsRef.current;
    previousBannerItemsRef.current = bannerItems;
    if (!bannerItems.length) return;

    const signature = (item: MarketBanner) =>
      [
        item.id,
        item.priority,
        item.title,
        item.detail,
        item.detailNote,
        item.meta ?? "",
        item.serviceName ?? "",
        item.serviceSlug ?? "",
        item.icon,
        item.tone,
        item.pulse ?? ""
      ].join("|");

    const changedBannerIndexes = bannerItems.reduce<number[]>((indexes, item, index) => {
      const previous = previousBannerItems?.find(previousItem => previousItem.id === item.id);
      if (!previous || signature(previous) !== signature(item)) indexes.push(index);
      return indexes;
    }, []);

    const highPriorityChangedIndex =
      changedBannerIndexes.find(index => bannerItems[index].pulse === "error") ??
      changedBannerIndexes.find(index => bannerItems[index].pulse === "accepted") ??
      changedBannerIndexes.find(index => bannerItems[index].pulse === "new-request");

    const fallbackChangedIndex =
      changedBannerIndexes.find(index => !bannerItems[index].id.startsWith("test-")) ??
      (previousBannerItems === null ? undefined : changedBannerIndexes[0]);

    const previousActiveIndex = previousBannerItems
      ? Math.min(Math.max(Math.round(bannerPositionRef.current), 0), previousBannerItems.length - 1)
      : -1;
    const previousActiveBanner = previousBannerItems?.[previousActiveIndex];
    const currentPreviousActiveBannerIndex = previousActiveBanner
      ? bannerItems.findIndex(item => item.id === previousActiveBanner.id)
      : -1;

    const keepCurrentImportantBanner =
      highPriorityChangedIndex === undefined &&
      currentPreviousActiveBannerIndex >= 0 &&
      ["error", "accepted", "new-request"].includes(previousActiveBanner?.pulse ?? "");

    const changedBannerIndex =
      highPriorityChangedIndex ??
      (keepCurrentImportantBanner ? undefined : fallbackChangedIndex);

    if (changedBannerIndex === undefined) return;

    stopBannerAnimation();
    bannerPointerRef.current = null;
    bannerWasSwiped.current = false;
    bannerPositionRef.current = changedBannerIndex;
  }, [bannerItems, stopBannerAnimation]);

  useEffect(() => {
    if (resetToken !== undefined) {
      stopBannerAnimation();
      bannerPointerRef.current = null;
      bannerWasSwiped.current = false;
      bannerPositionRef.current = 0;
      setActiveBannerIndex(0);
      setBannerPosition(0);
    }
  }, [resetToken, setBannerPosition, stopBannerAnimation]);

  function handleBannerPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (bannerItems.length < 2 || (event.pointerType === "mouse" && event.button !== 0)) return;
    stopBannerAnimation();
    bannerWasSwiped.current = false;
    bannerPointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originPosition: bannerPositionRef.current,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      isDragging: false,
      cancelled: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleBannerPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const pointer = bannerPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || pointer.cancelled) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (!pointer.isDragging) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        pointer.cancelled = true;
        bannerPointerRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }
      pointer.isDragging = true;
      bannerWasSwiped.current = true;
    }

    const now = performance.now();
    const elapsed = Math.max(1, now - pointer.lastTime);
    pointer.velocityX = ((event.clientX - pointer.lastX) / elapsed) * 1000;
    pointer.lastX = event.clientX;
    pointer.lastTime = now;
    const width =
      bannerViewportRef.current?.clientWidth || event.currentTarget.clientWidth || 1;
    const rawPosition = pointer.originPosition - deltaX / width;
    const maxPosition = bannerItems.length - 1;
    const position =
      rawPosition < 0
        ? rawPosition * 0.25
        : rawPosition > maxPosition
        ? maxPosition + (rawPosition - maxPosition) * 0.25
        : rawPosition;
    setBannerPosition(position);
  }

  function handleBannerPointerEnd(
    event: ReactPointerEvent<HTMLButtonElement>,
    cancelled = false
  ) {
    const pointer = bannerPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    bannerPointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointer.cancelled) return;
    if (cancelled) {
      animateBannerTo(Math.round(bannerPositionRef.current));
      return;
    }
    if (!pointer.isDragging) return;

    const deltaX = event.clientX - pointer.startX;
    const width =
      bannerViewportRef.current?.clientWidth || event.currentTarget.clientWidth || 1;
    const passedDistance = Math.abs(deltaX) >= width * 0.18;
    const passedVelocity = Math.abs(pointer.velocityX) >= 450;
    let target = Math.round(bannerPositionRef.current);
    if (passedDistance || passedVelocity) {
      const direction = deltaX < 0 || pointer.velocityX < 0 ? 1 : -1;
      target = Math.round(pointer.originPosition) + direction;
    }
    target = Math.min(Math.max(target, 0), bannerItems.length - 1);
    animateBannerTo(target, -pointer.velocityX / width, "gesture");
  }

  if (bannerItems.length === 0) return null;

  const safeBannerIndex = Math.min(activeBannerIndex, Math.max(0, bannerItems.length - 1));
  const activeBanner = bannerItems[safeBannerIndex];
  if (!activeBanner) return null;

  const activeBannerDetail = [activeBanner.detail, activeBanner.detailNote]
    .filter(Boolean)
    .join(" · ");
  const activeBannerAnnouncement = [
    activeBanner.title,
    activeBannerDetail,
    activeBanner.meta
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <section className="sm-market-action-banner" aria-label="Действия и уведомления">
      <span className="sr-only" aria-live="polite" aria-atomic="true" key={activeBanner.id}>
        {activeBannerAnnouncement}
      </span>
      <div className="sm-market-action-banner-viewport" ref={bannerViewportRef}>
        <div
          className="sm-market-action-banner-track"
          ref={bannerTrackRef}
          style={{ transform: `translate3d(${-bannerPositionRef.current * 100}%, 0, 0)` }}
        >
          {bannerItems.map((banner, index) => {
            const isActive = index === safeBannerIndex;
            const bannerDetail = [banner.detail, banner.detailNote].filter(Boolean).join(" · ");
            return (
              <button
                key={banner.id}
                className={`sm-market-action-banner-button${
                  banner.meta ? "" : " sm-market-action-banner-button-no-meta"
                }`}
                data-tone={banner.tone}
                type="button"
                data-testid={isActive ? "market-notifications" : undefined}
                aria-hidden={!isActive}
                tabIndex={isActive ? 0 : -1}
                aria-label={[banner.title, bannerDetail, banner.meta, "Открыть"]
                  .filter(Boolean)
                  .join(". ")}
                onClick={() => {
                  if (bannerWasSwiped.current) {
                    bannerWasSwiped.current = false;
                    return;
                  }
                  onOpenActions?.(banner.targetTab);
                }}
                onKeyDown={event => {
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    if (bannerItems.length > 1) {
                      animateBannerTo((safeBannerIndex + 1) % bannerItems.length);
                    }
                  } else if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    if (bannerItems.length > 1) {
                      animateBannerTo(
                        (safeBannerIndex - 1 + bannerItems.length) % bannerItems.length
                      );
                    }
                  }
                }}
                onPointerDown={handleBannerPointerDown}
                onPointerMove={handleBannerPointerMove}
                onPointerUp={event => handleBannerPointerEnd(event)}
                onPointerCancel={event => handleBannerPointerEnd(event, true)}
              >
                <span
                  className="sm-market-action-banner-icon"
                  data-tone={banner.tone}
                  aria-hidden
                >
                  {!banner.meta ? (
                    <SystemSymbol name="info.circle" size={22} />
                  ) : banner.serviceName ? (
                    <ServiceLogo
                      serviceSlug={banner.serviceSlug}
                      serviceName={banner.serviceName}
                      size={32}
                    />
                  ) : (
                    <BannerIcon icon={banner.icon} />
                  )}
                </span>
                <span className="sm-market-action-banner-copy">
                  <strong>{banner.title}</strong>
                  <small>
                    <span className="sm-market-action-banner-detail-main">
                      {banner.detail}
                    </span>
                    {banner.detailNote ? (
                      <span className="sm-market-action-banner-detail-note">
                        {banner.detailNote}
                      </span>
                    ) : null}
                  </small>
                </span>
                {banner.meta ? (
                  <span className="sm-market-action-banner-meta">
                    <span data-tone={banner.tone} data-status={banner.id}>
                      <span>{banner.meta}</span>
                    </span>
                  </span>
                ) : null}
                {!banner.meta ? (
                  <span
                    className="sm-market-action-banner-indicator sm-market-action-banner-service-indicator"
                    aria-hidden="true"
                  >
                    {banner.serviceName ? (
                      <ServiceLogo
                        serviceSlug={banner.serviceSlug}
                        serviceName={banner.serviceName}
                        size={32}
                      />
                    ) : (
                      <SystemSymbol name="info.circle" size={20} />
                    )}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      {bannerItems.length > 1 ? (
        <div
          className={`sm-market-action-banner-dots sm-market-action-banner-notification-dots sm-market-action-banner-dots-count-${Math.min(
            bannerItems.length,
            5
          )}`}
          ref={bannerDotsRef}
          role="group"
          aria-label={`Уведомления, слайд ${safeBannerIndex + 1} из ${bannerItems.length}`}
        >
          {bannerItems.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              className={index === safeBannerIndex ? "is-active" : undefined}
              aria-label={`Показать уведомление: ${banner.title}`}
              aria-current={index === safeBannerIndex ? "page" : undefined}
              onClick={() => animateBannerTo(index)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
