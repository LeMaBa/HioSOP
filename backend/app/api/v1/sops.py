from datetime import datetime, timezone
from typing import Optional
import io

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, case, cast, String, func
from sqlalchemy.orm import selectinload
from fpdf import FPDF

from app.core.database import get_db
from app.core.auth import get_current_user, require_admin, require_owner
from app.models.user import User, UserRole
from app.models.sop import SOP, SOPVersion, SOPStatus, AuditLog, SOPFavorite, SOPFeedback, Category
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
    details: Optional[dict] = None,
):
    entry = AuditLog(
        user_id=user.id,
        action=action,
        sop_id=sop_id,
        version_id=version_id,
        comment=comment,
        ip_address=ip,
        details=details,
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
    tag: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = _visible_statuses(current_user)

    status_priority = case(
        (SOPVersion.status == SOPStatus.ACTIVE, 0),
        (SOPVersion.status == SOPStatus.IN_REVIEW, 1),
        (SOPVersion.status == SOPStatus.DRAFT, 2),
        (SOPVersion.status == SOPStatus.ARCHIVED, 3),
        else_=4,
    )

    stmt = (
        select(SOP, SOPVersion)
        .join(SOPVersion, SOPVersion.sop_id == SOP.id)
        .where(SOPVersion.status.in_(allowed))
        .order_by(SOP.code, status_priority, SOPVersion.created_at.desc())
    )

    if category:
        stmt = stmt.where(SOP.category == category)

    if q:
        q_lower = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                SOP.code.ilike(q_lower),
                SOP.title.ilike(q_lower),
                cast(SOPVersion.tags, String).ilike(q_lower),
            )
        )

    if tag:
        # Match exact tag (case-insensitive) within the JSON array
        stmt = stmt.where(
            func.lower(cast(SOPVersion.tags, String)).contains(f'"{tag.lower()}"')
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
            tags=version.tags or [],
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


# ── PDF Export ────────────────────────────────────────────────────────────────

@router.get("/export", response_class=StreamingResponse)
async def export_sops_pdf(
    category: Optional[str] = Query(None),
    ids: Optional[str] = Query(None, description="Comma-separated SOP IDs"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(SOP)
    if ids:
        id_list = [i.strip() for i in ids.split(",") if i.strip()]
        query = query.where(SOP.id.in_(id_list))
    if category:
        query = query.where(SOP.category == category)
    query = query.order_by(SOP.category, SOP.code)

    sop_result = await db.execute(query)
    sops_list = sop_result.scalars().all()

    # For each SOP, load its active (or latest) version
    sop_versions: dict[str, SOPVersion] = {}
    for sop in sops_list:
        ver_result = await db.execute(
            select(SOPVersion)
            .where(SOPVersion.sop_id == sop.id)
            .order_by(
                case(
                    (SOPVersion.status == SOPStatus.ACTIVE, 0),
                    (SOPVersion.status == SOPStatus.IN_REVIEW, 1),
                    (SOPVersion.status == SOPStatus.DRAFT, 2),
                    else_=3,
                ),
                SOPVersion.created_at.desc(),
            )
        )
        version = ver_result.scalars().first()
        if version:
            sop_versions[sop.id] = version

    # Build PDF
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(20, 20, 20)

    # Cover page
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(226, 0, 26)  # Malteser red
    pdf.cell(0, 12, "Malteser SOP-Navigator", ln=True, align="C")
    pdf.set_font("Helvetica", "", 14)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 8, "Standard Operating Procedures", ln=True, align="C")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 6, f"Exportiert am {datetime.now().strftime('%d.%m.%Y %H:%M')}", ln=True, align="C")
    pdf.cell(0, 6, f"{len(sops_list)} SOP(s)", ln=True, align="C")

    for sop in sops_list:
        version = sop_versions.get(sop.id)
        pdf.add_page()

        # SOP header
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(150, 150, 150)
        pdf.cell(0, 5, f"{sop.category}  ·  {sop.code}", ln=True)
        pdf.ln(1)

        pdf.set_font("Helvetica", "B", 16)
        pdf.set_text_color(30, 30, 30)
        pdf.multi_cell(0, 9, sop.title)
        pdf.ln(2)

        # Meta row
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(100, 100, 100)
        if version:
            status_label = {"ACTIVE": "Aktiv", "DRAFT": "Entwurf", "IN_REVIEW": "In Prüfung", "ARCHIVED": "Archiviert"}.get(version.status, version.status)
            meta = f"Version {version.version_number}  ·  Status: {status_label}"
            if version.released_at:
                meta += f"  ·  Freigegeben: {version.released_at.strftime('%d.%m.%Y')}"
            if version.next_review_date:
                meta += f"  ·  Nächste Prüfung: {version.next_review_date.strftime('%d.%m.%Y')}"
            pdf.multi_cell(0, 5, meta)
            if version.tags:
                pdf.set_text_color(130, 130, 130)
                pdf.cell(0, 5, "Tags: " + ", ".join(version.tags), ln=True)
        pdf.ln(4)

        # Divider
        pdf.set_draw_color(226, 0, 26)
        pdf.set_line_width(0.5)
        pdf.line(20, pdf.get_y(), 190, pdf.get_y())
        pdf.ln(5)

        # Checklist
        if version and version.checklist_items:
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(30, 30, 30)
            pdf.cell(0, 6, "Checkliste", ln=True)
            pdf.ln(2)
            for i, item in enumerate(
                sorted(version.checklist_items, key=lambda x: x.get("order", i)), 1
            ):
                text = item.get("text", "")
                required = item.get("required", True)
                pdf.set_font("Helvetica", "B" if required else "", 9)
                pdf.set_text_color(30, 30, 30)
                marker = f"{i}."
                pdf.cell(8, 6, marker)
                pdf.set_font("Helvetica", "", 9)
                pdf.multi_cell(0, 6, text if text else "(kein Text)")
        else:
            pdf.set_font("Helvetica", "I", 9)
            pdf.set_text_color(150, 150, 150)
            pdf.cell(0, 6, "Keine Checklistenpunkte vorhanden.", ln=True)

        # Linked SOPs
        if version and version.linked_sop_codes:
            pdf.ln(4)
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(80, 80, 80)
            pdf.cell(0, 6, "Verknüpfte SOPs: " + ", ".join(version.linked_sop_codes), ln=True)

    buf = io.BytesIO(bytes(pdf.output()))
    buf.seek(0)
    filename = f"sop-export-{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
    status_priority = case(
        (SOPVersion.status == SOPStatus.ACTIVE, 0),
        (SOPVersion.status == SOPStatus.IN_REVIEW, 1),
        (SOPVersion.status == SOPStatus.DRAFT, 2),
        (SOPVersion.status == SOPStatus.ARCHIVED, 3),
        else_=4,
    )
    version_result = await db.execute(
        select(SOPVersion)
        .where(SOPVersion.sop_id == sop.id, SOPVersion.status.in_(allowed))
        .order_by(status_priority, SOPVersion.created_at.desc())
    )
    version = version_result.scalars().first()
    if not version:
        raise HTTPException(status_code=404, detail="Keine zugängliche SOP-Version gefunden")

    fav_result = await db.execute(
        select(SOPFavorite).where(
            SOPFavorite.user_id == current_user.id,
            SOPFavorite.sop_id == sop.id,
        )
    )
    is_favorite = fav_result.scalar_one_or_none() is not None

    # If current version is ACTIVE, also surface the latest DRAFT/IN_REVIEW (pending)
    pending_version = None
    if version and version.status == SOPStatus.ACTIVE and current_user.role in (UserRole.ADMIN, UserRole.OWNER):
        pending_result = await db.execute(
            select(SOPVersion)
            .where(
                SOPVersion.sop_id == sop.id,
                SOPVersion.status.in_([SOPStatus.DRAFT, SOPStatus.IN_REVIEW]),
            )
            .order_by(SOPVersion.created_at.desc())
        )
        pending_version = pending_result.scalars().first()

    return SOPResponse(
        id=sop.id,
        code=sop.code,
        title=sop.title,
        category=sop.category,
        created_by=sop.created_by,
        created_at=sop.created_at,
        active_version_id=sop.active_version_id,
        current_version=SOPVersionResponse.model_validate(version),
        pending_version=SOPVersionResponse.model_validate(pending_version) if pending_version else None,
        is_favorite=is_favorite,
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
    draft.submitted_by = current_user.id
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
        version.released_by = current_user.id
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


@router.delete("/{sop_id}", status_code=204)
async def delete_sop(
    sop_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    result = await db.execute(select(SOP).where(SOP.id == sop_id))
    sop = result.scalar_one_or_none()
    if not sop:
        raise HTTPException(status_code=404, detail="SOP nicht gefunden")

    # Only allow deletion of fully archived SOPs (no active version)
    if sop.active_version_id is not None:
        raise HTTPException(status_code=409, detail="Nur archivierte SOPs können gelöscht werden")

    await _log(db, current_user, "DELETED", sop.id, ip=_client_ip(request))
    await db.delete(sop)
    await db.commit()


# ── Versions ──────────────────────────────────────────────────────────────────

@router.get("/{sop_id}/versions", response_model=list[SOPVersionResponse])
async def list_versions(
    sop_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Resolve SOP by UUID or code (URL param may be either)
    sop_result = await db.execute(select(SOP).where(or_(SOP.id == sop_id, SOP.code == sop_id)))
    sop = sop_result.scalar_one_or_none()
    if not sop:
        raise HTTPException(status_code=404, detail="SOP nicht gefunden")

    result = await db.execute(
        select(SOPVersion)
        .where(SOPVersion.sop_id == sop.id)
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
    current_user: User = Depends(require_owner),
):
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.sop_id == sop_id)
        .order_by(AuditLog.timestamp.desc())
    )
    return [AuditLogResponse.model_validate(a) for a in result.scalars()]
