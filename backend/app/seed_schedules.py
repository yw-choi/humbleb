"""Seed Saturday/Sunday schedules through June 2026."""
import asyncio
from datetime import date, time, timedelta

from sqlalchemy import select

from app.database import async_session
from app.models.schedule import Schedule


async def seed_schedules():
    async with async_session() as db:
        # Check if schedules already exist
        existing = await db.execute(select(Schedule))
        if existing.scalars().first():
            print("Schedules already exist, skipping.")
            return

        count = 0
        current = date(2026, 3, 28)  # This Saturday
        end = date(2026, 6, 30)

        while current <= end:
            weekday = current.weekday()  # 5=Sat, 6=Sun

            if weekday == 5:  # Saturday
                # Time 1: 10:00-12:30
                db.add(Schedule(
                    title="토요일 타임1",
                    date=current,
                    start_time=time(10, 0),
                    end_time=time(12, 30),
                    venue="한강중학교",
                    court_count=2,
                    capacity=12,
                ))
                # Time 2: 12:30-15:00
                db.add(Schedule(
                    title="토요일 타임2",
                    date=current,
                    start_time=time(12, 30),
                    end_time=time(15, 0),
                    venue="한강중학교",
                    court_count=2,
                    capacity=12,
                ))
                count += 2

            elif weekday == 6:  # Sunday
                db.add(Schedule(
                    title="일요일 정모",
                    date=current,
                    start_time=time(11, 0),
                    end_time=time(14, 0),
                    venue="반포종합운동장",
                    court_count=2,
                    capacity=12,
                ))
                count += 1

            current += timedelta(days=1)

        await db.commit()
        print(f"Seeded {count} schedules (through {end}).")


if __name__ == "__main__":
    asyncio.run(seed_schedules())
