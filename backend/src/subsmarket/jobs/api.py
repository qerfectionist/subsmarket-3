from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from subsmarket.core.config import settings
from subsmarket.core.database import get_db
from subsmarket.jobs.monitoring import get_jobs_status
from subsmarket.jobs.schemas import JobsStatusResult, RunDueJobsResult
from subsmarket.jobs.service import run_due_jobs
from subsmarket.notifications.dispatcher import dispatch_pending_notifications
from subsmarket.notifications.schemas import DispatchNotificationsResult

router = APIRouter(prefix="/api/internal/jobs", tags=["jobs"])


def require_internal_job_token(
    x_internal_job_token: str | None = Header(default=None),
) -> None:
    if settings.internal_job_token:
        if x_internal_job_token != settings.internal_job_token:
            raise HTTPException(status_code=403, detail="INVALID_INTERNAL_JOB_TOKEN")
        return

    if not settings.is_development:
        raise HTTPException(status_code=403, detail="INTERNAL_JOB_TOKEN_REQUIRED")


@router.post("/run-due", response_model=RunDueJobsResult)
def post_run_due_jobs(
    _: None = Depends(require_internal_job_token),
    db: Session = Depends(get_db),
) -> RunDueJobsResult:
    return run_due_jobs(db)


@router.post("/dispatch-notifications", response_model=DispatchNotificationsResult)
def post_dispatch_notifications(
    _: None = Depends(require_internal_job_token),
    db: Session = Depends(get_db),
) -> DispatchNotificationsResult:
    return dispatch_pending_notifications(db)


@router.get("/status", response_model=JobsStatusResult)
def get_internal_jobs_status(
    _: None = Depends(require_internal_job_token),
    db: Session = Depends(get_db),
) -> JobsStatusResult:
    return get_jobs_status(db)


@router.get(
    "/health",
    response_model=JobsStatusResult,
    responses={503: {"model": JobsStatusResult}},
)
def get_internal_jobs_health(
    _: None = Depends(require_internal_job_token),
    db: Session = Depends(get_db),
) -> JobsStatusResult | JSONResponse:
    status = get_jobs_status(db)
    if status.status == "ok":
        return status
    return JSONResponse(status_code=503, content=jsonable_encoder(status))
