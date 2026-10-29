import { useEffect, useState } from "react";

/** What can be created, in the form that follows «Что создаём?» on the same line. */
const ITEMS = [
  { kind: "subscription", text: "подписку" },
  { kind: "tariff", text: "тариф" },
  { kind: "accounts", text: "аккаунт" },
  { kind: "gigabytes", text: "гигабайты" }
] as const;
const INTERVAL_MS = 2600;

/**
 * The words beside «Что создаём?»: a still outline with the four things taking
 * turns inside it. They share one cell, so the outline fits the longest and
 * never changes size. They roll like a drum: the shown one comes up from below
 * while the previous one leaves upward, both fading and tilting away.
 */
export function CreateTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % ITEMS.length), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="create-ticker" data-testid="create-ticker">
      <span className="sr-only">{ITEMS.map((item) => item.text).join(", ")}</span>
      <span className="create-ticker-pill" aria-hidden="true">
        <span className="create-ticker-window">
        {ITEMS.map((item, position) => (
          <span
            key={item.kind}
            className={`create-ticker-word create-kind-${item.kind}`}
            data-pos={
              position === index ? "current" : position === (index + ITEMS.length - 1) % ITEMS.length ? "previous" : "next"
            }
            data-testid={position === index ? "create-ticker-word" : undefined}
          >
            {item.text}
          </span>
        ))}
        </span>
      </span>
    </span>
  );
}
