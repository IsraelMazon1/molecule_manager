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


class PubChemResult(BaseModel):
    pubchem_cid: int
    name: str
    smiles: str
    molecular_formula: str
    molecular_weight: float
    iupac_name: str
