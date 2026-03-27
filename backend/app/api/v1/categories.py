from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_user, require_owner
from app.models.user import User
from app.models.sop import Category

router = APIRouter(prefix="/categories", tags=["categories"])


class CategoryResponse(BaseModel):
    key: str
    label: str
    color: str
    sort_order: int
    is_active: bool

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    key: str
    label: str
    color: str = "bg-gray-100 text-gray-700"
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    label: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/", response_model=list[CategoryResponse])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Category).where(Category.is_active == True).order_by(Category.sort_order, Category.key)
    )
    return [CategoryResponse.model_validate(c) for c in result.scalars()]


@router.get("/all", response_model=list[CategoryResponse])
async def list_all_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Return all categories including inactive ones (OWNER only)."""
    result = await db.execute(
        select(Category).order_by(Category.sort_order, Category.key)
    )
    return [CategoryResponse.model_validate(c) for c in result.scalars()]


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    key = payload.key.upper().replace(" ", "_")
    existing = await db.execute(select(Category).where(Category.key == key))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Kategorie '{key}' existiert bereits")
    cat = Category(key=key, label=payload.label, color=payload.color, sort_order=payload.sort_order)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryResponse.model_validate(cat)


@router.patch("/{key}", response_model=CategoryResponse)
async def update_category(
    key: str,
    payload: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    result = await db.execute(select(Category).where(Category.key == key))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")

    if payload.label is not None:
        cat.label = payload.label
    if payload.color is not None:
        cat.color = payload.color
    if payload.sort_order is not None:
        cat.sort_order = payload.sort_order
    if payload.is_active is not None:
        cat.is_active = payload.is_active

    await db.commit()
    await db.refresh(cat)
    return CategoryResponse.model_validate(cat)


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_category(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Deactivates a category (soft delete — SOPs using it are unaffected)."""
    result = await db.execute(select(Category).where(Category.key == key))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    cat.is_active = False
    await db.commit()
