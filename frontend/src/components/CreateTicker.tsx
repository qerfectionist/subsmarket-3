import { useEffect, useState } from "react";

/** What can be created, in the form that follows «Что создаём?». */
const THINGS = ["семейную подписку", "семейный тариф", "продажу аккаунта", "продажу гигабайтов"];
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
      () => setShown((value) => ({ index: (value.index + 1) % THINGS.length, previous: value.index })),
      INTERVAL_MS
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="create-ticker" data-testid="create-ticker">
      <span className="sr-only">{THINGS.join(", ")}</span>
      <span className="create-ticker-window" aria-hidden="true">
        {/* A new key restarts the slide-in; the outgoing word is the one before it. */}
        {previous === null ? null : (
          <span key={`out-${index}`} className="create-ticker-word create-ticker-out">
            {THINGS[previous]}
          </span>
        )}
        <span key={`in-${index}`} className={`create-ticker-word${previous === null ? "" : " create-ticker-in"}`} data-testid="create-ticker-word">
          {THINGS[index]}
        </span>
      </span>
    </span>
  );
}
