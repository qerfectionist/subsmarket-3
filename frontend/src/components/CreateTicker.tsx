import { useEffect, useState } from "react";

/** What can be created, in the form that follows «Что создаём?». */
const ITEMS = [
  { kind: "subscription", text: "семейную подписку" },
  { kind: "tariff", text: "семейный тариф" },
  { kind: "accounts", text: "продажу аккаунта" },
  { kind: "gigabytes", text: "продажу гигабайтов" }
] as const;
const INTERVAL_MS = 2600;

/**
 * The line under «Что создаём?»: the four things take turns, each sliding up
 * from below while the previous one leaves upward.
 */
export function CreateTicker() {
  // `previous` is null on the first showing, so nothing slides out on load.
  const [shown, setShown] = useState<{ index: number; previous: number | null }>({
    index: 0,
    previous: null
  });
  const { index, previous } = shown;

  useEffect(() => {
    const timer = window.setInterval(
      () => setShown((value) => ({ index: (value.index + 1) % ITEMS.length, previous: value.index })),
      INTERVAL_MS
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="create-ticker" data-testid="create-ticker">
      <span className="sr-only">{ITEMS.map((item) => item.text).join(", ")}</span>
      <span className="create-ticker-window" aria-hidden="true">
        {/* A new key restarts the slide-in; the outgoing word is the one before it. */}
        {previous === null ? null : (
          <span
            key={`out-${index}`}
            className={`create-ticker-word create-ticker-out create-kind-${ITEMS[previous].kind}`}
          >
            {ITEMS[previous].text}
          </span>
        )}
        <span key={`in-${index}`} className={`create-ticker-word create-kind-${ITEMS[index].kind}${previous === null ? "" : " create-ticker-in"}`}
          data-testid="create-ticker-word"
        >
          {ITEMS[index].text}
        </span>
      </span>
    </span>
  );
}
