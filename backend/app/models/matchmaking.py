import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MatchmakingStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"


class Matchmaking(Base):
    __tablename__ = "matchmakings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schedule_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schedules.id"), nullable=False)
    status: Mapped[MatchmakingStatus] = mapped_column(Enum(MatchmakingStatus), default=MatchmakingStatus.DRAFT)
    constraints: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
