import enum
import uuid
from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, Enum, Integer, String, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScheduleStatus(str, enum.Enum):
    MEMBER_OPEN = "MEMBER_OPEN"
    GUEST_OPEN = "GUEST_OPEN"
    CLOSED = "CLOSED"


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    venue: Mapped[str] = mapped_column(String(100), nullable=False)
    court_count: Mapped[int] = mapped_column(Integer, default=2)
    capacity: Mapped[int] = mapped_column(Integer, default=12)
    status: Mapped[ScheduleStatus] = mapped_column(Enum(ScheduleStatus), default=ScheduleStatus.MEMBER_OPEN)
    registration_deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    recurrence_rule: Mapped[str | None] = mapped_column(String(50), nullable=True)
    parent_schedule_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
