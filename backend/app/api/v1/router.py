from fastapi import APIRouter

from app.api.v1 import auth, users, sops, categories, changelog

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(sops.router)
api_router.include_router(categories.router)
api_router.include_router(changelog.router)
