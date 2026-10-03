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
  },
  {
    id: 200003,
    username: "demo_newbie",
    firstName: "New User",
    label: "Newbie"
  }
];

export function isDevAuthEnabled() {
  return import.meta.env.DEV && !getTelegramInitData();
}

export function isDevUserSwitchVisible() {
  if (!isDevAuthEnabled()) {
    return false;
  }
  if (new URLSearchParams(window.location.search).get("dev_user") === "0") {
    return false;
  }
  return true;
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

export async function clearArchiveApi(): Promise<{
  gb_archived_cleaned: number;
  account_archived_cleaned: number;
  family_archived_cleaned: number;
}> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
  const res = await fetch(`${baseUrl}/api/dev/clear-archive`, {
    method: "POST",
    headers: { ...authHeaders() }
  });
  if (!res.ok) throw new Error("Failed to clear archive");
  return res.json();
}

export async function cleanAllCardsApi(): Promise<{
  gb_requests: number;
  account_requests: number;
  family_requests: number;
}> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
  const res = await fetch(`${baseUrl}/api/dev/clean-all`, {
    method: "POST",
    headers: { ...authHeaders() }
  });
  if (!res.ok) throw new Error("Failed to clean all cards");
  return res.json();
}

export async function purgeAllApi(): Promise<{
  gb_requests: number;
  account_requests: number;
  family_requests: number;
  gb_listings: number;
  account_listings: number;
  families: number;
}> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
  const res = await fetch(`${baseUrl}/api/dev/purge-all`, {
    method: "POST",
    headers: { ...authHeaders() }
  });
  if (!res.ok) throw new Error("Failed to purge all data");
  return res.json();
}

export async function resetAndSeedAllApi(): Promise<{
  gb: number;
  accounts: number;
  families: number;
}> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
  const res = await fetch(`${baseUrl}/api/dev/reset-and-seed`, {
    method: "POST",
    headers: { ...authHeaders() }
  });
  if (!res.ok) throw new Error("Failed to reset and seed cards");
  return res.json();
}
