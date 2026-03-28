from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import attendance, auth, guests, matches, members, schedules

app = FastAPI(title="HumbleB API", root_path="/humbleb/api")

app.include_router(auth.router)
app.include_router(members.router)
app.include_router(schedules.router)
app.include_router(attendance.router)
app.include_router(guests.router)
app.include_router(matches.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "https://vesper.sogang.ac.kr",
        "http://localhost:3000",
        "http://localhost:3200",
        "http://127.0.0.1:3200",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}
