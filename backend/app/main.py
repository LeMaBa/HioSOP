from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.database import engine, Base
from app.api.v1.router import api_router

# Import all models so SQLAlchemy registers them
import app.models.user  # noqa: F401
import app.models.sop   # noqa: F401  (includes Category, SOP, SOPVersion, AuditLog, SOPFavorite, SOPFeedback)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from app.core.database import AsyncSessionLocal
    from app.core.security import get_password_hash
    from app.models.user import User, UserRole
    from app.models.sop import Category
    from sqlalchemy import select

    DEFAULT_CATEGORIES = [
        {"key": "BRAND",       "label": "Brand",                   "color": "bg-red-100 text-red-700",     "sort_order": 0},
        {"key": "THL",         "label": "Techn. Hilfeleistung",    "color": "bg-orange-100 text-orange-700","sort_order": 1},
        {"key": "GEFAHRGUT",   "label": "Gefahrgut",               "color": "bg-yellow-100 text-yellow-700","sort_order": 2},
        {"key": "MANV",        "label": "MANV",                    "color": "bg-purple-100 text-purple-700","sort_order": 3},
        {"key": "WASSER",      "label": "Wasser/Eisrettung",       "color": "bg-blue-100 text-blue-700",   "sort_order": 4},
        {"key": "HOCHWASSER",  "label": "Hochwasser",              "color": "bg-cyan-100 text-cyan-700",   "sort_order": 5},
        {"key": "ABC_EINSATZ", "label": "ABC-Einsatz",             "color": "bg-lime-100 text-lime-700",   "sort_order": 6},
        {"key": "ALLGEMEIN",   "label": "Allgemein",               "color": "bg-gray-100 text-gray-700",   "sort_order": 7},
    ]

    async with AsyncSessionLocal() as db:
        # Seed categories
        for cat in DEFAULT_CATEGORIES:
            existing = await db.execute(select(Category).where(Category.key == cat["key"]))
            if not existing.scalar_one_or_none():
                db.add(Category(**cat))
        await db.commit()

        # Seed default owner account if no users exist
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

from app.core.config import settings as _settings
_cors_origins = [o.strip() for o in _settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
