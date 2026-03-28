"""Generate a shareable matchmaking image for KakaoTalk."""
import io
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFont


@dataclass
class GameInfo:
    court: str
    team_a: tuple[str, str]  # (player1_name, player2_name)
    team_b: tuple[str, str]
    score_a: int | None = None
    score_b: int | None = None


@dataclass
class RoundInfo:
    round_number: int
    games: list[GameInfo]


def generate_match_image(
    title: str,
    subtitle: str,
    rounds: list[RoundInfo],
) -> bytes:
    """Generate a PNG image of the match schedule."""
    # Layout constants
    WIDTH = 800
    PADDING = 40
    ROUND_HEADER_H = 36
    GAME_H = 56
    GAME_GAP = 8
    ROUND_GAP = 24
    HEADER_H = 80

    # Calculate height
    content_h = HEADER_H
    for rnd in rounds:
        content_h += ROUND_HEADER_H + len(rnd.games) * (GAME_H + GAME_GAP) + ROUND_GAP
    HEIGHT = content_h + PADDING * 2

    # Colors (dark theme)
    BG = (26, 26, 30)
    CARD_BG = (44, 44, 46)
    TEXT_WHITE = (237, 237, 237)
    TEXT_MUTED = (161, 161, 161)
    ACCENT = (59, 130, 246)  # blue-600

    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)

    # Use default font (PIL built-in)
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc", 24)
        font_medium = ImageFont.truetype("/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc", 18)
        font_small = ImageFont.truetype("/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc", 14)
    except (OSError, IOError):
        try:
            font_large = ImageFont.truetype("/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc", 24)
            font_medium = ImageFont.truetype("/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc", 18)
            font_small = ImageFont.truetype("/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc", 14)
        except (OSError, IOError):
            font_large = ImageFont.load_default()
            font_medium = ImageFont.load_default()
            font_small = ImageFont.load_default()

    y = PADDING

    # Header
    draw.text((PADDING, y), title, fill=TEXT_WHITE, font=font_large)
    y += 32
    draw.text((PADDING, y), subtitle, fill=TEXT_MUTED, font=font_small)
    y += HEADER_H - 32

    # Rounds
    for rnd in rounds:
        # Round header
        draw.text(
            (PADDING, y),
            f"Round {rnd.round_number}",
            fill=ACCENT,
            font=font_medium,
        )
        y += ROUND_HEADER_H

        for game in rnd.games:
            # Game card background
            card_x = PADDING
            card_w = WIDTH - PADDING * 2
            draw.rounded_rectangle(
                [(card_x, y), (card_x + card_w, y + GAME_H)],
                radius=8,
                fill=CARD_BG,
            )

            # Court label
            draw.text(
                (card_x + 12, y + 4),
                f"Court {game.court}",
                fill=TEXT_MUTED,
                font=font_small,
            )

            # Team A names
            team_a_text = f"{game.team_a[0]} · {game.team_a[1]}"
            draw.text(
                (card_x + 12, y + 26),
                team_a_text,
                fill=TEXT_WHITE,
                font=font_medium,
            )

            # Score or "vs"
            mid_x = card_x + card_w // 2
            if game.score_a is not None and game.score_b is not None:
                score_text = f"{game.score_a} : {game.score_b}"
            else:
                score_text = "vs"
            bbox = draw.textbbox((0, 0), score_text, font=font_medium)
            tw = bbox[2] - bbox[0]
            draw.text(
                (mid_x - tw // 2, y + 26),
                score_text,
                fill=TEXT_MUTED,
                font=font_medium,
            )

            # Team B names (right-aligned)
            team_b_text = f"{game.team_b[0]} · {game.team_b[1]}"
            bbox_b = draw.textbbox((0, 0), team_b_text, font=font_medium)
            tw_b = bbox_b[2] - bbox_b[0]
            draw.text(
                (card_x + card_w - 12 - tw_b, y + 26),
                team_b_text,
                fill=TEXT_WHITE,
                font=font_medium,
            )

            y += GAME_H + GAME_GAP

        y += ROUND_GAP

    # Footer
    draw.text(
        (PADDING, HEIGHT - PADDING),
        "HumbleB Tennis Club",
        fill=TEXT_MUTED,
        font=font_small,
    )

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
