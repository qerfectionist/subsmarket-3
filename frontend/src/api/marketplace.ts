import { patchIdempotent, postIdempotent, request } from "./client";
import type {
  CursorPage,
  MarketplaceListing,
  MarketplaceListingCreate,
  MarketplaceListingRequest,
  MarketplaceListingUpdate,
  MarketplaceOperator,
  MarketplacePriceInsight,
  MarketplaceRequestRole,
  MarketplaceSort
} from "../types";

function pagePath(
  path: string,
  params: Record<string, string | null | undefined>
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export function getMarketplaceOperators(): Promise<MarketplaceOperator[]> {
  return request<MarketplaceOperator[]>("/api/marketplace/operators");
}

export function getMarketplacePriceInsight(
  operator: string
): Promise<MarketplacePriceInsight> {
  return request(
    pagePath("/api/marketplace/price-insight", { operator })
  );
}

export function getMarketplaceListingsPage({
  operator,
  sort,
  cursor
}: {
  operator?: string | null;
  sort: MarketplaceSort;
  cursor?: string | null;
}): Promise<CursorPage<MarketplaceListing>> {
  return request(
    pagePath("/api/marketplace/listings", {
      operator,
      sort,
      cursor
    })
  );
}

export function getMyMarketplaceListingsPage(
  cursor: string | null = null
): Promise<CursorPage<MarketplaceListing>> {
  return request(pagePath("/api/marketplace/listings/me", { cursor }));
}

export function getMarketplaceListing(id: string): Promise<MarketplaceListing> {
  return request(`/api/marketplace/listings/${id}`);
}

export function createMarketplaceListing(
  payload: MarketplaceListingCreate
): Promise<MarketplaceListing> {
  return postIdempotent(
    "marketplace_listing.create",
    "/api/marketplace/listings",
    payload
  );
}

export function updateMarketplaceListing(
  id: string,
  payload: MarketplaceListingUpdate
): Promise<MarketplaceListing> {
  return patchIdempotent(
    `marketplace_listing.update:${id}`,
    `/api/marketplace/listings/${id}`,
    payload
  );
}

function listingAction(
  id: string,
  action: "pause" | "resume" | "renew" | "archive"
): Promise<MarketplaceListing> {
  return postIdempotent(
    `marketplace_listing.${action}:${id}`,
    `/api/marketplace/listings/${id}/${action}`
  );
}

export const pauseMarketplaceListing = (id: string) => listingAction(id, "pause");
export const resumeMarketplaceListing = (id: string) => listingAction(id, "resume");
export const renewMarketplaceListing = (id: string) => listingAction(id, "renew");
export const archiveMarketplaceListing = (id: string) => listingAction(id, "archive");
export function createMarketplaceRequest(
  variables: { listingId: string; amountGb: string }
): Promise<MarketplaceListingRequest> {
  const { listingId, amountGb } = variables;
  return postIdempotent(
    `marketplace_request.create:${listingId}:${amountGb}`,
    `/api/marketplace/listings/${listingId}/requests`,
    { amount_gb: amountGb }
  );
}

export function getMyMarketplaceRequestsPage(
  role: MarketplaceRequestRole,
  cursor: string | null = null
): Promise<CursorPage<MarketplaceListingRequest>> {
  return request(
    pagePath("/api/marketplace/requests/me", {
      role,
      cursor
    })
  );
}

function requestAction(
  id: string,
  action: "accept" | "reject" | "cancel" | "remind",
  reason?: string | null
): Promise<MarketplaceListingRequest> {
  const body = action === "accept" || action === "remind" ? undefined : { reason };
  return postIdempotent(
    `marketplace_request.${action}:${id}`,
    `/api/marketplace/requests/${id}/${action}`,
    body
  );
}

export const acceptMarketplaceRequest = (id: string) => requestAction(id, "accept");
export const rejectMarketplaceRequest = (id: string, reason?: string | null) =>
  requestAction(id, "reject", reason);
export const cancelMarketplaceRequest = (id: string, reason?: string | null) =>
  requestAction(id, "cancel", reason);
export const closeMarketplaceRequest = (
  id: string,
  outcome: "sold" | "not_sold",
  reason?: string | null
) =>
  postIdempotent(
    `marketplace_request.close:${id}:${outcome}`,
    `/api/marketplace/requests/${id}/close`,
    { outcome, reason }
  );
export const remindMarketplaceRequest = (id: string) => requestAction(id, "remind");
