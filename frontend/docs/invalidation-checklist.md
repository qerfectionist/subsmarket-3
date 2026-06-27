# Owner workspace invalidation checklist

Owner panel reads three query keys per `familyId`:

- `ownerRequests`
- `familyMembers`
- `familyMemberPayments`

Plus `familyView` when membership/status on the family screen changes.

| Mutation | ownerRequests | familyMembers | familyMemberPayments | familyView |
|----------|:---:|:---:|:---:|:---:|
| useApproveFamilyRequest | ✓ | ✓ | — | ✓ |
| useRejectFamilyRequest | ✓ | ✓ | — | ✓ |
| useMarkAccessProvided | ✓ | ✓ | — | ✓ |
| useRemindAccessConfirmation | — | ✓ | — | — |
| useCancelMemberBeforeAccess | ✓ | ✓ | — | — |
| useScheduleMemberRemoval | ✓ | ✓ | — | ✓ |
| useRevokeMemberRemoval | ✓ | ✓ | — | ✓ |
| useConfirmPaymentReceived | ✓ | ✓ | ✓ | ✓ |
| useMarkPaymentNotReceived | ✓ | ✓ | ✓ | ✓ |
| useRecordOwnerPrepaidPeriods | ✓ | ✓ | ✓ | — |

Source of truth: `hooks/useApi.ts` `onSuccess` handlers.