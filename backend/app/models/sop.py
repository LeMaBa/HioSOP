import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import String, Text, DateTime, Enum as SAEnum, ForeignKey, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SOPCategory(str, Enum):
    BRAND = "BRAND"
    THL = "THL"
    GEFAHRGUT = "GEFAHRGUT"
    MANV = "MANV"
    WASSER = "WASSER"
    ALLGEMEIN = "ALLGEMEIN"


class SOPStatus(str, Enum):
    DRAFT = "DRAFT"
    IN_REVIEW = "IN_REVIEW"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class SOP(Base):
    __tablename__ = "sops"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[SOPCategory] = mapped_column(SAEnum(SOPCategory), nullable=False, index=True)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    active_version_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    versions: Mapped[list["SOPVersion"]] = relationship(
        "SOPVersion", back_populates="sop", cascade="all, delete-orphan",
        foreign_keys="SOPVersion.sop_id"
    )


class SOPVersion(Base):
    __tablename__ = "sop_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sop_id: Mapped[str] = mapped_column(String(36), ForeignKey("sops.id"), nullable=False, index=True)
    version_number: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[SOPStatus] = mapped_column(SAEnum(SOPStatus), default=SOPStatus.DRAFT, nullable=False, index=True)

    # Content
    checklist_items: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    diagram_xml: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    linked_sop_codes: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    tags: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    # Versioning meta
    change_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    released_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    review_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_review_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    sop: Mapped["SOP"] = relationship("SOP", back_populates="versions", foreign_keys=[sop_id])


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    sop_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    version_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)


class SOPFavorite(Base):
    __tablename__ = "sop_favorites"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    sop_id: Mapped[str] = mapped_column(String(36), ForeignKey("sops.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class SOPFeedback(Base):
    __tablename__ = "sop_feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sop_id: Mapped[str] = mapped_column(String(36), ForeignKey("sops.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 = thumbs up, -1 = thumbs down
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
