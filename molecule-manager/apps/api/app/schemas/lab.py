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
