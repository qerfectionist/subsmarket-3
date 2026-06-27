import { useEffect } from "react";

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
  useEffect(() => {
    if (!visible) {
      hideTelegramMainButton();
      return;
    }
    const cleanup = setTelegramMainButton(label, onClick, {
      progress: isPending,
      disabled: disabled || isPending
    });
    return cleanup;
  }, [disabled, isPending, label, onClick, visible]);
}
