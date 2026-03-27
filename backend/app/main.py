from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.database import engine, Base
from app.api.v1.router import api_router

# Import all models so SQLAlchemy registers them
import app.models.user  # noqa: F401
import app.models.sop   # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed default owner account if no users exist
    from app.core.database import AsyncSessionLocal
    from app.core.security import get_password_hash
    from app.models.user import User, UserRole
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).limit(1))
        if not result.scalar_one_or_none():
            owner = User(
                username="admin",
                email="admin@leitstelle.local",
                full_name="Leitstellenleiter",
                role=UserRole.OWNER,
                hashed_password=get_password_hash("changeme"),
            )
            db.add(owner)
            await db.commit()
            print("Standard-Admin-Konto erstellt: admin / changeme")

    yield


app = FastAPI(
    title="SOP-Navigator API",
    description="API für den SOP-Navigator der Feuerwehrleitstelle",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production via env
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
