from typing import Annotated

from fastapi import Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import AuthenticationError, PermissionDeniedError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import User, UserRole

DbSession = Annotated[Session, Depends(get_db)]

_bearer = HTTPBearer(
    auto_error=False,
    description="Paste the `access_token` returned by `POST /api/v1/auth/login`.",
)


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise AuthenticationError("Not authenticated")

    user_id = decode_access_token(credentials.credentials)
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("User no longer exists or is inactive", code="invalid_token")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> User:
    if user.role is not UserRole.ADMIN:
        raise PermissionDeniedError("This action requires the admin role")
    return user


AdminUser = Annotated[User, Depends(require_admin)]


class PageParams:
    """Shared `page` / `page_size` query parameters for list endpoints."""

    def __init__(
        self,
        page: Annotated[int, Query(ge=1, description="1-based page number")] = 1,
        page_size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
    ) -> None:
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


Pagination = Annotated[PageParams, Depends()]
