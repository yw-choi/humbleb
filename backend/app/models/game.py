import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PlayerType(str, enum.Enum):
    MEMBER = "MEMBER"
    GUEST = "GUEST"


class MatchRound(Base):
    __tablename__ = "match_rounds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    matchmaking_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("matchmakings.id", ondelete="CASCADE"), nullable=False)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Game(Base):
    __tablename__ = "games"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    round_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("match_rounds.id", ondelete="CASCADE"), nullable=False)
    court: Mapped[str] = mapped_column(String(5), nullable=False)
    team_a_player1_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    team_a_player2_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    team_b_player1_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    team_b_player2_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    team_a_player1_type: Mapped[PlayerType] = mapped_column(Enum(PlayerType), default=PlayerType.MEMBER)
    team_a_player2_type: Mapped[PlayerType] = mapped_column(Enum(PlayerType), default=PlayerType.MEMBER)
    team_b_player1_type: Mapped[PlayerType] = mapped_column(Enum(PlayerType), default=PlayerType.MEMBER)
    team_b_player2_type: Mapped[PlayerType] = mapped_column(Enum(PlayerType), default=PlayerType.MEMBER)
    score_a: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_b: Mapped[int | None] = mapped_column(Integer, nullable=True)
    submitted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("members.id", ondelete="CASCADE"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
