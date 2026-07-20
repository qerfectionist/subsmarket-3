import type { components } from "./api/openapi";

type Schema = components["schemas"];

export type User = Schema["UserOut"];

export type MeResponse = Schema["MeResponse"];

export type FamilyType = "subscription" | "tariff";

export type FamilyPeriod = "monthly" | "yearly";

export type PaymentBank = "kaspi" | "halyk" | "freedom" | "jusan";

export type FamilyMemberRemovalReason =
  | "no_payment"
  | "no_response"
  | "access_issue"
  | "mutual_agreement"
  | "other";

export type CursorPage<T> = {
  items: T[];
  next_cursor: string | null;
};

export type PublicOwner = Schema["PublicOwner"];

export type FamilyService = Omit<Schema["FamilyServiceOut"], "family_type" | "supported_periods"> & {
  family_type: FamilyType;
  supported_periods: FamilyPeriod[];
};

export type Family = Omit<Schema["FamilyOut"], "family_type" | "period"> & {
  family_type: FamilyType;
  period: FamilyPeriod;
};

export type FamilyCreate = Schema["FamilyCreate"];

export type FamilyCreateResult = {
  family: Family;
};

export type FamilyInvite = Omit<Schema["FamilyInviteOut"], "status"> & {
  status: "active" | "revoked";
};

export type RequestUser = Schema["RequestUserOut"];

export type FamilyRequest = Omit<Schema["FamilyRequestOut"], "family_type"> & {
  family_type: FamilyType;
};

export type OwnerFamilyRequest = FamilyRequest & {
  candidate: RequestUser;
};

export type FamilyMember = Omit<
  Schema["FamilyMemberOut"],
  "role" | "removal_reason"
> & {
  role: "owner" | "member";
  removal_reason: FamilyMemberRemovalReason | null;
};

export type FamilyPayment = Omit<Schema["FamilyPaymentOut"], "period"> & {
  period: FamilyPeriod;
};

export type FamilyMemberPayments = {
  member_id: string;
  payments: FamilyPayment[];
};

export type PaymentRequisite = Schema["PaymentRequisiteOut"];

export type AccessConfirmationResult = {
  member: FamilyMember;
  payment: FamilyPayment;
  payment_requisite: PaymentRequisite;
};

export type PaymentConfirmationResult = {
  member: FamilyMember;
  payment: FamilyPayment;
};

export type MyFamily = {
  family: Family;
  membership: FamilyMember;
  payments: FamilyPayment[];
  pending_requests_count: number;
};

export type FamilyView = {
  family: Family;
  owner_username: string | null;
  my_membership: FamilyMember | null;
  my_request: FamilyRequest | null;
  my_payments: FamilyPayment[];
  can_request: boolean;
};

export type FamilyAuditLog = Schema["FamilyAuditLogOut"];

export type OwnerFamilyDetails = {
  requests: OwnerFamilyRequest[];
  members: FamilyMember[];
  paymentsByMemberId: Record<string, FamilyPayment[]>;
};

export type MarketplaceOperator = Schema["MarketplaceOperatorOut"];
export type MarketplaceListing = Schema["MarketplaceListingOut"];
export type MarketplaceListingCreate = Schema["MarketplaceListingCreate"];
export type MarketplaceListingUpdate = Schema["MarketplaceListingUpdate"];
export type MarketplaceListingRequest = Schema["MarketplaceListingRequestOut"];
export type MarketplaceActionSummary = Schema["MarketplaceActionSummaryOut"];
export type MarketplacePriceInsight = Schema["MarketplacePriceInsightOut"];
export type MarketplaceRequestRole = "buyer" | "seller";
export type MarketplaceSort =
  | "recent"
  | "price_asc"
  | "price_desc";
export type AccountService = Schema["AccountServiceOut"];
export type AccountListing = Schema["AccountListingOut"];
export type AccountListingCreate = Schema["AccountListingCreate"];
export type AccountListingUpdate = Schema["AccountListingUpdate"];
export type AccountRequest = Schema["AccountRequestOut"];
