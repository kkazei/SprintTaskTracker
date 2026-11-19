from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import AdminUser, CurrentUser, DbSession, Pagination
from app.core.responses import ERROR_RESPONSES, ApiResponse, Deleted, PageMeta, ok
from app.models import SprintStatus
from app.schemas.sprint import SprintCreate, SprintRead, SprintUpdate
from app.services import sprints as sprint_service

router = APIRouter(prefix="/sprints", tags=["sprints"], responses=ERROR_RESPONSES)


@router.get("", summary="List sprints (newest first) with task progress")
def list_sprints(
    db: DbSession,
    _: CurrentUser,
    pagination: Pagination,
    status: Annotated[SprintStatus | None, Query()] = None,
) -> ApiResponse[list[SprintRead]]:
    sprints, total = sprint_service.list_sprints(
        db, status=status, offset=pagination.offset, limit=pagination.page_size
    )
    meta = PageMeta.build(page=pagination.page, page_size=pagination.page_size, total=total)
    return ok(sprints, meta)


@router.get("/{sprint_id}", summary="Get a sprint")
def get_sprint(sprint_id: int, db: DbSession, _: CurrentUser) -> ApiResponse[SprintRead]:
    return ok(sprint_service.get_sprint(db, sprint_id))


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a sprint (admin only)")
def create_sprint(
    payload: SprintCreate, db: DbSession, admin: AdminUser
) -> ApiResponse[SprintRead]:
    return ok(sprint_service.create_sprint(db, actor=admin, payload=payload))


@router.patch("/{sprint_id}", summary="Update a sprint (admin only)")
def update_sprint(
    sprint_id: int, payload: SprintUpdate, db: DbSession, _: AdminUser
) -> ApiResponse[SprintRead]:
    return ok(sprint_service.update_sprint(db, sprint_id=sprint_id, payload=payload))


@router.delete(
    "/{sprint_id}", summary="Delete a sprint (admin only); its tasks move to the backlog"
)
def delete_sprint(sprint_id: int, db: DbSession, _: AdminUser) -> ApiResponse[Deleted]:
    sprint_service.delete_sprint(db, sprint_id=sprint_id)
    return ok(Deleted(id=sprint_id))
