import { Button as AppButton } from "../ui";
import { Badge } from "../layout";
import { FamilyListingCard } from "../ListingCard";
import { RequisiteBox } from "../RequisiteBox";
import { FamilyCard } from "./FamilyCard";
import {
  OwnerWorkSummary,
  MemberNextStep,
  OwnerActions,
  MemberActions
} from "./FamilyActionsControls";
import { PaymentList } from "./PaymentList";
import { OwnerDetails } from "./OwnerDetails";
import { memberCardStatus, statusText } from "../../format";
import { triggerTelegramImpact } from "../../telegram";
import type {
  FamilyMember,
  FamilyMemberRemovalReason,
  FamilyPayment,
  FamilyRequest,
  MyFamily,
  OwnerFamilyDetails,
  PaymentRequisite
} from "../../types";

export function MyFamilyWorkspaceCard({
  item,
  details,
  requisite,
  isExpanded,
  busy,
  onToggleExpand,
  onOpenFamily,
  onLoadOwnerDetails,
  onUpdateDescription,
  onUpdatePrice,
  onUpdatePaymentDay,
  onCloseFamily,
  onConfirmAvailability,
  onConfirmAccess,
  onGetRequisite,
  onAcknowledgeClosing,
  onLeaveFamily,
  onCreatePrepayment,
  onReportPayment,
  onCancelPaymentReport,
  onApproveRequest,
  onRejectRequest,
  onAccessProvided,
  onRemindAccess,
  onCancelBeforeAccess,
  onRemoveMember,
  onConfirmPayment,
  onNotReceived,
  onRecordPrepayment
}: {
  item: MyFamily;
  details?: OwnerFamilyDetails;
  requisite?: PaymentRequisite;
  isExpanded: boolean;
  busy: string | null;
  onToggleExpand: () => void;
  onOpenFamily: (familyId: string) => void;
  onLoadOwnerDetails: (familyId: string) => void;
  onUpdateDescription: (familyId: string, description: string | null) => void;
  onUpdatePrice: (familyId: string, totalPriceKzt: number) => void;
  onUpdatePaymentDay: (familyId: string, paymentDay: number, nextPaymentDate: string) => void;
  onCloseFamily: (familyId: string, closesOn: string) => void;
  onConfirmAvailability: (familyId: string) => void;
  onConfirmAccess: (memberId: string) => void;
  onGetRequisite: (memberId: string) => void;
  onAcknowledgeClosing: (familyId: string) => void;
  onLeaveFamily: (memberId: string) => void;
  onCreatePrepayment: (memberId: string) => void;
  onReportPayment: (payment: FamilyPayment) => Promise<unknown>;
  onCancelPaymentReport: (payment: FamilyPayment) => Promise<unknown>;
  onApproveRequest: (familyId: string, request: FamilyRequest) => Promise<unknown>;
  onRejectRequest: (familyId: string, request: FamilyRequest) => Promise<unknown>;
  onAccessProvided: (familyId: string, member: FamilyMember) => Promise<unknown>;
  onRemindAccess: (familyId: string, member: FamilyMember) => Promise<unknown>;
  onCancelBeforeAccess: (familyId: string, member: FamilyMember) => Promise<unknown>;
  onRemoveMember: (familyId: string, member: FamilyMember, reason: FamilyMemberRemovalReason) => Promise<unknown>;
  onConfirmPayment: (familyId: string, payment: FamilyPayment) => Promise<unknown>;
  onNotReceived: (familyId: string, payment: FamilyPayment) => Promise<unknown>;
  onRecordPrepayment: (familyId: string, member: FamilyMember, periods: number) => Promise<unknown>;
}) {
  return (
    <article
      className={!isExpanded ? "my-family-preview" : "family-workspace"}
      data-family-id={item.family.id}
      data-testid="family-workspace"
      key={item.membership.id}
    >
      <FamilyListingCard
        family={item.family}
        isOwner={item.membership.role === "owner"}
        status={item.membership.role === "owner" ? null : memberCardStatus(item)}
        onClick={() => {
          triggerTelegramImpact("light");
          onToggleExpand();
        }}
      />
      {isExpanded && (
        <>
          <FamilyCard family={item.family}>
            <Badge>
              {item.membership.role === "owner"
                ? statusText(item.membership.status)
                : memberCardStatus(item)}
            </Badge>
            <AppButton
              type="button"
              variant="secondary"
              size="sm"
              data-testid="workspace-open-family-button"
              onClick={() => onOpenFamily(item.family.id)}
            >
              Подробнее
            </AppButton>
            <AppButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                triggerTelegramImpact("light");
                onToggleExpand();
              }}
            >
              Свернуть
            </AppButton>
          </FamilyCard>
          {item.membership.role === "owner" && (
            <OwnerWorkSummary
              pendingRequestsCount={item.pending_requests_count}
              activeMembersCount={item.family.active_members_count}
              maxMembers={item.family.max_members}
              freeSlots={item.family.free_slots}
            />
          )}
          {item.membership.role !== "owner" && (
            <MemberNextStep member={item.membership} payments={item.payments} />
          )}
          <div className="workspace-actions">
            {item.membership.role === "owner" ? (
              <OwnerActions
                family={item.family}
                busy={busy}
                onLoadOwnerDetails={onLoadOwnerDetails}
                onUpdateDescription={onUpdateDescription}
                onUpdatePrice={onUpdatePrice}
                onUpdatePaymentDay={onUpdatePaymentDay}
                onCloseFamily={onCloseFamily}
                onConfirmAvailability={onConfirmAvailability}
              />
            ) : (
              <MemberActions
                familyId={item.family.id}
                member={item.membership}
                familyStatus={item.family.status}
                busy={busy}
                onConfirmAccess={onConfirmAccess}
                onGetRequisite={onGetRequisite}
                onAcknowledgeClosing={onAcknowledgeClosing}
                onLeaveFamily={onLeaveFamily}
                onCreatePrepayment={onCreatePrepayment}
              />
            )}
          </div>

          {requisite && <RequisiteBox requisite={requisite} />}

          {item.payments.length > 0 && (
            <PaymentList
              payments={item.payments}
              onReport={onReportPayment}
              onCancel={onCancelPaymentReport}
            />
          )}

          {details && (
            <OwnerDetails
              family={item.family}
              details={details}
              onApprove={(request) => onApproveRequest(item.family.id, request)}
              onReject={(request) => onRejectRequest(item.family.id, request)}
              onAccessProvided={(member) => onAccessProvided(item.family.id, member)}
              onRemindAccess={(member) => onRemindAccess(item.family.id, member)}
              onCancelBeforeAccess={(member) => onCancelBeforeAccess(item.family.id, member)}
              onRemove={(member, reason) => onRemoveMember(item.family.id, member, reason)}
              onConfirmPayment={(payment) => onConfirmPayment(item.family.id, payment)}
              onNotReceived={(payment) => onNotReceived(item.family.id, payment)}
              onRecordPrepayment={(member, periods) =>
                onRecordPrepayment(item.family.id, member, periods)
              }
            />
          )}
        </>
      )}
    </article>
  );
}
