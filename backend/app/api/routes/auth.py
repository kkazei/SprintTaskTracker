from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.core.responses import ERROR_RESPONSES, ApiResponse, ok
from app.core.security import create_access_token
from app.models import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserRead
from app.services import users as user_service

router = APIRouter(prefix="/auth", tags=["auth"], responses=ERROR_RESPONSES)


def _token_for(user: User) -> TokenResponse:
    token, expires_in = create_access_token(user.id, user.role.value)
    return TokenResponse(
        access_token=token, expires_in=expires_in, user=UserRead.model_validate(user)
    )


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Create a member account and log in",
)
def register(payload: RegisterRequest, db: DbSession) -> ApiResponse[TokenResponse]:
    user = user_service.register(db, payload)
    return ok(_token_for(user))


@router.post("/login", summary="Exchange email and password for an access token")
def login(payload: LoginRequest, db: DbSession) -> ApiResponse[TokenResponse]:
    user = user_service.authenticate(db, payload.email, payload.password)
    return ok(_token_for(user))


@router.get("/me", summary="Get the current user")
def me(user: CurrentUser) -> ApiResponse[UserRead]:
    return ok(UserRead.model_validate(user))
