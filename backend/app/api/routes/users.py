from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import AdminUser, CurrentUser, DbSession, Pagination
from app.core.responses import ERROR_RESPONSES, ApiResponse, PageMeta, ok
from app.schemas.user import UserRead, UserRoleUpdate
from app.services import users as user_service

router = APIRouter(prefix="/users", tags=["users"], responses=ERROR_RESPONSES)


@router.get("", summary="List active team members (e.g. to pick an assignee)")
def list_users(
    db: DbSession,
    _: CurrentUser,
    pagination: Pagination,
    q: Annotated[str | None, Query(max_length=100, description="Search name or email")] = None,
) -> ApiResponse[list[UserRead]]:
    users, total = user_service.list_users(
        db, search=q, offset=pagination.offset, limit=pagination.page_size
    )
    meta = PageMeta.build(page=pagination.page, page_size=pagination.page_size, total=total)
    return ok([UserRead.model_validate(user) for user in users], meta)


@router.patch("/{user_id}/role", summary="Change a user's role (admin only)")
def change_role(
    user_id: int, payload: UserRoleUpdate, db: DbSession, admin: AdminUser
) -> ApiResponse[UserRead]:
    user = user_service.change_role(db, actor=admin, user_id=user_id, role=payload.role)
    return ok(UserRead.model_validate(user))
