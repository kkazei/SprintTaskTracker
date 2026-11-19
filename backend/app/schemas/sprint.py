from datetime import date, datetime
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models.enums import SprintStatus

SprintName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
SprintGoal = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class SprintSummary(BaseModel):
    """Compact sprint representation embedded in tasks."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    status: SprintStatus


class SprintRead(SprintSummary):
    goal: str | None
    start_date: date
    end_date: date
    created_at: datetime
    task_count: int = 0
    completed_task_count: int = 0


class SprintCreate(BaseModel):
    name: SprintName = Field(examples=["Sprint 5 - Launch"])
    goal: SprintGoal | None = None
    start_date: date
    end_date: date
    status: SprintStatus = SprintStatus.PLANNED

    @model_validator(mode="after")
    def end_after_start(self) -> Self:
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class SprintUpdate(BaseModel):
    """Partial update; only the fields sent are changed."""

    name: SprintName | None = None
    goal: SprintGoal | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: SprintStatus | None = None
