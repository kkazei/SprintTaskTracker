from datetime import date

from fastapi.testclient import TestClient

from app.models import SprintStatus, TaskStatus

SPRINTS_URL = "/api/v1/sprints"
TASKS_URL = "/api/v1/tasks"
NEW_SPRINT = {"name": "Sprint 7", "start_date": "2030-01-01", "end_date": "2030-01-14"}


def test_admin_creates_sprint(client: TestClient, admin_headers) -> None:
    response = client.post(SPRINTS_URL, json=NEW_SPRINT, headers=admin_headers)

    assert response.status_code == 201
    sprint = response.json()["data"]
    assert sprint["name"] == "Sprint 7"
    assert sprint["status"] == "planned"
    assert sprint["task_count"] == 0


def test_member_cannot_manage_sprints(client: TestClient, member_headers, make_sprint) -> None:
    sprint = make_sprint()

    assert client.post(SPRINTS_URL, json=NEW_SPRINT, headers=member_headers).status_code == 403
    assert (
        client.patch(
            f"{SPRINTS_URL}/{sprint.id}", json={"name": "x"}, headers=member_headers
        ).status_code
        == 403
    )
    assert client.delete(f"{SPRINTS_URL}/{sprint.id}", headers=member_headers).status_code == 403


def test_create_sprint_rejects_end_before_start(client: TestClient, admin_headers) -> None:
    response = client.post(
        SPRINTS_URL, json={**NEW_SPRINT, "end_date": "2029-12-31"}, headers=admin_headers
    )

    assert response.status_code == 422


def test_update_sprint_validates_against_stored_dates(
    client: TestClient, admin_headers, make_sprint
) -> None:
    sprint = make_sprint(start_date=date(2030, 1, 1), end_date=date(2030, 1, 14))

    response = client.patch(
        f"{SPRINTS_URL}/{sprint.id}", json={"end_date": "2029-12-01"}, headers=admin_headers
    )

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "end_date"


def test_update_sprint_status(client: TestClient, admin_headers, make_sprint) -> None:
    sprint = make_sprint(status=SprintStatus.ACTIVE)

    response = client.patch(
        f"{SPRINTS_URL}/{sprint.id}", json={"status": "completed"}, headers=admin_headers
    )

    assert response.json()["data"]["status"] == "completed"


def test_list_sprints_includes_progress_and_filters(
    client: TestClient, member_headers, make_sprint, make_task
) -> None:
    active = make_sprint(name="Active", status=SprintStatus.ACTIVE, start_date=date(2030, 2, 1))
    make_sprint(name="Planned", status=SprintStatus.PLANNED, start_date=date(2030, 3, 1))
    make_task(sprint_id=active.id, status=TaskStatus.DONE)
    make_task(sprint_id=active.id, status=TaskStatus.TODO)

    everything = client.get(SPRINTS_URL, headers=member_headers).json()
    only_active = client.get(SPRINTS_URL, params={"status": "active"}, headers=member_headers)

    assert [s["name"] for s in everything["data"]] == ["Planned", "Active"]
    assert everything["meta"]["total"] == 2
    active_data = only_active.json()["data"]
    assert len(active_data) == 1
    assert (active_data[0]["task_count"], active_data[0]["completed_task_count"]) == (2, 1)


def test_deleting_sprint_moves_tasks_to_backlog(
    client: TestClient, admin_headers, make_sprint, make_task
) -> None:
    sprint = make_sprint()
    task = make_task(sprint_id=sprint.id)

    response = client.delete(f"{SPRINTS_URL}/{sprint.id}", headers=admin_headers)

    assert response.status_code == 200
    assert client.get(f"{SPRINTS_URL}/{sprint.id}", headers=admin_headers).status_code == 404
    task_data = client.get(f"{TASKS_URL}/{task.id}", headers=admin_headers).json()["data"]
    assert task_data["sprint"] is None
