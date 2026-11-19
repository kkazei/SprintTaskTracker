from fastapi.testclient import TestClient

from app.models import User

USERS_URL = "/api/v1/users"


def test_list_users_requires_authentication(client: TestClient) -> None:
    assert client.get(USERS_URL).status_code == 401


def test_list_users_paginates_and_excludes_inactive(
    client: TestClient, member: User, member_headers: dict[str, str], make_user
) -> None:
    for _ in range(4):
        make_user()
    make_user(is_active=False)

    response = client.get(USERS_URL, params={"page": 2, "page_size": 2}, headers=member_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["meta"] == {"page": 2, "page_size": 2, "total": 5, "total_pages": 3}
    assert len(body["data"]) == 2


def test_list_users_searches_name_and_email(
    client: TestClient, member_headers: dict[str, str], make_user
) -> None:
    make_user(full_name="Grace Hopper", email="grace@example.com")
    make_user(full_name="Alan Turing", email="alan@example.com")

    by_name = client.get(USERS_URL, params={"q": "hopp"}, headers=member_headers).json()
    by_email = client.get(USERS_URL, params={"q": "ALAN@"}, headers=member_headers).json()

    assert [u["full_name"] for u in by_name["data"]] == ["Grace Hopper"]
    assert [u["full_name"] for u in by_email["data"]] == ["Alan Turing"]


def test_list_users_validates_pagination(client: TestClient, member_headers) -> None:
    response = client.get(USERS_URL, params={"page_size": 1000}, headers=member_headers)

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "page_size"


def test_admin_can_change_role(
    client: TestClient, admin_headers: dict[str, str], member: User
) -> None:
    response = client.patch(
        f"{USERS_URL}/{member.id}/role", json={"role": "admin"}, headers=admin_headers
    )

    assert response.status_code == 200
    assert response.json()["data"]["role"] == "admin"


def test_member_cannot_change_roles(
    client: TestClient, member_headers: dict[str, str], admin: User
) -> None:
    response = client.patch(
        f"{USERS_URL}/{admin.id}/role", json={"role": "member"}, headers=member_headers
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


def test_admin_cannot_change_own_role(
    client: TestClient, admin: User, admin_headers: dict[str, str]
) -> None:
    response = client.patch(
        f"{USERS_URL}/{admin.id}/role", json={"role": "member"}, headers=admin_headers
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "self_role_change"


def test_change_role_of_unknown_user_returns_404(client: TestClient, admin_headers) -> None:
    response = client.patch(
        f"{USERS_URL}/999999/role", json={"role": "admin"}, headers=admin_headers
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_change_role_rejects_unknown_role(client: TestClient, admin_headers, member: User) -> None:
    response = client.patch(
        f"{USERS_URL}/{member.id}/role", json={"role": "owner"}, headers=admin_headers
    )

    assert response.status_code == 422
