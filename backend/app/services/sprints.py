from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.errors import InvalidFieldError, NotFoundError
from app.models import Sprint, SprintStatus, Task, TaskStatus, User
from app.schemas.sprint import SprintCreate, SprintRead, SprintUpdate

NON_NULLABLE_FIELDS = ("name", "start_date", "end_date", "status")


def _with_task_counts() -> Select[tuple[Sprint, int, int]]:
    # One grouped query returns each sprint with its progress, instead of a count per sprint.
    return (
        select(
            Sprint,
            func.count(Task.id).label("task_count"),
            func.count(Task.id).filter(Task.status == TaskStatus.DONE).label("completed"),
        )
        .outerjoin(Task, Task.sprint_id == Sprint.id)
        .group_by(Sprint.id)
    )


def _to_read(sprint: Sprint, task_count: int, completed: int) -> SprintRead:
    read = SprintRead.model_validate(sprint)
    read.task_count = task_count
    read.completed_task_count = completed
    return read


def list_sprints(
    db: Session, *, status: SprintStatus | None, offset: int, limit: int
) -> tuple[list[SprintRead], int]:
    count_query = select(func.count()).select_from(Sprint)
    query = _with_task_counts()
    if status is not None:
        count_query = count_query.where(Sprint.status == status)
        query = query.where(Sprint.status == status)

    total = db.scalar(count_query) or 0
    rows = db.execute(
        query.order_by(Sprint.start_date.desc(), Sprint.id.desc()).offset(offset).limit(limit)
    ).all()
    return [_to_read(*row) for row in rows], total


def _get_or_404(db: Session, sprint_id: int) -> Sprint:
    sprint = db.get(Sprint, sprint_id)
    if sprint is None:
        raise NotFoundError(f"Sprint {sprint_id} not found")
    return sprint


def get_sprint(db: Session, sprint_id: int) -> SprintRead:
    row = db.execute(_with_task_counts().where(Sprint.id == sprint_id)).one_or_none()
    if row is None:
        raise NotFoundError(f"Sprint {sprint_id} not found")
    return _to_read(*row)


def create_sprint(db: Session, *, actor: User, payload: SprintCreate) -> SprintRead:
    sprint = Sprint(**payload.model_dump(), created_by_id=actor.id)
    db.add(sprint)
    db.commit()
    return get_sprint(db, sprint.id)


def update_sprint(db: Session, *, sprint_id: int, payload: SprintUpdate) -> SprintRead:
    sprint = _get_or_404(db, sprint_id)
    changes = payload.model_dump(exclude_unset=True)
    for name in NON_NULLABLE_FIELDS:
        if name in changes and changes[name] is None:
            raise InvalidFieldError(name, "This field cannot be null")

    start = changes.get("start_date", sprint.start_date)
    end = changes.get("end_date", sprint.end_date)
    if end < start:
        raise InvalidFieldError("end_date", "end_date must be on or after start_date")

    for name, value in changes.items():
        setattr(sprint, name, value)
    db.commit()
    return get_sprint(db, sprint_id)


def delete_sprint(db: Session, *, sprint_id: int) -> None:
    """Delete a sprint. Its tasks are kept and moved back to the backlog (FK is SET NULL)."""
    db.delete(_get_or_404(db, sprint_id))
    db.commit()
