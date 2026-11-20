from datetime import UTC, datetime, timedelta

import jwt
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.models import User
from tests.conftest import TEST_PASSWORD, auth_headers

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"


def test_register_creates_member_and_returns_token(client: TestClient) -> None:
    response = client.post(
        REGISTER_URL,
        json={
            "email": "  New.User@Example.com ",
            "full_name": " New User ",
            "password": "abc12345",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    user = body["data"]["user"]
    assert user["email"] == "new.user@example.com"
    assert user["full_name"] == "New User"
    assert user["role"] == "member"

    token = body["data"]["access_token"]
    me = client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["data"]["email"] == "new.user@example.com"


def test_register_ignores_role_in_payload(client: TestClient) -> None:
    response = client.post(
        REGISTER_URL,
        json={
            "email": "sneaky@example.com",
            "full_name": "Sneaky",
            "password": "abc12345",
            "role": "admin",
        },
    )

    assert response.status_code == 201
    assert response.json()["data"]["user"]["role"] == "member"


def test_register_rejects_duplicate_email_case_insensitively(
    client: TestClient, member: User
) -> None:
    response = client.post(
        REGISTER_URL,
        json={"email": member.email.upper(), "full_name": "Copy", "password": "abc12345"},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"


def test_register_validates_input(client: TestClient) -> None:
    response = client.post(
        REGISTER_URL, json={"email": "not-an-email", "full_name": "", "password": "short"}
    )

    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "validation_error"
    fields = {detail["field"] for detail in body["error"]["details"]}
    assert fields == {"email", "full_name", "password"}


def test_register_requires_letter_and_number_in_password(client: TestClient) -> None:
    response = client.post(
        REGISTER_URL,
        json={"email": "weak@example.com", "full_name": "Weak", "password": "onlyletters"},
    )

    assert response.status_code == 422
    assert "letter and one number" in response.json()["error"]["details"][0]["message"]


def test_login_returns_token(client: TestClient, member: User) -> None:
    response = client.post(LOGIN_URL, json={"email": member.email, "password": TEST_PASSWORD})

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == get_settings().access_token_expire_minutes * 60
    assert data["user"]["id"] == member.id


def test_login_with_wrong_password_fails(client: TestClient, member: User) -> None:
    response = client.post(LOGIN_URL, json={"email": member.email, "password": "wrong-pass1"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


def test_login_is_rate_limited_by_client_ip(client: TestClient, member: User) -> None:
    for _ in range(5):
        response = client.post(LOGIN_URL, json={"email": member.email, "password": "wrong-pass1"})
        assert response.status_code == 401

    response = client.post(LOGIN_URL, json={"email": member.email, "password": "wrong-pass1"})

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"
    assert response.headers["retry-after"]


def test_registration_is_rate_limited_by_client_ip(client: TestClient) -> None:
    for number in range(3):
        response = client.post(
            REGISTER_URL,
            json={
                "email": f"new{number}@example.com",
                "full_name": "New User",
                "password": "abc12345",
            },
        )
        assert response.status_code == 201

    response = client.post(
        REGISTER_URL,
        json={
            "email": "limited@example.com",
            "full_name": "Limited User",
            "password": "abc12345",
        },
    )

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"


def test_login_with_unknown_email_fails_the_same_way(client: TestClient) -> None:
    response = client.post(LOGIN_URL, json={"email": "ghost@example.com", "password": "abc12345"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


def test_login_rejects_deactivated_account(client: TestClient, make_user) -> None:
    user = make_user(is_active=False)

    response = client.post(LOGIN_URL, json={"email": user.email, "password": TEST_PASSWORD})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "account_inactive"


def test_me_requires_token(client: TestClient) -> None:
    response = client.get(ME_URL)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["error"]["code"] == "unauthorized"


def test_me_rejects_tampered_token(client: TestClient, member: User) -> None:
    token = auth_headers(member)["Authorization"] + "tampered"

    response = client.get(ME_URL, headers={"Authorization": token})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"


def test_me_rejects_expired_token(client: TestClient, member: User) -> None:
    settings = get_settings()
    past = datetime.now(UTC) - timedelta(hours=2)
    token = jwt.encode(
        {"sub": str(member.id), "type": "access", "iat": past, "exp": past + timedelta(hours=1)},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    response = client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "token_expired"


def test_me_rejects_token_of_deactivated_user(client: TestClient, db, member: User) -> None:
    headers = auth_headers(member)
    member.is_active = False
    db.commit()

    response = client.get(ME_URL, headers=headers)

    assert response.status_code == 401
