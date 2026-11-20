"""Rate limiting for public authentication endpoints."""

from fastapi import Request
from fastapi.responses import Response
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

from app.core.client_ip import get_client_ip
from app.core.config import get_settings
from app.core.errors import error_response

# Uvicorn is started without proxy-header trust (see scripts/start.sh), so `X-Forwarded-For`
# cannot influence identity. The key function accepts only a valid HMAC-signed assertion from
# our BFF and otherwise falls back to the direct peer address.
#
# `RATE_LIMIT_STORAGE_URI` lets deployments share counters across workers/instances via Redis;
# the in-memory default is only consistent within one process.
limiter = Limiter(
    key_func=get_client_ip,
    headers_enabled=True,
    storage_uri=get_settings().rate_limit_storage_uri,
)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """Return the API's usual error envelope while retaining rate-limit headers."""
    response = error_response(429, "rate_limited", "Too many requests. Please try again later.")
    return request.app.state.limiter._inject_headers(response, request.state.view_rate_limit)
