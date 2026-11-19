from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, EmailStr, Field, StringConstraints

from app.core.security import BCRYPT_MAX_BYTES
from app.schemas.user import UserRead


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _check_password_strength(value: str) -> str:
    if len(value.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise ValueError(f"must be at most {BCRYPT_MAX_BYTES} bytes")
    if not any(char.isalpha() for char in value) or not any(char.isdigit() for char in value):
        raise ValueError("must contain at least one letter and one number")
    return value


Email = Annotated[EmailStr, AfterValidator(_normalize_email)]


class RegisterRequest(BaseModel):
    email: Email = Field(examples=["jane@example.com"])
    full_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
    ] = Field(examples=["Jane Doe"])
    password: Annotated[
        str, Field(min_length=8, max_length=128), AfterValidator(_check_password_strength)
    ] = Field(examples=["Sup3rSecret!"])


class LoginRequest(BaseModel):
    email: Email = Field(examples=["admin@demo.com"])
    password: str = Field(min_length=1, max_length=128, examples=["Password123!"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Token lifetime in seconds", examples=[3600])
    user: UserRead
