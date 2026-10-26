import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import {
  hideTelegramMainButton,
  initTelegramShell,
  setTelegramBackButton,
  setTelegramClosingConfirmation,
  setTelegramMainButton
} from "../telegram";

export function useTelegramShellInit() {
  useEffect(() => {
    const cleanupTelegram = initTelegramShell();
    return cleanupTelegram;
  }, []);
}

export function useScrollOnRouteChange(routeKey: string) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [routeKey]);
}

export function useTelegramBackButton(visible: boolean, onBack: () => void) {
  useEffect(() => {
    return setTelegramBackButton(visible, onBack);
  }, [onBack, visible]);
}

export function useTelegramClosingGuard(busy: string | null, createFormDirty: boolean) {
  useEffect(() => {
    setTelegramClosingConfirmation(Boolean(busy) || createFormDirty);
  }, [busy, createFormDirty]);
}

export function useTelegramMainButton({
  visible,
  label,
  onClick,
  isPending,
  disabled
}: {
  visible: boolean;
  label: string;
  onClick: () => void;
  isPending: boolean;
  disabled: boolean;
}) {
  // The handler changes on every render; a stable wrapper keeps the native
  // button from being re-registered (and blinking) on each keystroke.
  const handlerRef = useRef(onClick);
  useLayoutEffect(() => {
    handlerRef.current = onClick;
  });
  const handler = useCallback(() => handlerRef.current(), []);

  useEffect(() => {
    if (!visible) return;
    return setTelegramMainButton(label, handler, {
      progress: isPending,
      disabled: disabled || isPending
    });
  }, [disabled, handler, isPending, label, visible]);

  // Hide only when the button goes away, not on every label change.
  useEffect(() => {
    if (!visible) return;
    return () => hideTelegramMainButton();
  }, [visible]);
}
