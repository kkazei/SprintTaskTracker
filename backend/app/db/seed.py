"""Load demo data so reviewers can log in and explore immediately.

Run with `python -m app.db.seed`. The script is idempotent: it does nothing if any user exists.
Data is generated from a fixed random seed and dated relative to today, so the dashboard always
shows a realistic mix of completed, in-flight and overdue work.
"""

import logging
import random
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Sprint, SprintStatus, Task, TaskPriority, TaskStatus, User, UserRole

logger = logging.getLogger("seed")

DEMO_PASSWORD = "Password123!"

DEMO_USERS = [
    ("admin@demo.com", "Ada Admin", UserRole.ADMIN),
    ("member@demo.com", "Max Member", UserRole.MEMBER),
    ("priya@demo.com", "Priya Sharma", UserRole.MEMBER),
    ("liam@demo.com", "Liam O'Brien", UserRole.MEMBER),
    ("sofia@demo.com", "Sofia Rossi", UserRole.MEMBER),
    ("kenji@demo.com", "Kenji Tanaka", UserRole.MEMBER),
]

TASK_TITLES = [
    "Set up CI pipeline for pull requests",
    "Design onboarding flow wireframes",
    "Add rate limiting to public endpoints",
    "Migrate user avatars to object storage",
    "Write API docs for the billing service",
    "Fix timezone bug in sprint reports",
    "Implement password reset emails",
    "Add dark mode to the dashboard",
    "Audit npm dependencies for vulnerabilities",
    "Create Postgres read replica runbook",
    "Improve search relevance for task titles",
    "Refactor notification service",
    "Add CSV export for task lists",
    "Investigate slow dashboard query",
    "Set up error tracking in production",
    "Write integration tests for auth flow",
    "Localize the settings page",
    "Add keyboard shortcuts to the task board",
    "Optimize bundle size of the web app",
    "Draft Q4 roadmap proposal",
    "Review accessibility of task forms",
    "Add audit log for admin actions",
    "Implement role management UI",
    "Configure automated database backups",
    "Add pagination to activity feed",
    "Fix flaky end-to-end test on checkout",
    "Upgrade to the latest Node LTS",
    "Add webhooks for task status changes",
    "Create onboarding checklist for new hires",
    "Benchmark API under load",
    "Add caching layer for summary metrics",
    "Polish empty states across the app",
    "Implement SSO with Google Workspace",
    "Clean up unused feature flags",
    "Add due date reminders",
    "Document deployment process",
    "Design mobile layout for task details",
    "Add bulk edit for tasks",
    "Instrument API with OpenTelemetry",
    "Fix overdue badge not updating",
    "Add sprint burndown chart",
    "Harden CORS and security headers",
    "Write seed data for staging",
    "Add filters to the sprint report",
    "Reduce cold start time of the API",
    "Prepare customer demo environment",
    "Add file attachments to tasks",
    "Triage backlog of support tickets",
    "Add comment threads to tasks",
    "Run usability test with five users",
    "Set up staging environment",
    "Add retry logic to email sender",
    "Create design tokens for brand colors",
    "Support markdown in task descriptions",
    "Investigate memory leak in worker",
    "Add assignee avatars to task list",
    "Implement team invitations",
    "Archive completed sprints automatically",
    "Add health checks to all services",
    "Write post-mortem for last outage",
]

DESCRIPTIONS = [
    None,
    "Acceptance criteria are in the linked spec. Coordinate with design before starting.",
    "Customer-reported. Reproduce first, then add a regression test.",
    "Keep the change small and behind a feature flag until QA signs off.",
    "Blocked on infrastructure access; ping the platform team if it takes longer than a day.",
]


def _at(day: date, hour: int) -> datetime:
    return datetime.combine(day, time(hour=hour), tzinfo=UTC)


def _build_sprints(today: date, admin: User) -> list[Sprint]:
    # Four two-week sprints: two finished, one in progress, one upcoming.
    specs = [
        ("Sprint 1 - Foundations", -35, SprintStatus.COMPLETED, "Ship auth and core task CRUD."),
        ("Sprint 2 - Collaboration", -21, SprintStatus.COMPLETED, "Assignees, filters and search."),
        ("Sprint 3 - Insights", -7, SprintStatus.ACTIVE, "Dashboard metrics and reporting."),
        ("Sprint 4 - Polish", 7, SprintStatus.PLANNED, "Performance, accessibility and UX polish."),
    ]
    return [
        Sprint(
            name=name,
            goal=goal,
            start_date=today + timedelta(days=offset),
            end_date=today + timedelta(days=offset + 13),
            status=status,
            created_by=admin,
        )
        for name, offset, status, goal in specs
    ]


def _task_status_for(sprint: Sprint | None, rng: random.Random) -> TaskStatus:
    if sprint is None or sprint.status is SprintStatus.PLANNED:
        return TaskStatus.TODO
    if sprint.status is SprintStatus.COMPLETED:
        return rng.choices([TaskStatus.DONE, TaskStatus.IN_PROGRESS], weights=[9, 1])[0]
    return rng.choice(list(TaskStatus))


def _build_tasks(
    today: date, users: list[User], sprints: list[Sprint], rng: random.Random
) -> list[Task]:
    # Slots: 12 tasks per sprint, the remainder go to the backlog (no sprint).
    sprint_slots: list[Sprint | None] = [s for s in sprints for _ in range(12)]
    sprint_slots += [None] * (len(TASK_TITLES) - len(sprint_slots))

    tasks = []
    for title, sprint in zip(TASK_TITLES, sprint_slots, strict=True):
        status = _task_status_for(sprint, rng)
        window_start = sprint.start_date if sprint else today - timedelta(days=10)
        window_end = sprint.end_date if sprint else today + timedelta(days=30)
        span = (window_end - window_start).days

        # Planned work is created before its sprint starts, but never later than today.
        created_on = min(
            window_start - timedelta(days=rng.randint(1, 5)), today - timedelta(days=1)
        )
        due_date = None
        if rng.random() < 0.85:
            due_date = window_start + timedelta(days=rng.randint(3, span))
        completed_at = None
        if status is TaskStatus.DONE:
            finished_on = min(today, window_start + timedelta(days=rng.randint(1, span)))
            completed_at = _at(finished_on, rng.randint(9, 18))

        tasks.append(
            Task(
                title=title,
                description=rng.choice(DESCRIPTIONS),
                status=status,
                priority=rng.choices(list(TaskPriority), weights=[3, 5, 3, 1])[0],
                due_date=due_date,
                completed_at=completed_at,
                assignee=rng.choice(users) if rng.random() < 0.9 else None,
                reporter=rng.choice(users),
                sprint=sprint,
                created_at=_at(created_on, rng.randint(9, 18)),
                updated_at=completed_at or _at(created_on, 18),
            )
        )
    return tasks


def seed(session: Session) -> bool:
    """Insert demo data. Returns False (and changes nothing) if the database already has users."""
    if session.scalar(select(User.id).limit(1)) is not None:
        return False

    rng = random.Random(42)
    today = date.today()
    password_hash = hash_password(DEMO_PASSWORD)  # hash once; bcrypt is deliberately slow

    users = [
        User(email=email, full_name=name, role=role, password_hash=password_hash)
        for email, name, role in DEMO_USERS
    ]
    sprints = _build_sprints(today, admin=users[0])
    tasks = _build_tasks(today, users, sprints, rng)

    session.add_all([*users, *sprints, *tasks])
    session.commit()
    logger.info("Seeded %d users, %d sprints, %d tasks", len(users), len(sprints), len(tasks))
    return True


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
    with SessionLocal() as session:
        if not seed(session):
            logger.info("Database already contains users; skipping seed.")


if __name__ == "__main__":
    main()
