"""Member endpoints: list, me, link, stats."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_kakao_id, get_current_member
from app.database import get_db
from app.models.game import Game, MatchRound, PlayerType
from app.models.matchmaking import Matchmaking, MatchmakingStatus
from app.models.member import Member

router = APIRouter(prefix="/members", tags=["members"])


class MemberOut(BaseModel):
    id: uuid.UUID
    name: str
    gender: str
    ntrp: float
    is_admin: bool

    model_config = {"from_attributes": True}


class LinkRequest(BaseModel):
    member_id: uuid.UUID


@router.get("/", response_model=list[MemberOut])
async def list_members(
    member: Member = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """List all active members."""
    result = await db.execute(
        select(Member).where(Member.status == "ACTIVE").order_by(Member.name)
    )
    return result.scalars().all()


@router.get("/me", response_model=MemberOut)
async def get_me(member: Member = Depends(get_current_member)):
    """Get current authenticated member."""
    return member


@router.post("/link", response_model=MemberOut)
async def link_member(
    body: LinkRequest,
    kakao_id: str = Depends(get_current_kakao_id),
    db: AsyncSession = Depends(get_db),
):
    """Link kakao account to a member (first login only)."""
    # Check if kakao_id is already linked
    existing = await db.execute(select(Member).where(Member.kakao_id == kakao_id))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Kakao account already linked to a member")

    # Find the member
    result = await db.execute(select(Member).where(Member.id == body.member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Member not found")

    if member.kakao_id is not None:
        raise HTTPException(409, "Member already linked to another kakao account")

    member.kakao_id = kakao_id
    await db.commit()
    await db.refresh(member)
    return member


class MemberStatsOut(BaseModel):
    id: str
    name: str
    gender: str
    ntrp: float
    internal_rating: float
    total_games: int
    wins: int
    losses: int
    draws: int
    win_rate: float  # 0.0 - 1.0


@router.get("/stats", response_model=list[MemberStatsOut])
async def member_stats(
    member: Member = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Get stats for all active members."""
    members_result = await db.execute(
        select(Member).where(Member.status == "ACTIVE").order_by(Member.name)
    )
    members = list(members_result.scalars().all())

    # Get all games from confirmed matchmakings with scores
    games_result = await db.execute(
        select(Game)
        .join(MatchRound, Game.round_id == MatchRound.id)
        .join(Matchmaking, MatchRound.matchmaking_id == Matchmaking.id)
        .where(
            Matchmaking.status == MatchmakingStatus.CONFIRMED,
            Game.score_a.isnot(None),
        )
    )
    games = list(games_result.scalars().all())

    # Calculate stats per member
    stats: dict[str, dict] = {}
    for m in members:
        stats[str(m.id)] = {"wins": 0, "losses": 0, "draws": 0, "total": 0}

    for game in games:
        player_positions = {
            str(game.team_a_player1_id): "a",
            str(game.team_a_player2_id): "a",
            str(game.team_b_player1_id): "b",
            str(game.team_b_player2_id): "b",
        }
        for pid, team in player_positions.items():
            if pid not in stats:
                continue
            stats[pid]["total"] += 1
            if game.score_a == game.score_b:
                stats[pid]["draws"] += 1
            elif (team == "a" and game.score_a > game.score_b) or \
                 (team == "b" and game.score_b > game.score_a):
                stats[pid]["wins"] += 1
            else:
                stats[pid]["losses"] += 1

    result = []
    for m in members:
        mid = str(m.id)
        s = stats.get(mid, {"wins": 0, "losses": 0, "draws": 0, "total": 0})
        win_rate = s["wins"] / s["total"] if s["total"] > 0 else 0.0
        result.append(MemberStatsOut(
            id=mid,
            name=m.name,
            gender=m.gender.value,
            ntrp=m.ntrp,
            internal_rating=m.internal_rating,
            total_games=s["total"],
            wins=s["wins"],
            losses=s["losses"],
            draws=s["draws"],
            win_rate=round(win_rate, 3),
        ))

    # Sort by total games descending
    result.sort(key=lambda x: x.total_games, reverse=True)
    return result
