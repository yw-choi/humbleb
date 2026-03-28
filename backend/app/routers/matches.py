"""Matchmaking and match endpoints."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_jwt, get_current_member, require_admin
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

from app.services.elo import compute_rating_changes

router = APIRouter(tags=["matches"])


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


@router.post("/schedules/{schedule_id}/matchmaking", response_model=MatchmakingOut)
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


@router.post("/schedules/{schedule_id}/matches/confirm")
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
    mm.confirmed_at = datetime.now(timezone.utc)
    db.add(mm)
    await db.commit()
    return {"status": "confirmed"}


@router.get("/schedules/{schedule_id}/matches", response_model=MatchmakingOut)
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

    # Load rounds and games first to collect player IDs
    rounds_result = await db.execute(
        select(MatchRound)
        .where(MatchRound.matchmaking_id == mm.id)
        .order_by(MatchRound.round_number)
    )
    all_rounds = list(rounds_result.scalars().all())
    all_games_by_round: dict[uuid.UUID, list[Game]] = {}
    player_ids: set[uuid.UUID] = set()
    for rnd in all_rounds:
        games_result = await db.execute(
            select(Game).where(Game.round_id == rnd.id).order_by(Game.court)
        )
        games = list(games_result.scalars().all())
        all_games_by_round[rnd.id] = games
        for game in games:
            player_ids.update([
                game.team_a_player1_id, game.team_a_player2_id,
                game.team_b_player1_id, game.team_b_player2_id,
            ])

    # Build name lookup filtered to relevant members
    if player_ids:
        members_result = await db.execute(
            select(Member).where(Member.id.in_(player_ids))
        )
        member_names = {str(m.id): m.name for m in members_result.scalars().all()}
    else:
        member_names = {}
    guests_result = await db.execute(
        select(Guest).where(Guest.schedule_id == schedule_id)
    )
    guest_names = {str(g.id): g.name for g in guests_result.scalars().all()}
    name_lookup = {**member_names, **guest_names}

    rounds_out: list[RoundOut] = []
    for rnd in all_rounds:
        games_out: list[GameOut] = []
        for game in all_games_by_round[rnd.id]:
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


@router.put("/schedules/{schedule_id}/matches/swap")
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

    # Validate positions
    VALID_POSITIONS = {"team_a_player1", "team_a_player2", "team_b_player1", "team_b_player2"}
    if body.position_a not in VALID_POSITIONS or body.position_b not in VALID_POSITIONS:
        raise HTTPException(400, "Invalid position")

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


# --- Game Results ---

class ScoreIn(BaseModel):
    score_a: int
    score_b: int


@router.put("/games/{game_id}/result", response_model=GameOut)
async def submit_result(
    game_id: uuid.UUID,
    body: ScoreIn,
    member: Member = Depends(get_current_member),
    db: AsyncSession = Depends(get_db),
):
    """Submit or update game score. Allowed for participants and admins."""
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Game not found")

    # Check authorization: admin or one of the 4 participants
    player_ids = {
        str(game.team_a_player1_id),
        str(game.team_a_player2_id),
        str(game.team_b_player1_id),
        str(game.team_b_player2_id),
    }
    if not member.is_admin and str(member.id) not in player_ids:
        raise HTTPException(403, "Only participants or admin can submit scores")

    had_score = game.score_a is not None
    if had_score:
        raise HTTPException(409, "Score already submitted. Cannot resubmit.")

    game.score_a = body.score_a
    game.score_b = body.score_b
    game.submitted_by = member.id
    db.add(game)

    # Update ELO ratings for MEMBER players (not guests)
    async def get_member_rating(player_id: uuid.UUID, player_type: str) -> float | None:
        if player_type != "MEMBER":
            return None
        r = await db.execute(select(Member).where(Member.id == player_id))
        m = r.scalar_one_or_none()
        return m.internal_rating if m else None

    # Collect ratings
    types = {
        "a1": (game.team_a_player1_id, game.team_a_player1_type.value),
        "a2": (game.team_a_player2_id, game.team_a_player2_type.value),
        "b1": (game.team_b_player1_id, game.team_b_player1_type.value),
        "b2": (game.team_b_player2_id, game.team_b_player2_type.value),
    }

    ratings: dict[str, float] = {}
    member_objs: dict[str, Member] = {}
    for key, (pid, ptype) in types.items():
        if ptype == "MEMBER":
            r = await db.execute(select(Member).where(Member.id == pid))
            m = r.scalar_one_or_none()
            if m:
                ratings[key] = m.internal_rating
                member_objs[key] = m
            else:
                ratings[key] = 1500.0
        else:
            ratings[key] = 1500.0  # Guests don't affect rating

    # Compute new ratings
    new_a1, new_a2, new_b1, new_b2 = compute_rating_changes(
        (ratings["a1"], ratings["a2"]),
        (ratings["b1"], ratings["b2"]),
        body.score_a,
        body.score_b,
    )

    # Update member ratings
    for key, new_rating in [("a1", new_a1), ("a2", new_a2), ("b1", new_b1), ("b2", new_b2)]:
        if key in member_objs:
            member_objs[key].internal_rating = round(new_rating, 1)
            db.add(member_objs[key])

    await db.commit()

    # Build name lookup for response (only relevant players)
    game_player_ids = [
        game.team_a_player1_id, game.team_a_player2_id,
        game.team_b_player1_id, game.team_b_player2_id,
    ]
    members_result = await db.execute(
        select(Member).where(Member.id.in_(game_player_ids))
    )
    name_lookup = {str(m.id): m.name for m in members_result.scalars().all()}
    # Get schedule_id from round → matchmaking
    round_result = await db.execute(select(MatchRound).where(MatchRound.id == game.round_id))
    rnd = round_result.scalar_one()
    mm_result = await db.execute(select(Matchmaking).where(Matchmaking.id == rnd.matchmaking_id))
    mm = mm_result.scalar_one()
    guests_result = await db.execute(select(Guest).where(Guest.schedule_id == mm.schedule_id))
    for g in guests_result.scalars().all():
        name_lookup[str(g.id)] = g.name

    return GameOut(
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
    )


@router.get("/schedules/{schedule_id}/matches/image")
async def get_match_image(
    schedule_id: uuid.UUID,
    token: str = Query(default=None),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """Generate a PNG image of the matchmaking for sharing."""
    from app.services.match_image import GameInfo, RoundInfo, generate_match_image

    # Authenticate: try Bearer header first, fall back to query param
    auth_header = request.headers.get("Authorization", "")
    jwt_token = None
    if auth_header.startswith("Bearer "):
        jwt_token = auth_header[7:]
    elif token:
        jwt_token = token

    if not jwt_token:
        raise HTTPException(401, "Not authenticated")

    payload = decode_jwt(jwt_token)
    kakao_id = payload.get("kakao_id")
    if not kakao_id:
        raise HTTPException(401, "Invalid token")

    member_result = await db.execute(select(Member).where(Member.kakao_id == kakao_id))
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(403, "Member not linked")

    # Get schedule info
    sched_result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = sched_result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    # Get matchmaking (prefer CONFIRMED)
    query = select(Matchmaking).where(Matchmaking.schedule_id == schedule_id)
    if not member.is_admin:
        query = query.where(Matchmaking.status == MatchmakingStatus.CONFIRMED)
    query = query.order_by(Matchmaking.created_at.desc())
    result = await db.execute(query)
    mm = result.scalar_one_or_none()
    if not mm:
        raise HTTPException(404, "No matchmaking found")

    # Load rounds and collect player IDs
    rounds_result = await db.execute(
        select(MatchRound).where(MatchRound.matchmaking_id == mm.id).order_by(MatchRound.round_number)
    )
    all_rounds = list(rounds_result.scalars().all())
    all_games_by_round: dict[uuid.UUID, list[Game]] = {}
    img_player_ids: set[uuid.UUID] = set()
    for rnd in all_rounds:
        games_result = await db.execute(
            select(Game).where(Game.round_id == rnd.id).order_by(Game.court)
        )
        games = list(games_result.scalars().all())
        all_games_by_round[rnd.id] = games
        for game in games:
            img_player_ids.update([
                game.team_a_player1_id, game.team_a_player2_id,
                game.team_b_player1_id, game.team_b_player2_id,
            ])

    # Build name lookup filtered to relevant members
    if img_player_ids:
        members_result = await db.execute(
            select(Member).where(Member.id.in_(img_player_ids))
        )
        name_lookup = {str(m.id): m.name for m in members_result.scalars().all()}
    else:
        name_lookup = {}
    guests_result = await db.execute(select(Guest).where(Guest.schedule_id == schedule_id))
    for g in guests_result.scalars().all():
        name_lookup[str(g.id)] = g.name

    rounds_info: list[RoundInfo] = []
    for rnd in all_rounds:
        games_info: list[GameInfo] = []
        for game in all_games_by_round[rnd.id]:
            games_info.append(GameInfo(
                court=game.court,
                team_a=(
                    name_lookup.get(str(game.team_a_player1_id), "?"),
                    name_lookup.get(str(game.team_a_player2_id), "?"),
                ),
                team_b=(
                    name_lookup.get(str(game.team_b_player1_id), "?"),
                    name_lookup.get(str(game.team_b_player2_id), "?"),
                ),
                score_a=game.score_a,
                score_b=game.score_b,
            ))
        rounds_info.append(RoundInfo(round_number=rnd.round_number, games=games_info))

    weekday_names = ["월", "화", "수", "목", "금", "토", "일"]
    wd = weekday_names[schedule.date.weekday()]
    title = f"HumbleB 대진표"
    subtitle = f"{schedule.date.month}/{schedule.date.day} ({wd}) {schedule.start_time.strftime('%H:%M')}~{schedule.end_time.strftime('%H:%M')} {schedule.venue}"

    image_bytes = generate_match_image(title, subtitle, rounds_info)
    return Response(content=image_bytes, media_type="image/png")
