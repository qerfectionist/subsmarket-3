import { patchIdempotent, postIdempotent, request } from "./client";
import type {
  AccountListing,
  AccountListingCreate,
  AccountListingUpdate,
  AccountRequest,
  AccountService,
  CursorPage,
  MarketplaceRequestRole,
  MarketplaceSort
} from "../types";

function pagePath(path: string, params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export const getAccountServices = (): Promise<AccountService[]> =>
  request("/api/marketplace/accounts/services");

export function getAccountListingsPage({ service, sort, cursor }: {
  service?: string | null;
  sort: MarketplaceSort;
  cursor?: string | null;
}): Promise<CursorPage<AccountListing>> {
  return request(
    pagePath("/api/marketplace/accounts/listings", { service, sort, cursor })
  );
}

export const getMyAccountListingsPage = (
  cursor: string | null = null
): Promise<CursorPage<AccountListing>> =>
  request(pagePath("/api/marketplace/accounts/listings/me", { cursor }));

export const getAccountListing = (id: string): Promise<AccountListing> =>
  request(`/api/marketplace/accounts/listings/${id}`);

export const createAccountListing = (
  payload: AccountListingCreate
): Promise<AccountListing> =>
  postIdempotent(
    "account_listing.create",
    "/api/marketplace/accounts/listings",
    payload
  );

export const updateAccountListing = (
  id: string,
  payload: AccountListingUpdate
): Promise<AccountListing> =>
  patchIdempotent(
    `account_listing.update:${id}`,
    `/api/marketplace/accounts/listings/${id}`,
    payload
  );

function listingAction(
  id: string,
  action: "pause" | "resume" | "renew" | "archive"
): Promise<AccountListing> {
  return postIdempotent(
    `account_listing.${action}:${id}`,
    `/api/marketplace/accounts/listings/${id}/${action}`
  );
}

export const pauseAccountListing = (id: string) => listingAction(id, "pause");
export const resumeAccountListing = (id: string) => listingAction(id, "resume");
export const renewAccountListing = (id: string) => listingAction(id, "renew");
export const archiveAccountListing = (id: string) => listingAction(id, "archive");

export const createAccountRequest = (listingId: string): Promise<AccountRequest> =>
  postIdempotent(
    `account_request.create:${listingId}`,
    `/api/marketplace/accounts/listings/${listingId}/requests`
  );

export const getMyAccountRequestsPage = (
  role: MarketplaceRequestRole,
  cursor: string | null = null
): Promise<CursorPage<AccountRequest>> =>
  request(pagePath("/api/marketplace/accounts/requests/me", { role, cursor }));

function requestAction(
  id: string,
  action: "accept" | "reject" | "cancel" | "remind",
  reason?: string | null
): Promise<AccountRequest> {
  const body = action === "accept" || action === "remind" ? undefined : { reason };
  return postIdempotent(
    `account_request.${action}:${id}`,
    `/api/marketplace/accounts/requests/${id}/${action}`,
    body
  );
}

export const acceptAccountRequest = (id: string) => requestAction(id, "accept");
export const rejectAccountRequest = (id: string, reason?: string | null) =>
  requestAction(id, "reject", reason);
export const cancelAccountRequest = (id: string, reason?: string | null) =>
  requestAction(id, "cancel", reason);
export const remindAccountRequest = (id: string) => requestAction(id, "remind");
export const closeAccountRequest = (
  id: string,
  outcome: "sold" | "not_sold",
  reason?: string | null
): Promise<AccountRequest> =>
  postIdempotent(
    `account_request.close:${id}:${outcome}`,
    `/api/marketplace/accounts/requests/${id}/close`,
    { outcome, reason }
  );
