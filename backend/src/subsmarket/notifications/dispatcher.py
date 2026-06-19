from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Protocol

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from subsmarket.core.config import settings
from subsmarket.core.database import utcnow
from subsmarket.notifications.models import NotificationJob
from subsmarket.notifications.schemas import DispatchNotificationsResult
from subsmarket.notifications.service import notification_payload_message

logger = logging.getLogger(__name__)


class NotificationSender(Protocol):
    def send_message(self, telegram_user_id: int, text: str) -> None: ...


class NotificationSendError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        permanent: bool = False,
        retry_after_seconds: int | None = None,
    ) -> None:
        super().__init__(message)
        self.permanent = permanent
        self.retry_after_seconds = retry_after_seconds


class TelegramBotSender:
    def __init__(self, bot_token: str | None = None) -> None:
        self.bot_token = bot_token or settings.telegram_bot_token

    def send_message(self, telegram_user_id: int, text: str) -> None:
        if not self.bot_token:
            raise NotificationSendError(
                "TELEGRAM_BOT_TOKEN_NOT_CONFIGURED",
                permanent=False,
                retry_after_seconds=300,
            )

        try:
            response = httpx.post(
                f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
                json=build_send_message_payload(
                    telegram_user_id,
                    text,
                    mini_app_url=settings.telegram_mini_app_url,
                ),
                timeout=10.0,
            )
        except httpx.HTTPError as exc:
            raise NotificationSendError(str(exc), permanent=False) from exc

        payload = _response_payload(response)
        if response.status_code >= 400:
            raise _telegram_error(
                payload,
                fallback_status=response.status_code,
                fallback_message=response.text,
            )
        if not payload.get("ok"):
            raise _telegram_error(
                payload,
                fallback_status=response.status_code,
                fallback_message=str(payload),
            )


def notification_message(job: NotificationJob) -> str:
    try:
        return notification_payload_message(job.payload)
    except ValueError as exc:
        raise NotificationSendError(
            str(exc),
            permanent=True,
        ) from exc


def build_send_message_payload(
    telegram_user_id: int,
    text: str,
    *,
    mini_app_url: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "chat_id": telegram_user_id,
        "text": text,
        "disable_web_page_preview": True,
    }
    if mini_app_url:
        payload["reply_markup"] = {
            "inline_keyboard": [
                [
                    {
                        "text": "Открыть SubsMarket",
                        "web_app": {"url": mini_app_url},
                    }
                ]
            ]
        }
    return payload


def _response_payload(response: httpx.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _telegram_error(
    payload: dict[str, Any],
    *,
    fallback_status: int,
    fallback_message: str,
) -> NotificationSendError:
    error_code = int(payload.get("error_code") or fallback_status)
    description = str(payload.get("description") or fallback_message)
    parameters = payload.get("parameters")
    retry_after = None
    if isinstance(parameters, dict) and parameters.get("retry_after") is not None:
        retry_after = int(parameters["retry_after"])
    return NotificationSendError(
        f"TELEGRAM_SEND_FAILED {error_code}: {description}",
        permanent=error_code in {400, 403},
        retry_after_seconds=retry_after,
    )


def dispatch_pending_notifications(
    db: Session,
    *,
    limit: int = 50,
    max_batches: int = 5,
    sender: NotificationSender | None = None,
) -> DispatchNotificationsResult:
    active_sender = sender or TelegramBotSender()
    total_selected = 0
    total_sent = 0
    total_retried = 0
    total_failed = 0

    for batch_number in range(1, max_batches + 1):
        result = _dispatch_notification_batch(
            db,
            limit=limit,
            batch_number=batch_number,
            sender=active_sender,
        )
        total_selected += result.selected
        total_sent += result.sent
        total_retried += result.retried
        total_failed += result.failed
        if result.selected < limit:
            break

    return DispatchNotificationsResult(
        selected=total_selected,
        sent=total_sent,
        retried=total_retried,
        failed=total_failed,
    )


def _dispatch_notification_batch(
    db: Session,
    *,
    limit: int,
    batch_number: int,
    sender: NotificationSender,
) -> DispatchNotificationsResult:
    now = utcnow()
    jobs = list(
        db.scalars(
            select(NotificationJob)
            .where(
                NotificationJob.status == "pending",
                NotificationJob.available_at <= now,
            )
            .order_by(
                NotificationJob.available_at.asc(),
                NotificationJob.created_at.asc(),
            )
            .limit(limit)
            .with_for_update(skip_locked=True)
        ).all()
    )
    logger.info(
        "Notification dispatch started",
        extra={
            "notification_batch": batch_number,
            "notification_limit": limit,
            "notifications_selected": len(jobs),
        },
    )
    sent = 0
    retried = 0
    failed = 0

    for job in jobs:
        job.attempts += 1
        try:
            message = notification_message(job)
            sender.send_message(job.recipient.telegram_user_id, message)
        except NotificationSendError as exc:
            job.failed_at = utcnow()
            job.error = str(exc)[:1000]
            if exc.permanent or job.attempts >= settings.notification_max_attempts:
                job.status = "failed"
                failed += 1
                logger.warning(
                    "Notification job failed permanently",
                    extra={
                        "notification_job_id": str(job.id),
                        "notification_event_type": job.event_type,
                        "notification_attempts": job.attempts,
                        "notification_error_type": type(exc).__name__,
                    },
                )
            else:
                job.status = "pending"
                job.available_at = utcnow() + timedelta(
                    seconds=_retry_delay_seconds(job.attempts, exc)
                )
                retried += 1
                logger.warning(
                    "Notification job scheduled for retry",
                    extra={
                        "notification_job_id": str(job.id),
                        "notification_event_type": job.event_type,
                        "notification_attempts": job.attempts,
                        "notification_error_type": type(exc).__name__,
                    },
                )
        except Exception as exc:
            job.failed_at = utcnow()
            job.error = str(exc)[:1000]
            if job.attempts >= settings.notification_max_attempts:
                job.status = "failed"
                failed += 1
                logger.exception(
                    "Notification job failed permanently with unexpected error",
                    extra={
                        "notification_job_id": str(job.id),
                        "notification_event_type": job.event_type,
                        "notification_attempts": job.attempts,
                    },
                )
            else:
                job.status = "pending"
                job.available_at = utcnow() + timedelta(
                    seconds=_retry_delay_seconds(job.attempts)
                )
                retried += 1
                logger.exception(
                    "Notification job scheduled for retry after unexpected error",
                    extra={
                        "notification_job_id": str(job.id),
                        "notification_event_type": job.event_type,
                        "notification_attempts": job.attempts,
                    },
                )
        else:
            job.status = "sent"
            job.sent_at = utcnow()
            job.failed_at = None
            job.error = None
            sent += 1

    db.commit()
    logger.info(
        "Notification dispatch completed",
        extra={
            "notification_batch": batch_number,
            "notifications_selected": len(jobs),
            "notifications_sent": sent,
            "notifications_retried": retried,
            "notifications_failed": failed,
        },
    )
    return DispatchNotificationsResult(
        selected=len(jobs), sent=sent, retried=retried, failed=failed
    )


def _retry_delay_seconds(
    attempts: int,
    exc: NotificationSendError | None = None,
) -> int:
    if exc and exc.retry_after_seconds is not None:
        return max(1, exc.retry_after_seconds)
    delay = settings.notification_retry_base_seconds * (2 ** max(0, attempts - 1))
    return min(delay, settings.notification_retry_max_seconds)
