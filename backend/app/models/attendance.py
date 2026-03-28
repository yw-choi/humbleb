import enum
import uuid
from datetime import datetime, time

from sqlalchemy import DateTime, Enum, ForeignKey, String, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AttendanceType(str, enum.Enum):
    FULL = "full"
    LATE = "late"
    EARLY = "early"


class Attendance(Base):
    __tablename__ = "attendances"
    __table_args__ = (UniqueConstraint("schedule_id", "member_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schedule_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schedules.id"), nullable=False)
    member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("members.id"), nullable=False)
    attendance_type: Mapped[AttendanceType] = mapped_column(Enum(AttendanceType), default=AttendanceType.FULL)
    arrival_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    departure_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    comment: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
