from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .db_models import UserRole


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=4)


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=4)
    name: str
    role: UserRole
    phone: Optional[str] = None


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str
    role: UserRole
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
