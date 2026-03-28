"""Matchmaking algorithm — brute-force round-by-round with constraints.

Given ≤12 players and 2 courts, generates optimal match assignments
per round using exhaustive search over all possible configurations.
"""
from dataclasses import dataclass, field
from itertools import combinations
from typing import Literal

from app.models.guest import GuestSkill


GUEST_NTRP_MAP = {
    GuestSkill.BEGINNER: 2.0,
    GuestSkill.INTERMEDIATE: 3.0,
    GuestSkill.ADVANCED: 4.0,
}


@dataclass
class Player:
    id: str
    name: str
    gender: str  # "M" or "F"
    ntrp: float
    player_type: str  # "MEMBER" or "GUEST"
    available_rounds: set[int] = field(default_factory=set)


@dataclass
class Constraint:
    type: str  # pair_exclude, pair_prefer, opponent_exclude, round_skip, round_start
    member_ids: list[str]
    round: int | None = None


@dataclass
class GameAssignment:
    court: str
    team_a: tuple[Player, Player]
    team_b: tuple[Player, Player]


@dataclass
class RoundAssignment:
    round_number: int
    games: list[GameAssignment]
    resting: list[Player]


@dataclass
class MatchmakingResult:
    rounds: list[RoundAssignment]
    warnings: list[str]


def generate_matchmaking(
    players: list[Player],
    court_count: int,
    round_count: int,
    constraints: list[Constraint] | None = None,
) -> MatchmakingResult:
    """Generate match assignments for all rounds."""
    constraints = constraints or []
    warnings: list[str] = []

    # Apply round_skip and round_start constraints to player availability
    for player in players:
        player.available_rounds = set(range(1, round_count + 1))

    for c in constraints:
        if c.type == "round_skip" and c.round is not None:
            for pid in c.member_ids:
                p = _find_player(players, pid)
                if p:
                    p.available_rounds.discard(c.round)
        elif c.type == "round_start" and c.round is not None:
            for pid in c.member_ids:
                p = _find_player(players, pid)
                if p:
                    p.available_rounds = {r for r in p.available_rounds if r >= c.round}

    # Track game counts and partner/opponent history
    game_counts: dict[str, int] = {p.id: 0 for p in players}
    partner_history: set[frozenset[str]] = set()
    opponent_history: set[frozenset[str]] = set()

    players_per_game = 4
    players_per_round = court_count * players_per_game

    rounds: list[RoundAssignment] = []

    for round_num in range(1, round_count + 1):
        # Filter available players for this round
        available = [p for p in players if round_num in p.available_rounds]

        if len(available) < players_per_game:
            warnings.append(f"Round {round_num}: 가용 인원 부족 ({len(available)}명)")
            rounds.append(RoundAssignment(round_number=round_num, games=[], resting=available))
            continue

        # Select players: prioritize those with fewer games
        n_playing = min(len(available), players_per_round)
        # Ensure n_playing is multiple of 4
        n_playing = (n_playing // 4) * 4
        if n_playing == 0:
            rounds.append(RoundAssignment(round_number=round_num, games=[], resting=available))
            continue

        # Sort by game count (ascending) to balance
        available.sort(key=lambda p: game_counts[p.id])
        playing = available[:n_playing]
        resting = available[n_playing:]

        # Find best assignment for this round
        best_assignment = _find_best_assignment(
            playing, court_count, constraints, partner_history, opponent_history
        )

        # Update tracking
        for game in best_assignment:
            for p in (*game.team_a, *game.team_b):
                game_counts[p.id] += 1
            partner_history.add(frozenset([game.team_a[0].id, game.team_a[1].id]))
            partner_history.add(frozenset([game.team_b[0].id, game.team_b[1].id]))
            for pa in game.team_a:
                for pb in game.team_b:
                    opponent_history.add(frozenset([pa.id, pb.id]))

        rounds.append(RoundAssignment(
            round_number=round_num,
            games=best_assignment,
            resting=resting,
        ))

    # Check game count balance
    if game_counts:
        min_games = min(game_counts.values())
        max_games = max(game_counts.values())
        if max_games - min_games > 1:
            behind = [
                _find_player(players, pid).name
                for pid, cnt in game_counts.items()
                if cnt < max_games and _find_player(players, pid)
            ]
            if behind:
                warnings.append(f"{', '.join(behind)}이(가) {max_games - min_games}게임 적음")

    return MatchmakingResult(rounds=rounds, warnings=warnings)


def _find_player(players: list[Player], pid: str) -> Player | None:
    for p in players:
        if p.id == pid:
            return p
    return None


def _find_best_assignment(
    playing: list[Player],
    court_count: int,
    constraints: list[Constraint],
    partner_history: set[frozenset[str]],
    opponent_history: set[frozenset[str]],
) -> list[GameAssignment]:
    """Find the best match assignment for a set of players across courts."""
    court_labels = [chr(ord("A") + i) for i in range(court_count)]
    n = len(playing)
    actual_courts = min(court_count, n // 4)

    if actual_courts == 0:
        return []

    best_score = float("-inf")
    best_assignment: list[GameAssignment] = []

    # For 8 players on 2 courts: pick 4 for court A, remaining 4 for court B
    # For each court group: try all possible team splits
    if actual_courts == 1:
        # Single court: all players in one game
        group = playing[:4]
        best_game = _best_game_for_group(
            group, court_labels[0], constraints, partner_history, opponent_history
        )
        return [best_game] if best_game else []

    # Multiple courts: partition players into groups of 4
    # Generate all ways to pick 4 players for first court
    indices = list(range(n))
    for court_a_indices in combinations(indices, 4):
        court_a_set = set(court_a_indices)
        remaining = [i for i in indices if i not in court_a_set]

        if actual_courts == 2 and len(remaining) >= 4:
            court_b_indices = remaining[:4]
            groups = [
                [playing[i] for i in court_a_indices],
                [playing[i] for i in court_b_indices],
            ]
        else:
            groups = [[playing[i] for i in court_a_indices]]

        # For each group, find best team split
        assignment = []
        total_score = 0
        valid = True
        for ci, group in enumerate(groups):
            game = _best_game_for_group(
                group, court_labels[ci], constraints, partner_history, opponent_history
            )
            if game is None:
                valid = False
                break
            assignment.append(game)
            total_score += _score_game(
                game, constraints, partner_history, opponent_history
            )

        if valid and total_score > best_score:
            best_score = total_score
            best_assignment = assignment

    return best_assignment


def _best_game_for_group(
    group: list[Player],
    court: str,
    constraints: list[Constraint],
    partner_history: set[frozenset[str]],
    opponent_history: set[frozenset[str]],
) -> GameAssignment | None:
    """Find the best team split for a group of 4 players."""
    # 3 ways to split 4 players into 2 teams of 2
    indices = [0, 1, 2, 3]
    splits = [
        ((0, 1), (2, 3)),
        ((0, 2), (1, 3)),
        ((0, 3), (1, 2)),
    ]

    best_score = float("-inf")
    best_game: GameAssignment | None = None

    for (a1, a2), (b1, b2) in splits:
        game = GameAssignment(
            court=court,
            team_a=(group[a1], group[a2]),
            team_b=(group[b1], group[b2]),
        )

        # Check hard constraints
        if _violates_hard_constraints(game, constraints):
            continue

        score = _score_game(game, constraints, partner_history, opponent_history)
        if score > best_score:
            best_score = score
            best_game = game

    return best_game


def _violates_hard_constraints(game: GameAssignment, constraints: list[Constraint]) -> bool:
    """Check if a game assignment violates any hard constraints."""
    for c in constraints:
        if c.type == "pair_exclude":
            pair = frozenset(c.member_ids)
            team_a_pair = frozenset([game.team_a[0].id, game.team_a[1].id])
            team_b_pair = frozenset([game.team_b[0].id, game.team_b[1].id])
            if pair == team_a_pair or pair == team_b_pair:
                return True
        elif c.type == "opponent_exclude":
            ids = set(c.member_ids)
            a_ids = {game.team_a[0].id, game.team_a[1].id}
            b_ids = {game.team_b[0].id, game.team_b[1].id}
            # Both players in different teams = they're opponents
            if len(ids & a_ids) > 0 and len(ids & b_ids) > 0:
                return True
    return False


def _score_game(
    game: GameAssignment,
    constraints: list[Constraint],
    partner_history: set[frozenset[str]],
    opponent_history: set[frozenset[str]],
) -> float:
    """Score a game assignment based on soft constraints. Higher = better."""
    score = 0.0

    # 1. NTRP balance: minimize difference between team totals
    ntrp_a = game.team_a[0].ntrp + game.team_a[1].ntrp
    ntrp_b = game.team_b[0].ntrp + game.team_b[1].ntrp
    score -= abs(ntrp_a - ntrp_b) * 10  # Weight: 10

    # 2. Partner diversity: penalize repeated partners
    for team in [game.team_a, game.team_b]:
        pair = frozenset([team[0].id, team[1].id])
        if pair in partner_history:
            score -= 20  # Weight: 20

    # 3. Opponent diversity: penalize repeated opponents
    for pa in game.team_a:
        for pb in game.team_b:
            pair = frozenset([pa.id, pb.id])
            if pair in opponent_history:
                score -= 5  # Weight: 5

    # 4. Mixed doubles preference: male+female pair preferred
    for team in [game.team_a, game.team_b]:
        if team[0].gender != team[1].gender:
            score += 8  # Weight: 8

    # 5. pair_prefer soft constraint
    for c in constraints:
        if c.type == "pair_prefer":
            pair = frozenset(c.member_ids)
            team_a_pair = frozenset([game.team_a[0].id, game.team_a[1].id])
            team_b_pair = frozenset([game.team_b[0].id, game.team_b[1].id])
            if pair == team_a_pair or pair == team_b_pair:
                score += 15  # Weight: 15

    return score
