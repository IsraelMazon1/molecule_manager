import uuid
from datetime import date, datetime

from pydantic import BaseModel, field_validator

from app.schemas.molecule import MoleculeResponse
from app.schemas.protein import ProteinList


class CreateExperimentRequest(BaseModel):
    title: str
    date: date
    notes: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title must not be empty")
        return v


class ExperimentResponse(BaseModel):
    """Returned by list — does not include molecules to avoid large payloads."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    lab_id: uuid.UUID
    created_by_user_id: uuid.UUID | None
    title: str
    date: date
    notes: str | None
    created_at: datetime


class ExperimentDetailResponse(ExperimentResponse):
    """Returned by get-one — includes the full attached molecule and protein lists."""

    molecules: list[MoleculeResponse] = []
    proteins: list[ProteinList] = []
