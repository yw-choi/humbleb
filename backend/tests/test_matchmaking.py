"""Tests for the matchmaking algorithm."""
import pytest

from app.services.matchmaking import (
    Constraint,
    Player,
    generate_matchmaking,
)


def make_players(n: int) -> list[Player]:
    """Create n test players with alternating genders and varied NTRP."""
    players = []
    for i in range(n):
        players.append(Player(
            id=f"p{i}",
            name=f"Player{i}",
            gender="M" if i % 2 == 0 else "F",
            ntrp=2.0 + (i % 5) * 0.5,
            player_type="MEMBER",
        ))
    return players


class TestBasicMatchmaking:
    def test_4_players_1_court_1_round(self):
        players = make_players(4)
        result = generate_matchmaking(players, court_count=1, round_count=1)
        assert len(result.rounds) == 1
        assert len(result.rounds[0].games) == 1
        game = result.rounds[0].games[0]
        assert game.court == "A"
        all_ids = {
            game.team_a[0].id, game.team_a[1].id,
            game.team_b[0].id, game.team_b[1].id,
        }
        assert len(all_ids) == 4

    def test_8_players_2_courts(self):
        players = make_players(8)
        result = generate_matchmaking(players, court_count=2, round_count=1)
        assert len(result.rounds) == 1
        assert len(result.rounds[0].games) == 2
        courts = {g.court for g in result.rounds[0].games}
        assert courts == {"A", "B"}

    def test_12_players_2_courts_multiple_rounds(self):
        players = make_players(12)
        result = generate_matchmaking(players, court_count=2, round_count=5)
        assert len(result.rounds) == 5
        for rnd in result.rounds:
            assert len(rnd.games) == 2
            # 8 players play, 4 rest
            playing_ids = set()
            for game in rnd.games:
                playing_ids.update([
                    game.team_a[0].id, game.team_a[1].id,
                    game.team_b[0].id, game.team_b[1].id,
                ])
            assert len(playing_ids) == 8
            assert len(rnd.resting) == 4

    def test_insufficient_players(self):
        players = make_players(3)
        result = generate_matchmaking(players, court_count=2, round_count=1)
        assert len(result.warnings) > 0
        assert len(result.rounds[0].games) == 0


class TestConstraints:
    def test_pair_exclude(self):
        players = make_players(4)
        constraints = [Constraint(type="pair_exclude", member_ids=["p0", "p1"])]
        result = generate_matchmaking(players, court_count=1, round_count=1, constraints=constraints)
        game = result.rounds[0].games[0]
        team_a_ids = frozenset([game.team_a[0].id, game.team_a[1].id])
        team_b_ids = frozenset([game.team_b[0].id, game.team_b[1].id])
        excluded_pair = frozenset(["p0", "p1"])
        assert team_a_ids != excluded_pair
        assert team_b_ids != excluded_pair

    def test_round_skip(self):
        players = make_players(8)
        constraints = [Constraint(type="round_skip", member_ids=["p0"], round=1)]
        result = generate_matchmaking(players, court_count=2, round_count=2, constraints=constraints)
        # p0 should not play in round 1
        round_1 = result.rounds[0]
        playing_ids = set()
        for game in round_1.games:
            playing_ids.update([
                game.team_a[0].id, game.team_a[1].id,
                game.team_b[0].id, game.team_b[1].id,
            ])
        assert "p0" not in playing_ids

    def test_round_start(self):
        players = make_players(8)
        constraints = [Constraint(type="round_start", member_ids=["p0"], round=3)]
        result = generate_matchmaking(players, court_count=2, round_count=4, constraints=constraints)
        # p0 should not play in rounds 1-2
        for rnd in result.rounds[:2]:
            playing_ids = set()
            for game in rnd.games:
                playing_ids.update([
                    game.team_a[0].id, game.team_a[1].id,
                    game.team_b[0].id, game.team_b[1].id,
                ])
            assert "p0" not in playing_ids


class TestSoftConstraints:
    def test_mixed_doubles_preference(self):
        """With equal NTRP, mixed doubles should be preferred."""
        players = [
            Player(id="m1", name="M1", gender="M", ntrp=3.0, player_type="MEMBER"),
            Player(id="f1", name="F1", gender="F", ntrp=3.0, player_type="MEMBER"),
            Player(id="m2", name="M2", gender="M", ntrp=3.0, player_type="MEMBER"),
            Player(id="f2", name="F2", gender="F", ntrp=3.0, player_type="MEMBER"),
        ]
        result = generate_matchmaking(players, court_count=1, round_count=1)
        game = result.rounds[0].games[0]
        # Both teams should be mixed
        for team in [game.team_a, game.team_b]:
            genders = {team[0].gender, team[1].gender}
            assert genders == {"M", "F"}

    def test_ntrp_balance(self):
        """Teams should have roughly equal NTRP sums."""
        players = [
            Player(id="p1", name="P1", gender="M", ntrp=5.0, player_type="MEMBER"),
            Player(id="p2", name="P2", gender="F", ntrp=2.0, player_type="MEMBER"),
            Player(id="p3", name="P3", gender="M", ntrp=4.0, player_type="MEMBER"),
            Player(id="p4", name="P4", gender="F", ntrp=3.0, player_type="MEMBER"),
        ]
        result = generate_matchmaking(players, court_count=1, round_count=1)
        game = result.rounds[0].games[0]
        ntrp_a = game.team_a[0].ntrp + game.team_a[1].ntrp
        ntrp_b = game.team_b[0].ntrp + game.team_b[1].ntrp
        assert abs(ntrp_a - ntrp_b) <= 1.0  # Should be well balanced
