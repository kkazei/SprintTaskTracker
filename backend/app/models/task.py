from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, pg_enum
from app.models.enums import TaskPriority, TaskStatus
from app.models.sprint import Sprint
from app.models.user import User


class Task(TimestampMixin, Base):
    __tablename__ = "tasks"
    __table_args__ = (
        # "My tasks" and the assignee filter almost always combine with a status filter.
        Index("ix_tasks_assignee_id_status", "assignee_id", "status"),
        # Board/list views filter by status and sort or filter by priority.
        Index("ix_tasks_status_priority", "status", "priority"),
        # Overdue = open tasks with a past due date. A partial index keeps it small,
        # because completed tasks (the bulk of history) are never overdue.
        Index(
            "ix_tasks_due_date_open",
            "due_date",
            postgresql_where=text("status <> 'done' AND due_date IS NOT NULL"),
        ),
        # Default list ordering is newest first.
        Index("ix_tasks_created_at", "created_at"),
        # A trigram GIN index on title for ILIKE search is created in the migration,
        # because it depends on the pg_trgm extension being available.
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TaskStatus] = mapped_column(
        pg_enum(TaskStatus, "task_status"), default=TaskStatus.TODO, server_default=TaskStatus.TODO
    )
    priority: Mapped[TaskPriority] = mapped_column(
        pg_enum(TaskPriority, "task_priority"),
        default=TaskPriority.MEDIUM,
        server_default=TaskPriority.MEDIUM,
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reporter_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    sprint_id: Mapped[int | None] = mapped_column(
        ForeignKey("sprints.id", ondelete="SET NULL"), index=True
    )

    # lazy="raise" forces queries to load relations explicitly, which prevents N+1 queries.
    assignee: Mapped[User | None] = relationship(foreign_keys=[assignee_id], lazy="raise")
    reporter: Mapped[User | None] = relationship(foreign_keys=[reporter_id], lazy="raise")
    sprint: Mapped[Sprint | None] = relationship(lazy="raise")

    def __repr__(self) -> str:
        return f"<Task id={self.id} title={self.title!r} status={self.status}>"
