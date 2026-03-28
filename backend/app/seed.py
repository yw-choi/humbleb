"""Seed 30 members into the database."""
import asyncio

from sqlalchemy import select

from app.database import async_session
from app.models.member import Gender, Member

# Placeholder seed data — replace with actual club members after migration from existing DB
MEMBERS = [
    # (name, gender, ntrp, is_admin)
    ("영우", "M", 3.5, True),
    ("지연", "F", 3.0, True),
    ("홍균", "M", 3.5, False),
    ("가영", "F", 2.5, False),
    ("성환", "M", 4.0, False),
    ("서윤", "F", 3.0, False),
    ("준형", "M", 3.0, False),
    ("희주", "F", 2.5, False),
    ("민수", "M", 3.5, False),
    ("수진", "F", 3.0, False),
    ("태현", "M", 2.5, False),
    ("은지", "F", 2.5, False),
    ("재혁", "M", 3.0, False),
    ("하늘", "F", 3.5, False),
    ("동현", "M", 2.5, False),
    ("유리", "F", 2.5, False),
    ("상우", "M", 4.0, False),
    ("보라", "F", 3.0, False),
    ("정훈", "M", 3.0, False),
    ("미영", "F", 2.5, False),
    ("승민", "M", 3.5, False),
    ("소연", "F", 3.0, False),
    ("현우", "M", 2.5, False),
    ("지은", "F", 2.5, False),
    ("우진", "M", 3.0, False),
    ("채원", "F", 3.5, False),
    ("대호", "M", 3.0, False),
    ("예진", "F", 2.5, False),
    ("시훈", "M", 2.5, False),
    ("나연", "F", 3.0, False),
]


async def seed():
    async with async_session() as db:
        existing = await db.execute(select(Member))
        if existing.scalars().first():
            print("Members already exist, skipping seed.")
            return

        for name, gender, ntrp, is_admin in MEMBERS:
            db.add(Member(
                name=name,
                gender=Gender(gender),
                ntrp=ntrp,
                is_admin=is_admin,
            ))
        await db.commit()
        print(f"Seeded {len(MEMBERS)} members.")


if __name__ == "__main__":
    asyncio.run(seed())
