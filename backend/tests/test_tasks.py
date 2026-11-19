from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.models import TaskPriority, TaskStatus, User
from tests.conftest import auth_headers

TASKS_URL = "/api/v1/tasks"
TODAY = datetime.now(UTC).date()


# --- create ----------------------------------------------------------------------------------


def test_create_task_sets_reporter_and_defaults(
    client: TestClient, member: User, member_headers: dict[str, str]
) -> None:
    response = client.post(TASKS_URL, json={"title": "  Write docs  "}, headers=member_headers)

    assert response.status_code == 201
    task = response.json()["data"]
    assert task["title"] == "Write docs"
    assert task["status"] == "todo"
    assert task["priority"] == "medium"
    assert task["reporter"]["id"] == member.id
    assert task["assignee"] is None
    assert task["permissions"] == {"can_edit": True, "can_delete": True}


def test_create_task_with_assignee_and_sprint(
    client: TestClient, member_headers, admin: User, make_sprint
) -> None:
    sprint = make_sprint(name="Sprint 9")

    response = client.post(
        TASKS_URL,
        json={
            "title": "Ship it",
            "priority": "urgent",
            "due_date": str(TODAY + timedelta(days=3)),
            "assignee_id": admin.id,
            "sprint_id": sprint.id,
        },
        headers=member_headers,
    )

    assert response.status_code == 201
    task = response.json()["data"]
    assert task["assignee"]["full_name"] == "Ada Admin"
    assert task["sprint"] == {"id": sprint.id, "name": "Sprint 9", "status": "active"}


def test_create_task_marked_done_records_completion(client: TestClient, member_headers) -> None:
    response = client.post(
        TASKS_URL, json={"title": "Already done", "status": "done"}, headers=member_headers
    )

    assert response.json()["data"]["completed_at"] is not None


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"title": ""}, "title"),
        ({"title": "x" * 201}, "title"),
        ({"title": "ok", "priority": "critical"}, "priority"),
        ({"title": "ok", "due_date": "not-a-date"}, "due_date"),
        ({}, "title"),
    ],
)
def test_create_task_validates_body(
    client: TestClient, member_headers, payload: dict, field: str
) -> None:
    response = client.post(TASKS_URL, json=payload, headers=member_headers)

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == field


def test_create_task_rejects_unknown_assignee(client: TestClient, member_headers) -> None:
    response = client.post(
        TASKS_URL, json={"title": "Orphan", "assignee_id": 999999}, headers=member_headers
    )

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "assignee_id"


def test_create_task_rejects_unknown_sprint(client: TestClient, member_headers) -> None:
    response = client.post(
        TASKS_URL, json={"title": "Lost", "sprint_id": 999999}, headers=member_headers
    )

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "sprint_id"


def test_tasks_require_authentication(client: TestClient) -> None:
    assert client.get(TASKS_URL).status_code == 401
    assert client.post(TASKS_URL, json={"title": "x"}).status_code == 401


# --- read ------------------------------------------------------------------------------------


def test_get_task_and_404(client: TestClient, member_headers, make_task) -> None:
    task = make_task(title="Find me")

    assert client.get(f"{TASKS_URL}/{task.id}", headers=member_headers).json()["data"]["title"] == (
        "Find me"
    )
    missing = client.get(f"{TASKS_URL}/999999", headers=member_headers)
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"


def test_is_overdue_flag(client: TestClient, member_headers, make_task) -> None:
    yesterday = TODAY - timedelta(days=1)
    late = make_task(title="Late", due_date=yesterday)
    done_late = make_task(title="Done late", due_date=yesterday, status=TaskStatus.DONE)
    future = make_task(title="Future", due_date=TODAY + timedelta(days=1))

    def flag(task_id: int) -> bool:
        return client.get(f"{TASKS_URL}/{task_id}", headers=member_headers).json()["data"][
            "is_overdue"
        ]

    assert flag(late.id) is True
    assert flag(done_late.id) is False
    assert flag(future.id) is False


# --- list: filtering, search, sorting, pagination --------------------------------------------


@pytest.fixture
def board(make_task, make_sprint, admin: User, member: User):
    sprint = make_sprint()
    yesterday = TODAY - timedelta(days=1)
    return {
        "sprint": sprint,
        "login_bug": make_task(
            title="Fix login bug",
            status=TaskStatus.IN_PROGRESS,
            priority=TaskPriority.URGENT,
            assignee_id=member.id,
            reporter_id=admin.id,
            sprint_id=sprint.id,
            due_date=yesterday,
        ),
        "docs": make_task(
            title="Write API docs",
            status=TaskStatus.TODO,
            priority=TaskPriority.LOW,
            assignee_id=admin.id,
            reporter_id=member.id,
            due_date=TODAY + timedelta(days=10),
        ),
        "release": make_task(
            title="Release 100%_ready",
            status=TaskStatus.DONE,
            priority=TaskPriority.HIGH,
            assignee_id=member.id,
            reporter_id=admin.id,
            sprint_id=sprint.id,
            due_date=yesterday,
        ),
        "backlog": make_task(title="Backlog idea", priority=TaskPriority.MEDIUM),
    }


def _titles(client: TestClient, headers: dict[str, str], **params) -> list[str]:
    response = client.get(TASKS_URL, params=params, headers=headers)
    assert response.status_code == 200, response.json()
    return [task["title"] for task in response.json()["data"]]


def test_filter_by_status_accepts_multiple(client: TestClient, member_headers, board) -> None:
    titles = _titles(client, member_headers, status=["todo", "in_progress"], sort="title")

    assert titles == ["Backlog idea", "Fix login bug", "Write API docs"]


def test_filter_by_priority(client: TestClient, member_headers, board) -> None:
    assert _titles(client, member_headers, priority="urgent") == ["Fix login bug"]


def test_filter_by_assignee(client: TestClient, member_headers, member: User, board) -> None:
    titles = _titles(client, member_headers, assignee_id=member.id, sort="title")

    assert titles == ["Fix login bug", "Release 100%_ready"]


def test_filter_unassigned(client: TestClient, member_headers, board) -> None:
    assert _titles(client, member_headers, unassigned="true") == ["Backlog idea"]


def test_filter_by_sprint(client: TestClient, member_headers, board) -> None:
    titles = _titles(client, member_headers, sprint_id=board["sprint"].id, sort="title")

    assert titles == ["Fix login bug", "Release 100%_ready"]


def test_filter_overdue_excludes_done(client: TestClient, member_headers, board) -> None:
    assert _titles(client, member_headers, overdue="true") == ["Fix login bug"]


def test_search_is_case_insensitive(client: TestClient, member_headers, board) -> None:
    assert _titles(client, member_headers, q="LOGIN") == ["Fix login bug"]


def test_search_treats_wildcards_literally(client: TestClient, member_headers, board) -> None:
    assert _titles(client, member_headers, q="100%_") == ["Release 100%_ready"]
    assert _titles(client, member_headers, q="%") == ["Release 100%_ready"]


def test_filters_combine(client: TestClient, member_headers, member: User, board) -> None:
    titles = _titles(client, member_headers, assignee_id=member.id, status="done", q="release")

    assert titles == ["Release 100%_ready"]


def test_sort_by_priority_descending(client: TestClient, member_headers, board) -> None:
    titles = _titles(client, member_headers, sort="-priority")

    assert titles == ["Fix login bug", "Release 100%_ready", "Backlog idea", "Write API docs"]


def test_sort_by_due_date_puts_missing_dates_last(
    client: TestClient, member_headers, board
) -> None:
    titles = _titles(client, member_headers, sort="due_date")

    assert titles[-1] == "Backlog idea"
    assert titles[-2] == "Write API docs"


def test_pagination_meta_and_pages(client: TestClient, member_headers, make_task) -> None:
    for i in range(25):
        make_task(title=f"Task {i:02d}")

    page_1 = client.get(
        TASKS_URL, params={"page_size": 10, "sort": "title"}, headers=member_headers
    ).json()
    page_3 = client.get(
        TASKS_URL, params={"page": 3, "page_size": 10, "sort": "title"}, headers=member_headers
    ).json()

    assert page_1["meta"] == {"page": 1, "page_size": 10, "total": 25, "total_pages": 3}
    assert [t["title"] for t in page_1["data"]][:2] == ["Task 00", "Task 01"]
    assert [t["title"] for t in page_3["data"]] == [f"Task {i}" for i in range(20, 25)]


def test_list_rejects_invalid_filters(client: TestClient, member_headers) -> None:
    response = client.get(
        TASKS_URL, params={"status": "blocked", "sort": "random"}, headers=member_headers
    )

    assert response.status_code == 422
    fields = {detail["field"] for detail in response.json()["error"]["details"]}
    assert fields == {"status.0", "sort"}


# --- update ----------------------------------------------------------------------------------


def test_reporter_can_update_task(client: TestClient, member: User, make_task) -> None:
    task = make_task(reporter_id=member.id)

    response = client.patch(
        f"{TASKS_URL}/{task.id}",
        json={"title": "Renamed", "priority": "high"},
        headers=auth_headers(member),
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert (data["title"], data["priority"]) == ("Renamed", "high")


def test_assignee_can_update_task(client: TestClient, member: User, make_task) -> None:
    task = make_task(assignee_id=member.id)

    response = client.patch(
        f"{TASKS_URL}/{task.id}", json={"status": "in_review"}, headers=auth_headers(member)
    )

    assert response.status_code == 200


def test_member_cannot_update_unrelated_task(
    client: TestClient, member_headers, admin: User, make_task
) -> None:
    task = make_task(reporter_id=admin.id)

    response = client.patch(
        f"{TASKS_URL}/{task.id}", json={"title": "Hijack"}, headers=member_headers
    )

    assert response.status_code == 403


def test_admin_can_update_any_task(
    client: TestClient, admin_headers, member: User, make_task
) -> None:
    task = make_task(reporter_id=member.id)

    response = client.patch(
        f"{TASKS_URL}/{task.id}", json={"title": "Fixed"}, headers=admin_headers
    )

    assert response.status_code == 200


def test_update_only_changes_sent_fields_and_null_clears(
    client: TestClient, admin_headers, member: User, make_task
) -> None:
    due = date(2030, 1, 1)
    task = make_task(title="Keep me", assignee_id=member.id, due_date=due)

    response = client.patch(
        f"{TASKS_URL}/{task.id}", json={"assignee_id": None}, headers=admin_headers
    )

    data = response.json()["data"]
    assert data["assignee"] is None
    assert data["title"] == "Keep me"
    assert data["due_date"] == str(due)


def test_update_rejects_null_title(client: TestClient, admin_headers, make_task) -> None:
    task = make_task()

    response = client.patch(f"{TASKS_URL}/{task.id}", json={"title": None}, headers=admin_headers)

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "title"


def test_status_transitions_maintain_completed_at(
    client: TestClient, admin_headers, make_task
) -> None:
    task = make_task()
    url = f"{TASKS_URL}/{task.id}"

    done = client.patch(url, json={"status": "done"}, headers=admin_headers).json()["data"]
    reopened = client.patch(url, json={"status": "todo"}, headers=admin_headers).json()["data"]

    assert done["completed_at"] is not None
    assert reopened["completed_at"] is None


def test_permissions_reflect_current_user(
    client: TestClient, member: User, admin: User, make_task
) -> None:
    task = make_task(reporter_id=admin.id, assignee_id=member.id)

    as_member = client.get(f"{TASKS_URL}/{task.id}", headers=auth_headers(member)).json()["data"]
    as_admin = client.get(f"{TASKS_URL}/{task.id}", headers=auth_headers(admin)).json()["data"]

    assert as_member["permissions"] == {"can_edit": True, "can_delete": False}
    assert as_admin["permissions"] == {"can_edit": True, "can_delete": True}


# --- delete ----------------------------------------------------------------------------------


def test_reporter_can_delete_task(client: TestClient, member: User, make_task) -> None:
    task = make_task(reporter_id=member.id)

    response = client.delete(f"{TASKS_URL}/{task.id}", headers=auth_headers(member))

    assert response.status_code == 200
    assert response.json()["data"] == {"id": task.id}
    assert client.get(f"{TASKS_URL}/{task.id}", headers=auth_headers(member)).status_code == 404


def test_assignee_cannot_delete_task(
    client: TestClient, member: User, admin: User, make_task
) -> None:
    task = make_task(reporter_id=admin.id, assignee_id=member.id)

    response = client.delete(f"{TASKS_URL}/{task.id}", headers=auth_headers(member))

    assert response.status_code == 403


def test_admin_can_delete_any_task(
    client: TestClient, admin_headers, member: User, make_task
) -> None:
    task = make_task(reporter_id=member.id)

    assert client.delete(f"{TASKS_URL}/{task.id}", headers=admin_headers).status_code == 200
