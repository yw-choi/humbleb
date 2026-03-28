"""Extended ELO tests: K-factor, team averaging, delta direction."""
from app.services.elo import K_FACTOR, compute_rating_changes, expected_score


class TestKFactor:
    def test_k_factor_is_16(self):
        assert K_FACTOR == 16


class TestTeamRatingAverage:
    def test_mixed_team_uses_average(self):
        """Team of (1400, 1600) should behave like a 1500-rated team."""
        a1, a2, b1, b2 = compute_rating_changes(
            (1400, 1600), (1500, 1500), score_a=6, score_b=4
        )
        # Average ratings are equal (1500 vs 1500), so expected = 0.5
        # Winner gains K * (1 - 0.5) = 8
        assert abs((a1 - 1400) - 8.0) < 1e-10
        assert abs((a2 - 1600) - 8.0) < 1e-10

    def test_asymmetric_team(self):
        """Both players on a team get the same delta."""
        a1, a2, b1, b2 = compute_rating_changes(
            (1300, 1700), (1500, 1500), score_a=6, score_b=4
        )
        delta_a1 = a1 - 1300
        delta_a2 = a2 - 1700
        assert abs(delta_a1 - delta_a2) < 1e-10


class TestDeltaDirection:
    def test_equal_rated_winner_gets_positive_delta(self):
        a1, a2, b1, b2 = compute_rating_changes(
            (1500, 1500), (1500, 1500), score_a=6, score_b=4
        )
        assert a1 > 1500
        assert a2 > 1500

    def test_higher_rated_wins_smaller_delta(self):
        """Favored team winning produces smaller gain than upset."""
        a1_fav, _, _, _ = compute_rating_changes(
            (1600, 1600), (1400, 1400), score_a=6, score_b=4
        )
        a1_ups, _, _, _ = compute_rating_changes(
            (1400, 1400), (1600, 1600), score_a=6, score_b=4
        )
        gain_favored = a1_fav - 1600
        gain_upset = a1_ups - 1400
        assert gain_upset > gain_favored

    def test_lower_rated_wins_larger_delta(self):
        """Upset produces delta > K/2."""
        a1, _, _, _ = compute_rating_changes(
            (1400, 1400), (1600, 1600), score_a=6, score_b=4
        )
        delta = a1 - 1400
        assert delta > K_FACTOR / 2

    def test_exact_delta_equal_teams(self):
        """Equal teams: delta = K * (1 - 0.5) = 8 for a win."""
        a1, _, _, _ = compute_rating_changes(
            (1500, 1500), (1500, 1500), score_a=6, score_b=4
        )
        assert abs((a1 - 1500) - 8.0) < 1e-10

    def test_loss_delta_equal_teams(self):
        """Equal teams: loser delta = K * (0 - 0.5) = -8."""
        _, _, b1, _ = compute_rating_changes(
            (1500, 1500), (1500, 1500), score_a=6, score_b=4
        )
        assert abs((b1 - 1500) - (-8.0)) < 1e-10
