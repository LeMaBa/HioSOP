from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.DISPATCHER


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserResponse(UserBase):
    id: str
    is_active: bool
    is_ldap_user: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginRequest(BaseModel):
    username: str
    password: str
