from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AuthenticationError, ConflictError, NotFoundError, PermissionDeniedError
from app.core.security import burn_password_check, hash_password, verify_password
from app.models import User, UserRole
from app.schemas.auth import RegisterRequest


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def get_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} not found")
    return user


def register(db: Session, payload: RegisterRequest) -> User:
    if get_by_email(db, payload.email) is not None:
        raise ConflictError("An account with this email already exists", code="email_taken")

    # Self-registration always creates a Member; only an Admin can promote someone.
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=UserRole.MEMBER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = get_by_email(db, email)
    if user is None:
        burn_password_check(password)
        raise AuthenticationError("Invalid email or password", code="invalid_credentials")
    if not verify_password(password, user.password_hash):
        raise AuthenticationError("Invalid email or password", code="invalid_credentials")
    if not user.is_active:
        raise PermissionDeniedError("This account has been deactivated", code="account_inactive")
    return user


def list_users(
    db: Session, *, search: str | None, offset: int, limit: int
) -> tuple[list[User], int]:
    query = select(User).where(User.is_active.is_(True))
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    users = db.scalars(query.order_by(User.full_name, User.id).offset(offset).limit(limit)).all()
    return list(users), total


def change_role(db: Session, *, actor: User, user_id: int, role: UserRole) -> User:
    if actor.id == user_id:
        # Prevents an admin from accidentally locking everyone out of admin features.
        raise PermissionDeniedError("You cannot change your own role", code="self_role_change")
    user = get_or_404(db, user_id)
    user.role = role
    db.commit()
    db.refresh(user)
    return user
