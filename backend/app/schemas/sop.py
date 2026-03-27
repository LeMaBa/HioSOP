from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.models.sop import SOPStatus


class ChecklistItem(BaseModel):
    id: str
    text: str
    order: int
    required: bool = True
    sub_items: List["ChecklistItem"] = []


class SOPVersionBase(BaseModel):
    checklist_items: List[ChecklistItem] = []
    diagram_xml: Optional[str] = None
    linked_sop_codes: List[str] = []
    tags: List[str] = []
    change_comment: Optional[str] = None
    next_review_date: Optional[datetime] = None


class SOPVersionCreate(SOPVersionBase):
    pass


class SOPVersionUpdate(SOPVersionBase):
    pass


class SOPVersionResponse(SOPVersionBase):
    id: str
    sop_id: str
    version_number: str
    status: SOPStatus
    created_by: str
    created_at: datetime
    updated_at: datetime
    submitted_at: Optional[datetime] = None
    submitted_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    review_comment: Optional[str] = None
    released_at: Optional[datetime] = None
    released_by: Optional[str] = None

    model_config = {"from_attributes": True}


class SOPCreate(BaseModel):
    code: str
    title: str
    category: str
    checklist_items: List[ChecklistItem] = []
    diagram_xml: Optional[str] = None
    linked_sop_codes: List[str] = []
    tags: List[str] = []
    next_review_date: Optional[datetime] = None


class SOPUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    checklist_items: Optional[List[ChecklistItem]] = None
    diagram_xml: Optional[str] = None
    linked_sop_codes: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    change_comment: Optional[str] = None
    next_review_date: Optional[datetime] = None


class SOPResponse(BaseModel):
    id: str
    code: str
    title: str
    category: str
    created_by: str
    created_at: datetime
    active_version_id: Optional[str] = None
    current_version: Optional[SOPVersionResponse] = None
    pending_version: Optional[SOPVersionResponse] = None
    is_favorite: bool = False

    model_config = {"from_attributes": True}


class SOPListItem(BaseModel):
    id: str
    code: str
    title: str
    category: str
    status: Optional[SOPStatus] = None
    version_number: Optional[str] = None
    tags: List[str] = []
    created_at: datetime
    released_at: Optional[datetime] = None
    is_favorite: bool = False

    model_config = {"from_attributes": True}


class ReviewAction(BaseModel):
    action: str  # "approve" | "reject"
    comment: Optional[str] = None


class FeedbackCreate(BaseModel):
    rating: int  # 1 or -1
    comment: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: str
    sop_id: str
    user_id: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogResponse(BaseModel):
    id: str
    user_id: str
    timestamp: datetime
    action: str
    sop_id: Optional[str] = None
    version_id: Optional[str] = None
    comment: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None

    model_config = {"from_attributes": True}


class ChangelogEntry(BaseModel):
    id: str
    timestamp: datetime
    username: str
    sop_id: Optional[str] = None
    sop_code: Optional[str] = None
    sop_title: Optional[str] = None
    sop_category: Optional[str] = None
    version_number: Optional[str] = None
    change_comment: Optional[str] = None
