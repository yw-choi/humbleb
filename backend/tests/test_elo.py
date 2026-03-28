"""Tests for ELO rating calculations."""
from app.services.elo import compute_rating_changes, expected_score


class TestExpectedScore:
    def test_equal_ratings(self):
        assert expected_score(1500, 1500) == 0.5

    def test_higher_rating_favored(self):
        assert expected_score(1600, 1400) > 0.5

    def test_lower_rating_disadvantaged(self):
        assert expected_score(1400, 1600) < 0.5

    def test_symmetric(self):
        e1 = expected_score(1500, 1600)
        e2 = expected_score(1600, 1500)
        assert abs(e1 + e2 - 1.0) < 1e-10


class TestComputeRatingChanges:
    def test_equal_teams_winner_gains(self):
        """Equal teams, team A wins → A gains, B loses."""
        a1, a2, b1, b2 = compute_rating_changes(
            (1500, 1500), (1500, 1500), score_a=6, score_b=4
        )
        assert a1 > 1500
        assert a2 > 1500
        assert b1 < 1500
        assert b2 < 1500

    def test_equal_teams_symmetric_change(self):
        """Changes should be symmetric for equal teams."""
        a1, a2, b1, b2 = compute_rating_changes(
            (1500, 1500), (1500, 1500), score_a=6, score_b=4
        )
        assert abs((a1 - 1500) + (b1 - 1500)) < 1e-10

    def test_draw_no_change(self):
        """Draw with equal teams → no change."""
        a1, a2, b1, b2 = compute_rating_changes(
            (1500, 1500), (1500, 1500), score_a=5, score_b=5
        )
        assert abs(a1 - 1500) < 1e-10
        assert abs(b1 - 1500) < 1e-10

    def test_upset_larger_change(self):
        """Weaker team winning = larger rating change."""
        # Weak team wins
        a1_u, a2_u, b1_u, b2_u = compute_rating_changes(
            (1400, 1400), (1600, 1600), score_a=6, score_b=4
        )
        # Strong team wins (expected outcome)
        a1_e, a2_e, b1_e, b2_e = compute_rating_changes(
            (1600, 1600), (1400, 1400), score_a=6, score_b=4
        )
        # Upset should produce larger gain
        assert (a1_u - 1400) > (a1_e - 1600)

    def test_loser_loses(self):
        a1, a2, b1, b2 = compute_rating_changes(
            (1500, 1500), (1500, 1500), score_a=3, score_b=6
        )
        assert a1 < 1500
        assert b1 > 1500
