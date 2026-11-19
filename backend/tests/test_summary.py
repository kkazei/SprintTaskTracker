from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.models import TaskPriority, TaskStatus, User

SUMMARY_URL = "/api/v1/tasks/summary"
TODAY = datetime.now(UTC).date()


def test_summary_of_empty_board(client: TestClient, member_headers) -> None:
    data = client.get(SUMMARY_URL, headers=member_headers).json()["data"]

    assert data["total"] == 0
    assert data["completion_rate"] == 0.0
    assert data["by_status"] == {"todo": 0, "in_progress": 0, "in_review": 0, "done": 0}


def test_summary_counts(client: TestClient, member_headers, member: User, make_task) -> None:
    yesterday, in_three_days = TODAY - timedelta(days=1), TODAY + timedelta(days=3)
    make_task(status=TaskStatus.DONE, due_date=yesterday, assignee_id=member.id)
    make_task(status=TaskStatus.DONE, priority=TaskPriority.HIGH, assignee_id=member.id)
    make_task(status=TaskStatus.TODO, due_date=yesterday)  # overdue, unassigned
    make_task(status=TaskStatus.IN_PROGRESS, due_date=in_three_days, assignee_id=member.id)
    make_task(status=TaskStatus.IN_REVIEW, priority=TaskPriority.URGENT, assignee_id=member.id)

    data = client.get(SUMMARY_URL, headers=member_headers).json()["data"]

    assert data["total"] == 5
    assert data["completed"] == 2
    assert data["pending"] == 3
    assert data["overdue"] == 1
    assert data["due_soon"] == 1
    assert data["unassigned"] == 1
    assert data["completion_rate"] == 0.4
    assert data["by_status"] == {"todo": 1, "in_progress": 1, "in_review": 1, "done": 2}
    assert data["by_priority"] == {"low": 0, "medium": 3, "high": 1, "urgent": 1}


def test_summary_respects_filters(
    client: TestClient, member_headers, member: User, make_task
) -> None:
    make_task(status=TaskStatus.DONE, assignee_id=member.id)
    make_task(status=TaskStatus.TODO, assignee_id=member.id)
    make_task(status=TaskStatus.TODO)

    data = client.get(
        SUMMARY_URL, params={"assignee_id": member.id}, headers=member_headers
    ).json()["data"]

    assert (data["total"], data["completed"], data["pending"]) == (2, 1, 1)
