"""Matchmaking and match endpoints."""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_member, require_admin
from app.database import get_db
from app.models.attendance import Attendance
from app.models.game import Game, MatchRound, PlayerType
from app.models.guest import Guest
from app.models.matchmaking import Matchmaking, MatchmakingStatus
from app.models.member import Member
from app.models.schedule import Schedule
from app.services.matchmaking import (
    Constraint,
    Player,
    generate_matchmaking,
    GUEST_NTRP_MAP,
)

router = APIRouter(prefix="/schedules", tags=["matches"])


# --- Request/Response Models ---


class ConstraintIn(BaseModel):
    type: str  # pair_exclude, pair_prefer, opponent_exclude, round_skip, round_start
    member_ids: list[str]
    round: Optional[int] = None


class MatchmakingCreateIn(BaseModel):
    round_count: int
    constraints: Optional[list[ConstraintIn]] = None


class GameOut(BaseModel):
    id: str
    court: str
    team_a_player1_id: str
    team_a_player2_id: str
    team_b_player1_id: str
    team_b_player2_id: str
    team_a_player1_type: str
    team_a_player2_type: str
    team_b_player1_type: str
    team_b_player2_type: str
    team_a_player1_name: str = ""
    team_a_player2_name: str = ""
    team_b_player1_name: str = ""
    team_b_player2_name: str = ""
    score_a: Optional[int] = None
    score_b: Optional[int] = None


class RoundOut(BaseModel):
    round_number: int
    games: list[GameOut]


class MatchmakingOut(BaseModel):
    id: str
    schedule_id: str
    status: str
    constraints: Optional[list[ConstraintIn]] = None
    warnings: Optional[list[str]] = None
    rounds: list[RoundOut]


class SwapIn(BaseModel):
    game_id: str
    position_a: str  # e.g. "team_a_player1"
    game_id_b: Optional[str] = None  # if swapping between games
    position_b: str  # e.g. "team_b_player2"


# --- Endpoints ---


@router.post("/{schedule_id}/matchmaking", response_model=MatchmakingOut)
async def create_matchmaking(
    schedule_id: uuid.UUID,
    body: MatchmakingCreateIn,
    admin: Member = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Generate a DRAFT matchmaking for a schedule."""
    # Get schedule
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    # Delete existing draft if any
    existing = await db.execute(
        select(Matchmaking).where(Matchmaking.schedule_id == schedule_id)
    )
    for mm in existing.scalars().all():
        # Delete rounds and games
        rounds_result = await db.execute(
            select(MatchRound).where(MatchRound.matchmaking_id == mm.id)
        )
        for rnd in rounds_result.scalars().all():
            games_result = await db.execute(
                select(Game).where(Game.round_id == rnd.id)
            )
            for game in games_result.scalars().all():
                await db.delete(game)
            await db.delete(rnd)
        await db.delete(mm)

    # Get attendees (members)
    attendees_result = await db.execute(
        select(Attendance, Member)
        .join(Member, Attendance.member_id == Member.id)
        .where(Attendance.schedule_id == schedule_id)
    )
    players: list[Player] = []
    for att, member in attendees_result.all():
        players.append(Player(
            id=str(member.id),
            name=member.name,
            gender=member.gender.value,
            ntrp=member.ntrp,
            player_type="MEMBER",
        ))

    # Get guests
    guests_result = await db.execute(
        select(Guest).where(Guest.schedule_id == schedule_id)
    )
    for guest in guests_result.scalars().all():
        players.append(Player(
            id=str(guest.id),
            name=guest.name,
            gender=guest.gender.value,
            ntrp=GUEST_NTRP_MAP.get(guest.estimated_skill, 3.0),
            player_type="GUEST",
        ))

    if len(players) < 4:
        raise HTTPException(400, f"최소 4명 필요 (현재 {len(players)}명)")

    # Convert constraints
    algo_constraints = []
    if body.constraints:
        for c in body.constraints:
            algo_constraints.append(Constraint(
                type=c.type,
                member_ids=c.member_ids,
                round=c.round,
            ))

    # Run algorithm
    mm_result = generate_matchmaking(
        players=players,
        court_count=schedule.court_count,
        round_count=body.round_count,
        constraints=algo_constraints,
    )

    # Save to DB
    matchmaking = Matchmaking(
        schedule_id=schedule_id,
        status=MatchmakingStatus.DRAFT,
        constraints=[c.model_dump() for c in body.constraints] if body.constraints else None,
    )
    db.add(matchmaking)
    await db.flush()

    rounds_out: list[RoundOut] = []
    for rnd_assign in mm_result.rounds:
        rnd = MatchRound(
            matchmaking_id=matchmaking.id,
            round_number=rnd_assign.round_number,
        )
        db.add(rnd)
        await db.flush()

        games_out: list[GameOut] = []
        for game_assign in rnd_assign.games:
            game = Game(
                round_id=rnd.id,
                court=game_assign.court,
                team_a_player1_id=uuid.UUID(game_assign.team_a[0].id),
                team_a_player2_id=uuid.UUID(game_assign.team_a[1].id),
                team_b_player1_id=uuid.UUID(game_assign.team_b[0].id),
                team_b_player2_id=uuid.UUID(game_assign.team_b[1].id),
                team_a_player1_type=PlayerType(game_assign.team_a[0].player_type),
                team_a_player2_type=PlayerType(game_assign.team_a[1].player_type),
                team_b_player1_type=PlayerType(game_assign.team_b[0].player_type),
                team_b_player2_type=PlayerType(game_assign.team_b[1].player_type),
            )
            db.add(game)
            await db.flush()

            games_out.append(GameOut(
                id=str(game.id),
                court=game.court,
                team_a_player1_id=str(game.team_a_player1_id),
                team_a_player2_id=str(game.team_a_player2_id),
                team_b_player1_id=str(game.team_b_player1_id),
                team_b_player2_id=str(game.team_b_player2_id),
                team_a_player1_type=game.team_a_player1_type.value,
                team_a_player2_type=game.team_a_player2_type.value,
                team_b_player1_type=game.team_b_player1_type.value,
                team_b_player2_type=game.team_b_player2_type.value,
                team_a_player1_name=game_assign.team_a[0].name,
                team_a_player2_name=game_assign.team_a[1].name,
                team_b_player1_name=game_assign.team_b[0].name,
                team_b_player2_name=game_assign.team_b[1].name,
            ))

        rounds_out.append(RoundOut(round_number=rnd_assign.round_number, games=games_out))

    await db.commit()

    return MatchmakingOut(
        id=str(matchmaking.id),
        schedule_id=str(schedule_id),
        status=matchmaking.status.value,
        constraints=body.constraints,
        warnings=mm_result.warnings if mm_result.warnings else None,
        rounds=rounds_out,
    )


@router.post("/{schedule_id}/matches/confirm")
async def confirm_matchmaking(
    schedule_id: uuid.UUID,
    admin: Member = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Confirm a DRAFT matchmaking → CONFIRMED."""
    result = await db.execute(
        select(Matchmaking).where(
            Matchmaking.schedule_id == schedule_id,
            Matchmaking.status == MatchmakingStatus.DRAFT,
        )
    )
    mm = result.scalar_one_or_none()
    if not mm:
        raise HTTPException(404, "No draft matchmaking found")

    mm.status = MatchmakingStatus.CONFIRMED
    mm.confirmed_at = datetime.utcnow()
    db.add(mm)
    await db.commit()
    return {"status": "confirmed"}


@router.get("/{schedule_id}/matches", response_model=MatchmakingOut)
async def get_matches(
    schedule_id: uuid.UUID,
    member: Member = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Get matchmaking for a schedule. Non-admin only sees CONFIRMED."""
    query = select(Matchmaking).where(Matchmaking.schedule_id == schedule_id)
    if not member.is_admin:
        query = query.where(Matchmaking.status == MatchmakingStatus.CONFIRMED)
    query = query.order_by(Matchmaking.created_at.desc())

    result = await db.execute(query)
    mm = result.scalar_one_or_none()
    if not mm:
        raise HTTPException(404, "No matchmaking found")

    # Build name lookup
    members_result = await db.execute(select(Member))
    member_names = {str(m.id): m.name for m in members_result.scalars().all()}
    guests_result = await db.execute(
        select(Guest).where(Guest.schedule_id == schedule_id)
    )
    guest_names = {str(g.id): g.name for g in guests_result.scalars().all()}
    name_lookup = {**member_names, **guest_names}

    # Load rounds and games
    rounds_result = await db.execute(
        select(MatchRound)
        .where(MatchRound.matchmaking_id == mm.id)
        .order_by(MatchRound.round_number)
    )
    rounds_out: list[RoundOut] = []
    for rnd in rounds_result.scalars().all():
        games_result = await db.execute(
            select(Game).where(Game.round_id == rnd.id).order_by(Game.court)
        )
        games_out: list[GameOut] = []
        for game in games_result.scalars().all():
            games_out.append(GameOut(
                id=str(game.id),
                court=game.court,
                team_a_player1_id=str(game.team_a_player1_id),
                team_a_player2_id=str(game.team_a_player2_id),
                team_b_player1_id=str(game.team_b_player1_id),
                team_b_player2_id=str(game.team_b_player2_id),
                team_a_player1_type=game.team_a_player1_type.value,
                team_a_player2_type=game.team_a_player2_type.value,
                team_b_player1_type=game.team_b_player1_type.value,
                team_b_player2_type=game.team_b_player2_type.value,
                team_a_player1_name=name_lookup.get(str(game.team_a_player1_id), "?"),
                team_a_player2_name=name_lookup.get(str(game.team_a_player2_id), "?"),
                team_b_player1_name=name_lookup.get(str(game.team_b_player1_id), "?"),
                team_b_player2_name=name_lookup.get(str(game.team_b_player2_id), "?"),
                score_a=game.score_a,
                score_b=game.score_b,
            ))
        rounds_out.append(RoundOut(round_number=rnd.round_number, games=games_out))

    constraint_list = None
    if mm.constraints:
        constraint_list = [ConstraintIn(**c) for c in mm.constraints]

    return MatchmakingOut(
        id=str(mm.id),
        schedule_id=str(schedule_id),
        status=mm.status.value,
        constraints=constraint_list,
        rounds=rounds_out,
    )


@router.put("/{schedule_id}/matches/swap")
async def swap_players(
    schedule_id: uuid.UUID,
    body: SwapIn,
    admin: Member = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Swap two players in the matchmaking (admin manual adjustment)."""
    game_a_result = await db.execute(
        select(Game).where(Game.id == uuid.UUID(body.game_id))
    )
    game_a = game_a_result.scalar_one_or_none()
    if not game_a:
        raise HTTPException(404, "Game not found")

    game_b = game_a
    if body.game_id_b and body.game_id_b != body.game_id:
        game_b_result = await db.execute(
            select(Game).where(Game.id == uuid.UUID(body.game_id_b))
        )
        game_b = game_b_result.scalar_one_or_none()
        if not game_b:
            raise HTTPException(404, "Second game not found")

    # Get player IDs and types from positions
    val_a_id = getattr(game_a, f"{body.position_a}_id")
    val_a_type = getattr(game_a, f"{body.position_a}_type")
    val_b_id = getattr(game_b, f"{body.position_b}_id")
    val_b_type = getattr(game_b, f"{body.position_b}_type")

    # Swap
    setattr(game_a, f"{body.position_a}_id", val_b_id)
    setattr(game_a, f"{body.position_a}_type", val_b_type)
    setattr(game_b, f"{body.position_b}_id", val_a_id)
    setattr(game_b, f"{body.position_b}_type", val_a_type)

    db.add(game_a)
    if game_b is not game_a:
        db.add(game_b)
    await db.commit()

    return {"status": "swapped"}
