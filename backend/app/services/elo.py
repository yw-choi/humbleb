"""ELO rating system for doubles tennis.

Each player on the winning team gains points, each on the losing team loses points.
Draw: no rating change.
K-factor is low (16) since these are casual club matches.
"""

K_FACTOR = 16


def expected_score(rating_a: float, rating_b: float) -> float:
    """Expected score for player A against player B."""
    return 1.0 / (1.0 + 10.0 ** ((rating_b - rating_a) / 400.0))


def compute_rating_changes(
    team_a_ratings: tuple[float, float],
    team_b_ratings: tuple[float, float],
    score_a: int,
    score_b: int,
) -> tuple[float, float, float, float]:
    """Compute new ratings for all 4 players after a match.

    Returns (new_a1, new_a2, new_b1, new_b2).
    """
    avg_a = (team_a_ratings[0] + team_a_ratings[1]) / 2
    avg_b = (team_b_ratings[0] + team_b_ratings[1]) / 2

    expected_a = expected_score(avg_a, avg_b)

    if score_a > score_b:
        actual_a = 1.0
    elif score_a < score_b:
        actual_a = 0.0
    else:
        actual_a = 0.5

    delta = K_FACTOR * (actual_a - expected_a)

    return (
        team_a_ratings[0] + delta,
        team_a_ratings[1] + delta,
        team_b_ratings[0] - delta,
        team_b_ratings[1] - delta,
    )
