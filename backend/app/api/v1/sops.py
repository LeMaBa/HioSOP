from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user, require_admin, require_owner
from app.models.user import User, UserRole
from app.models.sop import SOP, SOPVersion, SOPStatus, AuditLog, SOPFavorite, SOPFeedback
from app.schemas.sop import (
    SOPCreate, SOPUpdate, SOPResponse, SOPListItem, SOPVersionResponse,
    ReviewAction, FeedbackCreate, FeedbackResponse, AuditLogResponse,
)

router = APIRouter(prefix="/sops", tags=["sops"])


def _version_number(major: int, minor: int) -> str:
    return f"{major}.{minor}"


async def _log(
    db: AsyncSession,
    user: User,
    action: str,
    sop_id: Optional[str] = None,
    version_id: Optional[str] = None,
    comment: Optional[str] = None,
    ip: Optional[str] = None,
):
    entry = AuditLog(
        user_id=user.id,
        action=action,
        sop_id=sop_id,
        version_id=version_id,
        comment=comment,
        ip_address=ip,
    )
    db.add(entry)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _visible_statuses(user: User) -> list[SOPStatus]:
    if user.role == UserRole.DISPATCHER:
        return [SOPStatus.ACTIVE]
    if user.role == UserRole.ADMIN:
        return [SOPStatus.DRAFT, SOPStatus.IN_REVIEW, SOPStatus.ACTIVE]
    # OWNER sees all
    return [SOPStatus.DRAFT, SOPStatus.IN_REVIEW, SOPStatus.ACTIVE, SOPStatus.ARCHIVED]


# ── List & Search ─────────────────────────────────────────────────────────────

@router.get("/", response_model=list[SOPListItem])
async def list_sops(
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = _visible_statuses(current_user)

    stmt = (
        select(SOP, SOPVersion)
        .join(SOPVersion, SOPVersion.sop_id == SOP.id)
        .where(SOPVersion.status.in_(allowed))
        .order_by(SOP.code)
    )

    if category:
        stmt = stmt.where(SOP.category == category)

    if q:
        q_lower = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                SOP.code.ilike(q_lower),
                SOP.title.ilike(q_lower),
            )
        )

    result = await db.execute(stmt)
    rows = result.all()

    # Get favorites for current user
    fav_result = await db.execute(
        select(SOPFavorite.sop_id).where(SOPFavorite.user_id == current_user.id)
    )
    fav_ids = {r for r in fav_result.scalars()}

    items = []
    seen = set()
    for sop, version in rows:
        if sop.id in seen:
            continue
        seen.add(sop.id)
        items.append(SOPListItem(
            id=sop.id,
            code=sop.code,
            title=sop.title,
            category=sop.category,
            status=version.status,
            version_number=version.version_number,
            created_at=sop.created_at,
            released_at=version.released_at,
            is_favorite=sop.id in fav_ids,
        ))
    return items


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("/", response_model=SOPResponse, status_code=status.HTTP_201_CREATED)
async def create_sop(
    payload: SOPCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = await db.execute(select(SOP).where(SOP.code == payload.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"SOP-Code '{payload.code}' bereits vergeben")

    sop = SOP(
        code=payload.code,
        title=payload.title,
        category=payload.category,
        created_by=current_user.id,
    )
    db.add(sop)
    await db.flush()

    version = SOPVersion(
        sop_id=sop.id,
        version_number="1.0",
        status=SOPStatus.DRAFT,
        checklist_items=[item.model_dump() for item in payload.checklist_items],
        diagram_xml=payload.diagram_xml,
        linked_sop_codes=payload.linked_sop_codes,
        tags=payload.tags,
        next_review_date=payload.next_review_date,
        created_by=current_user.id,
    )
    db.add(version)
    await db.flush()

    await _log(db, current_user, "CREATED", sop.id, version.id, ip=_client_ip(request))
    await db.commit()
    await db.refresh(sop)
    await db.refresh(version)

    return SOPResponse(
        id=sop.id,
        code=sop.code,
        title=sop.title,
        category=sop.category,
        created_by=sop.created_by,
        created_at=sop.created_at,
        active_version_id=sop.active_version_id,
        current_version=SOPVersionResponse.model_validate(version),
    )


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{sop_id}", response_model=SOPResponse)
async def get_sop(
    sop_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(SOP).where(or_(SOP.id == sop_id, SOP.code == sop_id)))
    sop = result.scalar_one_or_none()
    if not sop:
        raise HTTPException(status_code=404, detail="SOP nicht gefunden")

    allowed = _visible_statuses(current_user)

    # Prefer active version, fall back to latest draft/review for admins
    version_result = await db.execute(
        select(SOPVersion)
        .where(SOPVersion.sop_id == sop.id, SOPVersion.status.in_(allowed))
        .order_by(SOPVersion.created_at.desc())
    )
    version = version_result.scalars().first()
    if not version:
        raise HTTPException(status_code=404, detail="Keine zugängliche SOP-Version gefunden")

    return SOPResponse(
        id=sop.id,
        code=sop.code,
        title=sop.title,
        category=sop.category,
        created_by=sop.created_by,
        created_at=sop.created_at,
        active_version_id=sop.active_version_id,
        current_version=SOPVersionResponse.model_validate(version),
    )


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{sop_id}", response_model=SOPResponse)
async def update_sop(
    sop_id: str,
    payload: SOPUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(SOP).where(SOP.id == sop_id))
    sop = result.scalar_one_or_none()
    if not sop:
        raise HTTPException(status_code=404, detail="SOP nicht gefunden")

    # Find current active or latest draft version
    ver_result = await db.execute(
        select(SOPVersion)
        .where(SOPVersion.sop_id == sop.id)
        .order_by(SOPVersion.created_at.desc())
    )
    latest = ver_result.scalars().first()
    if not latest:
        raise HTTPException(status_code=404, detail="Keine Version gefunden")

    # If active, create new draft with incremented minor
    if latest.status == SOPStatus.ACTIVE:
        major, minor = latest.version_number.split(".")
        new_version_number = f"{major}.{int(minor) + 1}"
        new_version = SOPVersion(
            sop_id=sop.id,
            version_number=new_version_number,
            status=SOPStatus.DRAFT,
            checklist_items=latest.checklist_items,
            diagram_xml=latest.diagram_xml,
            linked_sop_codes=latest.linked_sop_codes,
            tags=latest.tags,
            created_by=current_user.id,
        )
        db.add(new_version)
        latest = new_version

    # Apply updates
    if payload.title is not None:
        sop.title = payload.title
    if payload.category is not None:
        sop.category = payload.category
    if payload.checklist_items is not None:
        latest.checklist_items = [item.model_dump() for item in payload.checklist_items]
    if payload.diagram_xml is not None:
        latest.diagram_xml = payload.diagram_xml
    if payload.linked_sop_codes is not None:
        latest.linked_sop_codes = payload.linked_sop_codes
    if payload.tags is not None:
        latest.tags = payload.tags
    if payload.change_comment is not None:
        latest.change_comment = payload.change_comment
    if payload.next_review_date is not None:
        latest.next_review_date = payload.next_review_date

    await db.flush()
    await _log(db, current_user, "EDITED", sop.id, latest.id, payload.change_comment, _client_ip(request))
    await db.commit()
    await db.refresh(sop)
    await db.refresh(latest)

    return SOPResponse(
        id=sop.id,
        code=sop.code,
        title=sop.title,
        category=sop.category,
        created_by=sop.created_by,
        created_at=sop.created_at,
        active_version_id=sop.active_version_id,
        current_version=SOPVersionResponse.model_validate(latest),
    )


# ── Workflow ──────────────────────────────────────────────────────────────────

@router.post("/{sop_id}/submit")
async def submit_for_review(
    sop_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(SOP).where(SOP.id == sop_id))
    sop = result.scalar_one_or_none()
    if not sop:
        raise HTTPException(status_code=404, detail="SOP nicht gefunden")

    ver_result = await db.execute(
        select(SOPVersion)
        .where(SOPVersion.sop_id == sop.id, SOPVersion.status == SOPStatus.DRAFT)
        .order_by(SOPVersion.created_at.desc())
    )
    draft = ver_result.scalars().first()
    if not draft:
        raise HTTPException(status_code=400, detail="Kein Entwurf zur Einreichung vorhanden")

    draft.status = SOPStatus.IN_REVIEW
    draft.submitted_at = datetime.now(timezone.utc)
    await _log(db, current_user, "SUBMITTED", sop.id, draft.id, ip=_client_ip(request))
    await db.commit()
    return {"message": "SOP zur Freigabe eingereicht"}


@router.post("/{sop_id}/review")
async def review_sop(
    sop_id: str,
    payload: ReviewAction,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    result = await db.execute(select(SOP).where(SOP.id == sop_id))
    sop = result.scalar_one_or_none()
    if not sop:
        raise HTTPException(status_code=404, detail="SOP nicht gefunden")

    ver_result = await db.execute(
        select(SOPVersion)
        .where(SOPVersion.sop_id == sop.id, SOPVersion.status == SOPStatus.IN_REVIEW)
        .order_by(SOPVersion.created_at.desc())
    )
    version = ver_result.scalars().first()
    if not version:
        raise HTTPException(status_code=400, detail="Keine Version in Review")

    now = datetime.now(timezone.utc)
    version.reviewed_at = now
    version.reviewed_by = current_user.id
    version.review_comment = payload.comment

    if payload.action == "approve":
        # Archive old active version
        if sop.active_version_id:
            old_result = await db.execute(
                select(SOPVersion).where(SOPVersion.id == sop.active_version_id)
            )
            old_version = old_result.scalar_one_or_none()
            if old_version:
                old_version.status = SOPStatus.ARCHIVED

        version.status = SOPStatus.ACTIVE
        version.released_at = now
        sop.active_version_id = version.id
        await _log(db, current_user, "APPROVED", sop.id, version.id, payload.comment, _client_ip(request))
    elif payload.action == "reject":
        if not payload.comment:
            raise HTTPException(status_code=400, detail="Ablehnungskommentar ist Pflicht")
        version.status = SOPStatus.DRAFT
        await _log(db, current_user, "REJECTED", sop.id, version.id, payload.comment, _client_ip(request))
    else:
        raise HTTPException(status_code=400, detail="Ungültige Aktion. Erlaubt: 'approve', 'reject'")

    await db.commit()
    return {"message": f"SOP {payload.action}d"}


@router.post("/{sop_id}/archive")
async def archive_sop(
    sop_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    result = await db.execute(select(SOP).where(SOP.id == sop_id))
    sop = result.scalar_one_or_none()
    if not sop:
        raise HTTPException(status_code=404, detail="SOP nicht gefunden")

    ver_result = await db.execute(
        select(SOPVersion)
        .where(SOPVersion.sop_id == sop.id, SOPVersion.status == SOPStatus.ACTIVE)
    )
    active = ver_result.scalar_one_or_none()
    if active:
        active.status = SOPStatus.ARCHIVED
        sop.active_version_id = None

    await _log(db, current_user, "ARCHIVED", sop.id, ip=_client_ip(request))
    await db.commit()
    return {"message": "SOP archiviert"}


# ── Versions ──────────────────────────────────────────────────────────────────

@router.get("/{sop_id}/versions", response_model=list[SOPVersionResponse])
async def list_versions(
    sop_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(SOPVersion)
        .where(SOPVersion.sop_id == sop_id)
        .order_by(SOPVersion.created_at.desc())
    )
    return [SOPVersionResponse.model_validate(v) for v in result.scalars()]


# ── Diagram upload ────────────────────────────────────────────────────────────

@router.post("/{sop_id}/diagram")
async def upload_diagram(
    sop_id: str,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not file.filename or not file.filename.endswith(".drawio"):
        raise HTTPException(status_code=400, detail="Nur .drawio-Dateien erlaubt")

    content = await file.read()
    xml = content.decode("utf-8")

    result = await db.execute(select(SOP).where(SOP.id == sop_id))
    sop = result.scalar_one_or_none()
    if not sop:
        raise HTTPException(status_code=404, detail="SOP nicht gefunden")

    ver_result = await db.execute(
        select(SOPVersion)
        .where(SOPVersion.sop_id == sop.id, SOPVersion.status == SOPStatus.DRAFT)
        .order_by(SOPVersion.created_at.desc())
    )
    draft = ver_result.scalars().first()
    if not draft:
        raise HTTPException(status_code=400, detail="Kein Entwurf vorhanden")

    draft.diagram_xml = xml
    await _log(db, current_user, "DIAGRAM_UPLOADED", sop.id, draft.id, ip=_client_ip(request))
    await db.commit()
    return {"message": "Diagramm hochgeladen"}


# ── Favorites ─────────────────────────────────────────────────────────────────

@router.post("/{sop_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def toggle_favorite(
    sop_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SOPFavorite)
        .where(SOPFavorite.user_id == current_user.id, SOPFavorite.sop_id == sop_id)
    )
    fav = result.scalar_one_or_none()
    if fav:
        await db.delete(fav)
    else:
        db.add(SOPFavorite(user_id=current_user.id, sop_id=sop_id))
    await db.commit()


# ── Feedback ──────────────────────────────────────────────────────────────────

@router.post("/{sop_id}/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    sop_id: str,
    payload: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.rating not in (1, -1):
        raise HTTPException(status_code=400, detail="Bewertung muss 1 oder -1 sein")
    fb = SOPFeedback(
        sop_id=sop_id,
        user_id=current_user.id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(fb)
    await db.commit()
    await db.refresh(fb)
    return FeedbackResponse.model_validate(fb)


@router.get("/{sop_id}/feedback", response_model=list[FeedbackResponse])
async def get_feedback(
    sop_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(SOPFeedback)
        .where(SOPFeedback.sop_id == sop_id)
        .order_by(SOPFeedback.created_at.desc())
    )
    return [FeedbackResponse.model_validate(f) for f in result.scalars()]


# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/{sop_id}/audit", response_model=list[AuditLogResponse])
async def get_audit_log(
    sop_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.sop_id == sop_id)
        .order_by(AuditLog.timestamp.desc())
    )
    return [AuditLogResponse.model_validate(a) for a in result.scalars()]
