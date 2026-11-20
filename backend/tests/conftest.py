"""Test fixtures.

Tests run against a real PostgreSQL database (enums, partial indexes and ILIKE behave exactly
as in production). The schema is built once per session with the Alembic migrations, and every
test runs inside a transaction that is rolled back afterwards, so tests are isolated and fast.

Point TEST_DATABASE_URL at a disposable database; it is wiped at the start of the run.
"""

import os
from collections.abc import Callable, Iterator
from datetime import date, timedelta
from pathlib import Path
from typing import Any

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/tracker_test"
)
# Must be set before the app is imported: settings and the engine are created at import time.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["BCRYPT_ROUNDS"] = "4"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-hs256"
os.environ["ENVIRONMENT"] = "test"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.rate_limit import limiter  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.db.session import engine, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Sprint, SprintStatus, Task, User, UserRole  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEST_PASSWORD = "Password123!"


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> None:
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")


@pytest.fixture
def db() -> Iterator[Session]:
    connection = engine.connect()
    transaction = connection.begin()
    # Commits inside the app only release a SAVEPOINT; the outer transaction is rolled back.
    session = Session(
        bind=connection,
        join_transaction_mode="create_savepoint",
        autoflush=False,
        expire_on_commit=False,
    )
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(autouse=True)
def reset_rate_limiter() -> Iterator[None]:
    """Keep SlowAPI's in-memory counters isolated between tests."""
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(db: Session) -> Callable[..., User]:
    counter = iter(range(1, 10_000))

    def _make_user(
        *,
        role: UserRole = UserRole.MEMBER,
        email: str | None = None,
        full_name: str | None = None,
        is_active: bool = True,
    ) -> User:
        n = next(counter)
        user = User(
            email=email or f"user{n}@example.com",
            full_name=full_name or f"Test User {n}",
            role=role,
            is_active=is_active,
            password_hash=hash_password(TEST_PASSWORD),
        )
        db.add(user)
        db.commit()
        return user

    return _make_user


def auth_headers(user: User) -> dict[str, str]:
    token, _ = create_access_token(user.id, user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin(make_user: Callable[..., User]) -> User:
    return make_user(role=UserRole.ADMIN, email="admin@example.com", full_name="Ada Admin")


@pytest.fixture
def member(make_user: Callable[..., User]) -> User:
    return make_user(email="member@example.com", full_name="Max Member")


@pytest.fixture
def admin_headers(admin: User) -> dict[str, str]:
    return auth_headers(admin)


@pytest.fixture
def member_headers(member: User) -> dict[str, str]:
    return auth_headers(member)


@pytest.fixture
def make_sprint(db: Session, admin: User) -> Callable[..., Sprint]:
    def _make_sprint(**overrides: Any) -> Sprint:
        start = overrides.pop("start_date", date.today())
        values: dict[str, Any] = {
            "name": "Sprint",
            "start_date": start,
            "end_date": start + timedelta(days=13),
            "status": SprintStatus.ACTIVE,
            "created_by_id": admin.id,
        }
        sprint = Sprint(**(values | overrides))
        db.add(sprint)
        db.commit()
        return sprint

    return _make_sprint


@pytest.fixture
def make_task(db: Session) -> Callable[..., Task]:
    def _make_task(**overrides: Any) -> Task:
        values: dict[str, Any] = {"title": "A task"}
        task = Task(**(values | overrides))
        db.add(task)
        db.commit()
        return task

    return _make_task
