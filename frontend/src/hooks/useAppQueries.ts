import { useMemo } from "react";
import type { Tab, LoadState } from "../appTypes";
import type { FamilyType } from "../types";
import {
  useAccountListings,
  useFamilies,
  useFamilyAuditLog,
  useFamilyInvite,
  useFamilyServices,
  useFamilyView,
  useMarketplaceActionSummary,
  useMarketplaceListings,
  useMe,
  useMyFamilies,
  useMyFamilyRequests
} from "./useApi";

export function useAppQueries(tab: Tab, familyType: FamilyType, selectedFamilyId: string | null) {
  const meQuery = useMe();
  const servicesQuery = useFamilyServices();
  const subscriptionFamiliesQuery = useFamilies("subscription");
  const tariffFamiliesQuery = useFamilies(
    "tariff",
    tab === "home" || familyType === "tariff" || tab === "search"
  );
  const familiesQuery = familyType === "tariff" ? tariffFamiliesQuery : subscriptionFamiliesQuery;
  const myFamiliesQuery = useMyFamilies();
  const myRequestsQuery = useMyFamilyRequests();

  const homeMarketplaceEnabled = tab === "home" && meQuery.isSuccess && Boolean(meQuery.data?.ok);
  const marketplaceListingsQuery = useMarketplaceListings(null, "recent", homeMarketplaceEnabled);
  const accountListingsQuery = useAccountListings(null, "recent", homeMarketplaceEnabled);
  const marketplaceActionSummaryQuery = useMarketplaceActionSummary(
    meQuery.isSuccess && Boolean(meQuery.data?.ok)
  );

  const familyViewQuery = useFamilyView(selectedFamilyId);
  const familyAuditQuery = useFamilyAuditLog(
    selectedFamilyId && familyViewQuery.data?.my_membership ? selectedFamilyId : null
  );
  const familyInviteQuery = useFamilyInvite(
    selectedFamilyId && familyViewQuery.data?.my_membership?.role === "owner" ? selectedFamilyId : null
  );

  const me = meQuery.data;
  const user = me?.ok ? me.user : null;
  const services = servicesQuery.data ?? [];
  const subscriptionFamilies = subscriptionFamiliesQuery.data ?? [];
  const tariffFamilies = tariffFamiliesQuery.data ?? [];
  const marketplaceListings = marketplaceListingsQuery.data ?? [];
  const accountListings = accountListingsQuery.data ?? [];
  const myFamilies = myFamiliesQuery.data ?? [];
  const myRequests = myRequestsQuery.data ?? [];
  const marketplaceActionSummary = marketplaceActionSummaryQuery.data;

  const typedServices = useMemo(
    () => services.filter((service) => service.family_type === familyType),
    [services, familyType]
  );

  const typedFamilies = useMemo(
    () => (familyType === "tariff" ? tariffFamilies : subscriptionFamilies),
    [familyType, tariffFamilies, subscriptionFamilies]
  );

  const familyPendingActionsCount =
    myRequests.filter((request) => request.status === "pending").length +
    myFamilies.reduce(
      (total, item) =>
        total +
        item.pending_requests_count +
        (["awaiting_access", "awaiting_confirmation"].includes(item.membership.status) ? 1 : 0) +
        item.payments.filter((payment) =>
          ["due", "overdue", "payment_reported"].includes(payment.status)
        ).length,
      0
    );

  const marketplaceSalesActionCount =
    (marketplaceActionSummary?.pending_sales_requests ?? 0) +
    (marketplaceActionSummary?.accepted_sales_requests ?? 0);
  const marketplacePurchaseActionCount =
    marketplaceActionSummary?.accepted_purchase_requests ?? 0;
  const accountSalesActionCount =
    (marketplaceActionSummary?.pending_account_sales_requests ?? 0) +
    (marketplaceActionSummary?.accepted_account_sales_requests ?? 0);
  const accountPurchaseActionCount =
    marketplaceActionSummary?.accepted_account_purchase_requests ?? 0;
  const marketplacePendingActionsCount =
    marketplaceSalesActionCount +
    marketplacePurchaseActionCount +
    accountSalesActionCount +
    accountPurchaseActionCount;

  const loadState: LoadState = meQuery.isPending
    ? "loading"
    : meQuery.isError
      ? "error"
      : me && !me.ok
        ? "username-required"
        : "ready";

  return {
    meQuery,
    me,
    user,
    loadState,
    servicesQuery,
    services,
    typedServices,
    familiesQuery,
    typedFamilies,
    subscriptionFamiliesQuery,
    subscriptionFamilies,
    tariffFamiliesQuery,
    tariffFamilies,
    marketplaceListingsQuery,
    marketplaceListings,
    accountListingsQuery,
    accountListings,
    myFamiliesQuery,
    myFamilies,
    myRequestsQuery,
    myRequests,
    marketplaceActionSummaryQuery,
    familyViewQuery,
    selectedFamilyView: familyViewQuery.data ?? null,
    familyAuditQuery,
    selectedFamilyAudit: familyAuditQuery.data ?? [],
    familyInviteQuery,
    selectedFamilyInvite: familyInviteQuery.data ?? null,
    counts: {
      familyPendingActionsCount,
      marketplacePendingActionsCount,
      marketplaceSalesActionCount,
      marketplacePurchaseActionCount,
      accountSalesActionCount,
      accountPurchaseActionCount
    }
  };
}
