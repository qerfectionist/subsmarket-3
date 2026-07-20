import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acceptAccountRequest,
  archiveAccountListing,
  cancelAccountRequest,
  closeAccountRequest,
  createAccountListing,
  createAccountRequest,
  getAccountListing,
  getAccountListingsPage,
  getAccountServices,
  getMyAccountListingsPage,
  getMyAccountRequestsPage,
  pauseAccountListing,
  rejectAccountRequest,
  remindAccountRequest,
  renewAccountListing,
  resumeAccountListing,
  updateAccountListing
} from "../../api";
import type {
  AccountListingCreate,
  AccountListingUpdate,
  MarketplaceRequestRole,
  MarketplaceSort
} from "../../types";
import { queryKeys } from "./queryKeys";

function useAccountMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace })
  });
}

export const useAccountServices = () =>
  useQuery({
    queryKey: queryKeys.accountServices,
    queryFn: getAccountServices,
    staleTime: 60 * 60 * 1000
  });

export function useAccountListings(
  service: string | null,
  sort: MarketplaceSort
) {
  return useInfiniteQuery({
    queryKey: queryKeys.accountListings(service, sort),
    queryFn: ({ pageParam }) =>
      getAccountListingsPage({ service, sort, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items)
  });
}

export const useMyAccountListings = () =>
  useInfiniteQuery({
    queryKey: queryKeys.myAccountListings,
    queryFn: ({ pageParam }) => getMyAccountListingsPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items)
  });

export const useAccountListing = (listingId: string | null) =>
  useQuery({
    queryKey: queryKeys.accountListing(listingId ?? ""),
    queryFn: () => getAccountListing(listingId!),
    enabled: listingId !== null
  });

export const useAccountRequests = (role: MarketplaceRequestRole) =>
  useInfiniteQuery({
    queryKey: queryKeys.accountRequests(role),
    queryFn: ({ pageParam }) => getMyAccountRequestsPage(role, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items)
  });

export const useCreateAccountListing = () =>
  useAccountMutation<
    AccountListingCreate,
    Awaited<ReturnType<typeof createAccountListing>>
  >(createAccountListing);

export const useUpdateAccountListing = () =>
  useAccountMutation<
    { id: string; payload: AccountListingUpdate },
    Awaited<ReturnType<typeof updateAccountListing>>
  >(({ id, payload }) => updateAccountListing(id, payload));

export const usePauseAccountListing = () =>
  useAccountMutation<string, Awaited<ReturnType<typeof pauseAccountListing>>>(
    pauseAccountListing
  );
export const useResumeAccountListing = () =>
  useAccountMutation<string, Awaited<ReturnType<typeof resumeAccountListing>>>(
    resumeAccountListing
  );
export const useRenewAccountListing = () =>
  useAccountMutation<string, Awaited<ReturnType<typeof renewAccountListing>>>(
    renewAccountListing
  );
export const useArchiveAccountListing = () =>
  useAccountMutation<string, Awaited<ReturnType<typeof archiveAccountListing>>>(
    archiveAccountListing
  );
export const useCreateAccountRequest = () =>
  useAccountMutation<string, Awaited<ReturnType<typeof createAccountRequest>>>(
    createAccountRequest
  );
export const useAcceptAccountRequest = () =>
  useAccountMutation<string, Awaited<ReturnType<typeof acceptAccountRequest>>>(
    acceptAccountRequest
  );
export const useRejectAccountRequest = () =>
  useAccountMutation<
    { id: string; reason?: string | null },
    Awaited<ReturnType<typeof rejectAccountRequest>>
  >(({ id, reason }) => rejectAccountRequest(id, reason));
export const useCancelAccountRequest = () =>
  useAccountMutation<
    { id: string; reason?: string | null },
    Awaited<ReturnType<typeof cancelAccountRequest>>
  >(({ id, reason }) => cancelAccountRequest(id, reason));
export const useRemindAccountRequest = () =>
  useAccountMutation<string, Awaited<ReturnType<typeof remindAccountRequest>>>(
    remindAccountRequest
  );
export const useCloseAccountRequest = () =>
  useAccountMutation<
    { id: string; outcome: "sold" | "not_sold"; reason?: string | null },
    Awaited<ReturnType<typeof closeAccountRequest>>
  >(({ id, outcome, reason }) => closeAccountRequest(id, outcome, reason));
