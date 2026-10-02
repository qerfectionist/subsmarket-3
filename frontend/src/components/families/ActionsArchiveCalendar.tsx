import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { triggerTelegramImpact, triggerTelegramSelection } from "../../telegram";
import {
  parseCalendarDate,
  calendarMonthKey,
  calendarDayLabel
} from "./PaymentCalendar";

export type ActionsArchiveItem = {
  id: string;
  title: string;
  orderNumber: string;
  category: "gigabytes" | "accounts" | "families";
  categoryLabel: string;
  counterparty: string;
  counterpartyUsername?: string | null;
  date?: string;
  dateTime?: string;
  rawDate?: string;
  serviceName?: string;
  serviceSlug?: string;
  status: "successful" | "cancelled";
  statusLabel: string;
  amountKzt?: number;
  rejectionReason?: string;
  originalId?: string;
  familyId?: string;
  listingId?: string;
  amountGb?: string;
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ActionsArchiveCalendar({
  items,
  selectedDateKey,
  onSelectDate,
  mode = "inbox"
}: {
  items: ActionsArchiveItem[];
  selectedDateKey: string | null;
  onSelectDate: (dateKey: string | null) => void;
  mode?: "inbox" | "outbox";
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const isAnimatingRef = useRef(false);
  const dragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    dx: number;
    isDragging: boolean;
    startTime: number;
  } | null>(null);
  const suppressClickRef = useRef(false);

  // Group items by YYYY-MM-DD
  const itemsByDate = useMemo(() => {
    const map = new Map<string, ActionsArchiveItem[]>();
    for (const it of items) {
      if (!it.rawDate || it.rawDate.length < 10) continue;
      const key = it.rawDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(it);
      map.set(key, list);
    }
    return map;
  }, [items]);

  // Initial Monday based on latest event or today
  const initialMonday = useMemo(() => {
    const itemWithDate = items.find((it) => it.rawDate && it.rawDate.length >= 10);
    if (itemWithDate?.rawDate) {
      const { year, month, day } = parseCalendarDate(itemWithDate.rawDate);
      return getMonday(new Date(year, month, day));
    }
    return getMonday(new Date());
  }, [items]);

  const [visibleMonday, setVisibleMonday] = useState<Date>(initialMonday);
  const hasSyncedInitialItemsRef = useRef(false);

  useEffect(() => {
    if (!hasSyncedInitialItemsRef.current && items.length > 0) {
      hasSyncedInitialItemsRef.current = true;
      const itemWithDate = items.find((it) => it.rawDate && it.rawDate.length >= 10);
      if (itemWithDate?.rawDate) {
        const { year, month, day } = parseCalendarDate(itemWithDate.rawDate);
        setVisibleMonday(getMonday(new Date(year, month, day)));
      }
    }
  }, [items]);

  // Sync visibleMonday if selectedDateKey is provided and not in current week
  useEffect(() => {
    if (!selectedDateKey) return;
    const { year, month, day } = parseCalendarDate(selectedDateKey);
    const selMon = getMonday(new Date(year, month, day));
    if (selMon.getTime() !== visibleMonday.getTime()) {
      setVisibleMonday(selMon);
    }
  }, [selectedDateKey]);

  // Today key
  const todayKey = useMemo(() => formatDateKey(new Date()), []);

  const dayNames = useMemo(() => ["пн", "вт", "ср", "чт", "пт", "сб", "вс"], []);

  // 3 weeks (prev, current, next) for seamless infinite carousel
  const threeWeeks = useMemo(() => {
    const weeks = [];
    for (let offset = -1; offset <= 1; offset++) {
      const mon = new Date(visibleMonday);
      mon.setDate(mon.getDate() + offset * 7);
      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(mon);
        d.setDate(d.getDate() + i);
        const dateKey = formatDateKey(d);
        days.push({
          date: d,
          dateKey,
          dayNum: d.getDate(),
          dayName: dayNames[i],
          isToday: dateKey === todayKey
        });
      }
      weeks.push({
        offset,
        mondayKey: formatDateKey(mon),
        days
      });
    }
    return weeks;
  }, [visibleMonday, todayKey, dayNames]);

  // Midweek date determines visible month name & year (standard Thursday ISO)
  const midWeekDate = useMemo(() => {
    const d = new Date(visibleMonday);
    d.setDate(d.getDate() + 3);
    return d;
  }, [visibleMonday]);

  const monthName = midWeekDate.toLocaleDateString("ru-KZ", { month: "long" });
  const year = midWeekDate.getFullYear();
  const currentMonday = useMemo(() => getMonday(new Date()), []);
  const isCurrentWeek = currentMonday.getTime() === visibleMonday.getTime();

  // Month stats for turnover header
  const monthKey = calendarMonthKey(year, midWeekDate.getMonth());
  const monthStats = useMemo(() => {
    let turnover = 0;
    let count = 0;
    for (const it of items) {
      if (!it.rawDate || it.rawDate.length < 10) continue;
      const { year: y, month: m } = parseCalendarDate(it.rawDate);
      if (calendarMonthKey(y, m) === monthKey) {
        count++;
        if (it.status === "successful" && it.amountKzt) {
          turnover += it.amountKzt;
        }
      }
    }
    return { turnover, count };
  }, [items, monthKey]);

  const PAGE_GAP = 4;

  const getStep = useCallback(() => {
    const width = viewportRef.current?.offsetWidth || 300;
    return width + PAGE_GAP;
  }, []);

  // Sync track position on mount and resize
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const applyPosition = () => {
      if (isAnimatingRef.current || dragRef.current?.isDragging) return;
      const w = viewport.offsetWidth;
      if (w > 0 && trackRef.current) {
        trackRef.current.style.transform = `translate3d(${-(w + PAGE_GAP)}px, 0, 0)`;
      }
    };
    applyPosition();
    const observer = new ResizeObserver(applyPosition);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // Smooth slide to week with continuous transform and snap reset
  const slideToWeek = useCallback((direction: 1 | -1 | 0) => {
    const track = trackRef.current;
    if (!track) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = getStep();

    if (direction === 0) {
      track.style.transition = reduced ? "none" : "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)";
      track.style.transform = `translate3d(${-step}px, 0, 0)`;
      return;
    }

    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    triggerTelegramImpact("light");

    const targetTransform = direction === 1
      ? `translate3d(${-2 * step}px, 0, 0)`
      : "translate3d(0px, 0, 0)";

    if (reduced) {
      setVisibleMonday((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + direction * 7);
        return next;
      });
      return;
    }

    track.style.transition = "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)";
    track.style.transform = targetTransform;

    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      track.removeEventListener("transitionend", onEnd);
      setVisibleMonday((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + direction * 7);
        return next;
      });
    };

    const onEnd = (e: TransitionEvent) => {
      if (e.target === track && e.propertyName === "transform") {
        cleanup();
      }
    };

    track.addEventListener("transitionend", onEnd);
    setTimeout(cleanup, 320);
  }, [getStep]);

  // Synchronously reset track transform when visibleMonday updates (avoids frame flicker)
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const step = getStep();
    track.style.transition = "none";
    track.style.transform = `translate3d(${-step}px, 0, 0)`;
    void track.offsetWidth;
    isAnimatingRef.current = false;
  }, [visibleMonday, getStep]);

  function handleResetToday() {
    triggerTelegramImpact("light");
    setVisibleMonday(getMonday(new Date()));
    onSelectDate(null);
  }

  function handleDayClick(dateKey: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    triggerTelegramSelection();
    if (selectedDateKey === dateKey) {
      onSelectDate(null);
    } else {
      onSelectDate(dateKey);
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || isAnimatingRef.current) return;
    suppressClickRef.current = false;
    dragRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      isDragging: false,
      startTime: performance.now()
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId || isAnimatingRef.current) return;
    drag.dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.isDragging) {
      if (Math.abs(drag.dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(drag.dx)) {
        dragRef.current = null;
        return;
      }
      drag.isDragging = true;
      suppressClickRef.current = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {}
      if (trackRef.current) {
        trackRef.current.style.transition = "none";
      }
    }

    if (drag.isDragging && trackRef.current) {
      const step = getStep();
      trackRef.current.style.transform = `translate3d(${-step + drag.dx}px, 0, 0)`;
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {}
    }
    if (!drag?.isDragging) return;

    const dt = Math.max(performance.now() - drag.startTime, 1);
    const velocity = drag.dx / dt;
    const width = viewportRef.current?.offsetWidth || 300;
    const threshold = Math.min(width * 0.22, 50);

    if (drag.dx <= -threshold || velocity <= -0.3) {
      slideToWeek(1);
    } else if (drag.dx >= threshold || velocity >= 0.3) {
      slideToWeek(-1);
    } else {
      slideToWeek(0);
    }
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {}
    }
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.isDragging) {
      slideToWeek(0);
    }
  };

  return (
    <section
      className="my-payment-calendar"
      data-testid="actions-archive-calendar"
      aria-label="Календарь архива"
    >
      <div className="my-payment-calendar-hero">
        <div className="calendar__header my-payment-calendar-calendar-header">
          <div className="my-payment-calendar-month-heading">
            <button
              type="button"
              className="my-payment-calendar-month-button"
              aria-label={`${monthName} ${year}. ${isCurrentWeek ? "Текущая неделя" : "Вернуться к текущей неделе"}`}
              onClick={handleResetToday}
            >
              <span className="my-payment-calendar-month-name">{monthName}</span>
              <span className="my-payment-calendar-year">
                {year}
                <SystemSymbol name="arrow.clockwise" size={12} />
              </span>
            </button>
          </div>

          <div className={`my-payment-calendar-total${monthStats.count ? "" : " is-empty"}`}>
            <span>{mode === "inbox" ? "Выручка" : "Покупки"}</span>
            <strong>
              {monthStats.turnover > 0
                ? `${mode === "inbox" ? "+" : ""}${monthStats.turnover.toLocaleString("ru-KZ")} ₸`
                : "0 ₸"}
            </strong>
          </div>

          <button
            type="button"
            className="calendar__nav-button"
            aria-label="Предыдущая неделя"
            onClick={() => slideToWeek(-1)}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className="calendar__nav-button"
            aria-label="Следующая неделя"
            onClick={() => slideToWeek(1)}
          >
            <ChevronRightIcon />
          </button>
        </div>

        <div className="actions-archive-week-container">
          <div
            ref={viewportRef}
            className="actions-archive-carousel-viewport"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onClickCapture={(event) => {
              if (!suppressClickRef.current) return;
              event.preventDefault();
              event.stopPropagation();
              suppressClickRef.current = false;
            }}
          >
            <div ref={trackRef} className="actions-archive-carousel-track">
              {threeWeeks.map((week) => (
                <div key={week.offset} className="actions-archive-week-page">
                  <div className="actions-archive-week-header">
                    {dayNames.map((name) => (
                      <div key={name} className="calendar__header-cell">
                        {name}
                      </div>
                    ))}
                  </div>

                  <div className="actions-archive-week-row">
                    {week.days.map((day) => {
                      const dayItems = itemsByDate.get(day.dateKey) ?? [];
                      const previewItem = dayItems[0];
                      const isSelected = selectedDateKey === day.dateKey;
                      const dayLabel = dayItems.length
                        ? `${calendarDayLabel(day.dateKey)}: ${dayItems.map((it) => it.title).join(", ")}`
                        : calendarDayLabel(day.dateKey);

                      return (
                        <button
                          key={day.dateKey}
                          type="button"
                          data-testid="actions-archive-calendar-cell"
                          data-today={day.isToday ? "true" : undefined}
                          data-selected={isSelected ? "true" : undefined}
                          className={`calendar__cell my-payment-calendar-hero-cell${dayItems.length ? " has-event" : ""}${isSelected ? " is-active-day" : ""}`}
                          aria-label={dayLabel}
                          aria-pressed={isSelected}
                          onClick={() => handleDayClick(day.dateKey)}
                        >
                          <span className="my-payment-calendar-event-logos">
                            {previewItem ? (
                              <ServiceLogo
                                key={previewItem.id}
                                serviceSlug={previewItem.serviceSlug}
                                serviceName={previewItem.serviceName || previewItem.title}
                                familyType={previewItem.category === "gigabytes" ? "tariff" : "subscription"}
                                size={32}
                                loading="eager"
                                decoding="sync"
                              />
                            ) : null}
                          </span>
                          {dayItems.length > 1 ? (
                            <small className="my-payment-calendar-extra-count">{dayItems.length - 1}</small>
                          ) : null}
                          <span className="my-payment-calendar-day-number">
                            {day.dayNum}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
