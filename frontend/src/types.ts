export type User = {
  id: string;
  telegram_user_id: number;
  username: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  status: string;
};

export type MeResponse =
  | {
      ok: true;
      user: User;
      error: null;
      message: null;
    }
  | {
      ok: false;
      user: null;
      error: "USERNAME_REQUIRED" | string;
      message: string;
    };

export type FamilyService = {
  id: string;
  slug: string;
  name: string;
  variant: string | null;
  family_type: FamilyType;
  category: string;
  subcategory: string | null;
  max_members: number;
  supported_periods: Array<"monthly" | "yearly">;
  status: string;
  service_metadata: Record<string, unknown>;
};

export type FamilyType = "subscription" | "tariff";

export type PublicOwner = {
  first_name: string;
  photo_url: string | null;
};

export type Family = {
  id: string;
  service_id: string;
  family_type: FamilyType;
  service_slug: string;
  service_name: string;
  service_variant: string | null;
  owner: PublicOwner;
  status: string;
  period: "monthly" | "yearly";
  max_members: number;
  active_members_count: number;
  free_slots: number;
  total_price_kzt: number;
  member_share_kzt: number;
  rounding_delta_kzt: number;
  payment_day: number;
  next_payment_date: string;
  description: string | null;
  owner_rules: string | null;
  is_search_visible: boolean;
  closing_started_at: string | null;
  closes_at: string | null;
  created_at: string;
};

export type FamilyCreate = {
  service_id: string;
  period: "monthly" | "yearly";
  max_members: number;
  total_price_kzt: number;
  payment_day: number;
  next_payment_date: string;
  description: string | null;
  owner_rules: string | null;
  payment_bank: "kaspi" | "halyk" | "freedom" | "jusan";
  payment_phone: string;
};

export type FamilyCreateResult = {
  family: Family;
};

export type FamilyInvite = {
  code: string;
  status: "active" | "revoked";
  created_at: string;
};

export type RequestUser = {
  id: string;
  username: string;
  first_name: string;
  photo_url: string | null;
};

export type FamilyRequest = {
  id: string;
  family_id: string;
  family_type: FamilyType;
  service_name: string;
  service_variant: string | null;
  owner_username: string | null;
  user_id: string;
  status: string;
  cancel_reason: string | null;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
};

export type OwnerFamilyRequest = FamilyRequest & {
  candidate: RequestUser;
};

export type FamilyMember = {
  id: string;
  family_id: string;
  user: RequestUser;
  role: "owner" | "member";
  status: string;
  joined_at: string;
  access_provided_at: string | null;
  access_confirmed_at: string | null;
  removal_scheduled_at: string | null;
  removal_acknowledged_at: string | null;
  removal_cancel_requested_at: string | null;
  left_at: string | null;
  removed_at: string | null;
  cancelled_at: string | null;
  closing_acknowledged_at: string | null;
};

export type FamilyPayment = {
  id: string;
  family_id: string;
  member_id: string;
  kind: string;
  status: string;
  amount_kzt: number;
  period: "monthly" | "yearly";
  period_start: string;
  period_end: string;
  due_at: string;
  requisites_opened_at: string | null;
  reported_paid_at: string | null;
  confirmed_paid_at: string | null;
  overdue_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

export type PaymentRequisite = {
  bank: "kaspi" | "halyk" | "freedom" | "jusan";
  phone: string;
};

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

export type FamilyAuditLog = {
  id: string;
  family_id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  target_member_id: string | null;
  target_request_id: string | null;
  target_payment_id: string | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type OwnerFamilyDetails = {
  requests: OwnerFamilyRequest[];
  members: FamilyMember[];
  paymentsByMemberId: Record<string, FamilyPayment[]>;
};
