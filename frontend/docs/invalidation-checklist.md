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
| useRemoveMember | ✓ | ✓ | — | ✓ |
| useConfirmPaymentReceived | ✓ | ✓ | ✓ | ✓ |
| useMarkPaymentNotReceived | ✓ | ✓ | ✓ | ✓ |
| useRecordOwnerPrepaidPeriods | ✓ | ✓ | ✓ | — |

Source of truth: `frontend/src/hooks/api/families-mutations.ts` `onSuccess` handlers.