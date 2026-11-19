"""create users, sprints and tasks

Revision ID: 0001
Revises:
Create Date: 2026-11-20 06:23:49.516008

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ENUM_TYPES = ("task_priority", "task_status", "sprint_status", "user_role")


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column(name, sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False)
        for name in ("created_at", "updated_at")
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("member", "admin", name="user_role"),
            server_default="member",
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )

    op.create_table(
        "sprints",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("goal", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("planned", "active", "completed", name="sprint_status"),
            server_default="planned",
            nullable=False,
        ),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        *_timestamps(),
        sa.CheckConstraint("end_date >= start_date", name=op.f("ck_sprints_valid_date_range")),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_sprints_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sprints")),
    )
    op.create_index(op.f("ix_sprints_created_by_id"), "sprints", ["created_by_id"])
    op.create_index(op.f("ix_sprints_status"), "sprints", ["status"])

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("todo", "in_progress", "in_review", "done", name="task_status"),
            server_default="todo",
            nullable=False,
        ),
        sa.Column(
            "priority",
            sa.Enum("low", "medium", "high", "urgent", name="task_priority"),
            server_default="medium",
            nullable=False,
        ),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assignee_id", sa.Integer(), nullable=True),
        sa.Column("reporter_id", sa.Integer(), nullable=True),
        sa.Column("sprint_id", sa.Integer(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["assignee_id"],
            ["users.id"],
            name=op.f("fk_tasks_assignee_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["reporter_id"],
            ["users.id"],
            name=op.f("fk_tasks_reporter_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["sprint_id"],
            ["sprints.id"],
            name=op.f("fk_tasks_sprint_id_sprints"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
    )
    op.create_index("ix_tasks_assignee_id_status", "tasks", ["assignee_id", "status"])
    op.create_index("ix_tasks_status_priority", "tasks", ["status", "priority"])
    op.create_index("ix_tasks_created_at", "tasks", ["created_at"])
    op.create_index(op.f("ix_tasks_reporter_id"), "tasks", ["reporter_id"])
    op.create_index(op.f("ix_tasks_sprint_id"), "tasks", ["sprint_id"])
    op.create_index(
        "ix_tasks_due_date_open",
        "tasks",
        ["due_date"],
        postgresql_where=sa.text("status <> 'done' AND due_date IS NOT NULL"),
    )

    # Trigram index so `title ILIKE '%term%'` search can use an index instead of a full scan.
    # pg_trgm ships with standard PostgreSQL (Docker image, Neon, RDS); skip it gracefully on
    # minimal builds that lack the extension.
    has_trgm = op.get_bind().scalar(
        sa.text("SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm')")
    )
    if has_trgm:
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
        op.execute("CREATE INDEX ix_tasks_title_trgm ON tasks USING gin (title gin_trgm_ops)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_tasks_title_trgm")
    op.drop_table("tasks")
    op.drop_table("sprints")
    op.drop_table("users")
    for enum_type in ENUM_TYPES:
        sa.Enum(name=enum_type).drop(op.get_bind(), checkfirst=True)
