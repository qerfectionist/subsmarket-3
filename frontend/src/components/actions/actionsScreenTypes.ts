import type {
  FamilyMember,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyRequest,
  MyFamily,
  OwnerFamilyDetails,
  OwnerFamilyRequest,
  PaymentRequisite
} from "../../types";

export type ActionsScreenProps = {
  initialActionsTab?: "inbox" | "outbox";
  families: MyFamily[];
  ownerDetails: Record<string, OwnerFamilyDetails>;
  requisites: Record<string, PaymentRequisite>;
  requests: FamilyRequest[];
  busy: string | null;
  isLoading?: boolean;
  requestsLoading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  hasMoreRequests?: boolean;
  isLoadingMoreRequests?: boolean;
  onLoadMoreRequests?: () => void;
  onOpenFamily: (familyId: string) => void;
  onLoadOwnerDetails: (familyId: string) => void;
  onUpdateDescription: (familyId: string, description: string | null) => void;
  onUpdatePrice: (familyId: string, totalPriceKzt: number) => void;
  onUpdatePaymentDay: (
    familyId: string,
    paymentDay: number,
    nextPaymentDate: string
  ) => void;
  onCloseFamily: (familyId: string, closesOn: string) => void;
  onConfirmAvailability: (familyId: string) => void;
  onConfirmAccess: (memberId: string) => void;
  onGetRequisite: (memberId: string) => void;
  onAcknowledgeClosing: (familyId: string) => void;
  onLeaveFamily: (memberId: string) => void;
  onCreatePrepayment: (memberId: string) => void;
  onReportPayment: (payment: FamilyPayment) => Promise<unknown>;
  onCancelPaymentReport: (payment: FamilyPayment) => Promise<unknown>;
  onApproveRequest: (familyId: string, request: OwnerFamilyRequest) => Promise<unknown>;
  onRejectRequest: (familyId: string, request: OwnerFamilyRequest) => Promise<unknown>;
  onAccessProvided: (familyId: string, member: FamilyMember) => Promise<unknown>;
  onRemindAccess: (familyId: string, member: FamilyMember) => Promise<unknown>;
  onCancelBeforeAccess: (familyId: string, member: FamilyMember) => Promise<unknown>;
  onRemoveMember: (
    familyId: string,
    member: FamilyMember,
    reason: FamilyMemberRemovalReason
  ) => Promise<unknown>;
  onConfirmPayment: (familyId: string, payment: FamilyPayment) => Promise<unknown>;
  onNotReceived: (familyId: string, payment: FamilyPayment) => Promise<unknown>;
  onRecordPrepayment: (
    familyId: string,
    member: FamilyMember,
    periods: number
  ) => Promise<unknown>;
  onCancelRequest: (requestId: string) => void;
  marketplaceSalesActionCount?: number;
  marketplacePurchaseActionCount?: number;
  accountSalesActionCount?: number;
  accountPurchaseActionCount?: number;
  onOpenMarketplaceSalesActions?: () => void;
  onOpenMarketplacePurchaseActions?: () => void;
  onOpenAccountSalesActions?: () => void;
  onOpenAccountPurchaseActions?: () => void;
};
