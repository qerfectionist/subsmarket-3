import React, { useState, useRef, useEffect, useCallback } from "react";
import { SystemSymbol } from "./SystemSymbol";
import { triggerTelegramImpact, triggerTelegramNotification } from "../telegram";

interface TradeRequestSellerActionsProps {
  busy?: boolean;
  onAccept: () => void;
  onReject: () => void;
  durationMs?: number;
}

export function TradeRequestSellerActions({
  busy = false,
  onAccept,
  onReject,
  durationMs: propDurationMs,
}: TradeRequestSellerActionsProps) {
  const [activeAction, setActiveAction] = useState<"accept" | "reject" | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(5);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const circleRef = useRef<SVGCircleElement | null>(null);
  const startTimeRef = useRef<number>(0);

  const lastSecRef = useRef<number>(5);

  // In automated Playwright test environments, use a fast duration unless overridden
  const effectiveDuration =
    propDurationMs ??
    (typeof window !== "undefined" && window.navigator?.webdriver ? 350 : 5000);

  const clearCurrentTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const cancelCountdown = useCallback(() => {
    clearCurrentTimer();
    setActiveAction(null);
    triggerTelegramImpact("light");
  }, [clearCurrentTimer]);

  const startCountdown = useCallback(
    (action: "accept" | "reject") => {
      if (busy) return;
      clearCurrentTimer();
      setActiveAction(action);
      triggerTelegramImpact("medium");

      startTimeRef.current = Date.now();
      const initialSeconds = Math.max(1, Math.ceil(effectiveDuration / 1000));
      lastSecRef.current = initialSeconds;
      setSecondsLeft(initialSeconds);

      const totalLen = 47.12;

      const updateProgress = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(elapsed / effectiveDuration, 1);

        if (circleRef.current) {
          circleRef.current.style.strokeDashoffset = (totalLen * progress).toFixed(2);
        }

        const remainSec = Math.max(1, Math.ceil((effectiveDuration - elapsed) / 1000));
        if (remainSec !== lastSecRef.current) {
          lastSecRef.current = remainSec;
          setSecondsLeft(remainSec);
        }

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(updateProgress);
        }
      };

      animFrameRef.current = requestAnimationFrame(updateProgress);

      timerRef.current = setTimeout(() => {
        clearCurrentTimer();
        setActiveAction(null);
        if (action === "accept") {
          triggerTelegramNotification("success");
          onAccept();
        } else {
          triggerTelegramNotification("warning");
          onReject();
        }
      }, effectiveDuration);
    },
    [busy, effectiveDuration, clearCurrentTimer, onAccept, onReject]
  );

  useEffect(() => {
    return () => {
      clearCurrentTimer();
    };
  }, [clearCurrentTimer]);

  // If busy state changes to true while countdown was running, cancel it
  useEffect(() => {
    if (busy && activeAction) {
      clearCurrentTimer();
      setActiveAction(null);
    }
  }, [busy, activeAction, clearCurrentTimer]);

  const isAcceptActive = activeAction === "accept";
  const isRejectActive = activeAction === "reject";

  return (
    <>
      <button
        type="button"
        disabled={busy || isRejectActive}
        className={isAcceptActive ? "is-countdown is-accept" : undefined}
        data-testid="trade-request-accept-btn"
        onClick={(e) => {
          e.stopPropagation();
          if (isAcceptActive) {
            cancelCountdown();
          } else {
            startCountdown("accept");
          }
        }}
      >
        {isAcceptActive ? (
          <>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              className="action-countdown-svg"
              aria-hidden="true"
            >
              <circle
                cx="9"
                cy="9"
                r="7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                opacity="0.25"
              />
              <circle
                ref={circleRef}
                cx="9"
                cy="9"
                r="7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="action-countdown-circle-progress"
              />
            </svg>
            <span>Отмена ({secondsLeft}с)</span>
          </>
        ) : (
          <>
            <SystemSymbol name="checkmark" size={17} />
            <span>Принять</span>
          </>
        )}
      </button>

      <button
        type="button"
        disabled={busy || isAcceptActive}
        className={isRejectActive ? "is-countdown is-reject" : undefined}
        data-testid="trade-request-reject-btn"
        onClick={(e) => {
          e.stopPropagation();
          if (isRejectActive) {
            cancelCountdown();
          } else {
            startCountdown("reject");
          }
        }}
      >
        {isRejectActive ? (
          <>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              className="action-countdown-svg"
              aria-hidden="true"
            >
              <circle
                cx="9"
                cy="9"
                r="7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                opacity="0.25"
              />
              <circle
                ref={circleRef}
                cx="9"
                cy="9"
                r="7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="action-countdown-circle-progress"
              />
            </svg>
            <span>Отмена ({secondsLeft}с)</span>
          </>
        ) : (
          <>
            <SystemSymbol name="xmark" size={17} />
            <span>Отклонить</span>
          </>
        )}
      </button>
    </>
  );
}

export interface TradeRequestCancelButtonProps {
  busy?: boolean;
  onCancel: () => void;
  disabled?: boolean;
  durationMs?: number;
  label?: string;
  testId?: string;
  onCountdownChange?: (isCounting: boolean) => void;
}

export function TradeRequestCancelButton({
  busy = false,
  onCancel,
  disabled = false,
  durationMs: propDurationMs,
  label = "Отменить",
  testId = "trade-request-cancel-btn",
  onCountdownChange
}: TradeRequestCancelButtonProps) {
  const [isActive, setIsActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const circleRef = useRef<SVGCircleElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastSecRef = useRef<number>(5);

  const effectiveDuration =
    propDurationMs ??
    (typeof window !== "undefined" && window.navigator?.webdriver ? 350 : 5000);

  const clearCurrentTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const cancelCountdown = useCallback(() => {
    clearCurrentTimer();
    setIsActive(false);
    onCountdownChange?.(false);
    triggerTelegramImpact("light");
  }, [clearCurrentTimer, onCountdownChange]);

  const startCountdown = useCallback(() => {
    if (busy || disabled) return;
    clearCurrentTimer();
    setIsActive(true);
    onCountdownChange?.(true);
    triggerTelegramImpact("medium");

    startTimeRef.current = Date.now();
    const initialSeconds = Math.max(1, Math.ceil(effectiveDuration / 1000));
    lastSecRef.current = initialSeconds;
    setSecondsLeft(initialSeconds);

    const totalLen = 47.12;

    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / effectiveDuration, 1);

      if (circleRef.current) {
        circleRef.current.style.strokeDashoffset = (totalLen * progress).toFixed(2);
      }

      const remainSec = Math.max(1, Math.ceil((effectiveDuration - elapsed) / 1000));
      if (remainSec !== lastSecRef.current) {
        lastSecRef.current = remainSec;
        setSecondsLeft(remainSec);
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateProgress);

    timerRef.current = setTimeout(() => {
      clearCurrentTimer();
      setIsActive(false);
      onCountdownChange?.(false);
      triggerTelegramNotification("warning");
      onCancel();
    }, effectiveDuration);
  }, [busy, disabled, effectiveDuration, clearCurrentTimer, onCancel, onCountdownChange]);

  useEffect(() => {
    return () => {
      clearCurrentTimer();
    };
  }, [clearCurrentTimer]);

  useEffect(() => {
    if ((busy || disabled) && isActive) {
      clearCurrentTimer();
      setIsActive(false);
      onCountdownChange?.(false);
    }
  }, [busy, disabled, isActive, clearCurrentTimer, onCountdownChange]);

  return (
    <button
      type="button"
      disabled={busy || disabled}
      className={isActive ? "is-countdown is-reject" : undefined}
      data-testid={testId}
      onClick={(e) => {
        e.stopPropagation();
        if (isActive) {
          cancelCountdown();
        } else {
          startCountdown();
        }
      }}
    >
      {isActive ? (
        <>
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            className="action-countdown-svg"
            aria-hidden="true"
          >
            <circle
              cx="9"
              cy="9"
              r="7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.25"
            />
            <circle
              ref={circleRef}
              cx="9"
              cy="9"
              r="7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="action-countdown-circle-progress"
            />
          </svg>
          <span>Отмена ({secondsLeft}с)</span>
        </>
      ) : (
        <>
          <SystemSymbol name="xmark" size={17} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

