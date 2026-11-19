from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import CurrentUser, DbSession, Pagination
from app.core.responses import ERROR_RESPONSES, ApiResponse, Deleted, PageMeta, ok
from app.models import Task, TaskPriority, TaskStatus, User
from app.schemas.task import (
    TaskCreate,
    TaskPermissions,
    TaskRead,
    TaskSort,
    TaskSummary,
    TaskUpdate,
)
from app.services import tasks as task_service
from app.services.tasks import TaskFilters

router = APIRouter(prefix="/tasks", tags=["tasks"], responses=ERROR_RESPONSES)


def task_filters(
    status: Annotated[
        list[TaskStatus] | None,
        Query(description="Repeat to match several, e.g. `?status=todo&status=in_progress`"),
    ] = None,
    priority: Annotated[list[TaskPriority] | None, Query(description="Repeatable")] = None,
    assignee_id: Annotated[int | None, Query(ge=1)] = None,
    unassigned: Annotated[bool, Query(description="Only tasks without an assignee")] = False,
    reporter_id: Annotated[int | None, Query(ge=1)] = None,
    sprint_id: Annotated[int | None, Query(ge=1)] = None,
    q: Annotated[
        str | None, Query(max_length=100, description="Case-insensitive search in titles")
    ] = None,
    overdue: Annotated[bool, Query(description="Only open tasks past their due date")] = False,
) -> TaskFilters:
    return TaskFilters(
        statuses=status or [],
        priorities=priority or [],
        assignee_id=assignee_id,
        unassigned=unassigned,
        reporter_id=reporter_id,
        sprint_id=sprint_id,
        search=q,
        overdue=overdue,
    )


Filters = Annotated[TaskFilters, Depends(task_filters)]


def to_read(task: Task, user: User) -> TaskRead:
    permissions = TaskPermissions(
        can_edit=task_service.can_edit(user, task),
        can_delete=task_service.can_delete(user, task),
    )
    fields = {name: getattr(task, name) for name in TaskRead.model_fields if name != "permissions"}
    return TaskRead.model_validate({**fields, "permissions": permissions}, from_attributes=True)


@router.get("", summary="List tasks with filters, search, sorting and pagination")
def list_tasks(
    db: DbSession,
    user: CurrentUser,
    filters: Filters,
    pagination: Pagination,
    sort: Annotated[TaskSort, Query(description="Prefix with `-` for descending")] = (
        TaskSort.CREATED_DESC
    ),
) -> ApiResponse[list[TaskRead]]:
    tasks, total = task_service.list_tasks(
        db, filters, sort=sort, offset=pagination.offset, limit=pagination.page_size
    )
    meta = PageMeta.build(page=pagination.page, page_size=pagination.page_size, total=total)
    return ok([to_read(task, user) for task in tasks], meta)


@router.get("/summary", summary="Dashboard metrics (accepts the same filters as the list)")
def summary(db: DbSession, _: CurrentUser, filters: Filters) -> ApiResponse[TaskSummary]:
    return ok(task_service.summarize(db, filters))


@router.get("/{task_id}", summary="Get a task")
def get_task(task_id: int, db: DbSession, user: CurrentUser) -> ApiResponse[TaskRead]:
    return ok(to_read(task_service.get_task(db, task_id), user))


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a task")
def create_task(payload: TaskCreate, db: DbSession, user: CurrentUser) -> ApiResponse[TaskRead]:
    task = task_service.create_task(db, actor=user, payload=payload)
    return ok(to_read(task, user))


@router.patch(
    "/{task_id}", summary="Update a task (admins: any task; members: reported or assigned)"
)
def update_task(
    task_id: int, payload: TaskUpdate, db: DbSession, user: CurrentUser
) -> ApiResponse[TaskRead]:
    task = task_service.update_task(db, actor=user, task_id=task_id, payload=payload)
    return ok(to_read(task, user))


@router.delete("/{task_id}", summary="Delete a task (admins: any task; members: reported)")
def delete_task(task_id: int, db: DbSession, user: CurrentUser) -> ApiResponse[Deleted]:
    task_service.delete_task(db, actor=user, task_id=task_id)
    return ok(Deleted(id=task_id))
