import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class CreateLabRequest(BaseModel):
    name: str
    password: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Lab name must not be empty")
        return v

    @field_validator("password")
    @classmethod
    def password_not_empty(cls, v: str) -> str:
        if not v:
            raise ValueError("Password must not be empty")
        return v


class JoinLabRequest(BaseModel):
    lab_code: str
    password: str

    @field_validator("lab_code")
    @classmethod
    def normalise_code(cls, v: str) -> str:
        return v.strip().upper()


class LabResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    lab_code: str
    created_by_user_id: uuid.UUID | None
    created_at: datetime


class MemberResponse(BaseModel):
    model_config = {"from_attributes": True}

    user_id: uuid.UUID
    email: str
    role: str
    joined_at: datetime


class LabDetailResponse(LabResponse):
    members: list[MemberResponse]


class UpdateMemberRoleRequest(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("PI", "STUDENT"):
            raise ValueError('role must be "PI" or "STUDENT"')
        return v


class AuditLogResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    lab_id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    entity_type: str
    entity_id: uuid.UUID
    entity_name: str | None
    detail: str | None
    created_at: datetime


class AuditLogPageResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AuditLogResponse]
