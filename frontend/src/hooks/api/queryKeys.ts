export const queryKeys = {
  me: ["me"] as const,
  services: (familyType?: string) => ["services", familyType ?? "all"] as const,
  families: (familyType?: string) => ["families", familyType ?? "all"] as const,
  myFamilies: ["myFamilies"] as const,
  myRequests: ["myRequests"] as const,
  familyView: (familyId: string) => ["familyView", familyId] as const,
  familyAuditLog: (familyId: string) => ["familyAuditLog", familyId] as const,
  familyInvite: (familyId: string) => ["familyInvite", familyId] as const,
  ownerRequests: (familyId: string) => ["ownerRequests", familyId] as const,
  familyMembers: (familyId: string) => ["familyMembers", familyId] as const,
  familyMemberPayments: (familyId: string) => ["familyMemberPayments", familyId] as const,
  marketplace: ["marketplace"] as const,
  marketplaceOperators: ["marketplace", "operators"] as const,
  marketplacePriceInsight: (operator: string) =>
    ["marketplace", "price-insight", operator] as const,
  marketplaceListings: (operator: string | null, sort: string) =>
    ["marketplace", "listings", operator ?? "all", sort] as const,
  myMarketplaceListings: ["marketplace", "listings", "me"] as const,
  marketplaceListing: (listingId: string) =>
    ["marketplace", "listing", listingId] as const,
  marketplaceRequests: (role: string) =>
    ["marketplace", "requests", role] as const
};
