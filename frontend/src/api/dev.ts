import { getTelegramInitData } from "../telegram";

export const DEV_TELEGRAM_USER_KEY = "subsmarket.devTelegramUser";

export type DevTelegramUser = {
  id: number;
  username: string;
  firstName: string;
  label: string;
};

export const DEV_TELEGRAM_USERS: DevTelegramUser[] = [
  {
    id: 200001,
    username: "demo_owner",
    firstName: "Demo Owner",
    label: "Owner"
  },
  {
    id: 200002,
    username: "demo_member",
    firstName: "Demo Member",
    label: "Member"
  }
];

export function isDevAuthEnabled() {
  return import.meta.env.DEV && !getTelegramInitData();
}

export function isDevUserSwitchVisible() {
  return isDevAuthEnabled() && import.meta.env.VITE_SHOW_DEV_USER_SWITCH === "true";
}

export function getActiveDevTelegramUser() {
  if (!isDevAuthEnabled()) {
    return null;
  }
  const storedId = Number(window.localStorage.getItem(DEV_TELEGRAM_USER_KEY));
  return (
    DEV_TELEGRAM_USERS.find((user) => user.id === storedId) ?? DEV_TELEGRAM_USERS[0]
  );
}

export function setActiveDevTelegramUser(user: DevTelegramUser) {
  window.localStorage.setItem(DEV_TELEGRAM_USER_KEY, String(user.id));
}

export function authHeaders(): HeadersInit {
  const initData = getTelegramInitData();
  if (initData) {
    return { "X-Telegram-Init-Data": initData };
  }

  const devUser = getActiveDevTelegramUser();
  if (!devUser) {
    return {};
  }

  return {
    "X-Dev-Telegram-User-Id": String(devUser.id),
    "X-Dev-Telegram-Username": devUser.username,
    "X-Dev-Telegram-First-Name": devUser.firstName
  };
}
