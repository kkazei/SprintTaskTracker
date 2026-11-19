from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, pg_enum
from app.models.enums import SprintStatus
from app.models.user import User


class Sprint(TimestampMixin, Base):
    __tablename__ = "sprints"
    __table_args__ = (CheckConstraint("end_date >= start_date", name="valid_date_range"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    goal: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[SprintStatus] = mapped_column(
        pg_enum(SprintStatus, "sprint_status"),
        default=SprintStatus.PLANNED,
        server_default=SprintStatus.PLANNED,
        index=True,
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    created_by: Mapped[User | None] = relationship(lazy="raise")

    def __repr__(self) -> str:
        return f"<Sprint id={self.id} name={self.name!r} status={self.status}>"
