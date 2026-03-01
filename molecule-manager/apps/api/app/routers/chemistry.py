from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps.auth import get_current_user
from app.models.user import User
from app.schemas.chemistry import ChemistryPropertiesResponse, PubChemResult, ValidateSMILESRequest
from app.services.chemistry import InvalidSMILESError, process_smiles
from app.services.pubchem import search_pubchem

router = APIRouter(prefix="/api/v1/chemistry", tags=["chemistry"])


@router.post("/validate", response_model=ChemistryPropertiesResponse)
def validate(body: ValidateSMILESRequest) -> dict:
    """Validate a SMILES string and return computed properties + SVG.

    Returns 422 if the SMILES cannot be parsed.
    """
    try:
        return process_smiles(body.smiles)
    except InvalidSMILESError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.get("/pubchem", response_model=list[PubChemResult])
def pubchem_search(
    query: str = Query(min_length=1),
    _current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Search PubChem by molecule name or CAS number. Returns up to 10 results."""
    return search_pubchem(query)
