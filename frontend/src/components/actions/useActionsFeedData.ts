import { useEffect, useMemo, useRef, useState } from "react";
import { useAccountRequests, useMarketplaceRequests } from "../../hooks/useApi";
import { useActionsDevCards } from "./useActionsDevCards";
import { useActionsTradeMutations } from "./useActionsTradeMutations";
import { useActionsArchiveItems } from "./useActionsArchiveItems";
import { hasPendingFamilyAction } from "../families";
import type { ActionsTab } from "./ActionsScopePager";
import {
  type ActionsCategoryFilter,
  type ActionsStatusFilter,
  isTradeRequestStatusMatch,
  isFamilyRequestStatusMatch,
  isFamilyActionStatusMatch
} from "./actionsFilterTypes";
import {
  isRequestExpired,
  REQUEST_EXPIRED_EVENT
} from "./useRequestTimeRemaining";
import type {
  Family,
  FamilyRequest,
  MyFamily,
  OwnerFamilyDetails,
  OwnerFamilyRequest
} from "../../types";

export interface UseActionsFeedDataOptions {
  initialActionsTab?: "inbox" | "outbox";
  families: MyFamily[];
  ownerDetails: Record<string, OwnerFamilyDetails>;
  requests: FamilyRequest[];
  onLoadOwnerDetails?: (familyId: string) => void;
  actionsCategory: ActionsCategoryFilter;
  setActionsCategory: (c: ActionsCategoryFilter) => void;
  actionsStatus: ActionsStatusFilter;
  setActionsStatus: (s: ActionsStatusFilter) => void;
  setIsArchiveOpen: (open: boolean) => void;
  onCancelRequest?: (requestId: string) => void;
  onApproveRequest: (familyId: string, request: OwnerFamilyRequest) => Promise<unknown>;
  onRejectRequest: (familyId: string, request: OwnerFamilyRequest) => Promise<unknown>;
}

export function useActionsFeedData({
  initialActionsTab,
  families,
  ownerDetails,
  requests,
  onLoadOwnerDetails,
  actionsCategory,
  setActionsCategory,
  actionsStatus,
  setActionsStatus,
  setIsArchiveOpen,
  onCancelRequest,
  onApproveRequest,
  onRejectRequest
}: UseActionsFeedDataOptions) {
  const sellerGbRequestsQuery = useMarketplaceRequests("seller", true);
  const buyerGbRequestsQuery = useMarketplaceRequests("buyer", true);
  const sellerAccountRequestsQuery = useAccountRequests("seller", true);
  const buyerAccountRequestsQuery = useAccountRequests("buyer", true);

  const sellerGbRequests = sellerGbRequestsQuery.data ?? [];
  const buyerGbRequests = buyerGbRequestsQuery.data ?? [];
  const sellerAccountRequests = sellerAccountRequestsQuery.data ?? [];
  const buyerAccountRequests = buyerAccountRequestsQuery.data ?? [];

  const userSelectedTabRef = useRef<boolean>(false);
  const [actionsTab, setActionsTab] = useState<ActionsTab>(() => initialActionsTab ?? "inbox");
  const [timeTick, setTimeTick] = useState(() => Date.now());

  useEffect(() => {
    const handleExpired = () => setTimeTick(Date.now());
    window.addEventListener(REQUEST_EXPIRED_EVENT, handleExpired);
    const interval = setInterval(() => setTimeTick(Date.now()), 4000);
    return () => {
      window.removeEventListener(REQUEST_EXPIRED_EVENT, handleExpired);
      clearInterval(interval);
    };
  }, []);

  const dev = useActionsDevCards({
    actionsTab,
    actionsCategory,
    setActionsCategory,
    setActionsStatus
  });

  const allSellerGbRequests = useMemo(
    () => [...dev.devCards.sellerGb, ...sellerGbRequests],
    [dev.devCards.sellerGb, sellerGbRequests]
  );
  const allBuyerGbRequests = useMemo(
    () => [...dev.devCards.buyerGb, ...buyerGbRequests],
    [dev.devCards.buyerGb, buyerGbRequests]
  );
  const allSellerAccountRequests = useMemo(
    () => [...dev.devCards.sellerAccounts, ...sellerAccountRequests],
    [dev.devCards.sellerAccounts, sellerAccountRequests]
  );
  const allBuyerAccountRequests = useMemo(
    () => [...dev.devCards.buyerAccounts, ...buyerAccountRequests],
    [dev.devCards.buyerAccounts, buyerAccountRequests]
  );
  const allBuyerFamilyRequests = useMemo(
    () => [...dev.devCards.buyerFamilies, ...requests],
    [dev.devCards.buyerFamilies, requests]
  );

  const ownerCandidateRequests = useMemo(() => {
    const list: Array<{ family: Family; request: OwnerFamilyRequest }> = [];
    for (const item of families) {
      if (item.membership.role !== "owner") continue;
      const details = ownerDetails[item.family.id];
      if (details?.requests) {
        for (const req of details.requests) {
          if (req.status === "pending" && !isRequestExpired(req.status, req.created_at, req.expires_at)) {
            list.push({ family: item.family, request: req });
          }
        }
      }
    }
    return list;
  }, [families, ownerDetails, timeTick]);

  const combinedOwnerCandidateRequests = useMemo(
    () =>
      [...dev.devCards.candidates, ...ownerCandidateRequests].filter(
        ({ request }) => !isRequestExpired(request.status, request.created_at, request.expires_at)
      ),
    [dev.devCards.candidates, ownerCandidateRequests, timeTick]
  );

  const allCandidateRequestsForArchive = useMemo(() => {
    const list: Array<{ family: Family; request: OwnerFamilyRequest }> = [...dev.devCards.candidates];
    for (const item of families) {
      if (item.membership.role !== "owner") continue;
      const details = ownerDetails[item.family.id];
      if (details?.requests) {
        for (const req of details.requests) {
          list.push({ family: item.family, request: req });
        }
      }
    }
    return list;
  }, [families, ownerDetails, dev.devCards.candidates]);

  const activeDevCandidates = useMemo(
    () =>
      dev.devCards.candidates.filter(
        ({ request }) => !isRequestExpired(request.status, request.created_at, request.expires_at)
      ),
    [dev.devCards.candidates, timeTick]
  );

  // Per-family check: if details loaded, count actual pending non-expired requests; otherwise fall back to pending_requests_count
  const ownerCandidateTotalCount = families.reduce((total, item) => {
    if (item.membership.role !== "owner") return total;
    const details = ownerDetails[item.family.id];
    if (details?.requests) {
      return (
        total +
        details.requests.filter(
          (r) => !isRequestExpired(r.status, r.created_at, r.expires_at) && r.status === "pending"
        ).length
      );
    }
    return total + item.pending_requests_count;
  }, 0) + activeDevCandidates.length;

  const actionFamilies = useMemo(() => families.filter(hasPendingFamilyAction), [families]);
  const memberActionFamilies = useMemo(
    () => actionFamilies.filter((item) => item.membership.role !== "owner"),
    [actionFamilies]
  );

  const isTradeActive = (r: { status: string; created_at?: string | null }) =>
    !isRequestExpired(r.status, r.created_at) && ["pending", "accepted"].includes(r.status);
  const isBuyerTradeActive = (r: { status: string; created_at?: string | null }) =>
    !isRequestExpired(r.status, r.created_at) && ["pending", "accepted"].includes(r.status);
  const isBuyerFamilyActive = (r: { status: string; created_at?: string | null; expires_at?: string | null }) =>
    !isRequestExpired(r.status, r.created_at, r.expires_at) && ["pending", "approved"].includes(r.status);

  const inboxTotalCount =
    allSellerGbRequests.filter(isTradeActive).length +
    allSellerAccountRequests.filter(isTradeActive).length +
    ownerCandidateTotalCount;

  const outboxTotalCount =
    allBuyerGbRequests.filter(isBuyerTradeActive).length +
    allBuyerAccountRequests.filter(isBuyerTradeActive).length +
    allBuyerFamilyRequests.filter(isBuyerFamilyActive).length +
    memberActionFamilies.length;

  const mutations = useActionsTradeMutations({
    devCards: dev.devCards,
    setDevCards: dev.setDevCards,
    onCancelRequest,
    onApproveRequest,
    onRejectRequest,
    setIsArchiveOpen,
    setActionsTab
  });

  const archive = useActionsArchiveItems({
    actionsTab,
    sellerGbRequests: allSellerGbRequests,
    sellerAccountRequests: allSellerAccountRequests,
    families,
    ownerDetails,
    buyerGbRequests: allBuyerGbRequests,
    buyerAccountRequests: allBuyerAccountRequests,
    requests: allBuyerFamilyRequests,
    candidateRequests: allCandidateRequestsForArchive,
    timeTick
  });

  useEffect(() => {
    if (initialActionsTab) {
      setActionsTab(initialActionsTab);
      setActionsCategory("all");
      setActionsStatus("all");
      userSelectedTabRef.current = true;
    } else {
      userSelectedTabRef.current = false;
    }
  }, [initialActionsTab, setActionsCategory, setActionsStatus]);

  useEffect(() => {
    if (!userSelectedTabRef.current && !initialActionsTab) {
      if (inboxTotalCount === 0 && outboxTotalCount > 0) {
        setActionsTab("outbox");
        setActionsCategory("all");
        setActionsStatus("all");
      } else if (inboxTotalCount > 0 && outboxTotalCount === 0) {
        setActionsTab("inbox");
        setActionsCategory("all");
        setActionsStatus("all");
      }
    }
  }, [inboxTotalCount, outboxTotalCount, initialActionsTab, setActionsCategory, setActionsStatus]);

  const loadingOwnerDetailsRef = useRef(new Set<string>());
  useEffect(() => {
    if (!onLoadOwnerDetails) return;
    families.forEach((item) => {
      if (
        item.membership.role === "owner" &&
        item.pending_requests_count > 0 &&
        !ownerDetails[item.family.id] &&
        !loadingOwnerDetailsRef.current.has(item.family.id)
      ) {
        loadingOwnerDetailsRef.current.add(item.family.id);
        Promise.resolve(onLoadOwnerDetails(item.family.id)).finally(() => {
          loadingOwnerDetailsRef.current.delete(item.family.id);
        });
      }
    });
  }, [families, ownerDetails, onLoadOwnerDetails]);

  // Filtered feeds
  const filteredSellerGbRequests = allSellerGbRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "gigabytes") &&
      (isTradeRequestStatusMatch(item.status, actionsStatus, item.created_at) || mutations.cancellingIds.has(item.id))
  );
  const filteredSellerAccountRequests = allSellerAccountRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "accounts") &&
      (isTradeRequestStatusMatch(item.status, actionsStatus, item.created_at) || mutations.cancellingIds.has(item.id))
  );
  const filteredOwnerCandidateRequests = useMemo(() => {
    return combinedOwnerCandidateRequests.filter(({ request }) => {
      const isCategoryMatch = actionsCategory === "all" || actionsCategory === "families";
      const isStatusMatch =
        isFamilyRequestStatusMatch(request.status, actionsStatus, request.created_at, request.expires_at) ||
        mutations.cancellingIds.has(request.id);
      return isCategoryMatch && isStatusMatch;
    });
  }, [combinedOwnerCandidateRequests, actionsCategory, actionsStatus, mutations.cancellingIds]);

  const unloadedOwnerPendingCount = families.reduce((total, item) => {
    if (item.membership.role !== "owner") return total;
    if (!ownerDetails[item.family.id]) {
      return total + item.pending_requests_count;
    }
    return total;
  }, 0);

  const visibleCandidateCount =
    filteredOwnerCandidateRequests.filter((r) => !mutations.cancellingIds.has(r.request.id)).length +
    ((actionsCategory === "all" || actionsCategory === "families") && isFamilyActionStatusMatch(actionsStatus)
      ? unloadedOwnerPendingCount
      : 0);

  const visibleInboxCount =
    filteredSellerGbRequests.filter((r) => !mutations.cancellingIds.has(r.id)).length +
    filteredSellerAccountRequests.filter((r) => !mutations.cancellingIds.has(r.id)).length +
    visibleCandidateCount;

  const filteredBuyerGbRequests = allBuyerGbRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "gigabytes") &&
      (isTradeRequestStatusMatch(item.status, actionsStatus, item.created_at) || mutations.cancellingIds.has(item.id))
  );
  const filteredBuyerAccountRequests = allBuyerAccountRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "accounts") &&
      (isTradeRequestStatusMatch(item.status, actionsStatus, item.created_at) || mutations.cancellingIds.has(item.id))
  );
  const filteredFamilyRequests = allBuyerFamilyRequests.filter(
    (item) =>
      (actionsCategory === "all" || actionsCategory === "families") &&
      (isFamilyRequestStatusMatch(item.status, actionsStatus, item.created_at, item.expires_at) ||
        mutations.cancellingIds.has(item.id))
  );
  const filteredMemberActionFamilies =
    (actionsCategory === "all" || actionsCategory === "families") && isFamilyActionStatusMatch(actionsStatus)
      ? memberActionFamilies
      : [];
  const visibleOutboxCount =
    filteredBuyerGbRequests.filter((r) => !mutations.cancellingIds.has(r.id)).length +
    filteredBuyerAccountRequests.filter((r) => !mutations.cancellingIds.has(r.id)).length +
    filteredFamilyRequests.filter((r) => !mutations.cancellingIds.has(r.id)).length +
    filteredMemberActionFamilies.length;

  return {
    actionsTab,
    setActionsTab,
    userSelectedTabRef,
    timeTick,
    dev,
    mutations,
    archive,
    inboxTotalCount,
    outboxTotalCount,
    visibleInboxCount,
    visibleOutboxCount,
    visibleCandidateCount,
    filteredSellerGbRequests,
    filteredSellerAccountRequests,
    filteredOwnerCandidateRequests,
    filteredBuyerGbRequests,
    filteredBuyerAccountRequests,
    filteredFamilyRequests,
    filteredMemberActionFamilies
  };
}
