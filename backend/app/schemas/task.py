from datetime import date, datetime
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.enums import TaskPriority, TaskStatus
from app.schemas.sprint import SprintSummary
from app.schemas.user import UserSummary

TaskTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
TaskDescription = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]


class TaskSort(StrEnum):
    """Sort keys accepted by `GET /tasks`. A leading `-` means descending."""

    URGENCY = "urgency"  # open first, then soonest due date, then highest priority
    CREATED_DESC = "-created_at"
    CREATED_ASC = "created_at"
    UPDATED_DESC = "-updated_at"
    DUE_ASC = "due_date"
    DUE_DESC = "-due_date"
    PRIORITY_DESC = "-priority"
    PRIORITY_ASC = "priority"
    TITLE_ASC = "title"


class TaskPermissions(BaseModel):
    can_edit: bool
    can_delete: bool


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    is_overdue: bool
    completed_at: datetime | None
    assignee: UserSummary | None
    reporter: UserSummary | None
    sprint: SprintSummary | None
    created_at: datetime
    updated_at: datetime
    permissions: TaskPermissions = Field(
        description="What the current user may do with this task (for showing/hiding actions)."
    )


class TaskCreate(BaseModel):
    title: TaskTitle = Field(examples=["Add CSV export for task lists"])
    description: TaskDescription | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: date | None = None
    assignee_id: int | None = None
    sprint_id: int | None = None


class TaskUpdate(BaseModel):
    """Partial update. Only fields present in the body change; send `null` to clear an
    optional field (e.g. `"assignee_id": null` to unassign)."""

    title: TaskTitle | None = None
    description: TaskDescription | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None
    assignee_id: int | None = None
    sprint_id: int | None = None


class TaskSummary(BaseModel):
    """Aggregate metrics for the dashboard. Respects the same filters as the task list."""

    total: int
    completed: int
    pending: int = Field(description="Every task that is not done")
    overdue: int = Field(description="Not done and due before today")
    due_soon: int = Field(description="Not done and due within the next 7 days")
    unassigned: int
    completion_rate: float = Field(description="completed / total, from 0 to 1")
    by_status: dict[TaskStatus, int]
    by_priority: dict[TaskPriority, int]
