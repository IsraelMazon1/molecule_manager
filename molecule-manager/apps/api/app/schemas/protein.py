import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class ProteinResolve(BaseModel):
    query: str

    @field_validator("query")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Query must not be empty")
        return v


class ProteinCreate(BaseModel):
    name: str
    display_name: str | None = None
    uniprot_id: str | None = None
    pdb_id: str | None = None
    sequence: str | None = None
    source: str
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty")
        return v

    @field_validator("source")
    @classmethod
    def valid_source(cls, v: str) -> str:
        allowed = {"name", "pdb_id", "sequence", "manual"}
        if v not in allowed:
            raise ValueError(f"source must be one of {allowed}")
        return v


class ProteinDetail(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    lab_id: uuid.UUID
    created_by_user_id: uuid.UUID | None
    name: str
    display_name: str | None
    uniprot_id: str | None
    pdb_id: str | None
    sequence: str | None
    source: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class ProteinList(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    lab_id: uuid.UUID
    name: str
    display_name: str | None
    uniprot_id: str | None
    pdb_id: str | None
    source: str
    created_at: datetime


class ProteinPageResponse(BaseModel):
    items: list[ProteinList]
    total: int
    limit: int
    offset: int


class ProteinResolveResponse(BaseModel):
    name: str
    display_name: str | None = None
    uniprot_id: str | None = None
    pdb_id: str | None = None
    sequence: str | None = None
    source: str
