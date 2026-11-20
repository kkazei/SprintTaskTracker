"""Rate limiting for public authentication endpoints."""

from fastapi import Request
from fastapi.responses import Response
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.errors import error_response

# Uvicorn's trusted proxy handling updates ``request.client`` before SlowAPI sees it, so this
# keys limits by the original client IP in production and by the direct address locally.
limiter = Limiter(key_func=get_remote_address, headers_enabled=True)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """Return the API's usual error envelope while retaining rate-limit headers."""
    response = error_response(429, "rate_limited", "Too many requests. Please try again later.")
    return request.app.state.limiter._inject_headers(response, request.state.view_rate_limit)
