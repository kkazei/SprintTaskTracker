"""Trusted client-identity resolution for rate limiting.

The API is reachable directly on its public hostname, so forwarding headers such as
``X-Forwarded-For`` must never be trusted. Instead, the Next.js BFF (the only intended
production caller) asserts the browser's address with an HMAC signature shared out-of-band:

    X-Client-IP: <browser IP>
    X-Client-IP-Timestamp: <unix seconds>
    X-Client-IP-Signature: hex(hmac_sha256(secret, "<ip>:<timestamp>"))

The assertion is accepted only when the secret is configured, the timestamp is recent and the
signature matches. Anything else falls back to the direct peer address, which is Render's proxy
and therefore safe (if coarse) rather than attacker-controlled.
"""

import hashlib
import hmac
import ipaddress
import logging
import time

from fastapi import Request

from app.core.config import get_settings

logger = logging.getLogger(__name__)

CLIENT_IP_HEADER = "X-Client-IP"
CLIENT_IP_TIMESTAMP_HEADER = "X-Client-IP-Timestamp"
CLIENT_IP_SIGNATURE_HEADER = "X-Client-IP-Signature"

# How old a signed assertion may be. Bounds replay of a captured header to a short window.
MAX_ASSERTION_AGE_SECONDS = 60

_LOOPBACK = {"127.0.0.1", "::1", "testclient"}


def _normalise_ip(value: str) -> str | None:
    """Return a canonical IP string, or None for anything that is not an IP address."""
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None


def sign_client_ip(secret: str, client_ip: str, timestamp: int) -> str:
    """Build the signature the BFF sends; kept here so tests sign exactly as production does."""
    message = f"{client_ip}:{timestamp}".encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def _signed_assertion_is_valid(request: Request, secret: str) -> str | None:
    client_ip = _normalise_ip(request.headers.get(CLIENT_IP_HEADER, ""))
    raw_timestamp = request.headers.get(CLIENT_IP_TIMESTAMP_HEADER)
    signature = request.headers.get(CLIENT_IP_SIGNATURE_HEADER)
    if not client_ip or not raw_timestamp or not signature:
        return None

    try:
        timestamp = int(raw_timestamp)
    except ValueError:
        return None
    if abs(int(time.time()) - timestamp) > MAX_ASSERTION_AGE_SECONDS:
        return None

    expected = sign_client_ip(secret, client_ip, timestamp)
    if not hmac.compare_digest(signature, expected):
        return None
    return client_ip


def resolve_client_ip(request: Request) -> str:
    """Return a trustworthy client identity for rate-limit keying.

    Fail-safe behaviour: without a configured secret, or with a missing/invalid/stale
    assertion, use the direct peer address. Forwarding headers are never consulted.
    """
    peer = request.client.host if request.client else "unknown"
    secret = get_settings().client_ip_secret
    if not secret:
        return peer

    asserted = _signed_assertion_is_valid(request, secret)
    if asserted is not None:
        return asserted

    # A request carrying an assertion that failed validation is suspicious; log it without
    # the header values so we don't write untrusted data into logs.
    if (
        any(
            request.headers.get(header)
            for header in (CLIENT_IP_HEADER, CLIENT_IP_TIMESTAMP_HEADER, CLIENT_IP_SIGNATURE_HEADER)
        )
        and peer not in _LOOPBACK
    ):
        logger.warning("Rejected client-IP assertion from %s", peer)
    return peer


def get_client_ip(request: Request) -> str:
    """SlowAPI key function."""
    return resolve_client_ip(request)
