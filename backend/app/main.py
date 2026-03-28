from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import attendance, auth, members, schedules

app = FastAPI(title="HumbleB API", root_path="/humbleb/api")

app.include_router(auth.router)
app.include_router(members.router)
app.include_router(schedules.router)
app.include_router(attendance.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}
