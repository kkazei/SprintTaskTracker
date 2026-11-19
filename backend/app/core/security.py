from datetime import UTC, datetime, timedelta
from functools import lru_cache

import bcrypt
import jwt

from app.core.config import get_settings
from app.core.errors import AuthenticationError

# bcrypt only uses the first 72 bytes of a password; longer inputs are rejected by the
# request schemas rather than silently truncated.
BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=get_settings().bcrypt_rounds)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    encoded = password.encode("utf-8")
    if len(encoded) > BCRYPT_MAX_BYTES:
        return False
    return bcrypt.checkpw(encoded, password_hash.encode("utf-8"))


@lru_cache
def _dummy_hash() -> str:
    return hash_password("timing-equalizer-password")


def burn_password_check(password: str) -> None:
    """Spend the same time as a real check, so unknown emails can't be detected by timing."""
    verify_password(password, _dummy_hash())


def create_access_token(user_id: int, role: str) -> tuple[str, int]:
    """Return a signed JWT and its lifetime in seconds.

    The role claim is informational for clients; the API always re-reads the role from the
    database, so a demotion takes effect immediately.
    """
    settings = get_settings()
    expires_in = settings.access_token_expire_minutes * 60
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_in


def decode_access_token(token: str) -> int:
    """Validate a JWT and return the user id it was issued for."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Access token has expired", code="token_expired") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("Invalid access token", code="invalid_token") from exc

    if payload.get("type") != "access" or not str(payload["sub"]).isdigit():
        raise AuthenticationError("Invalid access token", code="invalid_token")
    return int(payload["sub"])
