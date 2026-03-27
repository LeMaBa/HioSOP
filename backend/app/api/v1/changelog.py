from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.sop import SOP, SOPVersion, AuditLog
from app.schemas.sop import ChangelogEntry

router = APIRouter(prefix="/changelog", tags=["changelog"])


@router.get("", response_model=list[ChangelogEntry])
async def get_changelog(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only show APPROVED events — these represent published/released SOP versions
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.action == "APPROVED")
        .order_by(AuditLog.timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    logs = result.scalars().all()

    # Batch-fetch related records
    user_ids = {log.user_id for log in logs}
    sop_ids = {log.sop_id for log in logs if log.sop_id}
    version_ids = {log.version_id for log in logs if log.version_id}

    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users = {u.id: u for u in users_result.scalars()}

    sops_result = await db.execute(select(SOP).where(SOP.id.in_(sop_ids)))
    sops = {s.id: s for s in sops_result.scalars()}

    versions_result = await db.execute(select(SOPVersion).where(SOPVersion.id.in_(version_ids)))
    versions = {v.id: v for v in versions_result.scalars()}

    entries = []
    for log in logs:
        user = users.get(log.user_id)
        sop = sops.get(log.sop_id) if log.sop_id else None
        version = versions.get(log.version_id) if log.version_id else None
        entries.append(ChangelogEntry(
            id=log.id,
            timestamp=log.timestamp,
            username=user.username if user else log.user_id,
            sop_id=log.sop_id,
            sop_code=sop.code if sop else None,
            sop_title=sop.title if sop else None,
            sop_category=sop.category if sop else None,
            version_number=version.version_number if version else None,
            change_comment=version.change_comment if version else None,
        ))
    return entries
