import { useEffect } from "react";

export const SEARCH_PLACEHOLDER_MESSAGES = [
  "Теле2 5 ГБ",
  "Active семья",
  "Tele2 семья",
  "Beeline семья",
  "ChatGPT Plus",
  "Яндекс Плюс",
  "YouTube Premium",
  "Spotify Premium"
] as const;

export const SEARCH_PLACEHOLDER_START_DELAY = 220;
export const SEARCH_PLACEHOLDER_TYPE_INTERVAL = 55;
export const SEARCH_PLACEHOLDER_DELETE_INTERVAL = 34;
export const SEARCH_PLACEHOLDER_HOLD_DELAY = 1700;
export const SEARCH_PLACEHOLDER_NEXT_DELAY = 420;

export function useTypingPlaceholder(
  inputRef: { current: HTMLInputElement | null },
  enabled: boolean,
  fallback: string
) {
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const searchInput = input;

    searchInput.placeholder = fallback;
    if (!enabled) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    let messageIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let timeoutId: number | null = null;

    const clearScheduledStep = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = null;
    };

    const scheduleStep = (delay: number) => {
      timeoutId = window.setTimeout(step, delay);
    };

    function step() {
      timeoutId = null;
      const message = SEARCH_PLACEHOLDER_MESSAGES[messageIndex];

      if (!deleting) {
        characterIndex += 1;
        searchInput.placeholder = message.slice(0, characterIndex);
        if (characterIndex === message.length) {
          deleting = true;
          scheduleStep(SEARCH_PLACEHOLDER_HOLD_DELAY);
        } else {
          scheduleStep(SEARCH_PLACEHOLDER_TYPE_INTERVAL);
        }
        return;
      }

      characterIndex -= 1;
      searchInput.placeholder = message.slice(0, characterIndex);
      if (characterIndex === 0) {
        deleting = false;
        messageIndex = (messageIndex + 1) % SEARCH_PLACEHOLDER_MESSAGES.length;
        scheduleStep(SEARCH_PLACEHOLDER_NEXT_DELAY);
      } else {
        scheduleStep(SEARCH_PLACEHOLDER_DELETE_INTERVAL);
      }
    }

    searchInput.placeholder = "";
    scheduleStep(SEARCH_PLACEHOLDER_START_DELAY);

    const handleMotionChange = () => {
      if (!motionQuery.matches) return;
      clearScheduledStep();
      searchInput.placeholder = fallback;
    };
    motionQuery.addEventListener("change", handleMotionChange);

    return () => {
      clearScheduledStep();
      motionQuery.removeEventListener("change", handleMotionChange);
      searchInput.placeholder = fallback;
    };
  }, [enabled, fallback, inputRef]);
}
