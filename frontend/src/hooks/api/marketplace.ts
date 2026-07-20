import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acceptMarketplaceRequest,
  archiveMarketplaceListing,
  cancelMarketplaceRequest,
  closeMarketplaceRequest,
  createMarketplaceListing,
  createMarketplaceRequest,
  getMarketplaceListing,
  getMarketplaceActionSummary,
  getMarketplaceListingsPage,
  getMarketplaceOperators,
  getMarketplacePriceInsight,
  getMyMarketplaceListingsPage,
  getMyMarketplaceRequestsPage,
  pauseMarketplaceListing,
  rejectMarketplaceRequest,
  remindMarketplaceRequest,
  renewMarketplaceListing,
  resumeMarketplaceListing,
  updateMarketplaceListing
} from "../../api";
import type {
  MarketplaceListingCreate,
  MarketplaceListingUpdate,
  MarketplaceRequestRole,
  MarketplaceSort
} from "../../types";
import { queryKeys } from "./queryKeys";

function useMarketplaceMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace })
  });
}

export function useMarketplaceOperators() {
  return useQuery({
    queryKey: queryKeys.marketplaceOperators,
    queryFn: getMarketplaceOperators,
    staleTime: 60 * 60 * 1000
  });
}

export function useMarketplacePriceInsight(
  operator: string,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.marketplacePriceInsight(operator),
    queryFn: () => getMarketplacePriceInsight(operator),
    enabled: enabled && operator.length > 0,
    staleTime: 60 * 1000
  });
}

export function useMarketplaceListings(
  operator: string | null,
  sort: MarketplaceSort
) {
  return useInfiniteQuery({
    queryKey: queryKeys.marketplaceListings(operator, sort),
    queryFn: ({ pageParam }) =>
      getMarketplaceListingsPage({ operator, sort, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items)
  });
}

export function useMyMarketplaceListings() {
  return useInfiniteQuery({
    queryKey: queryKeys.myMarketplaceListings,
    queryFn: ({ pageParam }) => getMyMarketplaceListingsPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items)
  });
}

export function useMarketplaceListing(listingId: string | null) {
  return useQuery({
    queryKey: queryKeys.marketplaceListing(listingId ?? ""),
    queryFn: () => getMarketplaceListing(listingId!),
    enabled: listingId !== null
  });
}

export function useMarketplaceRequests(role: MarketplaceRequestRole) {
  return useInfiniteQuery({
    queryKey: queryKeys.marketplaceRequests(role),
    queryFn: ({ pageParam }) => getMyMarketplaceRequestsPage(role, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items)
  });
}

export function useMarketplaceActionSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.marketplaceActionSummary,
    queryFn: getMarketplaceActionSummary,
    enabled,
    staleTime: 15 * 1000
  });
}

export const useCreateMarketplaceListing = () =>
  useMarketplaceMutation<MarketplaceListingCreate, Awaited<ReturnType<typeof createMarketplaceListing>>>(
    createMarketplaceListing
  );

export const useUpdateMarketplaceListing = () =>
  useMarketplaceMutation<
    { id: string; payload: MarketplaceListingUpdate },
    Awaited<ReturnType<typeof updateMarketplaceListing>>
  >(({ id, payload }) => updateMarketplaceListing(id, payload));

export const usePauseMarketplaceListing = () =>
  useMarketplaceMutation<string, Awaited<ReturnType<typeof pauseMarketplaceListing>>>(
    pauseMarketplaceListing
  );

export const useResumeMarketplaceListing = () =>
  useMarketplaceMutation<string, Awaited<ReturnType<typeof resumeMarketplaceListing>>>(
    resumeMarketplaceListing
  );

export const useRenewMarketplaceListing = () =>
  useMarketplaceMutation<string, Awaited<ReturnType<typeof renewMarketplaceListing>>>(
    renewMarketplaceListing
  );

export const useArchiveMarketplaceListing = () =>
  useMarketplaceMutation<string, Awaited<ReturnType<typeof archiveMarketplaceListing>>>(
    archiveMarketplaceListing
  );

export const useCreateMarketplaceRequest = () =>
  useMarketplaceMutation<
    { listingId: string; amountGb: string },
    Awaited<ReturnType<typeof createMarketplaceRequest>>
  >(
    createMarketplaceRequest
  );

export const useAcceptMarketplaceRequest = () =>
  useMarketplaceMutation<string, Awaited<ReturnType<typeof acceptMarketplaceRequest>>>(
    acceptMarketplaceRequest
  );

export const useRejectMarketplaceRequest = () =>
  useMarketplaceMutation<
    { id: string; reason?: string | null },
    Awaited<ReturnType<typeof rejectMarketplaceRequest>>
  >(({ id, reason }) => rejectMarketplaceRequest(id, reason));

export const useCancelMarketplaceRequest = () =>
  useMarketplaceMutation<
    { id: string; reason?: string | null },
    Awaited<ReturnType<typeof cancelMarketplaceRequest>>
  >(({ id, reason }) => cancelMarketplaceRequest(id, reason));

export const useCloseMarketplaceRequest = () =>
  useMarketplaceMutation<
    {
      id: string;
      outcome: "sold" | "not_sold";
      reason?: string | null;
    },
    Awaited<ReturnType<typeof closeMarketplaceRequest>>
  >(({ id, outcome, reason }) => closeMarketplaceRequest(id, outcome, reason));

export const useRemindMarketplaceRequest = () =>
  useMarketplaceMutation<string, Awaited<ReturnType<typeof remindMarketplaceRequest>>>(
    remindMarketplaceRequest
  );
