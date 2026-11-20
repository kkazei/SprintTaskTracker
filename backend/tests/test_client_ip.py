"""Client-identity trust tests for rate limiting.

The API must never take `X-Forwarded-For` at face value. Rate limits are keyed by a direct peer
address unless the BFF supplies a fresh HMAC-signed assertion.
"""

import time

from fastapi import Request
from fastapi.testclient import TestClient

from app.core.client_ip import (
    CLIENT_IP_HEADER,
    CLIENT_IP_SIGNATURE_HEADER,
    CLIENT_IP_TIMESTAMP_HEADER,
    resolve_client_ip,
    sign_client_ip,
)
from app.core.config import Settings

LOGIN_URL = "/api/v1/auth/login"
SECRET = "test-client-ip-secret"
BAD_LOGIN = {"email": "nobody@example.com", "password": "wrong-pass1"}


def _signed_headers(
    client_ip: str,
    *,
    secret: str = SECRET,
    timestamp: int | None = None,
    signature: str | None = None,
) -> dict[str, str]:
    issued_at = int(time.time()) if timestamp is None else timestamp
    return {
        CLIENT_IP_HEADER: client_ip,
        CLIENT_IP_TIMESTAMP_HEADER: str(issued_at),
        CLIENT_IP_SIGNATURE_HEADER: signature or sign_client_ip(secret, client_ip, issued_at),
        # A forged forwarding header alongside a valid assertion must still be ignored.
        "X-Forwarded-For": "203.0.113.99",
    }


def _attempt_login(client: TestClient, headers: dict[str, str]) -> int:
    return client.post(LOGIN_URL, json=BAD_LOGIN, headers=headers).status_code


def test_forged_forwarded_for_headers_cannot_evade_the_limit(client: TestClient) -> None:
    for number in range(5):
        response = client.post(
            LOGIN_URL,
            json=BAD_LOGIN,
            headers={"X-Forwarded-For": f"198.51.100.{number}"},
        )
        assert response.status_code == 401

    response = client.post(LOGIN_URL, json=BAD_LOGIN, headers={"X-Forwarded-For": "198.51.100.200"})
    assert response.status_code == 429


def test_signed_assertions_separate_clients(client: TestClient) -> None:
    client_a = _signed_headers("198.51.100.10")
    for _ in range(5):
        assert _attempt_login(client, client_a) == 401

    assert _attempt_login(client, client_a) == 429
    # A different validated client address has its own bucket.
    assert _attempt_login(client, _signed_headers("198.51.100.11")) == 401


def test_invalid_signature_falls_back_to_peer_and_shares_its_bucket(client: TestClient) -> None:
    # Exhaust the peer bucket with unasserted requests...
    for _ in range(5):
        assert _attempt_login(client, {}) == 401

    # ...then a forged assertion must fall back to that exhausted bucket, not get a new one.
    forged = _signed_headers("198.51.100.21", signature="0" * 64)
    assert _attempt_login(client, forged) == 429
    # A correctly signed client still gets its own bucket.
    assert _attempt_login(client, _signed_headers("198.51.100.22")) == 401


def test_expired_assertion_falls_back_to_peer(client: TestClient) -> None:
    for _ in range(5):
        assert _attempt_login(client, {}) == 401

    stale = _signed_headers("198.51.100.31", timestamp=int(time.time()) - 3600)
    assert _attempt_login(client, stale) == 429


def test_unsigned_assertion_is_ignored(client: TestClient) -> None:
    for _ in range(5):
        assert (
            _attempt_login(
                client,
                {
                    CLIENT_IP_HEADER: "198.51.100.40",
                    CLIENT_IP_TIMESTAMP_HEADER: str(int(time.time())),
                },
            )
            == 401
        )

    unsigned = {CLIENT_IP_HEADER: "198.51.100.41", "X-Forwarded-For": "198.51.100.41"}
    assert _attempt_login(client, unsigned) == 429


def _request(headers: dict[str, str], peer: str = "10.0.0.5") -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/auth/login",
            "headers": [(key.lower().encode(), value.encode()) for key, value in headers.items()],
            "client": (peer, 12345),
            "server": ("testserver", 80),
            "scheme": "http",
            "query_string": b"",
        }
    )


def test_direct_access_uses_peer_address(monkeypatch) -> None:
    monkeypatch.setattr("app.core.client_ip.get_settings", lambda: Settings(client_ip_secret=None))
    request = _request({"x-forwarded-for": "203.0.113.7"}, peer="172.16.0.9")

    assert resolve_client_ip(request) == "172.16.0.9"


def test_missing_secret_ignores_even_a_correctly_signed_assertion(monkeypatch) -> None:
    monkeypatch.setattr("app.core.client_ip.get_settings", lambda: Settings(client_ip_secret=None))
    request = _request(_signed_headers("198.51.100.50"), peer="172.16.0.10")

    assert resolve_client_ip(request) == "172.16.0.10"


def test_valid_assertion_wins_over_peer(monkeypatch) -> None:
    request = _request(_signed_headers("198.51.100.60"), peer="172.16.0.11")

    assert resolve_client_ip(request) == "198.51.100.60"


def test_malformed_client_ip_is_rejected(monkeypatch) -> None:
    request = _request(
        {
            CLIENT_IP_HEADER: "not-an-ip",
            CLIENT_IP_TIMESTAMP_HEADER: str(int(time.time())),
            CLIENT_IP_SIGNATURE_HEADER: "0" * 64,
        },
        peer="172.16.0.12",
    )

    assert resolve_client_ip(request) == "172.16.0.12"
