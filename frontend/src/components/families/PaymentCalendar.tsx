import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Calendar, I18nProvider } from "@heroui/react";
import { CalendarDate } from "@internationalized/date";

import { ServiceLogo } from "../branding";
import { SystemSymbol } from "../SystemSymbol";
import { familyTitle } from "../../format";
import type { MyFamily } from "../../types";

export type PaymentCalendarEvent = {
  dateKey: string;
  family: MyFamily;
};

export function parseCalendarDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return { year, month: month - 1, day };
}

export function calendarMonthKey(year: number, month: number) {
  return year * 12 + month;
}

export function calendarDateKey(year: number, month: number, day: number) {
  return [year, String(month + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

export function calendarMonthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

export function calendarDateValue(value: string | null) {
  if (!value) return null;
  const { year, month, day } = parseCalendarDate(value);
  return new CalendarDate(year, month + 1, day);
}

export function calendarDateKeyFromValue(value: CalendarDate) {
  return calendarDateKey(value.year, value.month - 1, value.day);
}

export function calendarDayLabel(value: string) {
  const { year, month, day } = parseCalendarDate(value);
  return new Intl.DateTimeFormat("ru-KZ", {
    day: "numeric",
    month: "long"
  }).format(new Date(year, month, day));
}

export function getCalendarInitialMonth(families: MyFamily[]) {
  const nextPayment = [...families]
    .filter((item) => !["closed"].includes(item.family.status))
    .sort((left, right) => left.family.next_payment_date.localeCompare(right.family.next_payment_date))[0]
    ?.family.next_payment_date;
  if (!nextPayment) return calendarMonthStart(new Date());
  const { year, month } = parseCalendarDate(nextPayment);
  return new Date(year, month, 1);
}

export function getPaymentCalendarEvents(families: MyFamily[], visibleMonth: Date): PaymentCalendarEvent[] {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const visibleKey = calendarMonthKey(year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return families.flatMap((item) => {
    const family = item.family;
    if (!["active", "full", "closing"].includes(family.status)) return [];

    const nextPayment = parseCalendarDate(family.next_payment_date);
    const nextPaymentKey = calendarMonthKey(nextPayment.year, nextPayment.month);
    if (visibleKey < nextPaymentKey) return [];
    if (family.period === "yearly" && month !== nextPayment.month) return [];

    const day = Math.min(nextPayment.day, daysInMonth);
    return [{
      dateKey: calendarDateKey(year, month, day),
      family: item
    }];
  });
}

export function PaymentCalendar({ families }: { families: MyFamily[] }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<Animation | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; dx: number; dragging: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [visibleMonth, setVisibleMonth] = useState(() => getCalendarInitialMonth(families));
  const previousMonthRef = useRef(visibleMonth.getTime());

  useEffect(() => {
    const previous = previousMonthRef.current;
    previousMonthRef.current = visibleMonth.getTime();
    const grid = gridRef.current;
    if (!grid || previous === visibleMonth.getTime()) return;
    motionRef.current?.cancel();
    grid.style.transform = "";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const direction = visibleMonth.getTime() > previous ? 1 : -1;
    motionRef.current = grid.animate([
      { transform: `translateX(${reduced ? 0 : direction * 48}px)`, opacity: 0 },
      { transform: "translateX(0)", opacity: 1 }
    ], { duration: reduced ? 100 : 300, easing: "cubic-bezier(.22, 1, .36, 1)" });
    return () => motionRef.current?.cancel();
  }, [visibleMonth]);

  const [focusedValue, setFocusedValue] = useState(() => {
    const initialMonth = getCalendarInitialMonth(families);
    return new CalendarDate(initialMonth.getFullYear(), initialMonth.getMonth() + 1, 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);
  const selectionListRef = useRef<HTMLDivElement | null>(null);
  const events = getPaymentCalendarEvents(families, visibleMonth);
  const eventsByDate = new Map<string, PaymentCalendarEvent[]>();

  for (const event of events) {
    const current = eventsByDate.get(event.dateKey) ?? [];
    current.push(event);
    eventsByDate.set(event.dateKey, current);
  }

  useEffect(() => {
    setSelectedDateKey(null);
    setIsSelectionOpen(false);
  }, [visibleMonth]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const selectedEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) ?? [] : [];
  const total = events.reduce((sum, event) => sum + event.family.family.member_share_kzt, 0);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  useEffect(() => {
    if (!selectedEvents.length || !isSelectionOpen) return;
    const el = selectionListRef.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const items = el.querySelectorAll(".my-payment-calendar-selection-item");
    if (items.length) {
      gsap.fromTo(
        items,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.24, stagger: 0.04, ease: "power2.out", overwrite: "auto" }
      );
    }
  }, [selectedDateKey, isSelectionOpen, selectedEvents.length]);

  function handleCalendarFocusChange(value: CalendarDate) {
    setFocusedValue(value);
    const nextMonth = new Date(value.year, value.month - 1, 1);
    if (calendarMonthKey(nextMonth.getFullYear(), nextMonth.getMonth()) !== calendarMonthKey(year, month)) {
      setVisibleMonth(nextMonth);
    }
  }

  function handleCalendarDayClick(value: CalendarDate) {
    const dateKey = calendarDateKeyFromValue(value);
    if (!eventsByDate.has(dateKey)) return;
    if (selectedDateKey === dateKey && isSelectionOpen) {
      setSelectedDateKey(null);
      setIsSelectionOpen(false);
      return;
    }
    setSelectedDateKey(dateKey);
    setIsSelectionOpen(true);
  }

  function handleToday() {
    const current = new Date();
    setFocusedValue(new CalendarDate(current.getFullYear(), current.getMonth() + 1, current.getDate()));
    setVisibleMonth(calendarMonthStart(current));
  }

  return (
    <section className="my-payment-calendar" data-testid="my-payment-calendar" aria-label="Календарь платежей">
      <I18nProvider locale="ru-KZ">
        <Calendar
          className="my-payment-calendar-hero"
          aria-label="Платежи по семьям"
          firstDayOfWeek="mon"
          focusedValue={focusedValue}
          onFocusChange={handleCalendarFocusChange}
          value={calendarDateValue(selectedDateKey)}
          onChange={() => undefined}
        >
          <Calendar.Header className="my-payment-calendar-calendar-header">
            <div className="my-payment-calendar-month-heading">
              <button
                type="button"
                className="my-payment-calendar-month-button"
                aria-label={`${visibleMonth.toLocaleDateString("ru-KZ", { month: "long", year: "numeric" })}. ${isCurrentMonth ? "Текущий месяц" : "Вернуться к текущему месяцу"}`}
                onClick={handleToday}
              >
                <span className="my-payment-calendar-month-name">{visibleMonth.toLocaleDateString("ru-KZ", { month: "long" })}</span>
                <span className="my-payment-calendar-year">
                  {year}
                  <SystemSymbol name="arrow.clockwise" size={12} />
                </span>
              </button>
            </div>
            <div className={`my-payment-calendar-total${events.length ? "" : " is-empty"}`}>
              <span>Итого</span>
              <strong>{events.length ? `${total.toLocaleString("ru-KZ")} ₸` : "Нет платежей"}</strong>
            </div>
            <Calendar.NavButton slot="previous" aria-label="Предыдущий месяц" />
            <Calendar.NavButton slot="next" aria-label="Следующий месяц" />
          </Calendar.Header>
          <div
            className="my-calendar-month-viewport"
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!event.isPrimary || event.button !== 0) return;
              suppressClickRef.current = false;
              dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dragging: false };
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.id !== event.pointerId) return;
              drag.dx = event.clientX - drag.x;
              if (!drag.dragging) {
                if (Math.max(Math.abs(drag.dx), Math.abs(event.clientY - drag.y)) < 8) return;
                if (Math.abs(event.clientY - drag.y) > Math.abs(drag.dx)) {
                  dragRef.current = null;
                  return;
                }
                drag.dragging = true;
                suppressClickRef.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                motionRef.current?.cancel();
              }
              if (gridRef.current) gridRef.current.style.transform = `translateX(${drag.dx}px)`;
            }}
            onPointerUp={(event) => {
              const drag = dragRef.current;
              dragRef.current = null;
              if (!drag?.dragging) return;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              if (Math.abs(drag.dx) >= 48) {
                handleCalendarFocusChange(new CalendarDate(year, month + 1, 1).add({ months: drag.dx < 0 ? 1 : -1 }));
              } else if (gridRef.current) {
                const from = gridRef.current.style.transform;
                gridRef.current.style.transform = "";
                motionRef.current = gridRef.current.animate([{ transform: from }, { transform: "translateX(0)" }], { duration: 200, easing: "ease-out" });
              }
            }}
            onPointerCancel={() => {
              dragRef.current = null;
              if (gridRef.current) gridRef.current.style.transform = "";
            }}
            onClickCapture={(event) => {
              if (!suppressClickRef.current) return;
              event.preventDefault();
              event.stopPropagation();
              suppressClickRef.current = false;
            }}
          >
            <div ref={gridRef}>
              <Calendar.Grid weekdayStyle="short">
                <Calendar.GridHeader>
                  {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                </Calendar.GridHeader>
                <Calendar.GridBody>
                  {(date) => {
                    const dateKey = calendarDateKeyFromValue(date);
                    const dayEvents = eventsByDate.get(dateKey) ?? [];
                    const previewEvent = dayEvents.find((event) => {
                      const serviceSlug = event.family.family.service_slug?.toLowerCase() ?? "";
                      const serviceName = event.family.family.service_name?.toLowerCase() ?? "";
                      return serviceSlug.includes("youtube") || serviceName.includes("youtube");
                    }) ?? dayEvents[0];
                    const dayLabel = dayEvents.length
                      ? `${calendarDayLabel(dateKey)}: ${dayEvents.map((event) => familyTitle(event.family.family)).join(", ")}`
                      : calendarDayLabel(dateKey);
                    const eventDescriptionId = `my-payment-calendar-date-${dateKey}`;

                    return (
                      <Calendar.Cell
                        date={date}
                        className={`my-payment-calendar-hero-cell${dayEvents.length ? " has-event" : ""}`}
                        aria-label={dayLabel}
                        aria-describedby={dayEvents.length ? eventDescriptionId : undefined}
                        onClick={() => handleCalendarDayClick(date)}
                      >
                        {({ formattedDate, isOutsideMonth }) => (
                          <>
                            <span className="my-payment-calendar-event-logos">
                              {previewEvent ? (
                                <ServiceLogo
                                  key={previewEvent.family.family.id}
                                  serviceSlug={previewEvent.family.family.service_slug}
                                  serviceName={previewEvent.family.family.service_name}
                                  familyType={previewEvent.family.family.family_type}
                                  size={32}
                                />
                              ) : null}
                            </span>
                            {dayEvents.length > 1 ? <small className="my-payment-calendar-extra-count">+{dayEvents.length - 1}</small> : null}
                            <span className="my-payment-calendar-day-number">
                              {isOutsideMonth ? "" : formattedDate}
                            </span>
                            {dayEvents.length ? (
                              <span id={eventDescriptionId} className="sr-only">
                                {dayEvents.map((event) => familyTitle(event.family.family)).join(", ")}
                              </span>
                            ) : null}
                          </>
                        )}
                      </Calendar.Cell>
                    );
                  }}
                </Calendar.GridBody>
              </Calendar.Grid>
            </div>
          </div>
        </Calendar>
      </I18nProvider>

      <div
        className={`my-payment-calendar-selection-wrap${isSelectionOpen && selectedEvents.length ? " is-open" : ""}`}
        aria-hidden={!isSelectionOpen || selectedEvents.length === 0}
      >
        <div className="my-payment-calendar-selection" aria-live="polite">
          {selectedEvents.length > 0 ? (
            <>
              <div className="my-payment-calendar-selection-heading">
                {selectedDateKey ? calendarDayLabel(selectedDateKey) : ""}
              </div>
              <div className="my-payment-calendar-selection-list" ref={selectionListRef}>
                {selectedEvents.map((event) => (
                  <div className="my-payment-calendar-selection-item" key={event.family.family.id}>
                    <ServiceLogo
                      serviceSlug={event.family.family.service_slug}
                      serviceName={event.family.family.service_name}
                      familyType={event.family.family.family_type}
                      size={24}
                    />
                    <strong>{familyTitle(event.family.family)}</strong>
                    <span>{event.family.family.member_share_kzt.toLocaleString("ru-KZ")} ₸</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
