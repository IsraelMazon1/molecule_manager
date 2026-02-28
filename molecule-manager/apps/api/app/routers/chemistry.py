from fastapi import APIRouter, HTTPException, status

from app.schemas.chemistry import ChemistryPropertiesResponse, ValidateSMILESRequest
from app.services.chemistry import InvalidSMILESError, process_smiles

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
