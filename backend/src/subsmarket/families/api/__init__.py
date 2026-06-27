from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import APIRouter

from subsmarket.families.api import (
    detail,
    discovery,
    management,
    members,
    payments,
    requests,
)
from subsmarket.families.schemas import (
    AccessConfirmationResult,
    FamilyAuditLogOut,
    FamilyAuditLogPageOut,
    FamilyCreateResult,
    FamilyInviteOut,
    FamilyMemberOut,
    FamilyMemberPageOut,
    FamilyMemberPaymentsOut,
    FamilyOut,
    FamilyPageOut,
    FamilyPaymentOut,
    FamilyPaymentPageOut,
    FamilyRequestOut,
    FamilyRequestPageOut,
    FamilyViewOut,
    MyFamilyOut,
    MyFamilyPageOut,
    OwnerFamilyRequestOut,
    OwnerFamilyRequestPageOut,
    PaymentConfirmationResult,
    PaymentRequisiteOut,
)

router = APIRouter(prefix="/api/families", tags=["families"])


def _add(method: str, path: str, handler: Callable[..., Any], **kwargs: Any) -> None:
    getattr(router, method)(path, **kwargs)(handler)


_add("get", "", discovery.get_families, response_model=list[FamilyOut])
_add("get", "/page", discovery.get_families_page, response_model=FamilyPageOut)
_add("get", "/me", discovery.get_my_families, response_model=list[MyFamilyOut])
_add("get", "/me/page", discovery.get_my_families_page, response_model=MyFamilyPageOut)
_add(
    "get",
    "/payments/me",
    discovery.get_my_payments,
    response_model=list[FamilyPaymentOut],
)
_add(
    "get",
    "/payments/me/page",
    discovery.get_my_payments_page,
    response_model=FamilyPaymentPageOut,
)
_add("get", "/invites/{code}", discovery.get_family_by_invite_code, response_model=FamilyViewOut)
_add(
    "get",
    "/requests/me",
    discovery.get_my_family_requests,
    response_model=list[FamilyRequestOut],
)
_add(
    "get",
    "/requests/me/page",
    discovery.get_my_family_requests_page,
    response_model=FamilyRequestPageOut,
)

_add(
    "post",
    "/{family_id}/requests",
    requests.post_family_request,
    response_model=FamilyRequestOut,
    status_code=201,
)
_add("post", "/requests/{request_id}/cancel", requests.cancel_my_family_request, response_model=FamilyRequestOut)
_add(
    "get",
    "/{family_id}/requests",
    requests.get_owner_family_requests,
    response_model=list[OwnerFamilyRequestOut],
)
_add(
    "get",
    "/{family_id}/requests/page",
    requests.get_owner_family_requests_page,
    response_model=OwnerFamilyRequestPageOut,
)
_add("post", "/requests/{request_id}/approve", requests.approve_family_request, response_model=FamilyRequestOut)
_add("post", "/requests/{request_id}/reject", requests.reject_family_request, response_model=FamilyRequestOut)

_add("post", "", management.post_family, response_model=FamilyCreateResult, status_code=201)
_add("patch", "/{family_id}/description", management.patch_family_description, response_model=FamilyOut)
_add("patch", "/{family_id}/price", management.patch_family_price, response_model=FamilyOut)
_add("patch", "/{family_id}/payment-day", management.patch_family_payment_day, response_model=FamilyOut)
_add("patch", "/{family_id}/visibility", management.patch_family_visibility, response_model=FamilyOut)
_add(
    "post",
    "/{family_id}/confirm-availability",
    management.post_family_availability_confirmed,
    response_model=FamilyOut,
)
_add(
    "get",
    "/{family_id}/invite",
    management.get_owner_family_invite,
    response_model=FamilyInviteOut | None,
)
_add(
    "post",
    "/{family_id}/invite",
    management.post_owner_family_invite,
    response_model=FamilyInviteOut,
    status_code=201,
)
_add(
    "post",
    "/{family_id}/invite/rotate",
    management.post_owner_family_invite_rotation,
    response_model=FamilyInviteOut,
)
_add("post", "/{family_id}/invite/disable", management.post_owner_family_invite_disabled, status_code=204)
_add("post", "/{family_id}/close", management.post_family_close, response_model=FamilyOut)
_add(
    "post",
    "/{family_id}/acknowledge-closing",
    management.post_family_closing_acknowledged,
    response_model=FamilyMemberOut,
)

_add("get", "/{family_id}/members", members.get_family_members, response_model=list[FamilyMemberOut])
_add("get", "/{family_id}/members/page", members.get_family_members_page, response_model=FamilyMemberPageOut)
_add("post", "/members/{member_id}/access-provided", members.post_member_access_provided, response_model=FamilyMemberOut)
_add(
    "post",
    "/members/{member_id}/remind-access-confirmation",
    members.post_member_access_confirmation_reminder,
    response_model=FamilyMemberOut,
)
_add(
    "post",
    "/members/{member_id}/cancel-before-access",
    members.post_member_cancel_before_access,
    response_model=FamilyMemberOut,
)
_add("post", "/members/{member_id}/leave", members.post_member_leave, response_model=FamilyMemberOut)
_add("post", "/members/{member_id}/remove", members.post_member_remove, response_model=FamilyMemberOut)
_add(
    "post",
    "/members/{member_id}/access-confirmed",
    members.post_member_access_confirmed,
    response_model=AccessConfirmationResult,
)
_add(
    "get",
    "/members/{member_id}/payment-requisite",
    members.get_member_payment_requisite,
    response_model=PaymentRequisiteOut,
)

_add("get", "/members/{member_id}/payments", payments.get_member_payments, response_model=list[FamilyPaymentOut])
_add("get", "/members/{member_id}/payments/page", payments.get_member_payments_page, response_model=FamilyPaymentPageOut)
_add(
    "get",
    "/{family_id}/payments",
    payments.get_family_member_payments,
    response_model=list[FamilyMemberPaymentsOut],
)
_add(
    "post",
    "/members/{member_id}/prepayments",
    payments.post_member_prepayment,
    response_model=FamilyPaymentOut,
    status_code=201,
)
_add(
    "post",
    "/members/{member_id}/prepayments/record-paid",
    payments.post_owner_prepaid_periods,
    response_model=list[FamilyPaymentOut],
    status_code=201,
)
_add("post", "/payments/{payment_id}/report-paid", payments.post_payment_report_paid, response_model=FamilyPaymentOut)
_add("post", "/payments/{payment_id}/cancel-report", payments.post_payment_cancel_report, response_model=FamilyPaymentOut)
_add(
    "post",
    "/payments/{payment_id}/confirm",
    payments.post_payment_confirm,
    response_model=PaymentConfirmationResult,
)
_add("post", "/payments/{payment_id}/not-received", payments.post_payment_not_received, response_model=FamilyPaymentOut)

_add("get", "/{family_id}/view", detail.get_family_detail_view, response_model=FamilyViewOut)
_add("get", "/{family_id}/audit-log", detail.get_family_audit_log, response_model=list[FamilyAuditLogOut])
_add("get", "/{family_id}/audit-log/page", detail.get_family_audit_log_page, response_model=FamilyAuditLogPageOut)
_add("get", "/{family_id}", detail.get_family, response_model=FamilyOut)

__all__ = ["router"]
