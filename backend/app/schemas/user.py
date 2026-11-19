from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import UserRole


class UserSummary(BaseModel):
    """Compact user representation embedded in other resources (task assignee, reporter...)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str


class UserRead(UserSummary):
    role: UserRole
    is_active: bool
    created_at: datetime


class UserRoleUpdate(BaseModel):
    role: UserRole
