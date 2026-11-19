from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import InvalidFieldError, NotFoundError, PermissionDeniedError
from app.models import Sprint, Task, TaskPriority, TaskStatus, User, UserRole
from app.schemas.task import TaskCreate, TaskSort, TaskSummary, TaskUpdate
from app.services.common import escape_like, utc_today

DUE_SOON_DAYS = 7


@dataclass(frozen=True)
class TaskFilters:
    statuses: list[TaskStatus] = field(default_factory=list)
    priorities: list[TaskPriority] = field(default_factory=list)
    assignee_id: int | None = None
    unassigned: bool = False
    reporter_id: int | None = None
    sprint_id: int | None = None
    search: str | None = None
    overdue: bool = False


_SORT_ORDER = {
    TaskSort.CREATED_DESC: [Task.created_at.desc()],
    TaskSort.CREATED_ASC: [Task.created_at.asc()],
    TaskSort.UPDATED_DESC: [Task.updated_at.desc()],
    TaskSort.DUE_ASC: [Task.due_date.asc().nulls_last()],
    TaskSort.DUE_DESC: [Task.due_date.desc().nulls_last()],
    TaskSort.PRIORITY_DESC: [Task.priority.desc(), Task.due_date.asc().nulls_last()],
    TaskSort.PRIORITY_ASC: [Task.priority.asc(), Task.due_date.asc().nulls_last()],
    TaskSort.TITLE_ASC: [Task.title.asc()],
}


# --- permissions -----------------------------------------------------------------------------


def can_edit(user: User, task: Task) -> bool:
    """Admins edit anything; members edit tasks they reported or are assigned to."""
    return user.role is UserRole.ADMIN or user.id in (task.reporter_id, task.assignee_id)


def can_delete(user: User, task: Task) -> bool:
    """Admins delete anything; members delete only tasks they reported."""
    return user.role is UserRole.ADMIN or user.id == task.reporter_id


# --- queries ---------------------------------------------------------------------------------


def _conditions(filters: TaskFilters) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = []
    if filters.statuses:
        conditions.append(Task.status.in_(filters.statuses))
    if filters.priorities:
        conditions.append(Task.priority.in_(filters.priorities))
    if filters.unassigned:
        conditions.append(Task.assignee_id.is_(None))
    elif filters.assignee_id is not None:
        conditions.append(Task.assignee_id == filters.assignee_id)
    if filters.reporter_id is not None:
        conditions.append(Task.reporter_id == filters.reporter_id)
    if filters.sprint_id is not None:
        conditions.append(Task.sprint_id == filters.sprint_id)
    if filters.search and (term := filters.search.strip()):
        # Served by the trigram GIN index on title.
        conditions.append(Task.title.ilike(f"%{escape_like(term)}%", escape="\\"))
    if filters.overdue:
        # Matches the partial index ix_tasks_due_date_open.
        conditions.append(Task.status != TaskStatus.DONE)
        conditions.append(Task.due_date < utc_today())
    return conditions


def _with_relations(query: Select[tuple[Task]]) -> Select[tuple[Task]]:
    # Many-to-one relations are joined in the same query, so listing N tasks is one round trip.
    return query.options(
        joinedload(Task.assignee), joinedload(Task.reporter), joinedload(Task.sprint)
    )


def list_tasks(
    db: Session, filters: TaskFilters, *, sort: TaskSort, offset: int, limit: int
) -> tuple[list[Task], int]:
    conditions = _conditions(filters)
    total = db.scalar(select(func.count()).select_from(Task).where(*conditions)) or 0
    query = (
        _with_relations(select(Task))
        .where(*conditions)
        .order_by(*_SORT_ORDER[sort], Task.id.desc())  # id makes paging stable on ties
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(query).all()), total


def get_task(db: Session, task_id: int) -> Task:
    task = db.scalar(_with_relations(select(Task)).where(Task.id == task_id))
    if task is None:
        raise NotFoundError(f"Task {task_id} not found")
    return task


def summarize(db: Session, filters: TaskFilters) -> TaskSummary:
    """All dashboard metrics in a single aggregate query using FILTER clauses."""
    today = utc_today()
    is_open = Task.status != TaskStatus.DONE
    count = func.count()

    query = (
        select(
            count.label("total"),
            count.filter(Task.status == TaskStatus.DONE).label("completed"),
            count.filter(is_open, Task.due_date < today).label("overdue"),
            count.filter(
                is_open, Task.due_date.between(today, today + timedelta(days=DUE_SOON_DAYS))
            ).label("due_soon"),
            count.filter(Task.assignee_id.is_(None)).label("unassigned"),
            *(count.filter(Task.status == s).label(f"status_{s.value}") for s in TaskStatus),
            *(count.filter(Task.priority == p).label(f"priority_{p.value}") for p in TaskPriority),
        )
        .select_from(Task)
        .where(*_conditions(filters))
    )
    row = db.execute(query).one()._mapping

    total, completed = row["total"], row["completed"]
    return TaskSummary(
        total=total,
        completed=completed,
        pending=total - completed,
        overdue=row["overdue"],
        due_soon=row["due_soon"],
        unassigned=row["unassigned"],
        completion_rate=round(completed / total, 4) if total else 0.0,
        by_status={s: row[f"status_{s.value}"] for s in TaskStatus},
        by_priority={p: row[f"priority_{p.value}"] for p in TaskPriority},
    )


# --- commands --------------------------------------------------------------------------------


def _validate_references(db: Session, values: dict[str, object]) -> None:
    assignee_id = values.get("assignee_id")
    if assignee_id is not None:
        assignee = db.get(User, assignee_id)
        if assignee is None or not assignee.is_active:
            raise InvalidFieldError("assignee_id", f"User {assignee_id} does not exist")
    sprint_id = values.get("sprint_id")
    if sprint_id is not None and db.get(Sprint, sprint_id) is None:
        raise InvalidFieldError("sprint_id", f"Sprint {sprint_id} does not exist")


def _sync_completed_at(task: Task) -> None:
    if task.status is TaskStatus.DONE:
        task.completed_at = task.completed_at or datetime.now(UTC)
    else:
        task.completed_at = None


def create_task(db: Session, *, actor: User, payload: TaskCreate) -> Task:
    values = payload.model_dump()
    _validate_references(db, values)

    task = Task(**values, reporter_id=actor.id)
    _sync_completed_at(task)
    db.add(task)
    db.commit()
    return get_task(db, task.id)


NON_NULLABLE_FIELDS = ("title", "status", "priority")


def update_task(db: Session, *, actor: User, task_id: int, payload: TaskUpdate) -> Task:
    task = get_task(db, task_id)
    if not can_edit(actor, task):
        raise PermissionDeniedError("You can only edit tasks you reported or are assigned to")

    changes = payload.model_dump(exclude_unset=True)
    for name in NON_NULLABLE_FIELDS:
        if name in changes and changes[name] is None:
            raise InvalidFieldError(name, "This field cannot be null")
    _validate_references(db, changes)

    for name, value in changes.items():
        setattr(task, name, value)
    if "status" in changes:
        _sync_completed_at(task)

    db.commit()
    db.expire(task)  # reload relationships that may have changed (assignee, sprint)
    return get_task(db, task_id)


def delete_task(db: Session, *, actor: User, task_id: int) -> None:
    task = get_task(db, task_id)
    if not can_delete(actor, task):
        raise PermissionDeniedError("You can only delete tasks you reported")
    db.delete(task)
    db.commit()
