import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const gridRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<Animation | null>(null);
  const dragRef = useRef<{ id: number; startX: number; startY: number; dx: number; isDragging: boolean } | null>(null);
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

  // 7 days of the visible week
  const weekDays = useMemo(() => {
    const days = [];
    const dayNames = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
    for (let i = 0; i < 7; i++) {
      const d = new Date(visibleMonday);
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
    return days;
  }, [visibleMonday, todayKey]);

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

  // Week change with animation
  const changeWeek = useCallback((direction: 1 | -1) => {
    triggerTelegramImpact("light");
    const grid = gridRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (grid && !reduced) {
      const width = grid.offsetWidth || 300;
      motionRef.current?.cancel();
      motionRef.current = grid.animate([
        { transform: grid.style.transform || "translateX(0)", opacity: 1 },
        { transform: `translateX(${-direction * width * 0.35}px)`, opacity: 0 }
      ], { duration: 140, easing: "ease-in" });

      motionRef.current.onfinish = () => {
        setVisibleMonday((prev) => {
          const next = new Date(prev);
          next.setDate(next.getDate() + direction * 7);
          return next;
        });
        grid.style.transform = "";
        motionRef.current = grid.animate([
          { transform: `translateX(${direction * width * 0.35}px)`, opacity: 0 },
          { transform: "translateX(0)", opacity: 1 }
        ], { duration: 200, easing: "cubic-bezier(.22, 1, .36, 1)" });
      };
    } else {
      setVisibleMonday((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + direction * 7);
        return next;
      });
    }
  }, []);

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
            {selectedDateKey && (
              <button
                type="button"
                className="actions-archive-all-btn"
                onClick={() => {
                  triggerTelegramImpact("light");
                  onSelectDate(null);
                }}
              >
                Все дни
              </button>
            )}
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
            onClick={() => changeWeek(-1)}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className="calendar__nav-button"
            aria-label="Следующая неделя"
            onClick={() => changeWeek(1)}
          >
            <ChevronRightIcon />
          </button>
        </div>

        <div
          className="my-calendar-month-viewport"
          style={{ overflow: "hidden", touchAction: "pan-y" }}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (!event.isPrimary || event.button !== 0) return;
            suppressClickRef.current = false;
            dragRef.current = {
              id: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              dx: 0,
              isDragging: false
            };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.id !== event.pointerId) return;
            drag.dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            if (!drag.isDragging) {
              if (Math.abs(drag.dx) < 8) return;
              if (Math.abs(dy) > Math.abs(drag.dx)) {
                dragRef.current = null;
                return;
              }
              drag.isDragging = true;
              suppressClickRef.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              motionRef.current?.cancel();
            }
            if (gridRef.current) {
              gridRef.current.style.transform = `translateX(${drag.dx}px)`;
            }
          }}
          onPointerUp={(event) => {
            const drag = dragRef.current;
            dragRef.current = null;
            if (!drag?.isDragging) return;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            if (drag.dx <= -40) {
              changeWeek(1);
            } else if (drag.dx >= 40) {
              changeWeek(-1);
            } else if (gridRef.current) {
              const from = gridRef.current.style.transform;
              gridRef.current.style.transform = "";
              motionRef.current = gridRef.current.animate(
                [{ transform: from }, { transform: "translateX(0)" }],
                { duration: 180, easing: "ease-out" }
              );
            }
          }}
          onPointerCancel={() => {
            const drag = dragRef.current;
            dragRef.current = null;
            if (drag?.isDragging && gridRef.current) {
              gridRef.current.style.transform = "";
            }
          }}
        >
          <div className="actions-archive-week-container">
            <div className="actions-archive-week-header">
              {weekDays.map((d) => (
                <div key={d.dateKey} className="calendar__header-cell">
                  {d.dayName}
                </div>
              ))}
            </div>

            <div className="actions-archive-week-row" ref={gridRef}>
              {weekDays.map((day) => {
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
                        />
                      ) : null}
                    </span>
                    {dayItems.length > 1 ? (
                      <small className="my-payment-calendar-extra-count">+{dayItems.length - 1}</small>
                    ) : null}
                    <span className="my-payment-calendar-day-number">
                      {day.dayNum}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
