from pydantic import BaseModel


class ValidateSMILESRequest(BaseModel):
    smiles: str


class ChemistryPropertiesResponse(BaseModel):
    canonical_smiles: str
    molecular_weight: float
    molecular_formula: str
    hbd: int
    hba: int
    tpsa: float
    rotatable_bonds: int
    svg_image: str
