type TelegramThemeParams = {
  accent_text_color?: string;
  bg_color?: string;
  bottom_bar_bg_color?: string;
  button_color?: string;
  button_text_color?: string;
  destructive_text_color?: string;
  header_bg_color?: string;
  hint_color?: string;
  link_color?: string;
  secondary_bg_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  text_color?: string;
};

type TelegramInset = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type TelegramBackButton = {
  show?: () => void;
  hide?: () => void;
  onClick?: (handler: () => void) => void;
  offClick?: (handler: () => void) => void;
};

type TelegramBottomButton = {
  type?: "main" | "secondary";
  text?: string;
  color?: string;
  textColor?: string;
  isVisible?: boolean;
  isActive?: boolean;
  hasShineEffect?: boolean;
  isProgressVisible?: boolean;
  setText?: (text: string) => void;
  show?: () => void;
  hide?: () => void;
  enable?: () => void;
  disable?: () => void;
  showProgress?: (leaveActive?: boolean) => void;
  hideProgress?: () => void;
  setParams?: (params: Record<string, unknown>) => void;
  onClick?: (handler: () => void) => void;
  offClick?: (handler: () => void) => void;
};

type TelegramPopupButton = {
  id?: string;
  type?: "default" | "ok" | "close" | "cancel" | "destructive";
  text?: string;
};

type TelegramHapticFeedback = {
  impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred?: (type: "error" | "success" | "warning") => void;
  selectionChanged?: () => void;
};

type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: {
    start_param?: string;
  };
  version?: string;
  platform?: string;
  colorScheme?: "light" | "dark";
  themeParams?: TelegramThemeParams;
  viewportHeight?: number;
  viewportStableHeight?: number;
  safeAreaInset?: TelegramInset;
  contentSafeAreaInset?: TelegramInset;
  BackButton?: TelegramBackButton;
  MainButton?: TelegramBottomButton;
  SecondaryButton?: TelegramBottomButton;
  HapticFeedback?: TelegramHapticFeedback;
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  showPopup?: (
    params: {
      title?: string;
      message: string;
      buttons?: TelegramPopupButton[];
    },
    callback?: (buttonId: string) => void
  ) => void;
  showAlert?: (message: string, callback?: () => void) => void;
  showConfirm?: (message: string, callback?: (ok: boolean) => void) => void;
  openTelegramLink?: (url: string) => void;
  isVersionAtLeast?: (version: string) => boolean;
  onEvent?: (
    event:
      | "themeChanged"
      | "viewportChanged"
      | "safeAreaChanged"
      | "contentSafeAreaChanged"
      | "mainButtonClicked"
      | "secondaryButtonClicked",
    handler: () => void
  ) => void;
  offEvent?: (
    event:
      | "themeChanged"
      | "viewportChanged"
      | "safeAreaChanged"
      | "contentSafeAreaChanged"
      | "mainButtonClicked"
      | "secondaryButtonClicked",
    handler: () => void
  ) => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

let activeBackHandler: (() => void) | null = null;

function webApp() {
  return window.Telegram?.WebApp;
}

function supportsWebAppVersion(version: string) {
  return webApp()?.isVersionAtLeast?.(version) ?? false;
}

function setCssVar(name: string, value: string | number | undefined) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  const nextValue = typeof value === "number" ? `${value}px` : value;
  document.documentElement.style.setProperty(name, nextValue);
}

function applyTelegramTheme() {
  const app = webApp();
  const theme = app?.themeParams ?? {};

  setCssVar("--app-bg", theme.bg_color ?? "#eef3fb");
  setCssVar("--app-surface", theme.section_bg_color ?? "#ffffff");
  setCssVar("--app-secondary-bg", theme.secondary_bg_color ?? "#f7f9fd");
  setCssVar("--app-text", theme.text_color ?? "#111827");
  setCssVar("--app-muted", theme.hint_color ?? "#667085");
  setCssVar("--app-link", theme.link_color ?? "#2f6fed");
  setCssVar("--app-accent", theme.button_color ?? "#2f6fed");
  setCssVar("--app-accent-text", theme.button_text_color ?? "#ffffff");
  setCssVar("--app-danger", theme.destructive_text_color ?? "#b42318");
  setCssVar("--app-bottom-bar-bg", theme.bottom_bar_bg_color ?? "#ffffff");

  const root = document.documentElement;
  root.classList.remove("tma-light", "tma-dark");
  root.classList.add(app?.colorScheme === "dark" ? "tma-dark" : "tma-light");

  if (supportsWebAppVersion("6.1")) {
    app?.setHeaderColor?.(theme.secondary_bg_color ?? theme.bg_color ?? "#eef3fb");
    app?.setBackgroundColor?.(theme.bg_color ?? "#eef3fb");
  }
  if (supportsWebAppVersion("7.10")) {
    app?.setBottomBarColor?.(theme.bottom_bar_bg_color ?? "#ffffff");
  }
}

function applyTelegramViewport() {
  const app = webApp();
  setCssVar("--app-viewport-height", app?.viewportHeight);
  setCssVar("--app-viewport-stable-height", app?.viewportStableHeight);

  const safe = app?.safeAreaInset ?? {};
  setCssVar("--app-safe-area-top", safe.top ?? 0);
  setCssVar("--app-safe-area-right", safe.right ?? 0);
  setCssVar("--app-safe-area-bottom", safe.bottom ?? 0);
  setCssVar("--app-safe-area-left", safe.left ?? 0);

  const contentSafe = app?.contentSafeAreaInset ?? {};
  setCssVar("--app-content-safe-area-top", contentSafe.top ?? 0);
  setCssVar("--app-content-safe-area-right", contentSafe.right ?? 0);
  setCssVar("--app-content-safe-area-bottom", contentSafe.bottom ?? 0);
  setCssVar("--app-content-safe-area-left", contentSafe.left ?? 0);
}

export function getTelegramInitData() {
  return webApp()?.initData ?? "";
}

export function getTelegramStartParam() {
  return (
    webApp()?.initDataUnsafe?.start_param ??
    new URLSearchParams(window.location.search).get("tgWebAppStartParam") ??
    ""
  );
}

export function isTelegramMiniApp() {
  return Boolean(getTelegramInitData());
}

export function initTelegramShell() {
  const app = webApp();
  applyTelegramTheme();
  applyTelegramViewport();

  app?.ready?.();
  app?.expand?.();
  if (supportsWebAppVersion("7.7")) {
    app?.disableVerticalSwipes?.();
  }

  const handleTheme = () => applyTelegramTheme();
  const handleViewport = () => applyTelegramViewport();
  app?.onEvent?.("themeChanged", handleTheme);
  app?.onEvent?.("viewportChanged", handleViewport);
  app?.onEvent?.("safeAreaChanged", handleViewport);
  app?.onEvent?.("contentSafeAreaChanged", handleViewport);

  return () => {
    app?.offEvent?.("themeChanged", handleTheme);
    app?.offEvent?.("viewportChanged", handleViewport);
    app?.offEvent?.("safeAreaChanged", handleViewport);
    app?.offEvent?.("contentSafeAreaChanged", handleViewport);
    if (supportsWebAppVersion("7.7")) {
      app?.enableVerticalSwipes?.();
    }
    if (supportsWebAppVersion("6.2")) {
      app?.disableClosingConfirmation?.();
    }
  };
}

export function setTelegramBackButton(visible: boolean, handler: () => void) {
  const backButton = webApp()?.BackButton;
  if (!backButton || !supportsWebAppVersion("6.1")) {
    return () => {};
  }

  if (activeBackHandler) {
    backButton.offClick?.(activeBackHandler);
    activeBackHandler = null;
  }

  if (!visible) {
    backButton.hide?.();
    return () => {};
  }

  activeBackHandler = handler;
  backButton.onClick?.(handler);
  backButton.show?.();

  return () => {
    backButton.offClick?.(handler);
    if (activeBackHandler === handler) {
      activeBackHandler = null;
    }
  };
}

export function triggerTelegramSelection() {
  if (!supportsWebAppVersion("6.1")) {
    return;
  }
  webApp()?.HapticFeedback?.selectionChanged?.();
}

export function triggerTelegramNotification(
  type: "error" | "success" | "warning"
) {
  if (!supportsWebAppVersion("6.1")) {
    return;
  }
  webApp()?.HapticFeedback?.notificationOccurred?.(type);
}

export function triggerTelegramImpact(
  style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light"
) {
  if (!supportsWebAppVersion("6.1")) {
    return;
  }
  webApp()?.HapticFeedback?.impactOccurred?.(style);
}

export function openTelegramUser(username: string, text?: string) {
  const normalized = username.trim().replace(/^@/, "");
  if (!normalized) {
    return;
  }
  const encodedUsername = encodeURIComponent(normalized);
  const message = text?.trim();
  const url = message
    ? `https://t.me/${encodedUsername}?text=${encodeURIComponent(message)}`
    : `https://t.me/${encodedUsername}`;
  if (webApp()?.openTelegramLink) {
    webApp()?.openTelegramLink?.(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function showTelegramAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    const app = webApp();
    if (!app?.showAlert || !supportsWebAppVersion("6.2")) {
      window.alert(message);
      resolve();
      return;
    }
    app.showAlert(message, () => resolve());
  });
}

export function showTelegramConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const app = webApp();
    if (!app?.showConfirm || !supportsWebAppVersion("6.2")) {
      resolve(window.confirm(message));
      return;
    }
    app.showConfirm(message, (ok) => resolve(ok));
  });
}

export function showTelegramPopup(params: {
  title?: string;
  message: string;
  buttons?: TelegramPopupButton[];
}): Promise<string> {
  return new Promise((resolve) => {
    const app = webApp();
    if (!app?.showPopup || !supportsWebAppVersion("6.2")) {
      const ok = window.confirm(params.message);
      resolve(ok ? "ok" : "cancel");
      return;
    }
    app.showPopup(params, (buttonId) => resolve(buttonId));
  });
}

export function setTelegramClosingConfirmation(enabled: boolean) {
  const app = webApp();
  if (!supportsWebAppVersion("6.2")) {
    return;
  }
  if (enabled) {
    app?.enableClosingConfirmation?.();
  } else {
    app?.disableClosingConfirmation?.();
  }
}

let activeMainButtonHandler: (() => void) | null = null;

export function setTelegramMainButton(
  text: string,
  handler: () => void,
  options?: {
    color?: string;
    textColor?: string;
    shineEffect?: boolean;
    progress?: boolean;
    disabled?: boolean;
  }
) {
  const button = webApp()?.MainButton;
  if (!button || !supportsWebAppVersion("6.1")) {
    return () => {};
  }

  if (activeMainButtonHandler) {
    button.offClick?.(activeMainButtonHandler);
    activeMainButtonHandler = null;
  }

  button.setText?.(text);
  if (options?.color) {
    button.setParams?.({ color: options.color });
  }
  if (options?.textColor) {
    button.setParams?.({ text_color: options.textColor });
  }
  if (options?.shineEffect !== undefined) {
    button.setParams?.({ has_shine_effect: options.shineEffect });
  }
  if (options?.progress) {
    button.showProgress?.(options.disabled !== false);
  } else {
    button.hideProgress?.();
  }
  if (options?.disabled) {
    button.disable?.();
  } else {
    button.enable?.();
  }

  activeMainButtonHandler = handler;
  button.onClick?.(handler);
  button.show?.();

  return () => {
    button.offClick?.(handler);
    if (activeMainButtonHandler === handler) {
      activeMainButtonHandler = null;
    }
  };
}

export function hideTelegramMainButton() {
  const button = webApp()?.MainButton;
  if (!button || !supportsWebAppVersion("6.1")) {
    return;
  }
  if (activeMainButtonHandler) {
    button.offClick?.(activeMainButtonHandler);
    activeMainButtonHandler = null;
  }
  button.hideProgress?.();
  button.hide?.();
}

export function setTelegramMainButtonProgress(visible: boolean) {
  const button = webApp()?.MainButton;
  if (!button || !supportsWebAppVersion("6.1")) {
    return;
  }
  if (visible) {
    button.showProgress?.(false);
  } else {
    button.hideProgress?.();
  }
}
