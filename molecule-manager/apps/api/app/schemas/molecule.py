import uuid
from datetime import date, datetime

from pydantic import BaseModel, field_validator


class CreateMoleculeRequest(BaseModel):
    name: str
    smiles: str
    date_created: date
    method_used: str
    notes: str | None = None

    @field_validator("name", "method_used")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field must not be empty")
        return v

    @field_validator("smiles")
    @classmethod
    def smiles_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("SMILES must not be empty")
        return v


class UpdateMoleculeRequest(BaseModel):
    """SMILES is intentionally excluded: changing it would invalidate all
    derived properties. Delete and recreate the molecule instead."""

    name: str | None = None
    date_created: date | None = None
    method_used: str | None = None
    notes: str | None = None

    @field_validator("name", "method_used")
    @classmethod
    def not_empty(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Field must not be empty")
        return v


class MoleculeResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    lab_id: uuid.UUID
    created_by_user_id: uuid.UUID | None
    name: str
    smiles: str
    canonical_smiles: str | None
    inchi: str | None
    inchikey: str | None
    date_created: date
    method_used: str
    notes: str | None
    molecular_weight: float | None
    molecular_formula: str | None
    hbd: int | None
    hba: int | None
    tpsa: float | None
    rotatable_bonds: int | None
    svg_image: str | None
    created_at: datetime
    updated_at: datetime


class SubstructureSearchRequest(BaseModel):
    smiles: str

    @field_validator("smiles")
    @classmethod
    def smiles_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("SMILES must not be empty")
        return v


class SimilaritySearchRequest(BaseModel):
    query_smiles: str
    threshold: float = 0.7

    @field_validator("query_smiles")
    @classmethod
    def query_smiles_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("query_smiles must not be empty")
        return v

    @field_validator("threshold")
    @classmethod
    def threshold_in_range(cls, v: float) -> float:
        if not (0.0 <= v <= 1.0):
            raise ValueError("threshold must be between 0.0 and 1.0")
        return v


class SimilarityHit(MoleculeResponse):
    """MoleculeResponse extended with a Tanimoto similarity score."""

    similarity: float


class ImportPubChemRequest(BaseModel):
    pubchem_cid: int
    name: str
    method_used: str
    date_created: date
    notes: str | None = None

    @field_validator("name", "method_used")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field must not be empty")
        return v
