from enum import StrEnum

# PostgreSQL enums sort by declaration order, so members are listed from "lowest" to "highest".
# That lets `ORDER BY priority` / `ORDER BY status` follow the workflow instead of the alphabet.


class UserRole(StrEnum):
    MEMBER = "member"
    ADMIN = "admin"


class TaskStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"


class TaskPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class SprintStatus(StrEnum):
    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"
