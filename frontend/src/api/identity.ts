import { typedIdentity } from "./typed";
import type { MeResponse } from "../types";

export function getMe(): Promise<MeResponse> {
  return typedIdentity.getMe();
}

export function refreshTelegramProfile(): Promise<MeResponse> {
  return typedIdentity.refreshTelegramProfile();
}